import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Warranty from '@/lib/models/Warranty';
import CompanySettings from '@/lib/models/CompanySettings';
import { generateWarrantyPdf } from '@/lib/utils/pdf/warrantyTemplate';

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const { searchParams } = new URL(req.url);
        const token = searchParams.get('token');

        let tenantId: string | null = null;
        let isPublic = false;

        if (token) {
            // Public access via token
            await connectDB();
            const publicWarranty = await (Warranty as any).findOne({ publicToken: token });

            if (publicWarranty) {
                tenantId = publicWarranty.tenantId;
                isPublic = true;
            } else {
                return NextResponse.json({ error: 'Invalid Token' }, { status: 403 });
            }
        } else {
            // Session access
            const session = await getServerSession(authOptions);
            if (!session) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            tenantId = req.headers.get('X-Tenant-Id') || (session.user as any).companyId;
        }

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
        }

        await connectDB();

        const query: any = { _id: params.id };
        if (isPublic) {
            query.publicToken = token;
        } else {
            query.tenantId = tenantId;
        }

        const warranty = await (Warranty as any).findOne(query)
            .populate('templateId')
            .populate('customerId')
            .populate('invoiceId')
            .lean();

        if (!warranty) {
            return NextResponse.json({ error: 'Warranty not found' }, { status: 404 });
        }

        const companySettings = await (CompanySettings as any).findOne({ tenantId });

        const includeStamp = searchParams.get('includeStamp') === 'true';

        // Use shared utility
        const doc = generateWarrantyPdf(warranty, companySettings, includeStamp);

        // Return PDF
        const pdfBuffer = doc.output('arraybuffer');

        return new NextResponse(pdfBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="Garantie-${warranty.certificateNumber}.pdf"`,
            },
        });

    } catch (error) {
        console.error('Error generating PDF:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
