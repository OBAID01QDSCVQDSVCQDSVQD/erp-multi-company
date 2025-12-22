import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Company from '@/lib/models/Company';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    // Si on demande la company courante
    const { searchParams } = new URL(request.url);
    if (searchParams.get('current') === 'true') {
      console.log('=== API: GET COMPANY CURRENT ===');
      console.log('Session user:', JSON.stringify(session.user, null, 2));

      const companyIdString = session.user.companyId;
      console.log('Company ID from session:', companyIdString);

      // Convertir companyId en ObjectId si c'est une string
      const companyId = typeof companyIdString === 'string'
        ? new mongoose.Types.ObjectId(companyIdString)
        : companyIdString;

      console.log('Company ID (ObjectId):', companyId);

      const company = await (Company as any).findById(companyId)
        .select('-__v')
        .lean();

      console.log('Company found in database:', company ? 'YES' : 'NO');

      if (!company) {
        console.log('ERROR: Company not found in database');
        return NextResponse.json(
          { error: 'Entreprise non trouvée' },
          { status: 404 }
        );
      }

      // تحويل البيانات إلى البنية المتوقعة
      const formattedCompany = {
        _id: company._id,
        name: company.name || '',
        code: company.code || '',
        address: company.address || {
          street: '',
          city: '',
          postalCode: '',
          country: '',
        },
        contact: company.contact || {
          email: company.email || '',
          phone: company.phone || '',
          website: company.website || '',
        },
        fiscal: company.fiscal || {
          taxNumber: company.taxNumber || '',
          registrationNumber: company.registrationNumber || '',
          vatNumber: company.vatNumber || company.taxNumber || '',
        },
        enTete: company.enTete || {
          slogan: '',
          capitalSocial: '',
        },
        piedPage: company.piedPage || {
          texte: '',
          conditionsGenerales: '',
          mentionsLegales: '',
          coordonneesBancaires: {
            banque: '',
            rib: '',
            swift: '',
          },
        },
        settings: company.settings || {
          currency: 'TND',
          timezone: 'Africa/Tunis',
          language: 'fr',
          dateFormat: 'DD/MM/YYYY',
        },
        logoUrl: company.logoUrl || '',
        isActive: company.isActive !== undefined ? company.isActive : true,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt,
      };

      console.log('Company data to return (formatted):', JSON.stringify(formattedCompany, null, 2));
      console.log('================================');

      return NextResponse.json(formattedCompany);
    }

    const companies = await (Company as any).find({ isActive: true })
      .select('-__v')
      .sort({ createdAt: -1 });

    return NextResponse.json(companies);
  } catch (error) {
    console.error('Erreur lors de la récupération des entreprises:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    await connectDB();

    // Vérifier si une entreprise existe déjà
    const existingCompany = await (Company as any).findOne({
      $or: [
        { name: body.name },
        { 'contact.email': body.contact?.email || body.email }
      ]
    });

    if (existingCompany) {
      return NextResponse.json(
        { error: 'Une entreprise avec ce nom ou cet email existe déjà' },
        { status: 400 }
      );
    }

    // Générer un code unique pour l'entreprise
    let companyCode = body.code || body.name.substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (companyCode.length < 3) {
      companyCode = companyCode.padEnd(3, 'X');
    }

    // Vérifier si le code existe déjà et générer un nouveau code unique
    let codeExists = true;
    let counter = 1;
    let finalCode = companyCode;

    while (codeExists) {
      const existingCode = await (Company as any).findOne({ code: finalCode });
      if (!existingCode) {
        codeExists = false;
      } else {
        // Ajouter un numéro ou des caractères pour rendre le code unique
        const suffix = counter.toString().padStart(2, '0');
        finalCode = companyCode.substring(0, 3) + suffix;
        counter++;
        // Limite de sécurité pour éviter une boucle infinie
        if (counter > 999) {
          finalCode = companyCode + Date.now().toString().slice(-3);
          break;
        }
      }
    }

    // Créer un objet company avec les champs requis
    const companyData = {
      name: body.name,
      code: finalCode,
      address: {
        street: body.address?.street || '',
        city: body.address?.city || '',
        postalCode: body.address?.postalCode || '',
        country: body.address?.country || 'France',
      },
      contact: {
        email: body.email,
        phone: body.phone || '',
        website: body.website || '',
      },
      fiscal: {
        ...(body.taxNumber && { taxNumber: body.taxNumber }),
        ...(body.registrationNumber && { registrationNumber: body.registrationNumber }),
        ...(body.vatNumber && { vatNumber: body.vatNumber }),
      },
      settings: {
        currency: 'TND',
        timezone: 'Africa/Tunis',
        language: 'fr',
        dateFormat: 'DD/MM/YYYY',
      },
      isActive: true,
    };

    const company = new (Company as any)(companyData);
    await (company as any).save();

    // Create default CompanySettings
    const CompanySettings = (await import('@/lib/models/CompanySettings')).default;
    await (CompanySettings as any).create({
      tenantId: company._id,
      societe: {
        nom: companyData.name,
        adresse: {
          rue: companyData.address.street,
          ville: companyData.address.city,
          codePostal: companyData.address.postalCode,
          pays: companyData.address.country
        },
        // 'tva' field in societe schema (string, required) - likely Tax ID or VAT ID
        tva: companyData.fiscal.vatNumber || companyData.fiscal.taxNumber || 'N/A',
        enTete: {
          email: companyData.contact.email,
          telephone: companyData.contact.phone,
          siteWeb: companyData.contact.website,
          matriculeFiscal: companyData.fiscal.taxNumber,
          registreCommerce: companyData.fiscal.registrationNumber
        }
      },
      // Initialize all required sub-documents to trigger Mongoose defaults
      numerotation: {},
      ventes: {},
      achats: {},
      depenses: {},
      stock: {},
      securite: {},
      systeme: {},
      tva: {} // This is the TVA settings object (ITVA), distinct from societe.tva string
    });

    return NextResponse.json(company, { status: 201 });
  } catch (error: any) {
    console.error('Erreur lors de la création de l\'entreprise:', error);

    // Gérer les erreurs de validation Mongoose
    if (error.name === 'ValidationError') {
      const validationErrors: Record<string, string> = {};
      Object.keys(error.errors || {}).forEach((key) => {
        validationErrors[key] = error.errors[key].message;
      });
      return NextResponse.json(
        {
          error: 'Erreur de validation',
          validationErrors,
          message: Object.values(validationErrors).join(', ')
        },
        { status: 400 }
      );
    }

    // Gérer les erreurs de clé dupliquée MongoDB
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      return NextResponse.json(
        {
          error: `Une entreprise avec ce ${field === 'code' ? 'code' : field} existe déjà`,
          field
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    await connectDB();

    // Vérifier que l'utilisateur est admin
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Accès refusé. Seuls les administrateurs peuvent modifier les informations de l\'entreprise.' },
        { status: 403 }
      );
    }

    const companyIdString = session.user.companyId;

    // Convertir companyId en ObjectId si c'est une string
    const companyId = typeof companyIdString === 'string'
      ? new mongoose.Types.ObjectId(companyIdString)
      : companyIdString;

    console.log('Updating company:', companyId);
    console.log('Update data:', JSON.stringify(body, null, 2));

    // Vérifier si le nom ou l'email existe déjà pour une autre entreprise
    const emailToCheck = body.contact?.email || body.email;
    if (body.name || emailToCheck) {
      const existingCompany = await (Company as any).findOne({
        _id: { $ne: companyId },
        $or: [
          ...(body.name ? [{ name: body.name }] : []),
          ...(emailToCheck ? [{ 'contact.email': emailToCheck }] : [])
        ]
      });

      if (existingCompany) {
        return NextResponse.json(
          { error: 'Une entreprise avec ce nom ou cet email existe déjà' },
          { status: 400 }
        );
      }
    }

    // Préparer les données de mise à jour - merger avec les données existantes
    const currentCompany = await (Company as any).findById(companyId);
    if (!currentCompany) {
      return NextResponse.json(
        { error: 'Entreprise non trouvée' },
        { status: 404 }
      );
    }

    // تحديد قيم email و phone
    // أولاً: استخدام القيمة المرسلة إذا كانت موجودة وغير فارغة
    // ثانياً: استخدام القيمة الحالية من قاعدة البيانات
    // ثالثاً: إذا كانت كلاهما فارغة، نرجع خطأ واضح

    let emailValue = '';
    let phoneValue = '';

    // للبريد الإلكتروني
    const sentEmail = body.contact?.email?.trim() || '';
    const currentEmail = currentCompany.contact?.email?.trim() || '';

    if (sentEmail !== '') {
      emailValue = sentEmail;
    } else if (currentEmail !== '') {
      emailValue = currentEmail;
    } else {
      // كلاهما فارغة، نرجع خطأ
      return NextResponse.json(
        { error: 'L\'email de contact est requis. Veuillez remplir le champ email dans la section En-tête.' },
        { status: 400 }
      );
    }

    // للهاتف
    const sentPhone = body.contact?.phone?.trim() || '';
    const currentPhone = currentCompany.contact?.phone?.trim() || '';

    if (sentPhone !== '') {
      phoneValue = sentPhone;
    } else if (currentPhone !== '') {
      phoneValue = currentPhone;
    } else {
      // كلاهما فارغة، نرجع خطأ
      return NextResponse.json(
        { error: 'Le téléphone de contact est requis. Veuillez remplir le champ téléphone dans la section En-tête.' },
        { status: 400 }
      );
    }

    // Merger les données
    const updateData: any = {
      name: body.name || currentCompany.name,
      address: {
        street: body.address?.street || currentCompany.address?.street || '',
        city: body.address?.city || currentCompany.address?.city || '',
        postalCode: body.address?.postalCode || currentCompany.address?.postalCode || '',
        country: body.address?.country || currentCompany.address?.country || '',
      },
      contact: {
        email: emailValue,
        phone: phoneValue,
        website: body.contact?.website !== undefined ? body.contact.website : (currentCompany.contact?.website || ''),
      },
      fiscal: {
        taxNumber: body.fiscal?.taxNumber || currentCompany.fiscal?.taxNumber || '',
        registrationNumber: body.fiscal?.registrationNumber || currentCompany.fiscal?.registrationNumber || '',
        vatNumber: body.fiscal?.vatNumber || currentCompany.fiscal?.vatNumber || '',
      },
      enTete: {
        slogan: body.enTete?.slogan !== undefined ? body.enTete.slogan : (currentCompany.enTete?.slogan || ''),
        capitalSocial: body.enTete?.capitalSocial !== undefined ? body.enTete.capitalSocial : (currentCompany.enTete?.capitalSocial || ''),
      },
      piedPage: {
        texte: body.piedPage?.texte !== undefined ? body.piedPage.texte : (currentCompany.piedPage?.texte || ''),
        conditionsGenerales: body.piedPage?.conditionsGenerales !== undefined ? body.piedPage.conditionsGenerales : (currentCompany.piedPage?.conditionsGenerales || ''),
        mentionsLegales: body.piedPage?.mentionsLegales !== undefined ? body.piedPage.mentionsLegales : (currentCompany.piedPage?.mentionsLegales || ''),
        coordonneesBancaires: {
          banque: body.piedPage?.coordonneesBancaires?.banque !== undefined ? body.piedPage.coordonneesBancaires.banque : (currentCompany.piedPage?.coordonneesBancaires?.banque || ''),
          rib: body.piedPage?.coordonneesBancaires?.rib !== undefined ? body.piedPage.coordonneesBancaires.rib : (currentCompany.piedPage?.coordonneesBancaires?.rib || ''),
          swift: body.piedPage?.coordonneesBancaires?.swift !== undefined ? body.piedPage.coordonneesBancaires.swift : (currentCompany.piedPage?.coordonneesBancaires?.swift || ''),
        },
      },
      settings: {
        currency: body.settings?.currency || currentCompany.settings?.currency || 'TND',
        timezone: body.settings?.timezone || currentCompany.settings?.timezone || 'Africa/Tunis',
        language: body.settings?.language || currentCompany.settings?.language || 'fr',
        dateFormat: body.settings?.dateFormat || currentCompany.settings?.dateFormat || 'DD/MM/YYYY',
      },
      logoUrl: body.logoUrl !== undefined ? body.logoUrl : currentCompany.logoUrl,
    };

    console.log('Final update data:', JSON.stringify(updateData, null, 2));

    const updatedCompany = await (Company as any).findByIdAndUpdate(
      companyId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-__v');

    if (!updatedCompany) {
      return NextResponse.json(
        { error: 'Entreprise non trouvée' },
        { status: 404 }
      );
    }

    console.log('Company updated successfully');
    return NextResponse.json(updatedCompany);
  } catch (error: any) {
    console.error('Erreur lors de la mise à jour de l\'entreprise:', error);

    // Gérer les erreurs de validation Mongoose
    if (error.name === 'ValidationError') {
      const validationErrors: Record<string, string> = {};
      Object.keys(error.errors || {}).forEach((key) => {
        validationErrors[key] = error.errors[key].message;
      });
      return NextResponse.json(
        {
          error: 'Erreur de validation',
          validationErrors,
          message: Object.values(validationErrors).join(', ')
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}
