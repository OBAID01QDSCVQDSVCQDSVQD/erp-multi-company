import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import CompanySettings from '@/lib/models/CompanySettings';
import Customer from '@/lib/models/Customer';
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

    // Fetch quote
    const quote = await (Document as any).findOne({
      _id: id,
      tenantId,
      type: 'DEVIS'
    });

    if (!quote) {
      return NextResponse.json({ error: 'Devis non trouvé' }, { status: 404 });
    }

    // Fetch company settings
    const settings = await (CompanySettings as any).findOne({ tenantId });
    if (!settings) {
      return NextResponse.json({ error: 'Paramètres de société non trouvés' }, { status: 404 });
    }

    // Check query params for stamp option
    const { searchParams } = new URL(request.url);
    const withStamp = searchParams.get('withStamp') !== 'false'; // Default to true if not specified, or handle as user pref

    // If user explicitly requests NO stamp, remove it from the settings object passed to generator
    if (!withStamp) {
      if (settings.societe) {
        settings.societe.cachetUrl = undefined;
      }
    }

    // Fetch customer details (directly from DB, no HTTP call)
    let customerName = '';
    let customerAddress = '';
    let customerMatricule = '';
    let customerCode = '';
    let customerPhone = '';

    if (quote.customerId) {
      try {
        const customer = await (Customer as any).findOne({
          _id: quote.customerId,
          tenantId,
        });

        if (customer) {
          customerName =
            customer.raisonSociale ||
            `${customer.nom || ''} ${customer.prenom || ''}`.trim();

          if (customer.adresseFacturation) {
            customerAddress = [
              customer.adresseFacturation.ligne1,
              customer.adresseFacturation.ligne2,
              customer.adresseFacturation.codePostal,
              customer.adresseFacturation.ville,
            ]
              .filter(Boolean)
              .join(', ');
          }

          customerMatricule = customer.matriculeFiscale || '';
          customerCode = customer.code || '';
          customerPhone = customer.telephone || '';
        }
      } catch (error) {
        console.error('Error fetching customer for PDF:', error);
      }
    }

    // Enrich lines with product references if missing
    const enrichedLines = await Promise.all(
      quote.lignes.map(async (line: any) => {
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

    // Calculate remise amounts
    const remiseLignes = quote.lignes.reduce((sum: number, line: any) => {
      const lineHTBeforeDiscount = (line.quantite || 0) * (line.prixUnitaireHT || 0);
      const lineHT = lineHTBeforeDiscount * (1 - ((line.remisePct || 0) / 100));
      return sum + (lineHTBeforeDiscount - lineHT);
    }, 0);

    const totalHTAfterLineDiscount = quote.lignes.reduce((sum: number, line: any) => {
      const lineHTBeforeDiscount = (line.quantite || 0) * (line.prixUnitaireHT || 0);
      const lineHT = lineHTBeforeDiscount * (1 - ((line.remisePct || 0) / 100));
      return sum + lineHT;
    }, 0);

    const remiseGlobalePct = quote.remiseGlobalePct || 0;
    const remiseGlobale = totalHTAfterLineDiscount - (totalHTAfterLineDiscount * (1 - (remiseGlobalePct / 100)));

    // Prepare quote data
    const quoteData = {
      numero: quote.numero,
      dateDoc: quote.dateDoc.toISOString(),
      dateValidite: quote.dateValidite?.toISOString(),
      customerName,
      customerAddress,
      customerMatricule,
      customerCode,
      customerPhone,
      devise: quote.devise || 'TND',
      lignes: enrichedLines,
      totalBaseHT: quote.totalBaseHT || 0,
      remiseLignes: remiseLignes,
      remiseGlobale: remiseGlobale,
      remiseGlobalePct: remiseGlobalePct,
      totalRemise: remiseLignes + remiseGlobale,
      fodec: quote.fodec?.montant || 0,
      fodecTauxPct: quote.fodec?.tauxPct || 0,
      totalTVA: quote.totalTVA || 0,
      timbreFiscal: quote.timbreFiscal || 0,
      totalTTC: quote.totalTTC || 0,
      modePaiement: quote.modePaiement || '',
      notes: quote.notes || ''
    };

    // Generate PDF
    const pdfDoc = generateDevisPdf(quoteData, settings.societe);

    // Convert to buffer
    const pdfBuffer = Buffer.from(pdfDoc.output('arraybuffer'));

    // Return PDF as response
    const sanitizedCustomerName = customerName.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_');
    const filename = `Devis-${quoteData.numero}${customerName ? '-' + sanitizedCustomerName : ''}.pdf`;
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

