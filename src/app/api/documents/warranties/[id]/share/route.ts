import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Warranty from '@/lib/models/Warranty';
import crypto from 'crypto';

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
        }

        const { id } = params;
        await connectDB();

        // Use 'any' cast to avoid strict typing issues with custom method setups if needed
        const warranty = await (Warranty as any).findOne({ _id: id });
        if (!warranty) {
            return NextResponse.json({ error: 'Garantie non trouvée' }, { status: 404 });
        }

        // Check if user has access to this tenant
        const tenantId = request.headers.get('X-Tenant-Id') || (session.user as any).companyId;
        if (warranty.tenantId !== tenantId) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
        }

        // Check if token exists
        if (warranty.publicToken) {
            return NextResponse.json({ token: warranty.publicToken });
        }

        // Generate descriptive token: GAR-[Numero]-[Random]
        const randomSuffix = crypto.randomBytes(3).toString('hex'); // 6 chars hex
        // Ensure we don't duplicate the prefix if it's already in the number
        const sanitizedNum = warranty.certificateNumber.replace(/[^a-zA-Z0-9-_]/g, '-');
        const token = sanitizedNum.startsWith('GAR-')
            ? `${sanitizedNum}-${randomSuffix}`
            : `GAR-${sanitizedNum}-${randomSuffix}`;

        warranty.publicToken = token;
        await warranty.save();

        return NextResponse.json({ token });

    } catch (error: any) {
        console.error('Error generating share token:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
