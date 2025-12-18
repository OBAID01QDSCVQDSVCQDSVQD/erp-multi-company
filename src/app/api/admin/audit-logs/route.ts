
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import AuditLog from '@/lib/models/AuditLog';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
        }

        await connectDB();

        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '50');
        const type = searchParams.get('type');
        const user = searchParams.get('user');

        const query: any = {};
        if (type && type !== 'all') {
            query.action = type;
        }
        if (user) {
            query.$or = [
                { userName: { $regex: user, $options: 'i' } },
                { userEmail: { $regex: user, $options: 'i' } }
            ];
        }

        const logs = await (AuditLog as any).find(query)
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        return NextResponse.json(logs);
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}
