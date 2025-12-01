import mongoose, { Document, Schema } from 'mongoose';

export interface ICounter extends Document {
  tenantId: string;
  seqName: string;
  value: number;
  createdAt: Date;
  updatedAt: Date;
}

const CounterSchema = new Schema({
  tenantId: {
    type: String,
    required: true,
    index: true,
  },
  seqName: {
    type: String,
    required: true,
    enum: ['devis', 'bc', 'bl', 'fac', 'avoir', 'ca', 'br', 'facfo', 'avoirfo', 'expense', 'int_fac', 'retour'],
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

let Counter: mongoose.Model<ICounter>;

if ((mongoose.models as any)['Counter']) {
  Counter = (mongoose.models as any)['Counter'] as mongoose.Model<ICounter>;
} else {
  Counter = (mongoose.model('Counter', CounterSchema) as any) as mongoose.Model<ICounter>;
}

export default Counter;