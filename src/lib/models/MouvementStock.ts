import mongoose, { Document, Schema } from 'mongoose';

export interface IMouvementStock extends Document {
  societeId: string;
  productId: string;
  projectId?: mongoose.Types.ObjectId; // Link to Project
  type: 'ENTREE' | 'SORTIE' | 'INVENTAIRE';
  qte: number;
  date: Date;
  source: 'BR' | 'BL' | 'FAC' | 'INV' | 'AJUST' | 'TRANSFERT' | 'AUTRE' | 'RETOUR';
  sourceId?: string;
  notes?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MouvementStockSchema = new (Schema as any)({
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
    enum: ['BR', 'BL', 'FAC', 'INV', 'AJUST', 'TRANSFERT', 'AUTRE', 'RETOUR'],
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

let MouvementStock: any;
if (mongoose.models.MouvementStock) {
  // Model exists in cache, update the source enum if RETOUR is missing
  const existingModel = mongoose.models.MouvementStock as any;
  const sourcePath = existingModel.schema.path('source');
  if (sourcePath && sourcePath.enumValues && !sourcePath.enumValues.includes('RETOUR')) {
    // Update enum values dynamically
    sourcePath.enum = ['BR', 'BL', 'FAC', 'INV', 'AJUST', 'TRANSFERT', 'AUTRE', 'RETOUR'];
    sourcePath.enumValues = ['BR', 'BL', 'FAC', 'INV', 'AJUST', 'TRANSFERT', 'AUTRE', 'RETOUR'];
  }
  MouvementStock = existingModel;
} else {
  MouvementStock = mongoose.model<IMouvementStock>('MouvementStock', MouvementStockSchema) as any;
}

export default MouvementStock;
