import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import mongoose from 'mongoose';
import { encode } from 'next-auth/jwt';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
        }

        const { companyId } = await request.json();

        if (!mongoose.Types.ObjectId.isValid(companyId)) {
            return NextResponse.json({ error: 'ID entreprise invalide' }, { status: 400 });
        }

        await connectDB();

        // 1. Find the first admin user of the target company
        const targetUser = await (User as any).findOne({
            companyId: companyId,
            role: 'admin',
            isActive: true
        }).sort({ createdAt: 1 });

        if (!targetUser) {
            return NextResponse.json({ error: 'Aucun utilisateur administrateur trouvé pour cette entreprise' }, { status: 404 });
        }

        // 2. Generate a signed token
        const impersonationToken = await encode({
            token: {
                isImpersonation: true,
                targetEmail: targetUser.email,
                adminEmail: session.user.email // logging who performed the action
            } as any,
            secret: process.env.NEXTAUTH_SECRET!,
        });

        // Log action
        const { logAction } = await import('@/lib/logger');
        await logAction(
            session,
            'IMPERSONATE',
            'Company',
            `Impersonated company ${companyId} (User: ${targetUser.email})`,
            { targetUserId: targetUser._id, companyId }
        );

        return NextResponse.json({
            impersonationToken
        });

    } catch (error) {
        console.error('Error impersonating company:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}
