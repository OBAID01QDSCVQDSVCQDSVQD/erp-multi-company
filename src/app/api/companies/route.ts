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
      const companyIdString = session.user.companyId;
      
      // Convertir companyId إلى ObjectId إذا كان string
      const companyId = typeof companyIdString === 'string' 
        ? new mongoose.Types.ObjectId(companyIdString)
        : companyIdString;
      
      const company = await (Company as any).findById(companyId)
        .select('-__v')
        .lean();
      
      if (!company) {
        return NextResponse.json(
          { error: 'Entreprise non trouvée' },
          { status: 404 }
        );
      }
      
      return NextResponse.json(company);
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
        currency: 'EUR',
        timezone: 'Europe/Paris',
        language: 'fr',
        dateFormat: 'DD/MM/YYYY',
      },
      isActive: true,
    };
    
    const company = new (Company as any)(companyData);
    await (company as any).save();

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
    
    // Convertir companyId إلى ObjectId إذا كان string
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

    // Préparer les données de mise à jour - merger avec البيانات الموجودة
    const currentCompany = await (Company as any).findById(companyId);
    if (!currentCompany) {
      return NextResponse.json(
        { error: 'Entreprise non trouvée' },
        { status: 404 }
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
        email: body.contact?.email || currentCompany.contact?.email || '',
        phone: body.contact?.phone || currentCompany.contact?.phone || '',
        website: body.contact?.website || currentCompany.contact?.website || '',
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
        currency: body.settings?.currency || currentCompany.settings?.currency || 'EUR',
        timezone: body.settings?.timezone || currentCompany.settings?.timezone || 'Europe/Paris',
        language: body.settings?.language || currentCompany.settings?.language || 'fr',
        dateFormat: body.settings?.dateFormat || currentCompany.settings?.dateFormat || 'DD/MM/YYYY',
      },
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
