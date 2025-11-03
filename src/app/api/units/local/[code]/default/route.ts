import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Unit from '@/lib/models/Unit';

export async function POST(request: NextRequest, { params }: { params: { code: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
    if (!tenantId) return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });
    const { code } = params;

    await connectDB();
    const target = await (Unit as any).findOne({ tenantId, code: code.toUpperCase() });
    if (!target) return NextResponse.json({ error: 'Unité non trouvée' }, { status: 404 });

    // Set false for same category, then true for target
    await (Unit as any).updateMany({ tenantId, categorie: target.categorie }, { $set: { estParDefaut: false } });
    await (Unit as any).updateOne({ _id: target._id }, { $set: { estParDefaut: true } });

    const refreshed = await (Unit as any).findOne({ _id: target._id });
    return NextResponse.json(refreshed);
  } catch (error) {
    console.error('Erreur POST /units/local/:code/default', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}


