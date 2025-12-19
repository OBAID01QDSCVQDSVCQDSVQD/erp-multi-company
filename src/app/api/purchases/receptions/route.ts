import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Reception from '@/lib/models/Reception';
import PurchaseOrder from '@/lib/models/PurchaseOrder';
import Supplier from '@/lib/models/Supplier';
import Product from '@/lib/models/Product';
import MouvementStock from '@/lib/models/MouvementStock';
import { NumberingService } from '@/lib/services/NumberingService';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId?.toString() || '';
    const { searchParams } = new URL(request.url);

    const search = searchParams.get('search');
    const statut = searchParams.get('statut');
    const fournisseurId = searchParams.get('fournisseurId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const query: any = { societeId: tenantId };

    if (statut) {
      query.statut = statut;
    }

    if (fournisseurId) {
      query.fournisseurId = fournisseurId;
    }

    if (dateFrom || dateTo) {
      query.dateDoc = {};
      if (dateFrom) {
        query.dateDoc.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        query.dateDoc.$lte = toDate;
      }
    }

    if (search) {
      query.$or = [
        { numero: { $regex: search, $options: 'i' } },
        { fournisseurNom: { $regex: search, $options: 'i' } },
      ];
    }

    const receptions = await (Reception as any).find(query)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await (Reception as any).countDocuments(query);

    // Ensure FODEC and TIMBRE fields exist with default values for old documents
    const normalizedReceptions = receptions.map((reception: any) => {
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
      if (!reception.totaux) {
        reception.totaux = {};
      }
      if (reception.totaux.fodec === undefined) {
        reception.totaux.fodec = 0;
      }
      if (reception.totaux.timbre === undefined) {
        reception.totaux.timbre = 0;
      }
      return reception;
    });

    return NextResponse.json({ items: normalizedReceptions, total, page, limit });
  } catch (error) {
    console.error('Erreur GET /purchases/receptions:', error);
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
            warehouseId: reception.warehouseId,
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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    await connectDB();

    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId?.toString() || '';

    // Check Subscription Limit
    const { checkSubscriptionLimit } = await import('@/lib/subscription-check');
    const limitCheck = await checkSubscriptionLimit(tenantId);
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: limitCheck.error }, { status: 403 });
    }

    // Generate reception number
    const numero = await NumberingService.next(tenantId, 'br');

    // If purchaseOrderId is provided, load lines from the purchase order
    let lignes = body.lignes || [];
    let fournisseurNom = body.fournisseurNom || '';
    let fournisseurId = body.fournisseurId || '';

    if (body.purchaseOrderId) {
      const purchaseOrder = await (PurchaseOrder as any).findOne({
        _id: body.purchaseOrderId,
        societeId: tenantId,
      });

      if (!purchaseOrder) {
        return NextResponse.json(
          { error: 'Bon de commande non trouvé' },
          { status: 404 }
        );
      }

      // Pre-fill supplier info
      fournisseurId = purchaseOrder.fournisseurId;
      fournisseurNom = purchaseOrder.fournisseurNom || '';

      // Load supplier details if needed
      if (fournisseurId && !fournisseurNom) {
        const supplier = await (Supplier as any).findOne({
          _id: fournisseurId,
          tenantId,
        });
        if (supplier) {
          fournisseurNom = supplier.raisonSociale || `${supplier.nom || ''} ${supplier.prenom || ''}`.trim();
        }
      }

      // Pre-fill lines from purchase order, but preserve qteRecue from body.lignes if provided
      if (purchaseOrder.lignes && purchaseOrder.lignes.length > 0) {
        // Create a map of body.lignes by index (primary) and productId (fallback) for quick lookup
        const bodyLinesByIndex: any[] = body.lignes || [];
        const bodyLinesByProductId = new Map();
        if (body.lignes && body.lignes.length > 0) {
          body.lignes.forEach((bl: any) => {
            if (bl.productId) {
              bodyLinesByProductId.set(bl.productId.toString(), bl);
            }
          });
        }

        lignes = await Promise.all(
          purchaseOrder.lignes.map(async (line: any, index: number) => {
            let productInfo: any = {};
            if (line.productId) {
              const product = await (Product as any).findOne({
                _id: line.productId,
                tenantId,
              });
              if (product) {
                productInfo = {
                  productId: product._id.toString(),
                  reference: line.reference || product.referenceClient || product.sku || '',
                  designation: line.designation || product.nom,
                  uom: line.unite || product.uomAchatCode || product.uomStockCode || 'PCE',
                };
              }
            }

            // Try to find matching body line to preserve qteRecue
            // First try by index (most reliable), then by productId
            let bodyLine = bodyLinesByIndex[index];
            if (!bodyLine && line.productId) {
              bodyLine = bodyLinesByProductId.get(line.productId.toString());
            }

            // Preserve qteRecue from body if exists, otherwise use 0
            let qteRecue = 0;
            if (bodyLine?.qteRecue !== undefined && bodyLine.qteRecue !== null) {
              qteRecue = typeof bodyLine.qteRecue === 'string' ? parseFloat(bodyLine.qteRecue) || 0 : (bodyLine.qteRecue || 0);
              if (isNaN(qteRecue)) qteRecue = 0;
            }

            // Calculate totalLigneHT with remise if applicable
            let prixAvecRemise = line.prixUnitaireHT || bodyLine?.prixUnitaireHT || 0;
            const remisePct = line.remisePct !== undefined ? line.remisePct : (bodyLine?.remisePct || 0);
            if (remisePct > 0) {
              prixAvecRemise = prixAvecRemise * (1 - remisePct / 100);
            }
            const totalHT = prixAvecRemise * qteRecue;

            return {
              productId: line.productId || undefined,
              reference: line.reference || productInfo.reference || bodyLine?.reference || '',
              designation: line.designation || productInfo.designation || bodyLine?.designation || '',
              uom: line.unite || productInfo.uom || bodyLine?.uom || 'PCE',
              qteCommandee: line.quantite || 0,
              qteRecue: qteRecue,
              prixUnitaireHT: line.prixUnitaireHT || bodyLine?.prixUnitaireHT || 0,
              remisePct: remisePct,
              tvaPct: line.tvaPct || bodyLine?.tvaPct || 0,
              totalLigneHT: bodyLine?.totalLigneHT || totalHT,
            };
          })
        );
      }
    }

    // Validate at least one line
    if (!lignes || lignes.length === 0) {
      return NextResponse.json(
        { error: 'Au moins une ligne est requise' },
        { status: 400 }
      );
    }

    // Validate and normalize qteRecue >= 0
    for (const ligne of lignes) {
      // Ensure qteRecue is a number
      ligne.qteRecue = typeof ligne.qteRecue === 'string' ? parseFloat(ligne.qteRecue) || 0 : (ligne.qteRecue || 0);

      if (isNaN(ligne.qteRecue) || ligne.qteRecue < 0) {
        return NextResponse.json(
          { error: 'La quantité reçue doit être un nombre positif ou zéro' },
          { status: 400 }
        );
      }
    }

    const reception = new Reception({
      societeId: tenantId,
      numero,
      dateDoc: body.dateDoc ? new Date(body.dateDoc) : new Date(),
      purchaseOrderId: body.purchaseOrderId || undefined,
      warehouseId: body.warehouseId || undefined,
      fournisseurId,
      fournisseurNom,
      statut: 'BROUILLON',
      lignes,
      fodecActif: body.fodecActif !== undefined ? body.fodecActif : false,
      tauxFodec: body.tauxFodec !== undefined ? body.tauxFodec : 1,
      timbreActif: body.timbreActif !== undefined ? body.timbreActif : true,
      montantTimbre: body.montantTimbre !== undefined ? body.montantTimbre : 1.000,
      remiseGlobalePct: body.remiseGlobalePct !== undefined ? body.remiseGlobalePct : 0,
      totaux: {
        totalHT: 0,
        fodec: 0,
        totalTVA: 0,
        timbre: 0,
        totalTTC: 0,
      },
      notes: body.notes || '',
      createdBy: session.user.email,
    });

    // Ensure FODEC and TIMBRE fields are explicitly set
    if (reception.fodecActif === undefined) {
      (reception as any).fodecActif = false;
    }
    if (reception.tauxFodec === undefined) {
      (reception as any).tauxFodec = 1;
    }
    if (reception.timbreActif === undefined) {
      (reception as any).timbreActif = true;
    }
    if (reception.montantTimbre === undefined) {
      (reception as any).montantTimbre = 1.000;
    }

    // Totals will be calculated by pre-save hook
    await (reception as any).save();

    // Create stock movements if reception is VALIDE
    if (body.statut === 'VALIDE' || reception.statut === 'VALIDE') {
      await createStockMovementsForReception(reception._id.toString(), tenantId, session.user.email);
    }

    // Log action
    const { logAction } = await import('@/lib/logger');
    await logAction(
      session,
      'CREATE_RECEPTION',
      'Purchases',
      `Created BR ${reception.numero}`,
      { receptionId: reception._id, totalTTC: reception.totaux?.totalTTC }
    );

    return NextResponse.json(reception, { status: 201 });
  } catch (error) {
    console.error('Erreur POST /purchases/receptions:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}
