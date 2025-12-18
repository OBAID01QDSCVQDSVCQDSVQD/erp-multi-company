
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import SystemSettings from '@/lib/models/SystemSettings';

export async function GET(request: NextRequest) {
    try {
        await connectDB();
        const settings = await (SystemSettings as any).findOne({}, 'announcementMessage systemName supportPhone contactEmail registrationEnabled maintenanceMode');
        return NextResponse.json(settings || {});
    } catch (error) {
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}
