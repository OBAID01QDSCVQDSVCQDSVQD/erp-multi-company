import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Unit from '@/lib/models/Unit';

const DEFAULTS = [
  { code:'PIECE', libelle:'Pièce', symbole:'pc', categorie:'quantite', baseCategorie:'PIECE', facteurVersBase:1 },
  { code:'KG', libelle:'Kilogramme', symbole:'kg', categorie:'poids', baseCategorie:'G', facteurVersBase:1000 },
  { code:'L',  libelle:'Litre', symbole:'L', categorie:'volume', baseCategorie:'ML', facteurVersBase:1000 },
  { code:'M',  libelle:'Mètre', symbole:'m', categorie:'longueur', baseCategorie:'MM', facteurVersBase:1000 },
  { code:'M2', libelle:'Mètre carré', symbole:'m²', categorie:'surface', baseCategorie:'CM2', facteurVersBase:10000 },
  { code:'H',  libelle:'Heure', symbole:'h', categorie:'temps', baseCategorie:'MIN', facteurVersBase:60 },
];

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
    if (!tenantId) return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });

    await connectDB();
    const count = await (Unit as any).countDocuments({ tenantId });
    if (count > 0) {
      return NextResponse.json({ message: 'Unités locales déjà présentes' });
    }
    const docs = DEFAULTS.map(d => ({ ...d, tenantId, actif: true, estParDefaut: true }));
    await (Unit as any).insertMany(docs);
    return NextResponse.json({ message: 'Unités par défaut créées', created: docs.length });
  } catch (error) {
    console.error('Erreur POST /units/local/backfill', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}


