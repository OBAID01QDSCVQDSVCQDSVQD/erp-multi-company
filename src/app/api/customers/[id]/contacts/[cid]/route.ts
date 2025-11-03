import { NextRequest, NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import Customer from '@/lib/models/Customer';

// PATCH /api/customers/:id/contacts/:cid - Modifier un contact
export async function PATCH(request: NextRequest, { params }: { params: { id: string; cid: string } }) {
  try {
    await connectMongo();
    
    const tenantId = request.headers.get('X-Tenant-Id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 401 });
    }

    const body = await request.json();

    const updateObj: any = {};
    Object.keys(body).forEach(key => {
      updateObj[`contacts.$.${key}`] = body[key];
    });

    const customer = await (Customer as any).findOneAndUpdate(
      { _id: params.id, tenantId, 'contacts._id': params.cid },
      { $set: updateObj },
      { new: true }
    );

    if (!customer) {
      return NextResponse.json({ error: 'Client ou contact introuvable' }, { status: 404 });
    }

    return NextResponse.json(customer);
  } catch (error: any) {
    console.error('Erreur PATCH /customers/:id/contacts/:cid:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/customers/:id/contacts/:cid - Supprimer un contact
export async function DELETE(request: NextRequest, { params }: { params: { id: string; cid: string } }) {
  try {
    await connectMongo();
    
    const tenantId = request.headers.get('X-Tenant-Id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 401 });
    }

    const customer = await (Customer as any).findOneAndUpdate(
      { _id: params.id, tenantId },
      { $pull: { contacts: { _id: params.cid } } },
      { new: true }
    );

    if (!customer) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Contact supprimé', customer });
  } catch (error: any) {
    console.error('Erreur DELETE /customers/:id/contacts/:cid:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}
