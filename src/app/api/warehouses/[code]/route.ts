import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Warehouse from '@/lib/models/Warehouse';

export async function PATCH(request: NextRequest, { params }: { params: { code: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
    if (!tenantId) return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });
    const body = await request.json();
    const update: any = {};
    for (const k of ['libelle','adresse','leadTimeJours','actif']) if (body[k] !== undefined) update[k] = body[k];
    await connectDB();
    const updated = await (Warehouse as any).findOneAndUpdate({ tenantId, code: params.code.toUpperCase() }, { $set: update }, { new: true });
    if (!updated) return NextResponse.json({ error: 'Entrepôt non trouvé' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (e) {
    console.error('Erreur PATCH /warehouses/:code', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { code: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
    if (!tenantId) return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });
    await connectDB();
    const deleted = await (Warehouse as any).findOneAndUpdate({ tenantId, code: params.code.toUpperCase() }, { $set: { actif: false } }, { new: true });
    if (!deleted) return NextResponse.json({ error: 'Entrepôt non trouvé' }, { status: 404 });
    return NextResponse.json({ message: 'Entrepôt désactivé' });
  } catch (e) {
    console.error('Erreur DELETE /warehouses/:code', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}


