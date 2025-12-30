import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Notification from '@/lib/models/Notification';

export async function GET(request: NextRequest) {
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

    // Fetch recent notifications (both read and unread)
    const notifications = await Notification.find({
      tenantId,
      userId: user.id,
    })
      .sort({ createdAt: -1 })
      .limit(20);

    // Count unread notifications seperately
    const unreadCount = await Notification.countDocuments({
      tenantId,
      userId: user.id,
      status: 'unread',
    });

    // Auto-cleanup corrupted notifications (Temporary Fix)
    // Remove if message or title contains "undefined"
    await Notification.deleteMany({
      tenantId,
      $or: [
        { title: { $regex: 'undefined', $options: 'i' } },
        { message: { $regex: 'undefined', $options: 'i' } }
      ]
    });

    // Filter out from current result just in case (though deleteMany is async, might race)
    const cleanNotifications = notifications.filter(n =>
      !n.title.toLowerCase().includes('undefined') &&
      !n.message.toLowerCase().includes('undefined')
    );

    return NextResponse.json({ notifications: cleanNotifications, unreadCount });
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
