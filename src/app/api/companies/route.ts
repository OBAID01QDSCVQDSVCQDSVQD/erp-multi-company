import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Company from '@/lib/models/Company';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();
    
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
    
    // Créer un objet company avec les champs requis
    const companyData = {
      name: body.name,
      code: body.code || body.name.substring(0, 3).toUpperCase(),
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
        taxNumber: body.taxNumber || '',
        registrationNumber: body.registrationNumber || '',
        vatNumber: body.vatNumber || '',
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
  } catch (error) {
    console.error('Erreur lors de la création de l\'entreprise:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
