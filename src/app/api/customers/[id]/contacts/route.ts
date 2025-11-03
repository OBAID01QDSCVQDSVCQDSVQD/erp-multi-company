import { NextRequest, NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import Customer from '@/lib/models/Customer';

// POST /api/customers/:id/contacts - Ajouter un contact
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectMongo();
    
    const tenantId = request.headers.get('X-Tenant-Id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 401 });
    }

    const body = await request.json();

    const customer = await (Customer as any).findOneAndUpdate(
      { _id: params.id, tenantId },
      { $push: { contacts: body } },
      { new: true }
    );

    if (!customer) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 });
    }

    return NextResponse.json(customer);
  } catch (error: any) {
    console.error('Erreur POST /customers/:id/contacts:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}

// GET /api/customers/:id/contacts - Lister les contacts
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectMongo();
    
    const tenantId = request.headers.get('X-Tenant-Id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 401 });
    }

    const customer = await (Customer as any).findOne({
      _id: params.id,
      tenantId
    }, 'contacts').lean();

    if (!customer) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 });
    }

    return NextResponse.json({ contacts: customer.contacts || [] });
  } catch (error: any) {
    console.error('Erreur GET /customers/:id/contacts:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}
