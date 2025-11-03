import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import GlobalUnit from '@/lib/models/GlobalUnit';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    await connectDB();
    const data = await (GlobalUnit as any).find({}).lean();
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Erreur GET /admin/global-units', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    const body = await request.json();
    const { code, libelle, symbole, categorie, baseCategorie, facteurVersBase, actif } = body;
    if (!code) return NextResponse.json({ error: 'Code requis' }, { status: 400 });
    await connectDB();
    const upserted = await (GlobalUnit as any).findOneAndUpdate(
      { code: code.toUpperCase() },
      { code: code.toUpperCase(), libelle, symbole, categorie, baseCategorie: baseCategorie.toUpperCase(), facteurVersBase, actif: actif !== false },
      { new: true, upsert: true }
    );
    return NextResponse.json(upserted, { status: 201 });
  } catch (error) {
    console.error('Erreur POST /admin/global-units', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}


