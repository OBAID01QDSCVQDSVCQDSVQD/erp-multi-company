import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import GlobalUnit from '@/lib/models/GlobalUnit';

export async function PATCH(request: NextRequest, { params }: { params: { code: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    await connectDB();
    const body = await request.json();
    const update: any = {};
    for (const key of ['libelle','symbole','categorie','baseCategorie','facteurVersBase','actif']) {
      if (body[key] !== undefined) update[key] = key === 'baseCategorie' ? String(body[key]).toUpperCase() : body[key];
    }
    const updated = await (GlobalUnit as any).findOneAndUpdate({ code: params.code.toUpperCase() }, { $set: update }, { new: true });
    if (!updated) return NextResponse.json({ error: 'Unité globale non trouvée' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Erreur PATCH /admin/global-units/:code', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { code: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';
    await connectDB();
    // TODO: vérifier l'utilisation avant suppression si force=false
    if (!force) {
      // Sans référentiel d'usage ici, on refuse par défaut
      return NextResponse.json({ error: 'Suppression refusée (utilisation inconnue). Utiliser force=true.' }, { status: 400 });
    }
    await (GlobalUnit as any).findOneAndDelete({ code: params.code.toUpperCase() });
    return NextResponse.json({ message: 'Unité globale supprimée' });
  } catch (error) {
    console.error('Erreur DELETE /admin/global-units/:code', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}


