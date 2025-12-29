
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import AuditLog from '@/lib/models/AuditLog';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
        }

        // Security Check: Only Admins can view audit logs
        if (session.user.role !== 'admin') {
            // Double check permissions just in case
            const perms = session.user.permissions || [];
            if (!perms.includes('all') && !perms.includes('settings')) {
                return NextResponse.json({ error: 'Accès refusé. Réservé aux administrateurs.' }, { status: 403 });
            }
        }

        const tenantId = req.headers.get('X-Tenant-Id') || session.user.companyId;
        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });
        }

        await connectDB();

        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '50');
        const page = parseInt(searchParams.get('page') || '1');
        const actionFilter = searchParams.get('action');
        const userFilter = searchParams.get('user');

        const query: any = { tenantId };

        if (actionFilter && actionFilter !== 'all') {
            query.action = actionFilter;
        }

        // Fuzzy search for user if needed, but for now exact match or skip
        // if (userFilter) { ... }

        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            (AuditLog as any).find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            (AuditLog as any).countDocuments(query)
        ]);

        return NextResponse.json({
            logs,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error: any) {
        console.error('Error fetching audit logs:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}
