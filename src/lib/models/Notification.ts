import mongoose, { Document, Schema } from 'mongoose';

export type NotificationStatus = 'unread' | 'read' | 'archived';
export type NotificationChannel = 'in_app' | 'email' | 'both';

export interface INotification extends Document {
  tenantId: string;
  userId?: string;
  userEmail?: string;
  // Optional targeting by role/permission for future use
  role?: string;
  permission?: string;

  type: string;
  title: string;
  message: string;
  link?: string;

  status: NotificationStatus;
  channel: NotificationChannel;

  // Metadata / extra data (used e.g. for dedupeKey)
  metadata?: Record<string, any>;

  createdAt: Date;
  readAt?: Date;
  createdBy?: string;
}

const NotificationSchema = new Schema(
  {
    tenantId: { type: String, required: true, index: true },
    userId: { type: String, index: true },
    userEmail: { type: String, index: true },
    role: { type: String, index: true },
    permission: { type: String, index: true },

    type: { type: String, required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String },

    status: {
      type: String,
      enum: ['unread', 'read', 'archived'],
      default: 'unread',
      index: true,
    },
    channel: {
      type: String,
      enum: ['in_app', 'email', 'both'],
      default: 'in_app',
    },

    metadata: { type: Schema.Types.Mixed },

    readAt: { type: Date },
    createdBy: { type: String },
  },
  { timestamps: true }
);

// Clear model cache for hot-reload environments
if (mongoose.models.Notification) {
  delete mongoose.models.Notification;
}

export default mongoose.model<any>('Notification', NotificationSchema);
