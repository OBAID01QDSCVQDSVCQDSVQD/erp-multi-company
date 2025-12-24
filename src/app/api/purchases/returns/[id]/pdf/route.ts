
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import CompanySettings from '@/lib/models/CompanySettings';
import User from '@/lib/models/User';
import Product from '@/lib/models/Product';
import Supplier from '@/lib/models/Supplier';
import { generateRetourAchatPdf } from '@/lib/utils/pdf/retourAchatTemplate';

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const tenantId = req.headers.get('X-Tenant-Id');
        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
        }

        await connectDB();

        // 1. Fetch Return Doc
        const returnDoc = await Document.findOne({
            _id: params.id,
            tenantId,
            type: 'RETOUR_ACHAT'
        }).lean();

        if (!returnDoc) {
            return NextResponse.json({ error: 'Return not found' }, { status: 404 });
        }

        // 1b. Manually Fetch Relations (Schema lacks 'ref' for some fields)
        let supplier = null;
        if (returnDoc.supplierId) {
            supplier = await Supplier.findOne({ _id: returnDoc.supplierId }).lean();
        }

        let br = null;
        if (returnDoc.brId) {
            br = await Document.findOne({ _id: returnDoc.brId }).select('numero dateDoc').lean();
        }

        // 1.5 Fetch Products to get codes
        const productIds = returnDoc.lignes
            .map((l: any) => l.productId)
            .filter((id: string) => id && mongoose.Types.ObjectId.isValid(id));

        const products = await Product.find({
            _id: { $in: productIds }
            // tenantId removed to be safe, IDs are unique
        }).select('sku referenceClient').lean();

        const productMap = new Map(products.map((p: any) => [p._id.toString(), p]));

        // 2. Fetch Company Settings
        const settings = await CompanySettings.findOne({ tenantId }).lean();
        const companyInfo = {
            nom: settings?.societe?.nom || 'Ma Société',
            adresse: {
                rue: settings?.societe?.adresse?.rue || '',
                ville: settings?.societe?.adresse?.ville || '',
                codePostal: settings?.societe?.adresse?.codePostal || '',
                pays: settings?.societe?.adresse?.pays || '',
            },
            logoUrl: settings?.societe?.logoUrl, // Base64 logo
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
            numero: returnDoc.numero,
            dateDoc: returnDoc.dateDoc,
            documentType: 'RETOUR_ACHAT',
            supplierName: supplier?.raisonSociale || `${supplier?.nom || ''} ${supplier?.prenom || ''}`.trim() || 'Client Inconnu',
            supplierAddress: supplier?.adresseFacturation ?
                [supplier.adresseFacturation.ligne1, supplier.adresseFacturation.ville, supplier.adresseFacturation.codePostal].filter(Boolean).join(', ') :
                '',
            supplierPhone: supplier?.telephone || supplier?.mobile,
            supplierEmail: supplier?.email,
            brNumero: br?.numero,
            brDate: br?.dateDoc,
            devise: returnDoc.devise || 'TND',
            lignes: returnDoc.lignes.map((l: any) => {
                // Calculate missing total line if needed
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
            totalHT: returnDoc.totalBaseHT || 0,
            totalTVA: returnDoc.totalTVA || 0,
            totalTTC: returnDoc.totalTTC || 0,
            notes: returnDoc.notes,
            statut: returnDoc.statut,
            // Include discount info for template to use if needed
            remiseGlobalePct: returnDoc.remiseGlobalePct
        };

        // 4. Generate PDF
        const doc = generateRetourAchatPdf(pdfData, companyInfo);
        const pdfBuffer = doc.output('arraybuffer');

        // 5. Return Response
        return new NextResponse(pdfBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${returnDoc.numero}.pdf"`,
            },
        });

    } catch (error) {
        console.error('Error generating PDF:', error);
        return NextResponse.json({ error: 'Error generating PDF' }, { status: 500 });
    }
}
