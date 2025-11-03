import mongoose, { Document, Schema } from 'mongoose';

export interface IInvoiceItem {
  productId: mongoose.Types.ObjectId;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  total: number;
}

export interface IInvoice extends Document {
  number: string;
  type: 'quote' | 'delivery' | 'invoice' | 'credit_note' | 'expense_note';
  status: 'draft' | 'sent' | 'paid' | 'cancelled';
  customerId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  date: Date;
  dueDate?: Date;
  items: IInvoiceItem[];
  subtotal: number;
  vatTotal: number;
  total: number;
  notes?: string;
  paymentTerms?: string;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  paidAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceItemSchema = new Schema<IInvoiceItem>({
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  vatRate: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  total: {
    type: Number,
    required: true,
    min: 0,
  },
});

const InvoiceSchema = new Schema<IInvoice>({
  number: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ['quote', 'delivery', 'invoice', 'credit_note', 'expense_note'],
    required: true,
  },
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'cancelled'],
    default: 'draft',
  },
  customerId: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  },
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
  dueDate: {
    type: Date,
  },
  items: [InvoiceItemSchema],
  subtotal: {
    type: Number,
    required: true,
    min: 0,
  },
  vatTotal: {
    type: Number,
    required: true,
    min: 0,
  },
  total: {
    type: Number,
    required: true,
    min: 0,
  },
  notes: {
    type: String,
    trim: true,
  },
  paymentTerms: {
    type: String,
    trim: true,
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'partial', 'paid'],
    default: 'unpaid',
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
}, {
  timestamps: true,
});

// Index pour la recherche
InvoiceSchema.index({ companyId: 1, number: 1 }, { unique: true });
InvoiceSchema.index({ companyId: 1, customerId: 1 });
InvoiceSchema.index({ companyId: 1, date: -1 });

export default mongoose.models.Invoice || mongoose.model<IInvoice>('Invoice', InvoiceSchema);
