import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Unit from '@/lib/models/Unit';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
    if (!tenantId) return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });
    await connectDB();
    const units = await (Unit as any).find({ tenantId }).lean();
    return NextResponse.json({ data: units });
  } catch (error) {
    console.error('Erreur GET /units/local:', error);
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
    const { code, libelle, symbole, categorie, baseCategorie, facteurVersBase, actif } = body;
    if (!code || !libelle || !symbole || !categorie || !baseCategorie || !facteurVersBase || facteurVersBase <= 0) {
      return NextResponse.json({ error: 'Champs requis manquants ou invalides' }, { status: 400 });
    }
    await connectDB();
    const created = await (Unit as any).findOneAndUpdate(
      { tenantId, code: code.toUpperCase() },
      { code: code.toUpperCase(), tenantId, libelle, symbole, categorie, baseCategorie: baseCategorie.toUpperCase(), facteurVersBase, actif: actif !== false },
      { new: true, upsert: true }
    );
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Erreur POST /units/local:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}


