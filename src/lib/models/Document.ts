import mongoose, { Document, Schema } from 'mongoose';

export interface IDocumentLine {
  productId?: string;
  codeAchat?: string;
  categorieCode?: string;
  designation: string;
  uomCode?: string;
  quantite: number;
  prixUnitaireHT: number;
  taxCode?: string;
  tvaPct?: number;
  remisePct?: number;
  sourceLineId?: string; // For tracking partial conversions
  qtyLivree?: number; // For deliveries
  qtyRecue?: number; // For receipts
  qtyFacturee?: number; // For invoicing
}

export interface IDocument extends Document {
  tenantId: string;
  
  // Basic info
  type: 'DEVIS' | 'BC' | 'BL' | 'FAC' | 'AVOIR' | 'PO' | 'BR' | 'FACFO' | 'AVOIRFO' | 'INT_FAC' | 'RETOUR';
  numero: string;
  dateDoc: Date;
  statut?: 'BROUILLON' | 'VALIDEE' | 'PARTIELLEMENT_PAYEE' | 'PAYEE' | 'ANNULEE';
  
  // Party (customer or supplier)
  customerId?: mongoose.Types.ObjectId;
  supplierId?: mongoose.Types.ObjectId;
  
  // Project reference
  projetId?: mongoose.Types.ObjectId;
  
  // BL reference (for RETOUR type)
  blId?: mongoose.Types.ObjectId;
  
  // References
  referenceExterne?: string;
  bonCommandeClient?: string;
  
  // Dates
  dateEcheance?: Date;
  dateLivraisonPrevue?: Date;
  dateLivraisonReelle?: Date;
  dateValidite?: Date;
  
  // Lines
  lignes: IDocumentLine[];
  
  // Totals (calculated)
  totalBaseHT: number;
  totalTVA: number;
  totalTTC: number;
  timbreFiscal?: number;
  retenueSource?: number;
  netAPayer: number;
  totalTVADeductible?: number; // For purchases
  remiseGlobalePct?: number; // Global discount percentage
  fodec?: {
    enabled: boolean;
    tauxPct: number;
    montant?: number;
  };
  
  // Settings
  devise?: string;
  tauxChange?: number;
  lieuLivraison?: string;
  moyenTransport?: string;
  
  // Payment
  modePaiement?: string;
  conditionsPaiement?: string;
  
  // Metadata
  notes?: string;
  notesInterne?: string;
  createdBy?: string;
  archived?: boolean;
  linkedDocuments?: string[]; // Parent/child references
}

const DocumentLineSchema = new Schema({
  productId: { type: String },
  codeAchat: { type: String },
  categorieCode: { type: String },
  designation: { type: String, required: true },
  uomCode: { type: String },
  quantite: { type: Number, required: true },
  prixUnitaireHT: { type: Number, required: true, min: 0 },
  taxCode: { type: String },
  tvaPct: { type: Number, min: 0, max: 100 },
  remisePct: { type: Number, min: 0, max: 100, default: 0 },
  sourceLineId: { type: String }, // Tracking partial
  qtyLivree: { type: Number, default: 0 },
  qtyRecue: { type: Number, default: 0 },
  qtyFacturee: { type: Number, default: 0 }
}, { _id: true });

const DocumentSchema = new (Schema as any)({
  tenantId: { type: String, required: true, index: true },
  
  type: { type: String, enum: ['DEVIS', 'BC', 'BL', 'FAC', 'AVOIR', 'PO', 'BR', 'FACFO', 'AVOIRFO', 'INT_FAC', 'RETOUR'], required: true },
  numero: { type: String, required: true },
  dateDoc: { type: Date, required: true, default: Date.now },
  statut: { type: String, enum: ['BROUILLON', 'VALIDEE', 'PARTIELLEMENT_PAYEE', 'PAYEE', 'ANNULEE'], default: 'BROUILLON' },
  
  customerId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Customer',
    index: true 
  },
  supplierId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Supplier',
    index: true 
  },
  
  referenceExterne: { type: String },
  bonCommandeClient: { type: String },
  
  dateEcheance: { type: Date },
  dateLivraisonPrevue: { type: Date },
  dateLivraisonReelle: { type: Date },
  dateValidite: { type: Date },
  
  lignes: [DocumentLineSchema],
  
  totalBaseHT: { type: Number, default: 0 },
  totalTVA: { type: Number, default: 0 },
  totalTTC: { type: Number, default: 0 },
  timbreFiscal: { type: Number, default: 0 },
  retenueSource: { type: Number, default: 0 },
  netAPayer: { type: Number, default: 0 },
  totalTVADeductible: { type: Number, default: 0 },
  remiseGlobalePct: { type: Number, default: 0, min: 0, max: 100 },
  fodec: {
    enabled: { type: Boolean, default: false },
    tauxPct: { type: Number, default: 1, min: 0, max: 100 },
    montant: { type: Number, default: 0 }
  },
  
  devise: { type: String, default: 'TND' },
  tauxChange: { type: Number, default: 1 },
  lieuLivraison: { type: String },
  moyenTransport: { type: String },
  
  modePaiement: { type: String },
  conditionsPaiement: { type: String },
  
  notes: { type: String },
  notesInterne: { type: String },
  createdBy: { type: String },
  archived: { type: Boolean, default: false },
  linkedDocuments: { type: [String] },
  projetId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Project',
    index: true 
  },
  blId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Document',
    index: true 
  }
}, { timestamps: true });

// Indexes
DocumentSchema.index({ tenantId: 1, type: 1, dateDoc: -1 });
DocumentSchema.index({ tenantId: 1, type: 1, numero: 1 }, { unique: true });
DocumentSchema.index({ tenantId: 1, customerId: 1 });
DocumentSchema.index({ tenantId: 1, supplierId: 1 });
DocumentSchema.index({ tenantId: 1, projetId: 1 });
DocumentSchema.index({ tenantId: 1, blId: 1 });
DocumentSchema.index({ 'lignes.productId': 1 });

// Clear cache
if (mongoose.models.Document) {
  delete mongoose.models.Document;
}

// Use 'documents' as collection name for all document types
export default mongoose.model<IDocument>('Document', DocumentSchema, 'documents');
