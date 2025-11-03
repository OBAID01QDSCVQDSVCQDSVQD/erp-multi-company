import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import TaxRate from '@/lib/models/TaxRate';

// PATCH /api/tva/rates/[code] - Modifier un taux de TVA
export async function PATCH(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
    const { code } = params;
    
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });
    }

    const body = await request.json();
    const { libelle, tauxPct, applicableA, actif } = body;

    await connectDB();

    // Vérifier que le taux existe
    const existingRate = await (TaxRate as any).findOne({ tenantId, code: code.toUpperCase() });
    if (!existingRate) {
      return NextResponse.json(
        { error: 'Taux de TVA non trouvé' },
        { status: 404 }
      );
    }

    // Validation des données
    if (tauxPct !== undefined && (tauxPct < 0 || tauxPct > 100)) {
      return NextResponse.json(
        { error: 'Le taux doit être entre 0 et 100' },
        { status: 400 }
      );
    }

    // Mise à jour
    const updateData: any = {};
    if (libelle !== undefined) updateData.libelle = libelle;
    if (tauxPct !== undefined) updateData.tauxPct = tauxPct;
    if (applicableA !== undefined) updateData.applicableA = applicableA;
    if (actif !== undefined) updateData.actif = actif;

    const updatedRate = await (TaxRate as any).findOneAndUpdate(
      { tenantId, code: code.toUpperCase() },
      { $set: updateData, $unset: { deductiblePctVentes: '', deductiblePctAchats: '' } },
      { new: true }
    );

    return NextResponse.json(updatedRate);

  } catch (error) {
    console.error('Erreur lors de la mise à jour du taux TVA:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// DELETE /api/tva/rates/[code] - Supprimer un taux de TVA
export async function DELETE(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
    const { code } = params;
    
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });
    }

    await connectDB();

    // Vérifier que le taux existe
    const existingRate = await (TaxRate as any).findOne({ tenantId, code: code.toUpperCase() });
    if (!existingRate) {
      return NextResponse.json(
        { error: 'Taux de TVA non trouvé' },
        { status: 404 }
      );
    }

    // Supprimer le taux
    await (TaxRate as any).findOneAndDelete({ tenantId, code: code.toUpperCase() });

    return NextResponse.json({ message: 'Taux de TVA supprimé' });

  } catch (error) {
    console.error('Erreur lors de la suppression du taux TVA:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
