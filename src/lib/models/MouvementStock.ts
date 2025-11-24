import mongoose, { Document, Schema } from 'mongoose';

export interface IMouvementStock extends Document {
  societeId: string;
  productId: string;
  projectId?: mongoose.Types.ObjectId; // Link to Project
  type: 'ENTREE' | 'SORTIE' | 'INVENTAIRE';
  qte: number;
  date: Date;
  source: 'BR' | 'BL' | 'FAC' | 'INV' | 'AJUST' | 'TRANSFERT' | 'AUTRE';
  sourceId?: string;
  notes?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MouvementStockSchema = new Schema<IMouvementStock>({
  societeId: {
    type: String,
    required: true,
    index: true,
  },
  productId: {
    type: String,
    required: true,
    ref: 'Product',
    index: true,
  },
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    index: true,
  },
  type: {
    type: String,
    enum: ['ENTREE', 'SORTIE', 'INVENTAIRE'],
    required: true,
  },
  qte: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
  source: {
    type: String,
    enum: ['BR', 'BL', 'FAC', 'INV', 'AJUST', 'TRANSFERT', 'AUTRE'],
    required: true,
  },
  sourceId: {
    type: String,
  },
  notes: {
    type: String,
  },
  createdBy: {
    type: String,
  },
}, {
  timestamps: true,
});

// Indexes for efficient stock queries
MouvementStockSchema.index({ societeId: 1, productId: 1, date: -1 });
MouvementStockSchema.index({ societeId: 1, source: 1, sourceId: 1 });
MouvementStockSchema.index({ societeId: 1, projectId: 1 });
MouvementStockSchema.index({ date: -1 });

const MouvementStock = mongoose.models.MouvementStock || mongoose.model<IMouvementStock>('MouvementStock', MouvementStockSchema);

export default MouvementStock;
