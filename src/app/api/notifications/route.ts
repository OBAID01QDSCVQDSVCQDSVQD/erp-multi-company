import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Notification from '@/lib/models/Notification';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all'; // unread | all
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const tenantId = session.user.companyId?.toString() || '';
    const userEmail = session.user.email as string | undefined;

    if (!tenantId || !userEmail) {
      return NextResponse.json({ error: 'Tenant ou email utilisateur introuvable' }, { status: 400 });
    }

    const query: any = {
      tenantId,
      userEmail,
    };

    if (status === 'unread') {
      query.status = 'unread';
    }

    const notificationsRaw = await (Notification as any)
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 3) // جلب أكثر شوية قبل ما نعمل dedupe
      .lean();

    // إزالة التكرار: نفس dedupeKey أو نفس عنوان الفاتورة نحتفظو بآخر واحدة فقط
    const seen = new Set<string>();
    const notifications = notificationsRaw.filter((n: any) => {
      const dedupe =
        (n.metadata && n.metadata.dedupeKey) ||
        (typeof n.title === 'string' ? n.title : n._id.toString());
      if (seen.has(dedupe)) return false;
      seen.add(dedupe);
      return true;
    }).slice(0, limit);

    const unreadCountDb = await (Notification as any).countDocuments({
      tenantId,
      userEmail,
      status: 'unread',
    });

    // عدّاد غير المقروءة بعد إزالة التكرار في الواجهة
    const unreadCount = notifications.filter((n: any) => n.status === 'unread').length || unreadCountDb;

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error: any) {
    console.error('Erreur GET /notifications:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const body = await request.json();
    const { id, markAllRead } = body || {};

    const tenantId = session.user.companyId?.toString() || '';
    const userEmail = session.user.email as string | undefined;

    if (!tenantId || !userEmail) {
      return NextResponse.json({ error: 'Tenant ou email utilisateur introuvable' }, { status: 400 });
    }

    const now = new Date();

    if (markAllRead) {
      await (Notification as any).updateMany(
        { tenantId, userEmail, status: 'unread' },
        { $set: { status: 'read', readAt: now } }
      );
    } else if (id) {
      await (Notification as any).updateOne(
        { _id: id, tenantId, userEmail },
        { $set: { status: 'read', readAt: now } }
      );
    } else {
      return NextResponse.json({ error: 'Aucune action spécifiée' }, { status: 400 });
    }

    const unreadCount = await (Notification as any).countDocuments({
      tenantId,
      userEmail,
      status: 'unread',
    });

    return NextResponse.json({ success: true, unreadCount });
  } catch (error: any) {
    console.error('Erreur PATCH /notifications:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}
