
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import CompanySettings from '@/lib/models/CompanySettings';
import Product from '@/lib/models/Product';
import Supplier from '@/lib/models/Supplier';
import { generateAvoirFournisseurPdf } from '@/lib/utils/pdf/avoirFournisseurTemplate';

export async function GET(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const tenantId = req.headers.get('X-Tenant-Id');
        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
        }

        await connectDB();

        // 1. Fetch Credit Note Doc
        const creditNote: any = await Document.findOne({
            _id: params.id,
            tenantId,
            type: 'AVOIRFO'
        }).lean();

        if (!creditNote) {
            return NextResponse.json({ error: 'Credit Note not found' }, { status: 404 });
        }

        // 1b. Manually Fetch Supplier
        let supplier: any = null;
        if (creditNote.supplierId) {
            supplier = await (Supplier as any).findOne({ _id: creditNote.supplierId }).lean();
        }

        // 1.5 Fetch Products to get codes
        const productIds = creditNote.lignes
            .map((l: any) => l.productId)
            .filter((id: string) => id && mongoose.Types.ObjectId.isValid(id));

        const products = await (Product as any).find({
            _id: { $in: productIds }
        }).select('sku referenceClient').lean();

        const productMap = new Map(products.map((p: any) => [p._id.toString(), p]));

        // 2. Fetch Company Settings
        const settings = await (CompanySettings as any).findOne({ tenantId }).lean();
        const companyInfo = {
            nom: settings?.societe?.nom || 'Ma Société',
            adresse: {
                rue: settings?.societe?.adresse?.rue || '',
                ville: settings?.societe?.adresse?.ville || '',
                codePostal: settings?.societe?.adresse?.codePostal || '',
                pays: settings?.societe?.adresse?.pays || '',
            },
            logoUrl: settings?.societe?.logoUrl,
            enTete: {
                telephone: settings?.societe?.enTete?.telephone || settings?.societe?.telephone,
                email: settings?.societe?.enTete?.email || settings?.societe?.email,
                siteWeb: settings?.societe?.enTete?.siteWeb || settings?.societe?.siteWeb,
                matriculeFiscal: settings?.societe?.enTete?.matriculeFiscal || settings?.societe?.matriculeFiscal,
            },
            piedPage: {
                ...settings?.societe?.piedPage
            }
        };

        // 3. Map Data
        const pdfData = {
            numero: creditNote.numero,
            dateDoc: creditNote.dateDoc,
            documentType: 'AVOIR_FOURNISSEUR',
            supplierName: supplier?.raisonSociale || `${supplier?.nom || ''} ${supplier?.prenom || ''}`.trim() || 'Fournisseur Inconnu',
            supplierAddress: supplier?.adresseFacturation ?
                [supplier.adresseFacturation.ligne1, supplier.adresseFacturation.ville, supplier.adresseFacturation.codePostal].filter(Boolean).join(', ') :
                '',
            supplierPhone: supplier?.telephone || supplier?.mobile,
            supplierEmail: supplier?.email,
            referenceExterne: creditNote.referenceExterne,
            devise: creditNote.devise || 'TND',
            lignes: creditNote.lignes.map((l: any) => {
                let lineTotal = l.totalLigneHT;
                const price = l.prixUnitaireHT || 0;
                const qty = l.quantite || 0;
                const discount = l.remisePct || 0;
                const calculatedTotal = price * qty * (1 - discount / 100);

                // Resolve Reference
                let ref = l.codeAchat || '—';
                const product = productMap.get(l.productId?.toString());
                if (product) {
                    ref = (product as any).sku || (product as any).referenceClient || l.codeAchat || '—';
                }

                return {
                    reference: ref,
                    designation: l.designation,
                    quantite: l.quantite,
                    unite: l.uomCode || l.uom || 'U',
                    prixUnitaireHT: l.prixUnitaireHT,
                    remisePct: l.remisePct,
                    tvaPct: l.tvaPct,
                    totalLigneHT: calculatedTotal
                };
            }),
            totalBaseHT: creditNote.totalBaseHT || 0,
            // Calculate Net HT for display if global discount exists
            totalHT: (creditNote.remiseGlobalePct || 0) > 0
                ? (creditNote.totalBaseHT || 0) * (1 - (creditNote.remiseGlobalePct / 100))
                : (creditNote.totalBaseHT || 0),
            totalTVA: creditNote.totalTVA || 0,
            totalTTC: creditNote.totalTTC || 0,

            // Extras
            remiseGlobalePct: creditNote.remiseGlobalePct,
            fodec: creditNote.fodec,
            totalFodec: creditNote.totalFodec,
            timbreFiscal: creditNote.timbreFiscal,

            notes: creditNote.notes,
            statut: creditNote.statut,
        };

        // 4. Generate PDF
        const doc = generateAvoirFournisseurPdf(pdfData, companyInfo);
        const pdfBuffer = doc.output('arraybuffer');

        // 5. Return Response
        return new NextResponse(pdfBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${creditNote.numero}.pdf"`,
            },
        });

    } catch (error) {
        console.error('Error generating PDF:', error);
        return NextResponse.json({ error: 'Error generating PDF' }, { status: 500 });
    }
}
