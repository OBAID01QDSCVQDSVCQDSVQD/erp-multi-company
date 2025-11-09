import mongoose, { Document, Schema } from 'mongoose';

export interface IPaiementFournisseurLigne {
  factureId?: mongoose.Types.ObjectId; // Optional for payment on account
  numeroFacture?: string; // Optional for payment on account
  referenceFournisseur?: string; // N° facture fournisseur
  montantFacture?: number; // Montant total de la facture (optional for payment on account)
  montantPayeAvant?: number; // Montant déjà payé avant ce paiement (optional for payment on account)
  montantPaye: number; // Montant payé dans ce paiement
  soldeRestant?: number; // Solde restant après ce paiement (optional for payment on account)
  isPaymentOnAccount?: boolean; // Flag for payment on account
}

export interface IPaiementFournisseur extends Document {
  societeId: mongoose.Types.ObjectId;
  numero: string;
  datePaiement: Date;
  fournisseurId: mongoose.Types.ObjectId;
  fournisseurNom?: string;
  modePaiement: string; // Espèces, Virement, Chèque, Carte, etc.
  reference?: string; // Numéro de chèque, référence virement, etc.
  montantTotal: number;
  lignes: IPaiementFournisseurLigne[];
  notes?: string;
  createdBy?: string;
  isPaymentOnAccount?: boolean; // Flag to indicate if this is a payment on account
  advanceUsed?: number; // Amount of advance balance used in this payment
  createdAt: Date;
  updatedAt: Date;
}

const PaiementFournisseurLigneSchema = new Schema({
  factureId: { 
    type: Schema.Types.ObjectId, 
    ref: 'PurchaseInvoice',
  },
  numeroFacture: { 
    type: String,
  },
  referenceFournisseur: { type: String },
  montantFacture: { 
    type: Number, 
    min: 0, 
    default: 0 
  },
  montantPayeAvant: { 
    type: Number, 
    min: 0, 
    default: 0 
  },
  montantPaye: { type: Number, required: true, min: 0 },
  soldeRestant: { 
    type: Number, 
    min: 0, 
    default: 0 
  },
  isPaymentOnAccount: { type: Boolean, default: false },
}, { _id: false });

const PaiementFournisseurSchema = new Schema<IPaiementFournisseur>({
  societeId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  numero: { type: String, required: true, unique: true },
  datePaiement: { type: Date, required: true, default: Date.now },
  fournisseurId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
  fournisseurNom: { type: String },
  modePaiement: { type: String, required: true },
  reference: { type: String },
  montantTotal: { type: Number, required: true, min: 0 },
  lignes: {
    type: [PaiementFournisseurLigneSchema],
    required: true,
    validate: {
      validator: function(v: IPaiementFournisseurLigne[]) {
        return v && v.length > 0;
      },
      message: 'Un paiement doit contenir au moins une ligne.',
    },
  },
  isPaymentOnAccount: { type: Boolean, default: false }, // Flag to indicate if this is a payment on account
  advanceUsed: { type: Number, default: 0, min: 0 }, // Amount of advance balance used in this payment
  notes: { type: String },
  createdBy: { type: String },
}, { timestamps: true });

// Indexes
PaiementFournisseurSchema.index({ societeId: 1, numero: 1 }, { unique: true });
PaiementFournisseurSchema.index({ societeId: 1, datePaiement: -1 });
PaiementFournisseurSchema.index({ societeId: 1, fournisseurId: 1 });

// Pre-save hook: calculate total
PaiementFournisseurSchema.pre('save', function(next) {
  if (this.lignes && this.lignes.length > 0) {
    this.montantTotal = this.lignes.reduce((sum, ligne) => sum + ligne.montantPaye, 0);
  }
  next();
});

// Delete existing model if it exists to ensure schema changes are applied
if (mongoose.models.PaiementFournisseur) {
  delete mongoose.models.PaiementFournisseur;
}
if ((mongoose as any).modelSchemas && (mongoose as any).modelSchemas.PaiementFournisseur) {
  delete (mongoose as any).modelSchemas.PaiementFournisseur;
}

export default mongoose.model<IPaiementFournisseur>('PaiementFournisseur', PaiementFournisseurSchema, 'paiements_fournisseurs');

