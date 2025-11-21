import mongoose, { Document, Schema } from 'mongoose';

export interface IExpenseItem {
  description?: string;
  montant: number;
  devise: string;
  tvaPct: number;
  tvaDeductiblePct: number;
}

export interface IPieceJointe {
  nom: string;
  url: string; // Cloudinary URL
  publicId?: string; // Cloudinary public ID
  type: string;
  taille: number;
  uploadedAt: Date;
  width?: number;
  height?: number;
  format?: string;
}

export interface IExpense extends Document {
  tenantId: string;
  societeId?: mongoose.Types.ObjectId; // For multi-sociétés
  numero: string;
  date: Date;
  categorieId: mongoose.Types.ObjectId;
  description?: string;
  centreCoutId?: mongoose.Types.ObjectId; // Cost center
  projetId?: mongoose.Types.ObjectId;
  
  // Montant et TVA
  montantType: 'HT' | 'TTC'; // User choice: HT or TTC
  montant: number; // The entered amount (HT or TTC)
  devise: string;
  taxCode: string; // TVA code
  tvaPct: number;
  tvaDeductiblePct: number; // Déductible Achats (%)
  
  // FODEC
  fodecActif: boolean;
  fodecRate: number; // Usually 1%
  fodecBase: 'avantRemise' | 'apresRemise'; // Calculation base
  
  // Retenue à la source
  retenueActif: boolean;
  retenueRate: number; // e.g., 1.5%, 3%, 5%
  retenueBase: 'TTC_TIMBRE'; // Calculation base (TTC - Timbre fiscal)
  
  // Timbre fiscal
  timbreFiscal: number; // Fixed amount (e.g., 1.000 TND)
  
  // Remise globale
  remiseGlobalePct: number; // Global discount (%)
  
  // Calculated totals (stored for reference)
  baseHT: number;
  fodec: number;
  remise: number;
  baseHTApresRemise: number;
  tvaBase: number;
  tva: number;
  tvaNonDeductible: number;
  retenue: number;
  totalHT: number;
  totalTaxes: number;
  totalTTC: number;
  netADecaisser: number; // TTC - retenue if retenue is withheld
  
  // Informations complémentaires
  modePaiement: 'especes' | 'cheque' | 'virement' | 'carte' | 'autre';
  fournisseurId?: mongoose.Types.ObjectId;
  employeId?: mongoose.Types.ObjectId;
  referencePiece?: string; // Num. facture fournisseur
  notesInterne?: string;
  
  // Statut
  statut: 'brouillon' | 'en_attente' | 'valide' | 'paye' | 'rejete';
  piecesJointes: IPieceJointe[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PieceJointeSchema = new (Schema as any)({
  nom: { type: String, required: true },
  url: { type: String, required: true }, // Cloudinary URL
  publicId: { type: String }, // Cloudinary public ID
  type: { type: String, required: true },
  taille: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now },
  width: { type: Number },
  height: { type: Number },
  format: { type: String },
});

const ExpenseSchema = new (Schema as any)({
  tenantId: {
    type: String,
    required: true,
    index: true,
  },
  societeId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
  },
  numero: {
    type: String,
    required: true,
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
    required: false,
    trim: true,
  },
  centreCoutId: {
    type: Schema.Types.ObjectId,
    ref: 'CostCenter',
  },
  projetId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
  },
  
  // Montant et TVA
  montantType: {
    type: String,
    enum: ['HT', 'TTC'],
    default: 'HT',
    required: true,
  },
  montant: {
    type: Number,
    required: true,
    min: 0,
  },
  devise: {
    type: String,
    required: true,
    default: 'TND',
  },
  taxCode: {
    type: String,
    required: true,
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
    default: 100,
  },
  
  // FODEC
  fodecActif: {
    type: Boolean,
    default: false,
  },
  fodecRate: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  fodecBase: {
    type: String,
    enum: ['avantRemise', 'apresRemise'],
    default: 'avantRemise',
  },
  
  // Retenue à la source
  retenueActif: {
    type: Boolean,
    default: false,
  },
  retenueRate: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  retenueBase: {
    type: String,
    enum: ['TTC_TIMBRE'],
    default: 'TTC_TIMBRE',
  },
  
  // Timbre fiscal
  timbreFiscal: {
    type: Number,
    min: 0,
    default: 0,
  },
  
  // Remise globale
  remiseGlobalePct: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  
  // Calculated totals
  baseHT: { type: Number, default: 0 },
  fodec: { type: Number, default: 0 },
  remise: { type: Number, default: 0 },
  baseHTApresRemise: { type: Number, default: 0 },
  tvaBase: { type: Number, default: 0 },
  tva: { type: Number, default: 0 },
  tvaNonDeductible: { type: Number, default: 0 },
  retenue: { type: Number, default: 0 },
  totalHT: { type: Number, default: 0 },
  totalTaxes: { type: Number, default: 0 },
  totalTTC: { type: Number, default: 0 },
  netADecaisser: { type: Number, default: 0 },
  
  // Informations complémentaires
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
  referencePiece: {
    type: String,
    trim: true,
  },
  notesInterne: {
    type: String,
    trim: true,
  },
  
  // Statut
  statut: {
    type: String,
    enum: ['brouillon', 'en_attente', 'valide', 'paye', 'rejete'],
    default: 'brouillon',
  },
  piecesJointes: [PieceJointeSchema],
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

// Index pour les recherches
ExpenseSchema.index({ tenantId: 1, numero: 1 }, { unique: true }); // Unique per tenant
ExpenseSchema.index({ tenantId: 1, date: -1 });
ExpenseSchema.index({ tenantId: 1, categorieId: 1 });
ExpenseSchema.index({ tenantId: 1, statut: 1 });
ExpenseSchema.index({ tenantId: 1, projetId: 1 });

// Delete existing model if it exists to ensure schema changes are applied
if ((mongoose.models as any)['Expense']) {
  delete (mongoose.models as any)['Expense'];
}
if ((mongoose as any).modelSchemas && (mongoose as any).modelSchemas.Expense) {
  delete (mongoose as any).modelSchemas.Expense;
}

let Expense: mongoose.Model<IExpense>;

if ((mongoose.models as any)['Expense']) {
  Expense = (mongoose.models as any)['Expense'] as mongoose.Model<IExpense>;
} else {
  Expense = (mongoose.model('Expense', ExpenseSchema) as any) as mongoose.Model<IExpense>;
}

export default Expense;
