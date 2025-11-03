import mongoose, { Document, Schema } from 'mongoose';

export interface IProductAttribute extends Document {
  tenantId: string;
  code: string;
  nom: string;
  type: 'texte' | 'nombre' | 'bool' | 'liste';
  valeurs?: string[];
  actif: boolean;
}

const ProductAttributeSchema = new Schema<IProductAttribute>({
  tenantId: { type: String, required: true, index: true },
  code: { type: String, required: true, uppercase: true, trim: true },
  nom: { type: String, required: true, trim: true },
  type: { type: String, enum: ['texte','nombre','bool','liste'], required: true },
  valeurs: { type: [String] },
  actif: { type: Boolean, default: true },
}, { timestamps: true });

ProductAttributeSchema.index({ tenantId: 1, code: 1 }, { unique: true });

export default mongoose.models.ProductAttribute || mongoose.model<IProductAttribute>('ProductAttribute', ProductAttributeSchema);


