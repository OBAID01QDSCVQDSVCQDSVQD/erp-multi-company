import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import crypto from 'crypto';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
        }

        const { id } = await params;
        await connectDB();

        const invoice = await (Document as any).findOne({ _id: id });
        if (!invoice) {
            return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 });
        }

        // Check if user has access to this tenant
        const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
        if (invoice.tenantId !== tenantId && session.user.role !== 'SUPER_ADMIN') {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
        }

        // Check if token exists AND is in the new format (starts with F-)
        if (invoice.publicToken && invoice.publicToken.startsWith('F-')) {
            return NextResponse.json({ token: invoice.publicToken });
        }

        // Generate descriptive token: F-[Numero]-[Random]
        // Example: F-FAC-2025-0048-1a2b
        const randomSuffix = crypto.randomBytes(3).toString('hex'); // 6 chars hex
        const sanitizedNum = invoice.numero.replace(/[^a-zA-Z0-9-_]/g, '-');
        const token = `F-${sanitizedNum}-${randomSuffix}`;

        invoice.publicToken = token;
        await invoice.save();

        return NextResponse.json({ token });

    } catch (error: any) {
        console.error('Error generating share token:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
