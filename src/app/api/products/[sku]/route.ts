import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Product from '@/lib/models/Product';

export async function GET(request: NextRequest, { params }: { params: { sku: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
    await connectDB();
    const item = await (Product as any).findOne({ tenantId, sku: params.sku.toUpperCase() }).lean();
    if (!item) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
    return NextResponse.json(item);
  } catch (e) {
    console.error('Erreur GET /products/:sku', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { sku: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
    const body = await request.json();
    await connectDB();
    const updated = await (Product as any).findOneAndUpdate({ tenantId, sku: params.sku.toUpperCase() }, { $set: body }, { new: true });
    if (!updated) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (e) {
    console.error('Erreur PATCH /products/:sku', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { sku: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
    await connectDB();
    const archived = await (Product as any).findOneAndUpdate({ tenantId, sku: params.sku.toUpperCase() }, { $set: { archive: true, actif: false } }, { new: true });
    if (!archived) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
    return NextResponse.json({ message: 'Archivé' });
  } catch (e) {
    console.error('Erreur DELETE /products/:sku', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}


