import mongoose, { Document, Schema } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  code: string;
  description?: string;
  parentId?: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  code: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  parentId: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
  },
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Index pour la recherche
CategorySchema.index({ companyId: 1, code: 1 }, { unique: true });
CategorySchema.index({ companyId: 1, name: 1 });

export default mongoose.models.Category || mongoose.model<ICategory>('Category', CategorySchema);
