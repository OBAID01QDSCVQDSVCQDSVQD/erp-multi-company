import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import PurchaseInvoice from '@/lib/models/PurchaseInvoice';
import { NumberingService } from '@/lib/services/NumberingService';
import Supplier from '@/lib/models/Supplier';
import MouvementStock from '@/lib/models/MouvementStock';
import mongoose from 'mongoose';
import Warehouse from '@/lib/models/Warehouse';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const tenantId = session.user.companyId?.toString() || '';
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const statut = searchParams.get('statut');
    const fournisseurId = searchParams.get('fournisseurId');

    const query: any = { societeId: tenantId };
    if (statut) {
      query.statut = statut;
    }
    if (fournisseurId) {
      query.fournisseurId = fournisseurId;
    }

    const skip = (page - 1) * limit;
    const total = await (PurchaseInvoice as any).countDocuments(query);
    const invoices = await (PurchaseInvoice as any)
      .find(query)
      .sort({ dateFacture: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Ensure default values for fodec and timbre
    const normalizedInvoices = invoices.map((inv: any) => ({
      ...inv,
      images: inv.images || [], // Ensure images array is always present
      fodec: {
        enabled: inv.fodec?.enabled ?? false,
        tauxPct: inv.fodec?.tauxPct ?? 1,
        montant: inv.fodec?.montant ?? 0,
      },
      timbre: {
        enabled: inv.timbre?.enabled ?? true,
        montant: inv.timbre?.montant ?? 1.000,
      },
      totaux: {
        ...inv.totaux,
        totalRemise: inv.totaux?.totalRemise ?? 0,
        totalFodec: inv.totaux?.totalFodec ?? 0,
        totalTimbre: inv.totaux?.totalTimbre ?? 0,
      },
    }));


    return NextResponse.json({
      items: normalizedInvoices,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Erreur GET /api/purchases/invoices:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const tenantId = session.user.companyId?.toString() || '';
    const body = await request.json();

    // Use manual number if provided, otherwise generate automatically
    console.log('========================================');
    console.log('POST /api/purchases/invoices: START');
    console.log('Body keys:', Object.keys(body));
    console.log('Body.numero:', body.numero);
    console.log('Body.numero type:', typeof body.numero);
    console.log('Body.numero value:', JSON.stringify(body.numero));
    console.log('========================================');
    let numero: string;

    // Check if manual number is provided and not empty
    if (body.numero && typeof body.numero === 'string' && body.numero.trim() !== '') {
      numero = body.numero.trim();
      console.log('POST /api/purchases/invoices: Using manual number:', numero);
      // Check if manual number already exists
      const existingInvoice = await (PurchaseInvoice as any).findOne({
        societeId: tenantId,
        numero: numero,
      });
      if (existingInvoice) {
        return NextResponse.json(
          { error: 'Un numéro de facture avec ce numéro existe déjà' },
          { status: 400 }
        );
      }
    } else {
      console.log('POST /api/purchases/invoices: No manual number provided, generating automatically');
      numero = await NumberingService.next(tenantId, 'facfo');
    }
    console.log('POST /api/purchases/invoices: Final numero to use:', numero);

    // Get supplier name if not provided
    let fournisseurNom = body.fournisseurNom || '';
    if (!fournisseurNom && body.fournisseurId) {
      const supplier = await (Supplier as any).findOne({
        _id: body.fournisseurId,
        tenantId,
      });
      if (supplier) {
        fournisseurNom = supplier.raisonSociale || `${supplier.nom || ''} ${supplier.prenom || ''}`.trim();
      }
    }

    // Resolve Warehouse
    let warehouseId = body.warehouseId;
    console.log('POST /api/purchases/invoices: Received warehouseId:', warehouseId);

    if (!warehouseId) {
      // Try to find default warehouse
      const defaultWarehouse = await (Warehouse as any).findOne({
        tenantId: tenantId,
        isDefault: true,
      });

      if (defaultWarehouse) {
        warehouseId = defaultWarehouse._id.toString();
      } else {
        // Fallback to any warehouse
        const anyWarehouse = await (Warehouse as any).findOne({
          tenantId: tenantId,
        });
        if (anyWarehouse) {
          warehouseId = anyWarehouse._id.toString();
        }
      }
    }

    // Prepare lines
    const lignes = (body.lignes || []).map((line: any) => ({
      produitId: line.produitId || undefined,
      designation: line.designation || '',
      quantite: line.quantite || 0,
      prixUnitaireHT: line.prixUnitaireHT || 0,
      remisePct: line.remisePct || 0,
      tvaPct: line.tvaPct || 0,
      fodecPct: line.fodecPct || 0,
      totalLigneHT: 0,
    }));

    // Prepare fodec
    const fodec = {
      enabled: body.fodec?.enabled ?? false,
      tauxPct: body.fodec?.tauxPct ?? 1,
      montant: 0,
    };

    // Prepare timbre
    const timbre = {
      enabled: body.timbre?.enabled ?? true,
      montant: body.timbre?.montant ?? 1.000,
    };

    const invoice = new PurchaseInvoice({
      societeId: tenantId,
      numero,
      dateFacture: body.dateFacture ? new Date(body.dateFacture) : new Date(),
      referenceFournisseur: body.referenceFournisseur || undefined,
      fournisseurId: body.fournisseurId,
      fournisseurNom,
      devise: body.devise || 'TND',
      tauxChange: body.tauxChange || 1,
      conditionsPaiement: body.conditionsPaiement || undefined,
      statut: body.statut || 'BROUILLON',
      warehouseId,
      lignes,
      fodec,
      timbre,
      totaux: {
        totalHT: 0,
        totalRemise: 0,
        totalFodec: 0,
        totalTVA: 0,
        totalTimbre: 0,
        totalTTC: 0,
      },
      bonsReceptionIds: body.bonsReceptionIds || [],
      fichiers: body.fichiers || [],
      images: [], // Will be set below
      paiements: body.paiements || [],
      notes: body.notes || '',
      createdBy: session.user.email,
    });

    // Force Mongoose to recognize images as modified if it's an array (same logic as PUT route)
    console.log('POST /api/purchases/invoices: Received images in body', {
      hasImages: !!body.images,
      imagesIsArray: Array.isArray(body.images),
      imagesLength: Array.isArray(body.images) ? body.images.length : 0,
      images: body.images,
    });

    if (Array.isArray(body.images) && body.images.length > 0) {
      // Clear and set images array
      invoice.images = [];
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
      console.log('POST /api/purchases/invoices: Setting images on invoice', {
        imagesCount: invoice.images.length,
        images: invoice.images,
      });
      (invoice as any).markModified('images');
    } else {
      console.log('POST /api/purchases/invoices: No images to save', {
        imagesIsArray: Array.isArray(body.images),
        imagesValue: body.images,
      });
    }

    // Totals will be calculated by pre-save hook
    await (invoice as any).save();

    // Create stock movements if invoice is VALIDEE
    // Check if invoice is created from BR - if so, update existing BR stock movements to reference the invoice
    const isFromBR = invoice.bonsReceptionIds && invoice.bonsReceptionIds.length > 0;
    if (body.statut === 'VALIDEE' || invoice.statut === 'VALIDEE') {
      if (isFromBR) {
        // Update existing BR stock movements to reference the invoice instead of creating new ones
        await updateStockMovementsFromBRToPurchaseInvoice(invoice, tenantId, session.user.email);
      } else {
        // Create new stock movements for direct invoice creation
        await createStockMovementsForPurchaseInvoice(invoice._id.toString(), tenantId, session.user.email);
      }
    }

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error('Erreur POST /api/purchases/invoices:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// Helper function to update stock movements from BR to Purchase Invoice
// This prevents double stock increase when converting BR to Purchase Invoice
async function updateStockMovementsFromBRToPurchaseInvoice(
  invoice: any,
  tenantId: string,
  createdBy: string
): Promise<void> {
  if (!invoice.lignes || invoice.lignes.length === 0 || !invoice.bonsReceptionIds || invoice.bonsReceptionIds.length === 0) {
    return;
  }

  const dateFacture = invoice.dateFacture || new Date();
  const invoiceId = invoice._id.toString();

  // Process each BR ID
  for (const brId of invoice.bonsReceptionIds) {
    // Process each line
    for (const line of invoice.lignes) {
      // Skip if no productId or quantity is 0
      if (!line.produitId || !line.quantite || line.quantite <= 0) {
        continue;
      }

      try {
        const productIdStr = line.produitId.toString();
        const brIdStr = brId.toString();

        // Find existing stock movement from BR for this product
        let existingMovement = null;

        try {
          // Try to convert brId to ObjectId
          const brIdObjectId = new mongoose.Types.ObjectId(brIdStr);
          existingMovement = await (MouvementStock as any).findOne({
            societeId: tenantId,
            productId: productIdStr,
            source: 'BR',
            $or: [
              { sourceId: brIdStr },
              { sourceId: brIdObjectId },
              { sourceId: brId.toString() }
            ],
            type: 'ENTREE',
          });
        } catch (err) {
          // If ObjectId conversion fails, try string only
          existingMovement = await (MouvementStock as any).findOne({
            societeId: tenantId,
            productId: productIdStr,
            source: 'BR',
            sourceId: brIdStr,
            type: 'ENTREE',
          });
        }

        // If still not found, try finding all BR movements for this product and match by string
        if (!existingMovement) {
          const allBRMovements = await (MouvementStock as any).find({
            societeId: tenantId,
            productId: productIdStr,
            source: 'BR',
            type: 'ENTREE',
          }).lean();

          // Find the one that matches brId (as string)
          existingMovement = allBRMovements.find((mov: any) =>
            mov.sourceId?.toString() === brIdStr
          );
        }

        if (existingMovement) {
          // Update existing movement to reference the invoice instead of BR
          // This prevents double stock increase
          const movementDoc = await (MouvementStock as any).findById(existingMovement._id);
          if (movementDoc) {
            movementDoc.source = 'FAC';
            movementDoc.sourceId = invoiceId;
            movementDoc.date = dateFacture;
            movementDoc.qte = line.quantite;
            movementDoc.notes = `Facture d'achat ${invoice.numero}`;
            await movementDoc.save();
            console.log(`[Convert] Updated stock movement ${existingMovement._id} for product ${productIdStr} from BR ${brIdStr} to FAC ${invoiceId}`);
          }
        } else {
          // If no existing movement found, this is an error
          // When converting from BR, the stock movement should already exist from the BR creation
          // We should NOT create a new movement as this would cause double stock increase
          console.error(`[Convert] WARNING: No stock movement found for BR ${brIdStr}, product ${productIdStr}. Stock was not increased when BR was created.`);
          // Do NOT create a new movement - this would cause double stock increase
          // The stock should have been increased when the BR was created
        }
      } catch (error) {
        console.error(`Error updating stock movement for product ${line.produitId}:`, error);
        // Continue processing other lines even if one fails
      }
    }
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
            warehouseId: invoice.warehouseId,
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
      await (MouvementStock as any).insertMany(stockMovements);
    }
  } catch (error) {
    console.error('Erreur lors de la création des mouvements de stock pour la facture d\'achat:', error);
    // Don't throw error, just log it
  }
}
