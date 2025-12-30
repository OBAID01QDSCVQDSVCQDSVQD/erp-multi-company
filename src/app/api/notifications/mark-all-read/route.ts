import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Notification from '@/lib/models/Notification';

export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { user } = session;
        const tenantId = request.headers.get('X-Tenant-Id') || user.companyId;

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant ID missing' }, { status: 400 });
        }

        await connectDB();

        // Update all unread notifications for this user/tenant to 'read'
        await Notification.updateMany(
            {
                tenantId,
                userId: user.id,
                status: 'unread',
            },
            {
                $set: {
                    status: 'read',
                    readAt: new Date(),
                },
            }
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error marking all notifications as read:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
