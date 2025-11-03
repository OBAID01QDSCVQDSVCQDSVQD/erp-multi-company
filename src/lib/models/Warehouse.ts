import mongoose, { Document, Schema } from 'mongoose';

export interface IWarehouse extends Document {
  tenantId: string;
  code: string;
  libelle: string;
  adresse?: string;
  leadTimeJours: number;
  actif: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WarehouseSchema = new Schema<IWarehouse>({
  tenantId: { type: String, required: true, index: true },
  code: { type: String, required: true, uppercase: true, trim: true },
  libelle: { type: String, required: true, trim: true },
  adresse: { type: String },
  leadTimeJours: { type: Number, default: 1 },
  actif: { type: Boolean, default: true },
}, { timestamps: true });

WarehouseSchema.index({ tenantId: 1, code: 1 }, { unique: true });

export default mongoose.models.Warehouse || mongoose.model<IWarehouse>('Warehouse', WarehouseSchema);


