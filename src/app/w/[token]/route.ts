import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Warranty from '@/lib/models/Warranty';
import CompanySettings from '@/lib/models/CompanySettings';
import WarrantyTemplate from '@/lib/models/WarrantyTemplate';
import Customer from '@/lib/models/Customer';
import DocumentModel from '@/lib/models/Document';
import { generateWarrantyPdf } from '@/lib/utils/pdf/warrantyTemplate';

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

        // Ensure models are registered to avoid MissingSchemaError
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _registered = [WarrantyTemplate, Customer, DocumentModel];

        // Fetch warranty by publicToken
        const warranty = await (Warranty as any).findOne({
            publicToken: token
        })
            .populate('templateId')
            .populate('customerId')
            .populate('invoiceId');

        if (!warranty) {
            return NextResponse.json({ error: 'Lien invalide ou expiré' }, { status: 404 });
        }

        const tenantId = warranty.tenantId;

        // Fetch company settings
        const settings = await (CompanySettings as any).findOne({ tenantId });
        if (!settings) {
            return NextResponse.json({ error: 'Paramètres de société non trouvés' }, { status: 404 });
        }

        const pdfDoc = generateWarrantyPdf(warranty, settings);

        // Convert to buffer
        const pdfBuffer = Buffer.from(pdfDoc.output('arraybuffer'));

        // Return PDF as response
        const filename = `Garantie-${warranty.certificateNumber}.pdf`;
        return new NextResponse(pdfBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });

    } catch (error: any) {
        console.error('Error in public Warranty PDF generation:', error);
        return NextResponse.json(
            { error: 'Erreur système', details: error.message },
            { status: 500 }
        );
    }
}
