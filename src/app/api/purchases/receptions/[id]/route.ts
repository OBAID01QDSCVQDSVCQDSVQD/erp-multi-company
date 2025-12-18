import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Reception from '@/lib/models/Reception';
import MouvementStock from '@/lib/models/MouvementStock';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId?.toString() || '';

    const reception = await (Reception as any).findOne({
      _id: id,
      societeId: tenantId,
    }).lean();

    if (!reception) {
      return NextResponse.json(
        { error: 'Bon de réception non trouvé' },
        { status: 404 }
      );
    }

    // Ensure FODEC and TIMBRE fields exist with default values for old documents
    if (reception.fodecActif === undefined) {
      reception.fodecActif = false;
    }
    if (reception.tauxFodec === undefined) {
      reception.tauxFodec = 1;
    }
    if (reception.timbreActif === undefined) {
      reception.timbreActif = true;
    }
    if (reception.montantTimbre === undefined) {
      reception.montantTimbre = 1.000;
    }

    // Ensure totaux.fodec and totaux.timbre exist
    if (!reception.totaux) {
      reception.totaux = {};
    }
    if (reception.totaux.fodec === undefined) {
      reception.totaux.fodec = 0;
    }
    if (reception.totaux.timbre === undefined) {
      reception.totaux.timbre = 0;
    }

    // Ensure remisePct exists for all lines (default to 0 if missing)
    if (reception.lignes && Array.isArray(reception.lignes)) {
      reception.lignes = reception.lignes.map((ligne: any) => {
        if (ligne.remisePct === undefined || ligne.remisePct === null) {
          ligne.remisePct = 0;
        }
        return ligne;
      });
    }

    return NextResponse.json(reception);
  } catch (error) {
    console.error('Erreur GET /purchases/receptions/[id]:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    await connectDB();

    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId?.toString() || '';

    // Check if reception exists
    const existingReception = await (Reception as any).findOne({
      _id: id,
      societeId: tenantId,
    });

    if (!existingReception) {
      return NextResponse.json(
        { error: 'Bon de réception non trouvé' },
        { status: 404 }
      );
    }

    // Validate qteRecue >= 0
    if (body.lignes) {
      for (const ligne of body.lignes) {
        if (ligne.qteRecue < 0) {
          return NextResponse.json(
            { error: 'La quantité reçue ne peut pas être négative' },
            { status: 400 }
          );
        }
      }
    }

    // Check if status is being changed to VALIDE
    const isStatusChangeToValide = body.statut === 'VALIDE' && existingReception.statut !== 'VALIDE';

    // Prepare update data
    const updateData: any = {
      dateDoc: body.dateDoc ? new Date(body.dateDoc) : existingReception.dateDoc,
      fournisseurId: body.fournisseurId || existingReception.fournisseurId,
      fournisseurNom: body.fournisseurNom || existingReception.fournisseurNom,
      lignes: body.lignes || existingReception.lignes,
      fodecActif: body.fodecActif !== undefined ? body.fodecActif : existingReception.fodecActif,
      tauxFodec: body.tauxFodec !== undefined ? body.tauxFodec : existingReception.tauxFodec,
      timbreActif: body.timbreActif !== undefined ? body.timbreActif : existingReception.timbreActif,
      montantTimbre: body.montantTimbre !== undefined ? body.montantTimbre : existingReception.montantTimbre,
      remiseGlobalePct: body.remiseGlobalePct !== undefined ? body.remiseGlobalePct : (existingReception.remiseGlobalePct || 0),
      notes: body.notes !== undefined ? body.notes : existingReception.notes,
      statut: body.statut || existingReception.statut,
    };

    // Calculate totaux (same logic as in ReceptionSchema.pre('save'))
    const lignes = updateData.lignes || [];
    let totalHTBeforeDiscount = 0;
    let totalHTAfterLineDiscount = 0;
    let totalTVA = 0;

    // Calculate TotalHT before and after line remise
    lignes.forEach((ligne: any) => {
      if (ligne.prixUnitaireHT && ligne.qteRecue > 0) {
        const lineHTBeforeDiscount = ligne.prixUnitaireHT * ligne.qteRecue;
        totalHTBeforeDiscount += lineHTBeforeDiscount;

        // Apply line remise if exists
        let prixAvecRemise = ligne.prixUnitaireHT;
        const remisePct = ligne.remisePct || 0;
        if (remisePct > 0) {
          prixAvecRemise = prixAvecRemise * (1 - remisePct / 100);
        }
        const ligneHT = prixAvecRemise * ligne.qteRecue;
        ligne.totalLigneHT = ligneHT;
        totalHTAfterLineDiscount += ligneHT;
      } else {
        ligne.totalLigneHT = ligne.totalLigneHT || 0;
        totalHTBeforeDiscount += (ligne.prixUnitaireHT || 0) * (ligne.qteRecue || 0);
        totalHTAfterLineDiscount += ligne.totalLigneHT;
      }
    });

    // Apply global remise
    const remiseGlobalePct = updateData.remiseGlobalePct || 0;
    const totalHT = totalHTAfterLineDiscount * (1 - (remiseGlobalePct / 100));

    // Calculate FODEC (on totalHT after all discounts)
    const fodecActif = updateData.fodecActif || false;
    const tauxFodec = updateData.tauxFodec || 1;
    const fodec = fodecActif ? totalHT * (tauxFodec / 100) : 0;

    // Calculate TVA (base includes FODEC if active, after global remise)
    lignes.forEach((ligne: any) => {
      if (ligne.prixUnitaireHT && ligne.qteRecue > 0 && ligne.tvaPct) {
        // Apply line remise
        let prixAvecRemise = ligne.prixUnitaireHT;
        const remisePct = ligne.remisePct || 0;
        if (remisePct > 0) {
          prixAvecRemise = prixAvecRemise * (1 - remisePct / 100);
        }
        const ligneHT = prixAvecRemise * ligne.qteRecue;
        // Apply global remise to line HT for TVA calculation
        const lineHTAfterGlobalRemise = ligneHT * (1 - (remiseGlobalePct / 100));
        // Calculate FODEC proportion for this line
        const ligneFodec = fodecActif ? lineHTAfterGlobalRemise * (tauxFodec / 100) : 0;
        const ligneBaseTVA = lineHTAfterGlobalRemise + ligneFodec;
        const ligneTVA = ligneBaseTVA * (ligne.tvaPct / 100);
        totalTVA += ligneTVA;
      } else if (ligne.totalLigneHT && ligne.tvaPct) {
        // Apply global remise to existing totalLigneHT
        const lineHTAfterGlobalRemise = ligne.totalLigneHT * (1 - (remiseGlobalePct / 100));
        const ligneFodec = fodecActif ? lineHTAfterGlobalRemise * (tauxFodec / 100) : 0;
        const ligneBaseTVA = lineHTAfterGlobalRemise + ligneFodec;
        const ligneTVA = ligneBaseTVA * (ligne.tvaPct / 100);
        totalTVA += ligneTVA;
      }
    });

    // Calculate TIMBRE
    const timbreActif = updateData.timbreActif !== undefined ? updateData.timbreActif : true;
    const montantTimbre = updateData.montantTimbre || 1.000;
    const timbre = timbreActif ? montantTimbre : 0;

    // Calculate TotalTTC
    const totalTTC = totalHT + fodec + totalTVA + timbre;

    updateData.totaux = {
      totalHT,
      fodec,
      totalTVA,
      timbre,
      totalTTC,
    };

    // Update reception
    const updatedReception = await (Reception as any).findOneAndUpdate(
      { _id: id, societeId: tenantId },
      { $set: updateData },
      { new: true }
    );

    if (!updatedReception) {
      return NextResponse.json(
        { error: 'Bon de réception non trouvé ou ne peut pas être modifié' },
        { status: 404 }
      );
    }

    // Handle stock movements
    if (isStatusChangeToValide) {
      // Create stock movements when status changes to VALIDE for the first time
      await createStockMovementsForReception(id, tenantId, session.user.email || '');
    } else if (updatedReception.statut === 'VALIDE') {
      // If BR is already VALIDE and quantities are being updated, update stock movements
      await updateStockMovementsForReception(id, tenantId, existingReception, updatedReception, session.user.email || '');
    }

    return NextResponse.json(updatedReception);
  } catch (error) {
    console.error('Erreur PUT /purchases/receptions/[id]:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // PATCH uses the same logic as PUT
  return PUT(request, { params });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId?.toString() || '';

    // Check if reception exists and is in BROUILLON status
    const existingReception = await (Reception as any).findOne({
      _id: id,
      societeId: tenantId,
    });

    if (!existingReception) {
      return NextResponse.json(
        { error: 'Bon de réception non trouvé' },
        { status: 404 }
      );
    }

    if (existingReception.statut !== 'BROUILLON') {
      return NextResponse.json(
        { error: 'Seuls les brouillons peuvent être supprimés' },
        { status: 400 }
      );
    }

    // Delete reception
    await (Reception as any).findOneAndDelete({
      _id: id,
      societeId: tenantId,
      statut: 'BROUILLON',
    });

    return NextResponse.json({ message: 'Bon de réception supprimé' });
  } catch (error) {
    console.error('Erreur DELETE /purchases/receptions/[id]:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// Helper function to create stock movements for a reception
async function createStockMovementsForReception(receptionId: string, tenantId: string, createdBy: string) {
  try {
    const reception = await (Reception as any).findOne({
      _id: receptionId,
      societeId: tenantId,
    }).lean();

    if (!reception || reception.statut !== 'VALIDE') {
      return;
    }

    // Check if stock movements already exist for this reception
    const existingMovements = await (MouvementStock as any).find({
      societeId: tenantId,
      source: 'BR',
      sourceId: receptionId,
    });

    if (existingMovements.length > 0) {
      // Movements already exist, skip
      return;
    }

    // Create stock movements for each line with qteRecue > 0
    const stockMovements = [];
    if (reception.lignes && reception.lignes.length > 0) {
      for (const ligne of reception.lignes) {
        if (ligne.qteRecue > 0 && ligne.productId) {
          const mouvement = new MouvementStock({
            societeId: tenantId,
            productId: ligne.productId.toString(),
            type: 'ENTREE',
            qte: ligne.qteRecue,
            date: reception.dateDoc || new Date(),
            source: 'BR',
            sourceId: receptionId,
            notes: `Réception ${reception.numero} - ${ligne.designation || ''}`,
            createdBy,
          });
          stockMovements.push(mouvement);
        }
      }
    }

    // Save all stock movements
    if (stockMovements.length > 0) {
      await (MouvementStock as any).insertMany(stockMovements);
    }
  } catch (error) {
    console.error('Erreur lors de la création des mouvements de stock pour la réception:', error);
    // Don't throw error, just log it
  }
}

// Helper function to update stock movements when BR quantities are modified
async function updateStockMovementsForReception(
  receptionId: string,
  tenantId: string,
  oldReception: any,
  newReception: any,
  updatedBy: string
) {
  try {
    // Get the reception with all fields to ensure we have numero
    const reception = await (Reception as any).findOne({
      _id: receptionId,
      societeId: tenantId,
    }).lean();

    if (!reception || reception.statut !== 'VALIDE') {
      return;
    }

    // Delete all existing stock movements for this reception
    await (MouvementStock as any).deleteMany({
      societeId: tenantId,
      source: 'BR',
      sourceId: receptionId,
    });

    // Create new stock movements with updated quantities
    const stockMovements = [];
    if (reception.lignes && reception.lignes.length > 0) {
      for (const ligne of reception.lignes) {
        if (ligne.qteRecue > 0 && ligne.productId) {
          const mouvement = new MouvementStock({
            societeId: tenantId,
            productId: ligne.productId.toString(),
            type: 'ENTREE',
            qte: ligne.qteRecue,
            date: reception.dateDoc || new Date(),
            source: 'BR',
            sourceId: receptionId,
            notes: `Réception ${reception.numero} - ${ligne.designation || ''}`,
            createdBy: updatedBy,
          });
          stockMovements.push(mouvement);
        }
      }
    }

    // Save all new stock movements
    if (stockMovements.length > 0) {
      await (MouvementStock as any).insertMany(stockMovements);
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour des mouvements de stock pour la réception:', error);
    // Don't throw error, just log it
  }
}
