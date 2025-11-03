import mongoose, { Document, Schema } from 'mongoose';

export interface ICounter extends Document {
  tenantId: string;
  seqName: string;
  value: number;
  createdAt: Date;
  updatedAt: Date;
}

const CounterSchema = new Schema<ICounter>({
  tenantId: {
    type: String,
    required: true,
    index: true,
  },
  seqName: {
    type: String,
    required: true,
    enum: ['devis', 'bc', 'bl', 'fac', 'avoir', 'ca', 'br', 'facfo', 'avoirfo'],
  },
  value: {
    type: Number,
    required: true,
    default: 0,
  },
}, {
  timestamps: true,
});

// Index unique pour tenantId + seqName
CounterSchema.index({ tenantId: 1, seqName: 1 }, { unique: true });

export default mongoose.models.Counter || mongoose.model<ICounter>('Counter', CounterSchema);