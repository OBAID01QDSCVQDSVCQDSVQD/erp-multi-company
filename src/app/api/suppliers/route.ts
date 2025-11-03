import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Supplier from '@/lib/models/Supplier';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const tenantId = session.user.companyId?.toString() || '';

    // Query parameters
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const actif = searchParams.get('actif');
    const ville = searchParams.get('ville');
    const ratingMin = searchParams.get('ratingMin');
    const risque = searchParams.get('risque');
    const tags = searchParams.get('tags')?.split(',') || [];
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build query
    const query: any = { tenantId };
    
    if (actif !== null) {
      query.actif = actif === 'true';
    }
    
    if (ville) {
      query['adresseFacturation.ville'] = ville;
    }
    
    if (ratingMin) {
      query['rating.noteGlobale'] = { $gte: parseFloat(ratingMin) };
    }
    
    if (risque) {
      query.risque = risque;
    }
    
    if (tags.length > 0) {
      query.tags = { $in: tags };
    }

    // Text search
    if (q) {
      query.$text = { $search: q };
    }

    // Execute query
    const suppliers = await (Supplier as any).find(query)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await (Supplier as any).countDocuments(query);

    // Facets
    const [villes, gouvernorats, risques, allTags] = await Promise.all([
      Supplier.distinct('adresseFacturation.ville', { tenantId }),
      Supplier.distinct('adresseFacturation.gouvernorat', { tenantId }),
      Supplier.distinct('risque', { tenantId }),
      Supplier.distinct('tags', { tenantId })
    ]);

    return NextResponse.json({
      items: suppliers,
      total,
      facets: {
        villes,
        gouvernorats,
        risques,
        tags: allTags.filter(t => t)
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des fournisseurs:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    
    await connectDB();

    const tenantId = session.user.companyId?.toString() || '';
    
    // Validate required fields based on type
    if (body.type === 'societe' && !body.raisonSociale) {
      return NextResponse.json(
        { error: 'La raison sociale est requise pour une société' },
        { status: 400 }
      );
    }

    // Normalize matricule fiscale
    if (body.matriculeFiscale) {
      // Remove all non-alphanumeric characters except letters and numbers
      const cleaned = body.matriculeFiscale.toUpperCase().replace(/[^A-Z0-9]/g, '');
      
      // Extract pattern: 7 digits + 1 letter + 3 digits
      const match = cleaned.match(/^(\d{7})([A-Z])(\d{3})$/);
      
      if (match) {
        body.matriculeFiscale = match[1] + match[2] + match[3];
      } else {
        // If format is invalid, accept as is (optional field)
        body.matriculeFiscale = cleaned;
      }
    }

    // Check for duplicates
    const existing = await (Supplier as any).findOne({
      tenantId,
      $or: [
        ...(body.matriculeFiscale ? [{ matriculeFiscale: body.matriculeFiscale }] : []),
        ...(body.email ? [{ email: body.email }] : [])
      ]
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Un fournisseur avec ces informations existe déjà' },
        { status: 400 }
      );
    }

    // Clean empty addresses
    if (body.adresseLivraison && (!body.adresseLivraison.ligne1 || !body.adresseLivraison.ville)) {
      delete body.adresseLivraison;
    }

    // Calculate rating.noteGlobale if sub-ratings exist
    if (body.rating) {
      const { qualite, delai, prix, service } = body.rating;
      const notes = [qualite, delai, prix, service].filter(n => n !== undefined);
      if (notes.length > 0) {
        body.rating.noteGlobale = notes.reduce((a, b) => a + b, 0) / notes.length;
      }
    }

    const supplier = new Supplier({
      ...body,
      tenantId,
      createdBy: session.user.email
    });

    await (supplier as any).save();

    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    console.error('Erreur lors de la création du fournisseur:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}
