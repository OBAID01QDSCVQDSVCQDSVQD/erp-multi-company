import mongoose, { Document, Schema } from 'mongoose';

export interface IGlobalExpenseCategory extends Document {
  code: string;
  nom: string;
  typeGlobal: 'exploitation' | 'consommable' | 'investissement' | 'financier' | 'exceptionnel';
  icone?: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const GlobalExpenseCategorySchema = new Schema<IGlobalExpenseCategory>({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
  },
  nom: {
    type: String,
    required: true,
    trim: true,
  },
  typeGlobal: {
    type: String,
    enum: ['exploitation', 'consommable', 'investissement', 'financier', 'exceptionnel'],
    required: true,
    default: 'exploitation',
  },
  icone: {
    type: String,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Index unique pour code
GlobalExpenseCategorySchema.index({ code: 1 }, { unique: true });

export default mongoose.models.GlobalExpenseCategory || mongoose.model<IGlobalExpenseCategory>('GlobalExpenseCategory', GlobalExpenseCategorySchema);