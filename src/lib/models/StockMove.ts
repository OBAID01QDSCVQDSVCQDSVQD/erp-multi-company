import mongoose, { Document, Schema } from 'mongoose';

export interface IStockMove extends Document {
  tenantId: string;
  
  type: 'IN' | 'OUT' | 'TRANSFER' | 'ADJ' | 'RETOUR';
  category: 'vente' | 'achat' | 'inventaire' | 'transfert' | 'autre';
  
  warehouseCode?: string;
  warehouseDestination?: string; // For transfers
  
  documentId?: string; // Link to Document (BL, BR, etc.)
  documentType?: string;
  documentNumero?: string;
  
  productId: string;
  productCode?: string;
  designation?: string;
  
  uomCode?: string;
  quantite: number;
  quantiteBase: number; // Normalized quantity
  
  prixUnitaire?: number;
  
  etat?: 'disponible' | 'reserve' | 'endommage' | 'quarantaine' | 'expire';
  
  lot?: string;
  serie?: string;
  dateExpiration?: Date;
  
  notes?: string;
  processedBy?: string;
  
  reversed?: boolean; // If this move was reversed
  reversedBy?: string; // Reference to reversal move
}

const StockMoveSchema = new Schema<IStockMove>({
  tenantId: { type: String, required: true, index: true },
  
  type: { type: String, enum: ['IN', 'OUT', 'TRANSFER', 'ADJ', 'RETOUR'], required: true },
  category: { type: String, enum: ['vente', 'achat', 'inventaire', 'transfert', 'autre'], required: true },
  
  warehouseCode: { type: String },
  warehouseDestination: { type: String },
  
  documentId: { type: String, index: true },
  documentType: { type: String },
  documentNumero: { type: String },
  
  productId: { type: String, required: true, index: true },
  productCode: { type: String },
  designation: { type: String },
  
  uomCode: { type: String },
  quantite: { type: Number, required: true },
  quantiteBase: { type: Number, required: true },
  
  prixUnitaire: { type: Number, min: 0 },
  
  etat: { 
    type: String, 
    enum: ['disponible', 'reserve', 'endommage', 'quarantaine', 'expire'],
    default: 'disponible' 
  },
  
  lot: { type: String },
  serie: { type: String },
  dateExpiration: { type: Date },
  
  notes: { type: String },
  processedBy: { type: String },
  
  reversed: { type: Boolean, default: false },
  reversedBy: { type: String }
}, { timestamps: true });

// Indexes for fast queries
StockMoveSchema.index({ tenantId: 1, documentId: 1 });
StockMoveSchema.index({ tenantId: 1, productId: 1, createdAt: -1 });
StockMoveSchema.index({ tenantId: 1, warehouseCode: 1, type: 1 });
StockMoveSchema.index({ tenantId: 1, type: 1, category: 1, createdAt: -1 });

// Clear cache
if (mongoose.models.StockMove) {
  delete mongoose.models.StockMove;
}

export default mongoose.model<IStockMove>('StockMove', StockMoveSchema);
