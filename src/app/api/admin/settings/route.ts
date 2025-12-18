import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import SystemSettings from '@/lib/models/SystemSettings';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
        }

        await connectDB();

        let settings = await (SystemSettings as any).findOne();
        if (!settings) {
            settings = await (SystemSettings as any).create({});
        }

        return NextResponse.json(settings);
    } catch (error) {
        console.error('Error fetching system settings:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
        }

        const body = await request.json();

        await connectDB();

        const settings = await (SystemSettings as any).findOneAndUpdate(
            {},
            {
                ...body,
                updatedBy: session.user.id,
                updatedAt: new Date()
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        // Log action
        const { logAction } = await import('@/lib/logger');
        await logAction(
            session,
            'UPDATE_SETTINGS',
            'SystemSettings',
            'Updated global system settings',
            { changes: Object.keys(body) }
        );

        return NextResponse.json(settings);
    } catch (error) {
        console.error('Error updating system settings:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}
