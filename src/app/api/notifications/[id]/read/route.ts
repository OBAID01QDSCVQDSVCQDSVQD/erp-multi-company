import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Notification from '@/lib/models/Notification';

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = params;
        if (!id) {
            return NextResponse.json({ error: 'ID missing' }, { status: 400 });
        }

        await connectDB();

        const notification = await Notification.findOneAndUpdate(
            { _id: id, userId: session.user.id }, // Security: ensure user owns notification
            {
                status: 'read',
                readAt: new Date()
            },
            { new: true }
        );

        if (!notification) {
            return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, notification });
    } catch (error: any) {
        console.error('Error marking notification as read:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
