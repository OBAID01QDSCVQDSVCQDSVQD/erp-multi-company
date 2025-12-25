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

        const doc = await (Document as any).findOne({ _id: id });
        if (!doc) {
            return NextResponse.json({ error: 'Devis non trouvé' }, { status: 404 });
        }

        // Check if user has access to this tenant
        const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
        if (doc.tenantId !== tenantId && session.user.role !== 'SUPER_ADMIN') {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
        }

        // Check if token exists AND starts with D-
        if (doc.publicToken && doc.publicToken.startsWith('D-')) {
            return NextResponse.json({ token: doc.publicToken });
        }

        // Generate descriptive token: D-[Numero]-[Random]
        const randomSuffix = crypto.randomBytes(3).toString('hex');
        const sanitizedNum = doc.numero.replace(/[^a-zA-Z0-9-_]/g, '-');
        const token = `D-${sanitizedNum}-${randomSuffix}`;

        doc.publicToken = token;
        await doc.save();

        return NextResponse.json({ token });

    } catch (error: any) {
        console.error('Error generating share token:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
