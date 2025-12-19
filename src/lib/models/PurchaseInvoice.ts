import mongoose, { Document, Schema } from 'mongoose';

export interface IPurchaseInvoiceLine {
  produitId?: string;
  designation: string;
  quantite: number;
  prixUnitaireHT: number;
  remisePct?: number;
  tvaPct?: number;
  fodecPct?: number;
  totalLigneHT?: number;
}

export interface IPurchaseInvoiceFodec {
  enabled: boolean;
  tauxPct?: number;
  montant?: number;
}

export interface IPurchaseInvoiceTimbre {
  enabled: boolean;
  montant?: number;
}

export interface IPurchaseInvoiceTotaux {
  totalHT: number;
  totalRemise?: number;
  totalFodec?: number;
  totalTVA: number;
  totalTimbre?: number;
  totalTTC: number;
}

export interface IPurchaseInvoicePaiement {
  date: Date;
  montant: number;
  mode: string;
  notes?: string;
}

export interface IPurchaseInvoice extends Document {
  societeId: string;
  numero: string;
  dateFacture: Date;
  referenceFournisseur?: string;
  fournisseurId: string;
  fournisseurNom?: string;
  devise: string;
  tauxChange?: number; // Taux de change pour conversion en TND
  conditionsPaiement?: string;
  statut: 'BROUILLON' | 'VALIDEE' | 'PARTIELLEMENT_PAYEE' | 'PAYEE' | 'ANNULEE';
  lignes: IPurchaseInvoiceLine[];
  fodec: IPurchaseInvoiceFodec;
  timbre: IPurchaseInvoiceTimbre;
  totaux: IPurchaseInvoiceTotaux;
  bonsReceptionIds?: mongoose.Types.ObjectId[];
  fichiers?: string[]; // للحفاظ على التوافق مع البيانات القديمة
  images?: IPurchaseInvoiceImage[]; // الصور المرفقة (Base64)
  paiements?: IPurchaseInvoicePaiement[];
  notes?: string;
  warehouseId?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPurchaseInvoiceImage {
  id: string;
  name: string;
  url: string; // Cloudinary URL
  publicId?: string; // Cloudinary public ID
  type: string;
  size: number;
  width?: number;
  height?: number;
  format?: string;
}

// @ts-ignore - Complex union type inference issue with Mongoose
const PurchaseInvoiceLineSchema = new Schema({
  produitId: { type: String },
  designation: { type: String, required: true },
  quantite: { type: Number, required: true, min: 0 },
  prixUnitaireHT: { type: Number, required: true, min: 0 },
  remisePct: { type: Number, default: 0, min: 0, max: 100 },
  tvaPct: { type: Number, default: 0, min: 0, max: 100 },
  fodecPct: { type: Number, default: 0, min: 0, max: 100 },
  totalLigneHT: { type: Number, default: 0 },
}, { _id: false });

// @ts-ignore - Complex union type inference issue with Mongoose
const PurchaseInvoiceFodecSchema = new Schema({
  enabled: { type: Boolean, default: false },
  tauxPct: { type: Number, default: 1, min: 0, max: 100 },
  montant: { type: Number, default: 0, min: 0 },
}, { _id: false });

// @ts-ignore - Complex union type inference issue with Mongoose
const PurchaseInvoiceTimbreSchema = new Schema({
  enabled: { type: Boolean, default: true },
  montant: { type: Number, default: 1.000, min: 0 },
}, { _id: false });

// @ts-ignore - Complex union type inference issue with Mongoose
const PurchaseInvoiceTotauxSchema = new Schema({
  totalHT: { type: Number, default: 0, min: 0 },
  totalRemise: { type: Number, default: 0, min: 0 },
  totalFodec: { type: Number, default: 0, min: 0 },
  totalTVA: { type: Number, default: 0, min: 0 },
  totalTimbre: { type: Number, default: 0, min: 0 },
  totalTTC: { type: Number, default: 0, min: 0 },
}, { _id: false });

// @ts-ignore - Complex union type inference issue with Mongoose
const PurchaseInvoicePaiementSchema = new Schema({
  date: { type: Date, required: true },
  montant: { type: Number, required: true, min: 0 },
  mode: { type: String, required: true },
  notes: { type: String },
}, { _id: false });

// @ts-ignore - Complex union type inference issue with Mongoose
const PurchaseInvoiceSchema = new Schema({
  societeId: { type: String, required: true, index: true },
  numero: { type: String, required: true },
  dateFacture: { type: Date, required: true, default: Date.now },
  referenceFournisseur: { type: String },
  fournisseurId: { type: String, required: true, ref: 'Supplier' },
  fournisseurNom: { type: String },
  devise: { type: String, default: 'TND' },
  tauxChange: { type: Number, default: 1 }, // Taux de change pour conversion en TND
  conditionsPaiement: { type: String },
  statut: {
    type: String,
    enum: ['BROUILLON', 'VALIDEE', 'PARTIELLEMENT_PAYEE', 'PAYEE', 'ANNULEE'],
    default: 'BROUILLON',
    index: true,
  },
  warehouseId: { type: String, index: true },
  lignes: {
    type: [PurchaseInvoiceLineSchema],
    required: true,
    validate: {
      validator: function (v: IPurchaseInvoiceLine[]) {
        return v && v.length > 0;
      },
      message: 'La facture doit contenir au moins une ligne',
    },
  },
  fodec: { type: PurchaseInvoiceFodecSchema, default: () => ({ enabled: false, tauxPct: 1, montant: 0 }) },
  timbre: { type: PurchaseInvoiceTimbreSchema, default: () => ({ enabled: true, montant: 1.000 }) },
  totaux: { type: PurchaseInvoiceTotauxSchema, default: () => ({ totalHT: 0, totalFodec: 0, totalTVA: 0, totalTimbre: 0, totalTTC: 0 }) },
  bonsReceptionIds: [{ type: Schema.Types.ObjectId, ref: 'Reception' }],
  fichiers: [{ type: String }], // للحفاظ على التوافق مع البيانات القديمة
  images: [{
    id: { type: String, required: true },
    name: { type: String, required: true },
    url: { type: String, required: true }, // Cloudinary URL
    publicId: { type: String }, // Cloudinary public ID
    type: { type: String, required: true },
    size: { type: Number, required: true },
    width: { type: Number },
    height: { type: Number },
    format: { type: String },
  }],
  paiements: [PurchaseInvoicePaiementSchema],
  notes: { type: String },
  createdBy: { type: String },
}, { timestamps: true });

// Indexes
PurchaseInvoiceSchema.index({ societeId: 1, numero: 1 }, { unique: true });
PurchaseInvoiceSchema.index({ societeId: 1, dateFacture: -1 });
PurchaseInvoiceSchema.index({ societeId: 1, fournisseurId: 1 });
PurchaseInvoiceSchema.index({ societeId: 1, statut: 1 });
PurchaseInvoiceSchema.index({ societeId: 1, warehouseId: 1 });

// Pre-save hook: recalculate totals
PurchaseInvoiceSchema.pre('save', function (next) {
  if (this.lignes && this.lignes.length > 0) {
    let totalHT = 0;
    let totalRemise = 0;
    let totalHTAvantRemise = 0;
    let totalTVA = 0;

    // Calculate TotalHT (sum of lines with remise applied) and totalRemise
    this.lignes.forEach((ligne) => {
      if (ligne.prixUnitaireHT && ligne.quantite > 0) {
        const prixUnitaire = ligne.prixUnitaireHT;
        const quantite = ligne.quantite;
        const remisePct = ligne.remisePct || 0;

        const htAvantRemiseLigne = prixUnitaire * quantite;
        totalHTAvantRemise += htAvantRemiseLigne;

        let prixAvecRemise = prixUnitaire;
        if (remisePct > 0) {
          prixAvecRemise = prixUnitaire * (1 - remisePct / 100);
          const remiseLigne = htAvantRemiseLigne - (prixAvecRemise * quantite);
          totalRemise += remiseLigne;
        }

        const ligneHT = prixAvecRemise * quantite;
        ligne.totalLigneHT = ligneHT;
        totalHT += ligneHT;
      } else {
        ligne.totalLigneHT = 0;
      }
    });

    // Calculate FODEC if enabled
    const fodecEnabled = this.fodec?.enabled || false;
    const tauxFodec = this.fodec?.tauxPct || 1;
    const fodecMontant = fodecEnabled ? totalHT * (tauxFodec / 100) : 0;
    if (this.fodec) {
      this.fodec.montant = fodecMontant;
    }

    // Calculate TVA (base includes FODEC if enabled)
    this.lignes.forEach((ligne) => {
      if (ligne.prixUnitaireHT && ligne.quantite > 0 && ligne.tvaPct) {
        // Apply remise if exists
        let prixAvecRemise = ligne.prixUnitaireHT;
        const remisePct = ligne.remisePct || 0;
        if (remisePct > 0) {
          prixAvecRemise = prixAvecRemise * (1 - remisePct / 100);
        }
        const ligneHT = prixAvecRemise * ligne.quantite;

        // Calculate FODEC for this line if enabled
        const ligneFodec = fodecEnabled ? ligneHT * (tauxFodec / 100) : 0;
        const ligneBaseTVA = ligneHT + ligneFodec;
        const ligneTVA = ligneBaseTVA * (ligne.tvaPct / 100);
        totalTVA += ligneTVA;
      }
    });

    // Calculate TIMBRE if enabled
    const timbreEnabled = this.timbre?.enabled || false;
    const montantTimbre = timbreEnabled ? (this.timbre?.montant || 1.000) : 0;

    // Calculate TotalTTC
    const totalTTC = totalHT + fodecMontant + totalTVA + montantTimbre;

    this.totaux = {
      totalHT,
      totalRemise,
      totalFodec: fodecMontant,
      totalTVA,
      totalTimbre: montantTimbre,
      totalTTC,
    };
  }

  next();
});

if (mongoose.models.PurchaseInvoice) {
  delete mongoose.models.PurchaseInvoice;
}

export default mongoose.model<IPurchaseInvoice>('PurchaseInvoice', PurchaseInvoiceSchema, 'purchase_invoices');

