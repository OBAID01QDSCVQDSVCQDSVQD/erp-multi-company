import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import PurchaseOrder from '@/lib/models/PurchaseOrder';
import CompanySettings from '@/lib/models/CompanySettings';
import Supplier from '@/lib/models/Supplier';
import Product from '@/lib/models/Product';
import { generateDevisPdf } from '@/lib/utils/pdf/devisTemplate';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
    
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });
    }

    const { id } = await params;
    await connectDB();

    // Fetch purchase order
    const order = await (PurchaseOrder as any).findOne({
      _id: id,
      societeId: tenantId,
    });

    if (!order) {
      return NextResponse.json({ error: 'Commande d\'achat non trouvée' }, { status: 404 });
    }

    // Fetch company settings
    const settings = await (CompanySettings as any).findOne({ tenantId: tenantId });
    if (!settings) {
      return NextResponse.json({ error: 'Paramètres de société non trouvés' }, { status: 404 });
    }

    // Fetch supplier details
    let supplierName = '';
    let supplierAddress = '';
    let supplierMatricule = '';
    let supplierCode = '';
    let supplierPhone = '';

    if (order.fournisseurId) {
      try {
        const supplier = await (Supplier as any).findOne({ _id: order.fournisseurId, tenantId: tenantId });
        if (supplier) {
          supplierName = supplier.raisonSociale || `${supplier.nom || ''} ${supplier.prenom || ''}`.trim();
          if (supplier.adresseFacturation) {
            supplierAddress = [
              supplier.adresseFacturation.ligne1,
              supplier.adresseFacturation.ligne2,
              supplier.adresseFacturation.codePostal,
              supplier.adresseFacturation.ville
            ].filter(Boolean).join(', ');
          }
          supplierMatricule = supplier.matriculeFiscale || '';
          supplierCode = supplier.code || '';
          supplierPhone = supplier.telephone || '';
        }
      } catch (error) {
        console.error('Error fetching supplier:', error);
      }
    }

    // Enrich lines with product references if missing
    const enrichedLines = await Promise.all(
      order.lignes.map(async (line: any) => {
        // If reference is missing, try to get it from product
        if (line.productId) {
          try {
            const product = await (Product as any).findOne({ _id: line.productId, tenantId: tenantId });
            if (product) {
              line.reference = line.reference || product.referenceClient || product.sku || '';
            }
          } catch (error) {
            console.error('Error fetching product for enrichment:', error);
          }
        }
        return line;
      })
    );

    // Prepare order data for PDF
    const orderData = {
      numero: order.numero,
      dateDoc: order.dateDoc.toISOString(),
      documentType: 'Bon de commande', // Set document type for PDF
      customerName: supplierName,
      customerAddress: supplierAddress,
      customerMatricule: supplierMatricule,
      customerCode: supplierCode,
      customerPhone: supplierPhone,
      devise: order.devise || 'TND',
      lignes: enrichedLines.map((line: any) => ({
        designation: line.designation,
        quantite: line.quantite,
        unite: line.unite || 'PCE',
        reference: line.reference || '',
        prixUnitaireHT: line.prixUnitaireHT,
        remisePct: line.remisePct || 0,
        tvaPct: line.tvaPct || 0,
        totalLigneHT: line.totalLigneHT || ((line.quantite * line.prixUnitaireHT) * (1 - ((line.remisePct || 0) / 100))),
        totalLigneTVA: line.totalLigneTVA || (((line.quantite * line.prixUnitaireHT) * (1 - ((line.remisePct || 0) / 100))) * ((line.tvaPct || 0) / 100)),
        totalLigneTTC: line.totalLigneTTC || (((line.quantite * line.prixUnitaireHT) * (1 - ((line.remisePct || 0) / 100))) * (1 + (line.tvaPct || 0) / 100))
      })),
      totalBaseHT: order.totalBaseHT || 0,
      totalRemise: order.totalRemise || 0,
      totalTVA: order.totalTVA || 0,
      timbreFiscal: order.timbreFiscal || 0,
      totalTTC: order.totalTTC || 0,
      modePaiement: order.conditionsPaiement || '',
      notes: order.notes || '',
      adresseLivraison: order.adresseLivraison || ''
    };

    // Generate PDF using the same template
    const pdfDoc = generateDevisPdf(orderData, settings.societe);

    // Convert to buffer
    const pdfBuffer = Buffer.from(pdfDoc.output('arraybuffer'));

    // Return PDF as response
    const sanitizedSupplierName = supplierName.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_');
    const filename = `Commande-${orderData.numero}${supplierName ? '-' + sanitizedSupplierName : ''}.pdf`;
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error: any) {
    console.error('Error generating PDF:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { error: 'Erreur lors de la génération du PDF', details: error.message },
      { status: 500 }
    );
  }
}

