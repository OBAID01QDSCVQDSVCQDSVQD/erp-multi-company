import mongoose, { Document, Schema } from 'mongoose';

export interface IExpenseCategory extends Document {
  tenantId: string;
  code: string;
  nom: string;
  description?: string;
  icone?: string;
  typeGlobal: 'exploitation' | 'consommable' | 'investissement' | 'financier' | 'exceptionnel';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseCategorySchema = new (Schema as any)({
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
  nom: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  icone: {
    type: String,
    trim: true,
  },
  typeGlobal: {
    type: String,
    enum: ['exploitation', 'consommable', 'investissement', 'financier', 'exceptionnel'],
    required: true,
    default: 'exploitation',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Index unique pour tenantId + code
ExpenseCategorySchema.index({ tenantId: 1, code: 1 }, { unique: true });

let ExpenseCategory: mongoose.Model<IExpenseCategory>;

if ((mongoose.models as any)['ExpenseCategory']) {
  ExpenseCategory = (mongoose.models as any)['ExpenseCategory'] as mongoose.Model<IExpenseCategory>;
} else {
  ExpenseCategory = (mongoose.model('ExpenseCategory', ExpenseCategorySchema) as any) as mongoose.Model<IExpenseCategory>;
}

export default ExpenseCategory;
