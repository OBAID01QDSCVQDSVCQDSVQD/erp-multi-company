import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Warehouse from '@/lib/models/Warehouse';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
    if (!tenantId) return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });
    await connectDB();
    const data = await (Warehouse as any).find({ tenantId }).lean();
    return NextResponse.json({ data });
  } catch (e) {
    console.error('Erreur GET /warehouses', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
    if (!tenantId) return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });
    const body = await request.json();
    const { code, libelle, adresse, leadTimeJours, actif } = body;
    if (!code || !libelle) return NextResponse.json({ error: 'Code et libellé requis' }, { status: 400 });
    await connectDB();
    const created = await (Warehouse as any).findOneAndUpdate(
      { tenantId, code: code.toUpperCase() },
      { tenantId, code: code.toUpperCase(), libelle, adresse, leadTimeJours: leadTimeJours ?? 1, actif: actif !== false },
      { new: true, upsert: true }
    );
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error('Erreur POST /warehouses', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}


