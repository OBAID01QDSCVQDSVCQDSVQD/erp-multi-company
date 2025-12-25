import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import CompanySettings from '@/lib/models/CompanySettings';
import Product from '@/lib/models/Product';
import Customer from '@/lib/models/Customer';
import { generateInvoicePdf } from '@/lib/utils/pdf/invoiceTemplate';
import { generateDevisPdf } from '@/lib/utils/pdf/devisTemplate';

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

        // Fetch document by publicToken (any type)
        const doc = await (Document as any).findOne({
            publicToken: token
        });

        if (!doc) {
            return NextResponse.json({ error: 'Lien invalide ou expiré' }, { status: 404 });
        }

        const tenantId = doc.tenantId;

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

        if (doc.customerId) {
            try {
                const customer = await (Customer as any).findOne({
                    _id: doc.customerId.toString(),
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
            doc.lignes.map(async (line: any) => {
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

        // Prepare data object (common fields)
        const commonData = {
            numero: doc.numero,
            dateDoc: doc.dateDoc.toISOString(),
            dateEcheance: doc.dateEcheance?.toISOString(),
            customerName,
            customerAddress,
            customerMatricule,
            customerCode,
            customerPhone,
            devise: doc.devise || 'TND',
            lignes: enrichedLines,
            totalBaseHT: doc.totalBaseHT || 0,
            remiseGlobale: 0, // Calculated below
            remiseGlobalePct: doc.remiseGlobalePct || 0,
            totalRemise: 0, // Calculated below
            remiseLignes: 0, // Calculated below
            fodec: doc.fodec?.montant || 0,
            fodecTauxPct: doc.fodec?.tauxPct || 0,
            totalTVA: doc.totalTVA || 0,
            timbreFiscal: doc.timbreFiscal || 0,
            totalTTC: doc.totalTTC || 0,
            modePaiement: doc.modePaiement || '',
            conditionsPaiement: doc.conditionsPaiement || '',
            notes: doc.notes || '',
            documentType: doc.type === 'DEVIS' ? 'DEVIS' : (doc.type === 'BL' ? 'BON DE LIVRAISON' : 'FACTURE')
        };

        // Calculate missing details (reuse logic)
        const remiseLignes = doc.lignes.reduce((sum: number, line: any) => {
            const remise = line.remisePct || 0;
            const prixHT = line.prixUnitaireHT * (1 - remise / 100);
            return sum + (line.prixUnitaireHT - prixHT) * line.quantite;
        }, 0);

        const totalHT = (doc.totalBaseHT || 0) - remiseLignes;
        const remiseGlobale = totalHT * (commonData.remiseGlobalePct / 100);

        commonData.remiseLignes = remiseLignes;
        commonData.remiseGlobale = remiseGlobale;
        commonData.totalRemise = remiseLignes + remiseGlobale;

        let pdfDoc;

        if (doc.type === 'FAC') {
            pdfDoc = generateInvoicePdf(commonData, settings.societe);
        } else {
            // For DEVIS and BL (and others), use generateDevisPdf
            pdfDoc = generateDevisPdf(commonData, settings.societe);
        }

        // Convert to buffer
        const pdfBuffer = Buffer.from(pdfDoc.output('arraybuffer'));

        // Return PDF as response
        const prefix = doc.type === 'FAC' ? 'Facture' : (doc.type === 'DEVIS' ? 'Devis' : 'BL');
        const sanitizedCustomerName = customerName.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_');
        const filename = `${prefix}-${commonData.numero}${customerName ? '-' + sanitizedCustomerName : ''}.pdf`;
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
