import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import { v4 as uuidv4 } from 'uuid';

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

        if (invoice.publicToken) {
            return NextResponse.json({ token: invoice.publicToken });
        }

        // Generate new token
        const token = uuidv4();
        invoice.publicToken = token;
        await invoice.save();

        return NextResponse.json({ token });

    } catch (error: any) {
        console.error('Error generating share token:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
