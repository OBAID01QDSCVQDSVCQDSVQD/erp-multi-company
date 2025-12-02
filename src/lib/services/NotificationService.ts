import connectDB from '@/lib/mongodb';
import Notification, { NotificationChannel } from '@/lib/models/Notification';
import CompanySettings from '@/lib/models/CompanySettings';
import mongoose from 'mongoose';

interface BaseNotificationPayload {
  tenantId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  channel?: NotificationChannel;
  createdBy?: string;
  // Optional deduplication key to avoid spamming (e.g. `invoice_overdue_daily`)
  dedupeKey?: string;
}

interface UserNotificationPayload extends BaseNotificationPayload {
  userId: string;
  userEmail?: string;
}

interface AdminNotificationPayload extends BaseNotificationPayload {
  // Optional: limit to specific permission (e.g. 'sales_invoices', 'manage_subscriptions')
  permission?: string;
}

export class NotificationService {
  /**
   * Create a notification for a specific user
   */
  static async notifyUser(payload: UserNotificationPayload) {
    const {
      tenantId,
      userId,
      type,
      title,
      message,
      link,
      channel = 'in_app',
      createdBy,
      dedupeKey,
      userEmail,
    } = payload;

    await connectDB();

    // Optional deduplication: avoid creating too many identical notifications
    if (dedupeKey) {
      const since = new Date();
      since.setHours(since.getHours() - 24);

      const existing = await (Notification as any).findOne({
        tenantId,
        userId,
        type,
        'metadata.dedupeKey': dedupeKey,
        createdAt: { $gte: since },
      }).lean();

      if (existing) {
        return existing;
      }
    }

    const notificationData: any = {
      tenantId,
      userId,
      type,
      title,
      message,
      link,
      channel,
      createdBy,
      status: 'unread',
    };

    if (userEmail) {
      notificationData.userEmail = userEmail;
    }

    if (dedupeKey) {
      notificationData.metadata = { dedupeKey };
    }

    const notification = new (Notification as any)(notificationData);
    await notification.save();

    // Email sending will be implemented via a dedicated EmailService
    if (channel === 'email' || channel === 'both') {
      await this.sendEmailNotification(tenantId, userId, {
        title,
        message,
        link,
        type,
      });
    }

    return notification;
  }

  /**
   * Notify all admins (or users with a specific permission) of a tenant
   */
  static async notifyAdmins(payload: AdminNotificationPayload) {
    const { tenantId, permission, ...rest } = payload;

    await connectDB();

    // Load users from the database
    const { default: User } = await import('@/lib/models/User');

    // In our User model we store companyId (ObjectId) and isActive, not tenantId/actif
    const query: any = {
      companyId: new mongoose.Types.ObjectId(tenantId),
      isActive: true,
    };

    // If permission is provided, filter by it, otherwise target role admin
    if (permission) {
      query.$or = [
        { permissions: 'all' },
        { permissions: permission },
      ];
    } else {
      query.$or = [
        { role: 'admin' },
        { permissions: 'all' },
      ];
    }

    const admins = await (User as any).find(query).lean();
    if (!admins || admins.length === 0) {
      return;
    }

    // Create notifications for each admin
    const notifyPromises = admins.map((admin: any) =>
      this.notifyUser({
        ...rest,
        tenantId,
        userId: admin._id.toString(),
        userEmail: admin.email,
      })
    );

    await Promise.all(notifyPromises);
  }

  /**
   * Placeholder for email notifications, to be implemented / integrated
   * with the existing email infrastructure.
   */
  private static async sendEmailNotification(
    tenantId: string,
    userId: string,
    payload: { title: string; message: string; link?: string; type: string }
  ) {
    try {
      // Try to load EmailService if it exists
      const { default: EmailService } = await import('@/lib/services/EmailService').catch(
        () => ({ default: null })
      );

      if (!EmailService) {
        // No email service configured yet; skip silently
        return;
      }

      const { default: User } = await import('@/lib/models/User');
      const user = await (User as any).findOne({
        _id: new mongoose.Types.ObjectId(userId),
        tenantId,
      }).lean();

      if (!user || !user.email) {
        return;
      }

      const subject = payload.title;
      const body = `${payload.message}${
        payload.link ? `\n\nVoir plus: ${payload.link}` : ''
      }`;

      await (EmailService as any).sendNotificationEmail({
        to: user.email,
        subject,
        text: body,
      });
    } catch (err) {
      console.error('Error sending email notification:', err);
    }
  }
}

export default NotificationService;


