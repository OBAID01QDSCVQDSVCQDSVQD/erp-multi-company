import mongoose, { Schema, Document } from 'mongoose';

export interface ISubscription extends Document {
  companyId: mongoose.Types.ObjectId;
  plan: 'free' | 'starter' | 'premium';
  status: 'active' | 'inactive' | 'cancelled' | 'expired';
  startDate: Date;
  endDate?: Date;
  renewalDate?: Date;
  documentsUsed: number;
  documentsLimit: number; // -1 for unlimited
  price: number;
  currency: string;
  paymentMethod?: string;
  lastPaymentDate?: Date;
  nextPaymentDate?: Date;
  autoRenew: boolean;
  cancelledAt?: Date;
  cancellationReason?: string;
  notes?: string;
  // Plan change request fields
  pendingPlanChange?: 'free' | 'starter' | 'premium';
  pendingPlanChangeDate?: Date;
  pendingPlanChangeReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema({
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  },
  plan: {
    type: String,
    enum: ['free', 'starter', 'premium'],
    required: true,
    default: 'free',
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'cancelled', 'expired'],
    required: true,
    default: 'active',
  },
  startDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  endDate: {
    type: Date,
  },
  renewalDate: {
    type: Date,
  },
  documentsUsed: {
    type: Number,
    default: 0,
    min: 0,
  },
  documentsLimit: {
    type: Number,
    required: true,
    default: 100, // Free plan: 100 documents/year
  },
  price: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
  },
  currency: {
    type: String,
    default: 'TND',
  },
  paymentMethod: {
    type: String,
  },
  lastPaymentDate: {
    type: Date,
  },
  nextPaymentDate: {
    type: Date,
  },
  autoRenew: {
    type: Boolean,
    default: true,
  },
  cancelledAt: {
    type: Date,
  },
  cancellationReason: {
    type: String,
  },
  notes: {
    type: String,
  },
  // Plan change request fields
  pendingPlanChange: {
    type: String,
    enum: ['free', 'starter', 'premium'],
  },
  pendingPlanChangeDate: {
    type: Date,
  },
  pendingPlanChangeReason: {
    type: String,
  },
}, {
  timestamps: true,
});

// Index for efficient queries
SubscriptionSchema.index({ companyId: 1, status: 1 });
SubscriptionSchema.index({ status: 1, renewalDate: 1 });
SubscriptionSchema.index({ plan: 1, status: 1 });

// @ts-ignore - Schema type is too complex for TypeScript to infer, but works at runtime
export default mongoose.models.Subscription || mongoose.model<ISubscription>('Subscription', SubscriptionSchema);

