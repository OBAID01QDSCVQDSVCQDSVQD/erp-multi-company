import mongoose, { Document, Schema } from 'mongoose';

export interface IStockState extends Document {
  code: string; // disponible, reserve, endommage, quarantaine, expire
  libelle: string;
  actif: boolean;
}

const StockStateSchema = new Schema<IStockState>({
  code: { type: String, required: true, unique: true, lowercase: true, trim: true },
  libelle: { type: String, required: true, trim: true },
  actif: { type: Boolean, default: true },
});

StockStateSchema.index({ code: 1 }, { unique: true });

export default mongoose.models.StockState || mongoose.model<IStockState>('StockState', StockStateSchema);


