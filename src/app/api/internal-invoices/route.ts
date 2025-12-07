import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import Product from '@/lib/models/Product';
import CompanySettings from '@/lib/models/CompanySettings';
import MouvementStock from '@/lib/models/MouvementStock';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const tenantIdHeader = request.headers.get('X-Tenant-Id');
    const tenantId = tenantIdHeader || session.user.companyId?.toString() || '';
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID manquant' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const projetId = searchParams.get('projetId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const query: any = { tenantId, type: 'INT_FAC' };
    if (customerId) query.customerId = new mongoose.Types.ObjectId(customerId);
    if (projetId) query.projetId = new mongoose.Types.ObjectId(projetId);

    // Ensure models are registered
    if (!mongoose.models.Document) {
      void Document;
    }
    if (!mongoose.models.Customer) {
      const { default: Customer } = await import('@/lib/models/Customer');
      void Customer;
    }
    if (!mongoose.models.Project) {
      const { default: Project } = await import('@/lib/models/Project');
      void Project;
    }

    let invoices;
    try {
      invoices = await (Document as any)
        .find(query)
        .populate({
          path: 'customerId',
          select: 'raisonSociale nom prenom',
          model: 'Customer'
        })
        .populate({
          path: 'projetId',
          select: 'name projectNumber',
          model: 'Project'
        })
        .sort({ createdAt: -1, numero: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
    } catch (populateError: any) {
      console.error('Error populating invoices:', populateError);
      // Fallback: fetch without populate
      invoices = await (Document as any)
        .find(query)
        .sort({ createdAt: -1, numero: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
    }

    const total = await (Document as any).countDocuments(query);

    return NextResponse.json({ items: invoices || [], total: total || 0 });
  } catch (error: any) {
    console.error('Erreur GET /internal-invoices:', error);
    console.error('Error stack:', error.stack);
    
    // Return actual error message instead of generic "Erreur serveur"
    return NextResponse.json(
      { 
        error: error.message || 'Erreur serveur',
        details: error.message || 'Une erreur inattendue s\'est produite lors de la récupération des factures internes'
      },
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

    const body = await request.json();
    await connectDB();

    const tenantId = session.user.companyId?.toString() || '';
    
    let numero =
      typeof body.numero === 'string' && body.numero.trim().length > 0
        ? body.numero.trim()
        : '';

    if (numero) {
      const exists = await (Document as any).findOne({
        tenantId,
        type: 'INT_FAC',
        numero,
      });
      if (exists) {
        return NextResponse.json(
          { error: 'Ce numéro de facture interne existe déjà. Merci de choisir un autre numéro.' },
          { status: 409 }
        );
      }
    } else {
      // Generate invoice number using NumberingService
      try {
        const { NumberingService } = await import('@/lib/services/NumberingService');
        numero = await NumberingService.next(tenantId, 'int_fac');
      } catch (error: any) {
        console.error('Error generating internal invoice number:', error);
        // Fallback: generate simple number starting from 1
        const lastInvoice = await (Document as any).findOne({
          tenantId,
          type: 'INT_FAC'
        })
        .sort({ createdAt: -1 })
        .lean();

        if (lastInvoice && lastInvoice.numero) {
          // Extract numeric part
          const numericMatch = lastInvoice.numero.match(/(\d+)$/);
          if (numericMatch) {
            const lastNumber = parseInt(numericMatch[1], 10);
            const nextNumber = lastNumber + 1;
            const padding = numericMatch[1].length;
            numero = nextNumber.toString().padStart(padding, '0');
          } else {
            // If no numeric match, start from 0001
            numero = '0001';
          }
        } else {
          // First invoice: start from 0001 or use starting number from settings
          const settings = await (CompanySettings as any).findOne({ tenantId });
          const startNumber = settings?.numerotation?.startingNumbers?.int_fac || 0;
          numero = (startNumber + 1).toString().padStart(4, '0');
        }
      }
    }

    const invoice = new Document({
      ...body,
      tenantId,
      type: 'INT_FAC',
      numero,
      statut: body.statut || 'VALIDEE', // Default to VALIDEE instead of BROUILLON
      createdBy: session.user.email
    });

    calculateDocumentTotals(invoice);
    await (invoice as any).save();

    // Convert customerId and projetId to ObjectId if provided
    if (invoice.customerId) {
      (invoice as any).customerId = new mongoose.Types.ObjectId(invoice.customerId);
    }
    if ((invoice as any).projetId) {
      (invoice as any).projetId = new mongoose.Types.ObjectId((invoice as any).projetId);
    }

    // Create stock movements based on status and project
    // Stock movements should only occur for internal invoices without a project
    // Note: BROUILLON invoices should NOT create stock movements
    // Only VALIDEE invoices create SORTIE movements (decrease stock)
    if (!(invoice as any).projetId && invoice.statut === 'VALIDEE') {
      // Create SORTIE movements (decrease stock) only for VALIDEE invoices
      await createStockMovementsForInternalInvoice(invoice, tenantId, session.user.email, 'VALIDEE');
    }

    // Populate before returning
    const populatedInvoice = await (Document as any)
      .findById(invoice._id)
      .populate('customerId', 'raisonSociale nom prenom')
      .populate('projetId', 'name projectNumber')
      .lean();

    return NextResponse.json(populatedInvoice, { status: 201 });
  } catch (error: any) {
    console.error('Erreur POST /internal-invoices:', error);
    
    // Check if it's a validation error
    if (error.name === 'ValidationError' && error.errors) {
      const validationErrors = Object.values(error.errors).map((err: any) => ({
        field: err.path,
        message: err.message,
        value: err.value
      }));
      
      return NextResponse.json(
        { 
          error: 'Erreur de validation',
          details: validationErrors[0]?.message || error.message,
          validationErrors
        },
        { status: 400 }
      );
    }
    
    // Check if it's a duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'champ';
      return NextResponse.json(
        { 
          error: `Ce ${field === 'numero' ? 'numéro' : field} existe déjà`,
          details: `Un document avec ce ${field === 'numero' ? 'numéro' : field} existe déjà`
        },
        { status: 409 }
      );
    }
    
    // Generic error with actual message
    return NextResponse.json(
      { 
        error: error.message || 'Erreur serveur',
        details: error.message || 'Une erreur inattendue s\'est produite'
      },
      { status: 500 }
    );
  }
}

function calculateDocumentTotals(doc: any) {
  let totalHTAfterLineDiscount = 0;
  let totalTVA = 0;

  // Calculate HT after line discounts
  doc.lignes.forEach((line: any) => {
    const remise = line.remisePct || 0;
    const prixHT = line.prixUnitaireHT * (1 - remise / 100);
    const montantHT = prixHT * line.quantite;
    totalHTAfterLineDiscount += montantHT;
  });

  // Apply global remise
  const remiseGlobalePct = doc.remiseGlobalePct || 0;
  const totalBaseHT = totalHTAfterLineDiscount * (1 - (remiseGlobalePct / 100));

  // Calculate FODEC
  const fodecEnabled = doc.fodec?.enabled || false;
  const fodecTauxPct = doc.fodec?.tauxPct || 1;
  const fodec = fodecEnabled ? totalBaseHT * (fodecTauxPct / 100) : 0;

  // Calculate TVA
  doc.lignes.forEach((line: any) => {
    const remise = line.remisePct || 0;
    const prixHT = line.prixUnitaireHT * (1 - remise / 100);
    const montantHT = prixHT * line.quantite;
    const montantHTAfterGlobalRemise = montantHT * (1 - (remiseGlobalePct / 100));
    const ligneFodec = fodecEnabled ? montantHTAfterGlobalRemise * (fodecTauxPct / 100) : 0;
    const ligneBaseTVA = montantHTAfterGlobalRemise + ligneFodec;
    
    if (line.tvaPct) {
      totalTVA += ligneBaseTVA * (line.tvaPct / 100);
    }
  });

  doc.totalBaseHT = Math.round(totalBaseHT * 100) / 100;
  doc.totalTVA = Math.round(totalTVA * 100) / 100;
  
  if (doc.fodec) {
    doc.fodec.montant = Math.round(fodec * 100) / 100;
  }
  
  const timbreFiscal = doc.timbreFiscal || 0;
  doc.totalTTC = doc.totalBaseHT + fodec + doc.totalTVA + timbreFiscal;
  doc.netAPayer = doc.totalTTC;
}

// Helper function to create stock movements for internal invoice
// Only creates movements if invoice is NOT linked to a project
async function createStockMovementsForInternalInvoice(
  invoice: any,
  tenantId: string,
  createdBy: string,
  status: 'VALIDEE' | 'BROUILLON' = 'VALIDEE'
): Promise<void> {
  // Don't create stock movements if invoice is linked to a project
  const projetId = invoice.projetId?.toString() || invoice.projetId;
  if (projetId) {
    console.log('[Stock Movement] Skipping - Invoice linked to project:', projetId);
    return;
  }

  if (!invoice.lignes || invoice.lignes.length === 0) {
    console.log('[Stock Movement] Skipping - No lines in invoice');
    return;
  }

  const movementType = status === 'VALIDEE' ? 'SORTIE' : 'ENTREE';
  const source = status === 'VALIDEE' ? 'INT_FAC' : 'INT_FAC_BROUILLON';
  const notes = status === 'VALIDEE' 
    ? `Facture interne ${invoice.numero}` 
    : `Facture interne brouillon ${invoice.numero}`;

  console.log('[Stock Movement] Creating', movementType, 'movements for invoice:', invoice.numero, 'Lines:', invoice.lignes.length);

  const dateDoc = invoice.dateDoc || new Date();
  const invoiceId = invoice._id.toString();

  for (const line of invoice.lignes) {
    // Skip if no productId or quantity is 0
    if (!line.productId || !line.quantite || line.quantite <= 0) {
      continue;
    }

    try {
      // Convert productId to string for consistency
      const productIdStr = line.productId.toString();
      
      // Find product using ObjectId first, then string
      let product = null;
      try {
        product = await (Product as any).findOne({
          $or: [
            { _id: new mongoose.Types.ObjectId(productIdStr) },
            { _id: productIdStr },
          ],
          tenantId,
        }).lean();
      } catch (err) {
        // If ObjectId conversion fails, try string directly
        product = await (Product as any).findOne({
          _id: productIdStr,
          tenantId,
        }).lean();
      }

      if (!product) {
        console.warn(`[Stock] Product not found for ID: ${productIdStr}`);
        continue;
      }

      // Skip services (non-stocked products)
      if (product.estStocke === false) {
        continue;
      }

      // Check if stock movement already exists for this invoice and product
      const existingMovement = await (MouvementStock as any).findOne({
        societeId: tenantId,
        productId: productIdStr,
        source: source,
        sourceId: invoiceId,
      });

      if (existingMovement) {
        // Update existing movement
        existingMovement.type = movementType;
        existingMovement.qte = line.quantite;
        existingMovement.date = dateDoc;
        existingMovement.notes = notes;
        await (existingMovement as any).save();
        console.log('[Stock Movement] Updated', movementType, 'movement for product:', productIdStr, 'Qty:', line.quantite);
      } else {
        // Create new stock movement
        const mouvement = new MouvementStock({
          societeId: tenantId,
          productId: productIdStr,
          type: movementType,
          qte: line.quantite,
          date: dateDoc,
          source: source,
          sourceId: invoiceId,
          notes: notes,
          createdBy,
        });

        await (mouvement as any).save();
        console.log('[Stock Movement] Created', movementType, 'movement for product:', productIdStr, 'Qty:', line.quantite);
      }
    } catch (error) {
      console.error(`Error creating stock movement for product ${line.productId}:`, error);
      // Continue processing other lines even if one fails
    }
  }
}

