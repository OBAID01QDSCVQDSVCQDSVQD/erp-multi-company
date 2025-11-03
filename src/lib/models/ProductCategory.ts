import mongoose, { Document, Schema } from 'mongoose';

export interface IProductCategory extends Document {
  tenantId: string;
  code: string;
  nom: string;
  description?: string;
  parentCode?: string;
  actif: boolean;
}

const ProductCategorySchema = new Schema<IProductCategory>({
  tenantId: { type: String, required: true, index: true },
  code: { type: String, required: true, uppercase: true, trim: true },
  nom: { type: String, required: true, trim: true },
  description: { type: String },
  parentCode: { type: String, uppercase: true, trim: true },
  actif: { type: Boolean, default: true },
}, { timestamps: true });

ProductCategorySchema.index({ tenantId: 1, code: 1 }, { unique: true });

export default mongoose.models.ProductCategory || mongoose.model<IProductCategory>('ProductCategory', ProductCategorySchema);


