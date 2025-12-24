import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import CompanySettings from '@/lib/models/CompanySettings';
import Product from '@/lib/models/Product';
import Customer from '@/lib/models/Customer';
import { generateInvoicePdf } from '@/lib/utils/pdf/invoiceTemplate';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;

        if (!token) {
            return NextResponse.json({ error: 'Token manquant' }, { status: 400 });
        }

        await connectDB();

        // Fetch invoice by publicToken
        const invoice = await (Document as any).findOne({
            publicToken: token,
            type: 'FAC'
        });

        if (!invoice) {
            // Fallback for security: if not found, it might mean the token is invalid
            return NextResponse.json({ error: 'Lien invalide ou expiré' }, { status: 404 });
        }

        const tenantId = invoice.tenantId;

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
                }
            } catch (e) { console.error(e) }
        }

        // Enrich lines with product references if missing
        const enrichedLines = await Promise.all(
            invoice.lignes.map(async (line: any) => {
                if (line.productId) {
                    try {
                        const product = await (Product as any).findOne({ _id: line.productId, tenantId });
                        if (product) {
                            line.codeAchat = line.codeAchat || (product as any).referenceClient || (product as any).sku || '';
                            line.categorieCode = line.categorieCode || (product as any).categorieCode || '';
                            line.descriptionProduit = (product as any).description;
                        }
                    } catch (error) { }
                }
                return line;
            })
        );

        // Calculate details (reuse logic)
        const remiseLignes = invoice.lignes.reduce((sum: number, line: any) => {
            const remise = line.remisePct || 0;
            const prixHT = line.prixUnitaireHT * (1 - remise / 100);
            return sum + (line.prixUnitaireHT - prixHT) * line.quantite;
        }, 0);

        const remiseGlobalePct = invoice.remiseGlobalePct || 0;
        const totalHT = (invoice.totalBaseHT || 0) - remiseLignes;
        const remiseGlobale = totalHT * (remiseGlobalePct / 100);

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
        console.error('Error in public PDF generation:', error);
        return NextResponse.json(
            { error: 'Erreur système', details: error.message },
            { status: 500 }
        );
    }
}
