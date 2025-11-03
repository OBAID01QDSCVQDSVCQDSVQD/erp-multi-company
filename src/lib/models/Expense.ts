import mongoose, { Document, Schema } from 'mongoose';

export interface IExpenseItem {
  description: string;
  montant: number;
  devise: string;
  tvaPct: number;
  tvaDeductiblePct: number;
}

export interface IPieceJointe {
  nom: string;
  url: string;
  type: string;
  taille: number;
  uploadedAt: Date;
}

export interface IExpense extends Document {
  tenantId: string;
  numero: string;
  date: Date;
  categorieId: mongoose.Types.ObjectId;
  description: string;
  montant: number;
  devise: string;
  tvaPct: number;
  tvaDeductiblePct: number;
  modePaiement: 'especes' | 'cheque' | 'virement' | 'carte' | 'autre';
  fournisseurId?: mongoose.Types.ObjectId;
  employeId?: mongoose.Types.ObjectId;
  projetId?: mongoose.Types.ObjectId;
  interventionId?: mongoose.Types.ObjectId;
  statut: 'brouillon' | 'en_attente' | 'valide' | 'paye' | 'rejete';
  piecesJointes: IPieceJointe[];
  notesInterne?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PieceJointeSchema = new Schema<IPieceJointe>({
  nom: { type: String, required: true },
  url: { type: String, required: true },
  type: { type: String, required: true },
  taille: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now },
});

const ExpenseSchema = new Schema<IExpense>({
  tenantId: {
    type: String,
    required: true,
    index: true,
  },
  numero: {
    type: String,
    required: true,
    unique: true,
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
  categorieId: {
    type: Schema.Types.ObjectId,
    ref: 'ExpenseCategory',
    required: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  montant: {
    type: Number,
    required: true,
    min: 0,
  },
  devise: {
    type: String,
    required: true,
    default: 'EUR',
  },
  tvaPct: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 0,
  },
  tvaDeductiblePct: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 0,
  },
  modePaiement: {
    type: String,
    enum: ['especes', 'cheque', 'virement', 'carte', 'autre'],
    required: true,
  },
  fournisseurId: {
    type: Schema.Types.ObjectId,
    ref: 'Supplier',
  },
  employeId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  projetId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
  },
  interventionId: {
    type: Schema.Types.ObjectId,
    ref: 'Intervention',
  },
  statut: {
    type: String,
    enum: ['brouillon', 'en_attente', 'valide', 'paye', 'rejete'],
    default: 'brouillon',
  },
  piecesJointes: [PieceJointeSchema],
  notesInterne: {
    type: String,
    trim: true,
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

// Index pour les recherches
ExpenseSchema.index({ tenantId: 1, numero: 1 });
ExpenseSchema.index({ tenantId: 1, date: -1 });
ExpenseSchema.index({ tenantId: 1, categorieId: 1 });
ExpenseSchema.index({ tenantId: 1, statut: 1 });
ExpenseSchema.index({ tenantId: 1, projetId: 1 });

export default mongoose.models.Expense || mongoose.model<IExpense>('Expense', ExpenseSchema);
