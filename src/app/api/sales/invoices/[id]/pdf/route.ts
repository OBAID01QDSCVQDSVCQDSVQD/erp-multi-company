import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import CompanySettings from '@/lib/models/CompanySettings';
import Product from '@/lib/models/Product';
import Customer from '@/lib/models/Customer';
import { generateInvoicePdf } from '@/lib/utils/pdf/invoiceTemplate';

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

    // Fetch invoice
    const invoice = await (Document as any).findOne({
      _id: id,
      tenantId,
      type: 'FAC'
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 });
    }

    // Fetch company settings
    const settings = await (CompanySettings as any).findOne({ tenantId });
    if (!settings) {
      return NextResponse.json({ error: 'Paramètres de société non trouvés' }, { status: 404 });
    }

    // Check query params for stamp option
    const { searchParams } = new URL(request.url);
    const withStamp = searchParams.get('withStamp') !== 'false';

    // If user explicitly requests NO stamp, remove it from the settings object passed to generator
    if (!withStamp) {
      if (settings.societe) {
        settings.societe.cachetUrl = undefined;
      }
    }

    // Fetch customer details directly from database
    let customerName = '';
    let customerAddress = '';
    let customerMatricule = '';
    let customerCode = '';
    let customerPhone = '';

    if (invoice.customerId) {
      try {
        // Fetch customer directly from database using customerId as string
        const customer = await (Customer as any).findOne({
          _id: invoice.customerId.toString(),
          tenantId
        }).lean();

        if (customer) {
          customerName = customer.raisonSociale || `${customer.nom || ''} ${customer.prenom || ''}`.trim() || 'N/A';
          if (customer.adresseFacturation) {
            customerAddress = [
              customer.adresseFacturation.ligne1,
              customer.adresseFacturation.ligne2,
              customer.adresseFacturation.codePostal,
              customer.adresseFacturation.ville
            ].filter(Boolean).join(', ');
          }
          customerMatricule = customer.matriculeFiscale || '';
          customerCode = customer.code || '';
          customerPhone = customer.telephone || '';
        } else {
          console.warn(`Customer not found for ID: ${invoice.customerId}`);
        }
      } catch (error) {
        console.error('Error fetching customer:', error);
        console.error('Customer ID:', invoice.customerId);
        console.error('Tenant ID:', tenantId);
      }
    }

    // Enrich lines with product references if missing
    const enrichedLines = await Promise.all(
      invoice.lignes.map(async (line: any) => {
        // If codeAchat is missing, try to get it from product
        if (line.productId) {
          try {
            const product = await (Product as any).findOne({ _id: line.productId, tenantId });
            if (product) {
              line.codeAchat = line.codeAchat || (product as any).referenceClient || (product as any).sku || '';
              line.categorieCode = line.categorieCode || (product as any).categorieCode || '';
              line.estStocke = (product as any).estStocke;
              line.descriptionProduit = (product as any).description;
            }
          } catch (error) {
            console.error('Error fetching product for enrichment:', error);
          }
        }
        return line;
      })
    );

    // Calculate remise lignes (line discounts)
    const remiseLignes = invoice.lignes.reduce((sum: number, line: any) => {
      const remise = line.remisePct || 0;
      const prixHTBeforeDiscount = line.prixUnitaireHT;
      const prixHTAfterDiscount = prixHTBeforeDiscount * (1 - remise / 100);
      const remiseAmount = (prixHTBeforeDiscount - prixHTAfterDiscount) * line.quantite;
      return sum + remiseAmount;
    }, 0);

    // Calculate remise globale (global discount)
    const remiseGlobalePct = invoice.remiseGlobalePct || 0;
    const totalHTAfterLineDiscount = (invoice.totalBaseHT || 0) - remiseLignes;
    const remiseGlobale = totalHTAfterLineDiscount * (remiseGlobalePct / 100);

    // Prepare invoice data
    const invoiceData = {
      numero: invoice.numero,
      dateDoc: invoice.dateDoc.toISOString(),
      dateEcheance: invoice.dateEcheance?.toISOString(),
      customerName,
      customerAddress,
      customerMatricule,
      customerCode,
      customerPhone,
      devise: invoice.devise || 'TND',
      lignes: enrichedLines,
      totalBaseHT: invoice.totalBaseHT || 0,
      remiseLignes: remiseLignes,
      remiseGlobale: remiseGlobale,
      remiseGlobalePct: remiseGlobalePct,
      totalRemise: remiseLignes + remiseGlobale,
      fodec: invoice.fodec?.montant || 0,
      fodecTauxPct: invoice.fodec?.tauxPct || 0,
      totalTVA: invoice.totalTVA || 0,
      timbreFiscal: invoice.timbreFiscal || 0,
      totalTTC: invoice.totalTTC || 0,
      modePaiement: invoice.modePaiement || '',
      conditionsPaiement: invoice.conditionsPaiement || '',
      notes: invoice.notes || ''
    };

    // Generate PDF
    const pdfDoc = generateInvoicePdf(invoiceData, settings.societe);

    // Convert to buffer
    const pdfBuffer = Buffer.from(pdfDoc.output('arraybuffer'));

    // Return PDF as response
    const sanitizedCustomerName = customerName.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_');
    const filename = `Facture-${invoiceData.numero}${customerName ? '-' + sanitizedCustomerName : ''}.pdf`;
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

