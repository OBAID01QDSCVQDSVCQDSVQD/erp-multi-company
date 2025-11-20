import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import PurchaseInvoice from '@/lib/models/PurchaseInvoice';
import Supplier from '@/lib/models/Supplier';
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

    const tenantId = session.user.companyId?.toString() || '';
    const invoice = await (PurchaseInvoice as any).findOne({
      _id: id,
      societeId: tenantId,
    }).lean();

    if (!invoice) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 });
    }

    // Ensure default values
    const normalizedInvoice = {
      ...invoice,
      fodec: {
        enabled: invoice.fodec?.enabled ?? false,
        tauxPct: invoice.fodec?.tauxPct ?? 1,
        montant: invoice.fodec?.montant ?? 0,
      },
      timbre: {
        enabled: invoice.timbre?.enabled ?? true,
        montant: invoice.timbre?.montant ?? 1.000,
      },
      totaux: {
        ...invoice.totaux,
        totalRemise: invoice.totaux?.totalRemise ?? 0,
        totalFodec: invoice.totaux?.totalFodec ?? 0,
        totalTimbre: invoice.totaux?.totalTimbre ?? 0,
      },
    };

    return NextResponse.json(normalizedInvoice);
  } catch (error) {
    console.error('Erreur GET /api/purchases/invoices/[id]:', error);
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
  let body: any = null;
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    const tenantId = session.user.companyId?.toString() || '';
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });
    }
    
    body = await request.json();

    const invoice = await (PurchaseInvoice as any).findOne({
      _id: id,
      societeId: tenantId,
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 });
    }

    // Allow status change for any status (except PAYEE and ANNULEE)
    // But only allow other field updates if status is BROUILLON
    // Exception: images can always be added/updated (for adding check/virement images)
    const isStatusOnlyUpdate = Object.keys(body).length === 1 && body.statut !== undefined;
    const isImagesOnlyUpdate = Object.keys(body).length === 1 && body.images !== undefined;
    const hasOtherFields = Object.keys(body).some(key => key !== 'statut' && key !== 'images');

    // If updating other fields (not just status or images), check if invoice is BROUILLON
    if (hasOtherFields && invoice.statut !== 'BROUILLON') {
      return NextResponse.json(
        { error: 'Impossible de modifier une facture qui n\'est pas en brouillon' },
        { status: 400 }
      );
    }

    // Prevent status changes for PAYEE and ANNULEE
    if (body.statut !== undefined && (invoice.statut === 'PAYEE' || invoice.statut === 'ANNULEE')) {
      return NextResponse.json(
        { error: 'Impossible de modifier le statut d\'une facture payée ou annulée' },
        { status: 400 }
      );
    }

    // Update fields
    if (body.dateFacture !== undefined) {
      invoice.dateFacture = new Date(body.dateFacture);
    }
    if (body.referenceFournisseur !== undefined) {
      invoice.referenceFournisseur = body.referenceFournisseur;
    }
    if (body.fournisseurId !== undefined) {
      invoice.fournisseurId = body.fournisseurId;
      // Update supplier name if changed
      if (body.fournisseurId) {
        const supplier = await (Supplier as any).findOne({
          _id: body.fournisseurId,
          tenantId: tenantId,
        });
        if (supplier) {
          invoice.fournisseurNom = supplier.raisonSociale || `${supplier.nom || ''} ${supplier.prenom || ''}`.trim();
        }
      } else if (body.fournisseurNom !== undefined) {
        invoice.fournisseurNom = body.fournisseurNom;
      }
    } else if (body.fournisseurNom !== undefined) {
      invoice.fournisseurNom = body.fournisseurNom;
    }
    if (body.devise !== undefined) {
      invoice.devise = body.devise;
    }
    if (body.tauxChange !== undefined) {
      invoice.tauxChange = body.tauxChange;
    }
    if (body.conditionsPaiement !== undefined) {
      invoice.conditionsPaiement = body.conditionsPaiement;
    }
    if (body.lignes !== undefined) {
      invoice.lignes = body.lignes.map((line: any) => {
        // Calculate totalLigneHT if not provided
        let totalLigneHT = 0;
        if (line.prixUnitaireHT && line.quantite > 0) {
          let prixAvecRemise = line.prixUnitaireHT;
          const remisePct = line.remisePct || 0;
          if (remisePct > 0) {
            prixAvecRemise = prixAvecRemise * (1 - remisePct / 100);
          }
          totalLigneHT = prixAvecRemise * line.quantite;
        }
        
        return {
          produitId: line.produitId || undefined,
          designation: line.designation || '',
          quantite: parseFloat(line.quantite) || 0,
          prixUnitaireHT: parseFloat(line.prixUnitaireHT) || 0,
          remisePct: parseFloat(line.remisePct) || 0,
          tvaPct: parseFloat(line.tvaPct) || 0,
          fodecPct: parseFloat(line.fodecPct) || 0,
          totalLigneHT: line.totalLigneHT || totalLigneHT,
        };
      });
    }
    if (body.fodec !== undefined) {
      invoice.fodec = {
        enabled: body.fodec.enabled ?? false,
        tauxPct: body.fodec.tauxPct ?? 1,
        montant: 0,
      };
    }
    if (body.timbre !== undefined) {
      invoice.timbre = {
        enabled: body.timbre.enabled ?? true,
        montant: body.timbre.montant ?? 1.000,
      };
    }
    if (body.bonsReceptionIds !== undefined) {
      invoice.bonsReceptionIds = body.bonsReceptionIds;
    }
    if (body.fichiers !== undefined) {
      invoice.fichiers = body.fichiers;
    }
    if (body.images !== undefined) {
      // Force Mongoose to recognize images as modified
      invoice.images = [];
      if (Array.isArray(body.images) && body.images.length > 0) {
        body.images.forEach((img: any) => {
          invoice.images.push({
            id: img.id || `${Date.now()}-${Math.random()}`,
            name: img.name || '',
            url: img.url || '',
            publicId: img.publicId || undefined,
            type: img.type || 'image/jpeg',
            size: img.size || 0,
            width: img.width || undefined,
            height: img.height || undefined,
            format: img.format || undefined,
          });
        });
      }
      (invoice as any).markModified('images');
    }
    if (body.notes !== undefined) {
      invoice.notes = body.notes;
    }
    if (body.statut !== undefined) {
      invoice.statut = body.statut;
    }

    // Check if status is being changed to VALIDEE
    const isStatusChangeToValidee = body.statut === 'VALIDEE' && invoice.statut !== 'VALIDEE';

    // Totals will be recalculated by pre-save hook
    await invoice.save();

    // Create stock movements if status changed to VALIDEE
    if (isStatusChangeToValidee || invoice.statut === 'VALIDEE') {
      await createStockMovementsForPurchaseInvoice(id, tenantId, session.user.email || '');
    }

    // Fetch updated invoice with all fields
    const updatedInvoice = await (PurchaseInvoice as any).findOne({
      _id: id,
      societeId: tenantId,
    }).lean();

    if (!updatedInvoice) {
      return NextResponse.json({ error: 'Facture non trouvée après mise à jour' }, { status: 404 });
    }

    // Normalize response
    const normalizedInvoice = {
      ...updatedInvoice,
      fodec: {
        enabled: updatedInvoice.fodec?.enabled ?? false,
        tauxPct: updatedInvoice.fodec?.tauxPct ?? 1,
        montant: updatedInvoice.fodec?.montant ?? 0,
      },
      timbre: {
        enabled: updatedInvoice.timbre?.enabled ?? true,
        montant: updatedInvoice.timbre?.montant ?? 1.000,
      },
      totaux: {
        ...updatedInvoice.totaux,
        totalRemise: updatedInvoice.totaux?.totalRemise ?? 0,
        totalFodec: updatedInvoice.totaux?.totalFodec ?? 0,
        totalTimbre: updatedInvoice.totaux?.totalTimbre ?? 0,
      },
    };

    return NextResponse.json(normalizedInvoice);
  } catch (error) {
    console.error('Erreur PUT /api/purchases/invoices/[id]:', error);
    console.error('Error stack:', (error as Error).stack);
    if (body) {
      console.error('Request body:', JSON.stringify(body, null, 2));
    } else {
      console.error('Request body: Not parsed yet');
    }
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
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

    const tenantId = session.user.companyId?.toString() || '';
    const invoice = await (PurchaseInvoice as any).findOne({
      _id: id,
      societeId: tenantId,
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 });
    }

    // Only allow deletion if status is BROUILLON
    if (invoice.statut !== 'BROUILLON') {
      return NextResponse.json(
        { error: 'Impossible de supprimer une facture qui n\'est pas en brouillon' },
        { status: 400 }
      );
    }

    await (PurchaseInvoice as any).deleteOne({ _id: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur DELETE /api/purchases/invoices/[id]:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// Helper function to create stock movements for a purchase invoice
async function createStockMovementsForPurchaseInvoice(invoiceId: string, tenantId: string, createdBy: string) {
  try {
    const invoice = await (PurchaseInvoice as any).findOne({
      _id: invoiceId,
      societeId: tenantId,
    }).lean();

    if (!invoice || invoice.statut !== 'VALIDEE') {
      return;
    }

    // Check if stock movements already exist for this invoice
    const existingMovements = await (MouvementStock as any).find({
      societeId: tenantId,
      source: 'FAC',
      sourceId: invoiceId,
    });

    if (existingMovements.length > 0) {
      // Movements already exist, skip
      return;
    }

    // Create stock movements for each line with quantite > 0 and produitId
    const stockMovements = [];
    if (invoice.lignes && invoice.lignes.length > 0) {
      for (const ligne of invoice.lignes) {
        if (ligne.quantite > 0 && ligne.produitId) {
          const mouvement = new MouvementStock({
            societeId: tenantId,
            productId: ligne.produitId.toString(),
            type: 'ENTREE',
            qte: ligne.quantite,
            date: invoice.dateFacture || new Date(),
            source: 'FAC',
            sourceId: invoiceId,
            notes: `Facture d'achat ${invoice.numero} - ${ligne.designation || ''}`,
            createdBy,
          });
          stockMovements.push(mouvement);
        }
      }
    }

    // Save all stock movements
    if (stockMovements.length > 0) {
      await MouvementStock.insertMany(stockMovements);
    }
  } catch (error) {
    console.error('Erreur lors de la création des mouvements de stock pour la facture d\'achat:', error);
    // Don't throw error, just log it
  }
}

