import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import CompanySettings from '@/lib/models/CompanySettings';
import Customer from '@/lib/models/Customer';
import Product from '@/lib/models/Product';
import { generateDevisPdf } from '@/lib/utils/pdf/devisTemplate';
import { EmailService } from '@/lib/services/email.service';

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
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

        const { id } = params;
        const body = await request.json().catch(() => ({})); // Optional body
        let targetEmail = body.email;
        const withStamp = body.withStamp !== false; // Default to true

        await connectDB();

        // 1. Fetch quote
        const quote = await (Document as any).findOne({
            _id: id,
            tenantId,
            type: 'DEVIS'
        });

        if (!quote) {
            return NextResponse.json({ error: 'Devis non trouvé' }, { status: 404 });
        }

        // 2. Fetch company settings
        const settings = await (CompanySettings as any).findOne({ tenantId });
        if (!settings) {
            return NextResponse.json({ error: 'Paramètres de société non trouvés' }, { status: 404 });
        }

        // Handle Stamp logic
        if (!withStamp && settings.societe) {
            settings.societe.cachetUrl = undefined;
        }

        // 3. Fetch customer details
        let customerName = '';
        let customerAddress = '';
        let customerMatricule = '';
        let customerCode = '';
        let customerPhone = '';
        let customerEmailFromDb = '';

        if (quote.customerId) {
            const customer = await (Customer as any).findOne({
                _id: quote.customerId.toString(),
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
                customerEmailFromDb = customer.email || '';
            }
        }

        // Use provided email or fallback to customer email from DB
        targetEmail = targetEmail || customerEmailFromDb;

        if (!targetEmail) {
            return NextResponse.json({ error: 'Aucune adresse email trouvée pour ce client.' }, { status: 400 });
        }

        // 4. Enrich lines
        const enrichedLines = await Promise.all(
            quote.lignes.map(async (line: any) => {
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

        // 5. Calculate totals (same login as PDF)
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

        // 6. Prepare quote data
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

        // 7. Generate PDF Buffer
        const pdfDoc = generateDevisPdf(quoteData, settings.societe);
        const pdfBuffer = Buffer.from(pdfDoc.output('arraybuffer'));

        // 8. Send Email
        const companyName = settings.societe?.nom || 'Votre Société';
        await EmailService.sendQuoteEmail(targetEmail, quote.numero, pdfBuffer, companyName);

        return NextResponse.json({
            success: true,
            message: `Devis envoyé avec succès à ${targetEmail}`
        });

    } catch (error: any) {
        console.error('Error sending quote email:', error);
        return NextResponse.json(
            { error: error.message || "Erreur lors de l'envoi de l'email" },
            { status: 500 }
        );
    }
}
