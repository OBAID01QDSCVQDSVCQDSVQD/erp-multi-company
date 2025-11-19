import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import CompanySettings from '@/lib/models/CompanySettings';
import Product from '@/lib/models/Product';
import { generateCreditNotePdf } from '@/lib/utils/pdf/invoiceTemplate';

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

    const creditNote = await (Document as any).findOne({
      _id: id,
      tenantId,
      type: 'AVOIR',
    });

    if (!creditNote) {
      return NextResponse.json({ error: 'Avoir non trouvé' }, { status: 404 });
    }

    const settings = await (CompanySettings as any).findOne({ tenantId });
    if (!settings) {
      return NextResponse.json(
        { error: 'Paramètres de société non trouvés' },
        { status: 404 }
      );
    }

    let customerName = '';
    let customerAddress = '';
    let customerMatricule = '';
    let customerCode = '';
    let customerPhone = '';

    if (creditNote.customerId) {
      try {
        const response = await fetch(
          `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/customers/${creditNote.customerId}`,
          {
            headers: { 'X-Tenant-Id': tenantId },
          }
        );
        if (response.ok) {
          const customer = await response.json();
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
        console.error('Error fetching customer:', error);
      }
    }

    const enrichedLines = await Promise.all(
      creditNote.lignes.map(async (line: any, index: number) => {
        if (line.productId) {
          try {
            const product = await (Product as any).findOne({
              _id: line.productId,
              tenantId,
            });
            if (product) {
              line.codeAchat =
                line.codeAchat ||
                (product as any).referenceClient ||
                (product as any).sku ||
                '';
              line.categorieCode =
                line.categorieCode || (product as any).categorieCode || '';
              line.estStocke = (product as any).estStocke;
              line.descriptionProduit = line.descriptionProduit || (product as any).description;
              line.designation = line.designation || product.nom;
            }
          } catch (error) {
            console.error('Error fetching product for enrichment:', error);
          }
        }
        const quantite = Math.abs(line.quantite || 0);
        let designation =
          line.designation ||
          line.produit ||
          line.descriptionProduit ||
          line.description ||
          line.codeAchat ||
          `Produit ${index + 1}`;

        return {
          ...line,
          quantite,
          codeAchat: line.codeAchat || line.categorieCode || '',
          designation,
        };
      })
    );

    const creditNoteData = {
      numero: creditNote.numero,
      dateDoc: creditNote.dateDoc.toISOString(),
      dateEcheance: creditNote.dateEcheance?.toISOString(),
      customerName,
      customerAddress,
      customerMatricule,
      customerCode,
      customerPhone,
      devise: creditNote.devise || 'TND',
      lignes: enrichedLines,
      totalBaseHT: Math.abs(creditNote.totalBaseHT || 0),
      totalRemise: creditNote.lignes.reduce((sum: number, line: any) => {
        const remise = line.remisePct || 0;
        const prixHTBeforeDiscount = line.prixUnitaireHT;
        const prixHTAfterDiscount = prixHTBeforeDiscount * (1 - remise / 100);
        const remiseAmount =
          (prixHTBeforeDiscount - prixHTAfterDiscount) * Math.abs(line.quantite || 0);
        return sum + remiseAmount;
      }, 0),
      totalTVA: Math.abs(creditNote.totalTVA || 0),
      timbreFiscal: Math.abs(creditNote.timbreFiscal || 0),
      totalTTC: Math.abs(creditNote.totalTTC || 0),
      modePaiement: creditNote.modePaiement || '',
      conditionsPaiement: creditNote.conditionsPaiement || '',
      notes: creditNote.notes || '',
    };

    const pdfDoc = generateCreditNotePdf(creditNoteData, settings.societe);
    const pdfBuffer = Buffer.from(pdfDoc.output('arraybuffer'));

    const sanitizedCustomerName = customerName
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .trim()
      .replace(/\s+/g, '_');
    const filename = `Avoir-${creditNote.numero}${
      customerName ? '-' + sanitizedCustomerName : ''
    }.pdf`;

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating credit note PDF:', error);
    return NextResponse.json(
      {
        error: 'Erreur lors de la génération du PDF',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

