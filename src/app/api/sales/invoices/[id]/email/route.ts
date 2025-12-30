import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import CompanySettings from '@/lib/models/CompanySettings';
import Product from '@/lib/models/Product';
import Customer from '@/lib/models/Customer';
import { generateInvoicePdf } from '@/lib/utils/pdf/invoiceTemplate';
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

        // 1. Fetch invoice
        const invoice = await (Document as any).findOne({
            _id: id,
            tenantId,
            type: 'FAC'
        });

        if (!invoice) {
            return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 });
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

        if (invoice.customerId) {
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
                customerEmailFromDb = customer.email || '';
            }
        }

        // Use provided email or fallback to customer email from DB
        targetEmail = targetEmail || customerEmailFromDb;

        if (!targetEmail) {
            return NextResponse.json({ error: 'Aucune adresse email trouvée pour ce client.' }, { status: 400 });
        }

        // 4. Enrich lines (same logic as PDF route)
        const enrichedLines = await Promise.all(
            invoice.lignes.map(async (line: any) => {
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

        // 5. Calculate totals (same logic as PDF route)
        const remiseLignes = invoice.lignes.reduce((sum: number, line: any) => {
            const remise = line.remisePct || 0;
            const prixHTBeforeDiscount = line.prixUnitaireHT;
            const prixHTAfterDiscount = prixHTBeforeDiscount * (1 - remise / 100);
            const remiseAmount = (prixHTBeforeDiscount - prixHTAfterDiscount) * line.quantite;
            return sum + remiseAmount;
        }, 0);

        const remiseGlobalePct = invoice.remiseGlobalePct || 0;
        const totalHTAfterLineDiscount = (invoice.totalBaseHT || 0) - remiseLignes;
        const remiseGlobale = totalHTAfterLineDiscount * (remiseGlobalePct / 100);

        // 6. Prepare data for PDF
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

        // 7. Generate PDF Buffer
        const pdfDoc = generateInvoicePdf(invoiceData, settings.societe);
        const pdfBuffer = Buffer.from(pdfDoc.output('arraybuffer'));

        // 8. Send Email
        const companyName = settings.societe?.nom || 'Votre Société';
        await EmailService.sendInvoiceEmail(targetEmail, invoice.numero, pdfBuffer, companyName);

        return NextResponse.json({
            success: true,
            message: `Facture envoyée avec succès à ${targetEmail}`
        });

    } catch (error: any) {
        console.error('Error sending invoice email:', error);
        return NextResponse.json(
            { error: error.message || "Erreur lors de l'envoi de l'email" },
            { status: 500 }
        );
    }
}
