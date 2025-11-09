import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import CompanySettings from '@/lib/models/CompanySettings';
import Product from '@/lib/models/Product';
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

    // Fetch customer details
    let customerName = '';
    let customerAddress = '';
    let customerMatricule = '';
    let customerCode = '';
    let customerPhone = '';

    if (invoice.customerId) {
      try {
        const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/customers/${invoice.customerId}`, {
          headers: { 'X-Tenant-Id': tenantId }
        });
        if (response.ok) {
          const customer = await response.json();
          customerName = customer.raisonSociale || `${customer.nom || ''} ${customer.prenom || ''}`.trim();
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
        }
      } catch (error) {
        console.error('Error fetching customer:', error);
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
      totalRemise: invoice.lignes.reduce((sum: number, line: any) => {
        const remise = line.remisePct || 0;
        const prixHTBeforeDiscount = line.prixUnitaireHT;
        const prixHTAfterDiscount = prixHTBeforeDiscount * (1 - remise / 100);
        const remiseAmount = (prixHTBeforeDiscount - prixHTAfterDiscount) * line.quantite;
        return sum + remiseAmount;
      }, 0),
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

