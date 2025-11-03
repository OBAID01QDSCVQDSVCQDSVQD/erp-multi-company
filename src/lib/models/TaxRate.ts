import mongoose, { Document, Schema } from 'mongoose';

export interface ITaxRate extends Document {
  tenantId: string;
  code: string;
  libelle: string;
  tauxPct: number;
  applicableA: 'ventes' | 'achats' | 'les_deux';
  dateEffet: Date;
  actif: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TaxRateSchema = new Schema<ITaxRate>({
  tenantId: {
    type: String,
    required: true,
    index: true,
  },
  code: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
  libelle: {
    type: String,
    required: true,
    trim: true,
  },
  tauxPct: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  applicableA: {
    type: String,
    enum: ['ventes', 'achats', 'les_deux'],
    default: 'les_deux',
  },
  dateEffet: {
    type: Date,
    default: Date.now,
  },
  actif: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Index unique pour tenantId + code
TaxRateSchema.index({ tenantId: 1, code: 1 }, { unique: true });

// Index pour tenantId + actif
TaxRateSchema.index({ tenantId: 1, actif: 1 });

export default mongoose.models.TaxRate || mongoose.model<ITaxRate>('TaxRate', TaxRateSchema);
