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
  remiseGlobale?: number;
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
  remiseGlobalePct?: number;
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
  remiseGlobale: { type: Number, default: 0, min: 0 },
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
  remiseGlobalePct: { type: Number, default: 0, min: 0, max: 100 },
  fodec: { type: PurchaseInvoiceFodecSchema, default: () => ({ enabled: false, tauxPct: 1, montant: 0 }) },
  timbre: { type: PurchaseInvoiceTimbreSchema, default: () => ({ enabled: true, montant: 1.000 }) },
  totaux: { type: PurchaseInvoiceTotauxSchema, default: () => ({ totalHT: 0, totalRemise: 0, remiseGlobale: 0, totalFodec: 0, totalTVA: 0, totalTimbre: 0, totalTTC: 0 }) },
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
    let totalRemiseLignes = 0;
    let totalHTAvantRemiseLignes = 0;
    let totalTVA = 0;

    // 1. Calculate TotalHT (sum of lines with line remise applied)
    this.lignes.forEach((ligne) => {
      if (ligne.prixUnitaireHT && ligne.quantite > 0) {
        const prixUnitaire = ligne.prixUnitaireHT;
        const quantite = ligne.quantite;
        const remisePct = ligne.remisePct || 0;

        const htAvantRemiseLigne = prixUnitaire * quantite;
        totalHTAvantRemiseLignes += htAvantRemiseLigne;

        let prixAvecRemise = prixUnitaire;
        if (remisePct > 0) {
          prixAvecRemise = prixUnitaire * (1 - remisePct / 100);
          const remiseLigne = htAvantRemiseLigne - (prixAvecRemise * quantite);
          totalRemiseLignes += remiseLigne;
        }

        const ligneHT = prixAvecRemise * quantite;
        ligne.totalLigneHT = ligneHT;
        totalHT += ligneHT;
      } else {
        ligne.totalLigneHT = 0;
      }
    });

    // 2. Apply Global Discount (Remise Globale)
    const remiseGlobalePct = this.remiseGlobalePct || 0;
    let remiseGlobale = 0;
    let totalHTAfterGlobalDiscount = totalHT;

    if (remiseGlobalePct > 0) {
      remiseGlobale = totalHT * (remiseGlobalePct / 100);
      totalHTAfterGlobalDiscount = totalHT - remiseGlobale;
    }

    // 3. Calculate FODEC if enabled
    const fodecEnabled = this.fodec?.enabled || false;
    const tauxFodec = this.fodec?.tauxPct || 1;
    // FODEC applies to the NET HT (after global discount)
    const fodecMontant = fodecEnabled ? totalHTAfterGlobalDiscount * (tauxFodec / 100) : 0;
    if (this.fodec) {
      this.fodec.montant = fodecMontant;
    }

    // 4. Calculate TVA
    // TVA Base = HT (after global discount) + FODEC
    // We need to distribute global discount proportionally or apply to base?
    // Simplified: We iterate lines to get weighted TVA, BUT we need to adjust for global discount.
    // However, if different lines have different TVA rates, applying global discount to the total HT is tricky for TVA calculation.
    // The standard way if multiple TVA rates exist is that Global Discount reduces the base of each line proportionally.
    // Or simpler: TVA is calculated on (Total HT Net + Fodec) IF uniform TVA.
    // Since lines can have different TVA, we technically must reduce each line's HT by the global discount pct before calculating TVA.

    // Re-iterating lines to calculate TVA with Global Discount effect
    this.lignes.forEach((ligne) => {
      if (ligne.prixUnitaireHT && ligne.quantite > 0 && ligne.tvaPct) {
        // Line HT already includes line discount
        const lineHT = ligne.totalLigneHT || 0;

        // Apply Global Discount share to this line
        const lineHTNet = remiseGlobalePct > 0 ? lineHT * (1 - remiseGlobalePct / 100) : lineHT;

        // FODEC share
        const lineFodec = fodecEnabled ? lineHTNet * (tauxFodec / 100) : 0;

        // Base TVA
        const lineBaseTVA = lineHTNet + lineFodec;

        const lineTVA = lineBaseTVA * (ligne.tvaPct / 100);
        totalTVA += lineTVA;
      }
    });

    // 5. Calculate TIMBRE if enabled
    const timbreEnabled = this.timbre?.enabled || false;
    const montantTimbre = timbreEnabled ? (this.timbre?.montant || 1.000) : 0;

    // 6. Calculate TotalTTC
    // TTC = Total HT Net + Fodec + Total TVA + Timbre
    const totalTTC = totalHTAfterGlobalDiscount + fodecMontant + totalTVA + montantTimbre;

    this.totaux = {
      totalHT: totalHT, // Sum of lines after line discount
      totalRemise: totalRemiseLignes, // Sum of line discounts
      remiseGlobale: remiseGlobale,
      totalFodec: fodecMontant,
      totalTVA: totalTVA,
      totalTimbre: montantTimbre,
      totalTTC: totalTTC,
    };
  }

  next();
});

if (mongoose.models.PurchaseInvoice) {
  delete mongoose.models.PurchaseInvoice;
}

export default mongoose.model<IPurchaseInvoice>('PurchaseInvoice', PurchaseInvoiceSchema, 'purchase_invoices');

