import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Unit from '@/lib/models/Unit';

export async function PATCH(request: NextRequest, { params }: { params: { code: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
    if (!tenantId) return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });
    const { code } = params;
    const body = await request.json();
    const update: any = {};
    for (const key of ['libelle','symbole','facteurVersBase','actif']) {
      if (body[key] !== undefined) update[key] = body[key];
    }
    await connectDB();
    const updated = await (Unit as any).findOneAndUpdate({ tenantId, code: code.toUpperCase() }, { $set: update }, { new: true });
    if (!updated) return NextResponse.json({ error: 'Unité non trouvée' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Erreur PATCH /units/local/:code', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { code: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
    if (!tenantId) return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });
    const { code } = params;
    await connectDB();
    const deleted = await (Unit as any).findOneAndDelete({ tenantId, code: code.toUpperCase() });
    if (!deleted) return NextResponse.json({ error: 'Unité non trouvée' }, { status: 404 });
    return NextResponse.json({ message: 'Unité supprimée' });
  } catch (error) {
    console.error('Erreur DELETE /units/local/:code', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}


