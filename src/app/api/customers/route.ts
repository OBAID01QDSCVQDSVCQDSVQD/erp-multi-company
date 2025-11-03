import { NextRequest, NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import Customer from '@/lib/models/Customer';

// GET /api/customers - Liste des clients avec filtres et pagination
export async function GET(request: NextRequest) {
  try {
    await connectMongo();
    
    const tenantId = request.headers.get('X-Tenant-Id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type');
    const actif = searchParams.get('actif');
    const bloque = searchParams.get('bloque');
    const ville = searchParams.get('ville');
    const gouvernorat = searchParams.get('gouvernorat');
    const commercialId = searchParams.get('commercialId');
    const tags = searchParams.get('tags')?.split(',') || [];
    const tri = searchParams.get('tri') || 'raisonSociale';
    const ordre = searchParams.get('ordre') || 'asc';

    const query: any = { tenantId, archive: false };

    // Filtres
    if (type) query.type = type;
    if (actif !== null) query.actif = actif === 'true';
    if (bloque !== null) query.bloque = bloque === 'true';
    if (commercialId) query.commercialId = commercialId;
    if (tags.length > 0) query.tags = { $in: tags };
    if (ville) {
      query.$or = [
        { 'adresseFacturation.ville': ville },
        { 'adresseLivraison.ville': ville }
      ];
    }
    if (gouvernorat) {
      query.$or = [
        { 'adresseFacturation.gouvernorat': gouvernorat },
        { 'adresseLivraison.gouvernorat': gouvernorat }
      ];
    }

    // Recherche textuelle
    if (q) {
      query.$text = { $search: q };
    }

    // Tri
    const sort: any = {};
    sort[tri] = ordre === 'desc' ? -1 : 1;

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Customer.find(query).sort(sort).skip(skip).limit(limit).lean(),
      Customer.countDocuments(query)
    ]);

    // Facets pour filtres
    const [villes, gouvernorats, commerciaux] = await Promise.all([
      Customer.distinct('adresseFacturation.ville', { tenantId, archive: false }),
      Customer.distinct('adresseFacturation.gouvernorat', { tenantId, archive: false }),
      Customer.distinct('commercialId', { tenantId, archive: false })
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      facets: {
        villes: villes.filter(Boolean),
        gouvernorats: gouvernorats.filter(Boolean),
        commerciaux: commerciaux.filter(Boolean)
      }
    });
  } catch (error: any) {
    console.error('Erreur GET /customers:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/customers - Création d'un client
export async function POST(request: NextRequest) {
  try {
    await connectMongo();
    
    const tenantId = request.headers.get('X-Tenant-Id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 401 });
    }

    const body = await request.json();

    // Validation
    if (body.type === 'societe' && !body.raisonSociale) {
      return NextResponse.json({ error: 'Raison sociale requise pour une société' }, { status: 400 });
    }
    if (body.type === 'particulier' && !body.nom) {
      return NextResponse.json({ error: 'Nom requis pour un particulier' }, { status: 400 });
    }

    // Normaliser matricule fiscale
    if (body.matriculeFiscale) {
      body.matriculeFiscale = body.matriculeFiscale.toUpperCase().replace(/\s/g, '');
    }

    // Normaliser email
    if (body.email) {
      body.email = body.email.toLowerCase().trim();
    }

    const customer = new Customer({
      ...body,
      tenantId,
      stats: { caCumule: 0, soldeDu: 0, nbFactures: 0 }
    });

    await (customer as any).save();

    return NextResponse.json(customer, { status: 201 });
  } catch (error: any) {
    console.error('Erreur POST /customers:', error);
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[1];
      return NextResponse.json(
        { error: `${field} déjà utilisé` },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}
