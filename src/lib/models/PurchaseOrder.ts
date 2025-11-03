import mongoose, { Document, Schema } from 'mongoose';

export interface IPurchaseOrderLine {
  productId?: string;
  reference?: string;
  designation: string;
  quantite: number;
  unite: string;
  prixUnitaireHT: number;
  remisePct?: number;
  tvaPct?: number;
  totalLigneHT: number;
  totalLigneTVA: number;
  totalLigneTTC: number;
}

export interface IPurchaseOrder extends Document {
  societeId: string;
  numero: string;
  dateDoc: Date;
  fournisseurId: string;
  fournisseurNom?: string;
  fournisseurCode?: string;
  devise?: string;
  statut: 'BROUILLON' | 'VALIDEE' | 'RECEPTION_PARTIELLE' | 'CLOTUREE' | 'ANNULEE';
  conditionsPaiement?: string;
  adresseLivraison?: string;
  notes?: string;
  lignes: IPurchaseOrderLine[];
  totalBaseHT: number;
  totalRemise: number;
  totalTVA: number;
  timbreFiscal?: number;
  totalTTC: number;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseOrderLineSchema = new Schema({
  productId: { type: String },
  reference: { type: String },
  designation: { type: String, required: true },
  quantite: { type: Number, required: true, min: 0 },
  unite: { type: String, default: 'PCE' },
  prixUnitaireHT: { type: Number, required: true, min: 0 },
  remisePct: { type: Number, default: 0, min: 0, max: 100 },
  tvaPct: { type: Number, default: 0, min: 0, max: 100 },
  totalLigneHT: { type: Number, default: 0 },
  totalLigneTVA: { type: Number, default: 0 },
  totalLigneTTC: { type: Number, default: 0 }
} as any);

const PurchaseOrderSchema = new Schema({
  societeId: { type: String, required: true, index: true },
  numero: { type: String, required: true },
  dateDoc: { type: Date, required: true, default: Date.now },
  fournisseurId: { type: String, required: true },
  fournisseurNom: { type: String },
  fournisseurCode: { type: String },
  devise: { type: String, default: 'TND' },
  statut: {
    type: String,
    enum: ['BROUILLON', 'VALIDEE', 'RECEPTION_PARTIELLE', 'CLOTUREE', 'ANNULEE'],
    default: 'BROUILLON'
  },
  conditionsPaiement: { type: String },
  adresseLivraison: { type: String },
  notes: { type: String },
  lignes: [PurchaseOrderLineSchema],
  totalBaseHT: { type: Number, default: 0 },
  totalRemise: { type: Number, default: 0 },
  totalTVA: { type: Number, default: 0 },
  timbreFiscal: { type: Number, default: 0 },
  totalTTC: { type: Number, default: 0 },
  createdBy: { type: String }
} as any, { timestamps: true });

// Indexes
PurchaseOrderSchema.index({ societeId: 1, numero: 1 }, { unique: true });
PurchaseOrderSchema.index({ societeId: 1, dateDoc: -1 });
PurchaseOrderSchema.index({ societeId: 1, fournisseurId: 1 });
PurchaseOrderSchema.index({ societeId: 1, statut: 1 });

if (mongoose.models.PurchaseOrder) {
  delete mongoose.models.PurchaseOrder;
}
export default mongoose.model<any>('PurchaseOrder', PurchaseOrderSchema, 'purchase_orders');

