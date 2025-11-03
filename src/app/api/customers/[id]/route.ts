import { NextRequest, NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import Customer from '@/lib/models/Customer';

// GET /api/customers/:id - Détails d'un client
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectMongo();
    
    const tenantId = request.headers.get('X-Tenant-Id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 401 });
    }

    const customer = await (Customer as any).findOne({
      _id: params.id,
      tenantId,
      archive: false
    }).lean();

    if (!customer) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 });
    }

    return NextResponse.json(customer);
  } catch (error: any) {
    console.error('Erreur GET /customers/:id:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}

// PATCH /api/customers/:id - Modification d'un client
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectMongo();
    
    const tenantId = request.headers.get('X-Tenant-Id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 401 });
    }

    const body = await request.json();

    // Normaliser matricule fiscale
    if (body.matriculeFiscale) {
      body.matriculeFiscale = body.matriculeFiscale.toUpperCase().replace(/\s/g, '');
    }

    // Normaliser email
    if (body.email) {
      body.email = body.email.toLowerCase().trim();
    }

    const customer = await (Customer as any).findOneAndUpdate(
      { _id: params.id, tenantId },
      { $set: body },
      { new: true, runValidators: true }
    );

    if (!customer) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 });
    }

    return NextResponse.json(customer);
  } catch (error: any) {
    console.error('Erreur PATCH /customers/:id:', error);
    
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

// DELETE /api/customers/:id - Archivage d'un client
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectMongo();
    
    const tenantId = request.headers.get('X-Tenant-Id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 401 });
    }

    // Vérifier si le client a des documents liés (à implémenter)
    // Pour l'instant, on archive simplement

    const customer = await (Customer as any).findOneAndUpdate(
      { _id: params.id, tenantId },
      { $set: { archive: true, actif: false } },
      { new: true }
    );

    if (!customer) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Client archivé' });
  } catch (error: any) {
    console.error('Erreur DELETE /customers/:id:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}
