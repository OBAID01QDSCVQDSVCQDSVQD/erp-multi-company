import mongoose, { Document, Schema } from 'mongoose';

export interface IReglement extends Document {
  tenantId: string;
  
  type: 'client' | 'fournisseur'; // Payment type
  sens: 'entree' | 'sortie'; // Cash flow direction
  
  customerId?: string;
  supplierId?: string;
  
  documentId: string; // Related invoice/credit-note
  montant: number;
  devise?: string;
  
  modePaiement: 'Especes' | 'Virement' | 'Cheque' | 'Carte' | 'Traite' | 'Autre';
  
  numeroCheque?: string;
  banqueCheque?: string;
  dateCheque?: Date;
  
  virementReference?: string;
  virementDate?: Date;
  
  traiteNumero?: string;
  traiteEcheance?: Date;
  
  datePaiement: Date;
  
  notes?: string;
  processedBy?: string;
  
  docOriginal?: string; // Original document for payment (attachment)
}

const ReglementSchema = new Schema<IReglement>({
  tenantId: { type: String, required: true, index: true },
  
  type: { type: String, enum: ['client', 'fournisseur'], required: true },
  sens: { type: String, enum: ['entree', 'sortie'], required: true },
  
  customerId: { type: String },
  supplierId: { type: String },
  
  documentId: { type: String, required: true, index: true },
  montant: { type: Number, required: true, min: 0 },
  devise: { type: String, default: 'TND' },
  
  modePaiement: { 
    type: String, 
    enum: ['Especes', 'Virement', 'Cheque', 'Carte', 'Traite', 'Autre'],
    required: true 
  },
  
  numeroCheque: { type: String },
  banqueCheque: { type: String },
  dateCheque: { type: Date },
  
  virementReference: { type: String },
  virementDate: { type: Date },
  
  traiteNumero: { type: String },
  traiteEcheance: { type: Date },
  
  datePaiement: { type: Date, required: true, default: Date.now },
  
  notes: { type: String },
  processedBy: { type: String },
  
  docOriginal: { type: String }
}, { timestamps: true });

// Indexes
ReglementSchema.index({ tenantId: 1, datePaiement: -1 });
ReglementSchema.index({ tenantId: 1, type: 1 });
ReglementSchema.index({ tenantId: 1, customerId: 1 });
ReglementSchema.index({ tenantId: 1, supplierId: 1 });
ReglementSchema.index({ documentId: 1 });

// Clear cache
if (mongoose.models.Reglement) {
  delete mongoose.models.Reglement;
}

export default mongoose.model<IReglement>('Reglement', ReglementSchema);
