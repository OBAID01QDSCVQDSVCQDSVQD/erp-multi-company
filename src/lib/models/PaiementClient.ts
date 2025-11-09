import mongoose, { Document, Schema } from 'mongoose';

export interface IPaiementClientLigne {
  factureId?: mongoose.Types.ObjectId; // Optional for payment on account
  numeroFacture?: string; // Optional for payment on account
  referenceExterne?: string; // N° facture client
  montantFacture?: number; // Montant total de la facture (optional for payment on account)
  montantPayeAvant?: number; // Montant déjà payé avant ce paiement (optional for payment on account)
  montantPaye: number; // Montant payé dans ce paiement
  soldeRestant?: number; // Solde restant après ce paiement (optional for payment on account)
  isPaymentOnAccount?: boolean; // Flag for payment on account
}

export interface IPaiementClient extends Document {
  societeId: mongoose.Types.ObjectId;
  numero: string;
  datePaiement: Date;
  customerId: mongoose.Types.ObjectId;
  customerNom?: string;
  modePaiement: string; // Espèces, Virement, Chèque, Carte, etc.
  reference?: string; // Numéro de chèque, référence virement, etc.
  montantTotal: number;
  lignes: IPaiementClientLigne[];
  notes?: string;
  createdBy?: string;
  isPaymentOnAccount?: boolean; // Flag to indicate if this is a payment on account
  advanceUsed?: number; // Amount of advance balance used in this payment
  createdAt: Date;
  updatedAt: Date;
}

const PaiementClientLigneSchema = new Schema({
  factureId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Document',
  },
  numeroFacture: { 
    type: String,
  },
  referenceExterne: { type: String },
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

const PaiementClientSchema = new Schema<IPaiementClient>({
  societeId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  numero: { type: String, required: true, unique: true },
  datePaiement: { type: Date, required: true, default: Date.now },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  customerNom: { type: String },
  modePaiement: { type: String, required: true },
  reference: { type: String },
  montantTotal: { type: Number, default: 0, min: 0 },
  lignes: {
    type: [PaiementClientLigneSchema],
    required: true,
    validate: {
      validator: function(v: IPaiementClientLigne[]) {
        return v && v.length > 0;
      },
      message: 'Un paiement doit contenir au moins une ligne.',
    },
  },
  isPaymentOnAccount: { type: Boolean, default: false },
  advanceUsed: { type: Number, default: 0, min: 0 },
  notes: { type: String },
  createdBy: { type: String },
}, { timestamps: true });

// Indexes
PaiementClientSchema.index({ societeId: 1, numero: 1 }, { unique: true });
PaiementClientSchema.index({ societeId: 1, datePaiement: -1 });
PaiementClientSchema.index({ societeId: 1, customerId: 1 });

// Pre-save hook: calculate total
PaiementClientSchema.pre('save', function(next) {
  if (this.lignes && this.lignes.length > 0) {
    this.montantTotal = this.lignes.reduce((sum, ligne) => sum + (ligne.montantPaye || 0), 0);
  } else {
    this.montantTotal = 0;
  }
  next();
});

// Delete existing model if it exists to ensure schema changes are applied
if (mongoose.models.PaiementClient) {
  delete mongoose.models.PaiementClient;
}
if ((mongoose as any).modelSchemas && (mongoose as any).modelSchemas.PaiementClient) {
  delete (mongoose as any).modelSchemas.PaiementClient;
}

export default mongoose.model<IPaiementClient>('PaiementClient', PaiementClientSchema, 'paiements_clients');

