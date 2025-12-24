import mongoose, { Document, Schema } from 'mongoose';

export interface IReceptionLine {
  productId?: string;
  reference?: string;
  designation?: string;
  uom?: string;
  qteCommandee?: number;
  qteRecue: number;
  qteRetournee?: number;
  prixUnitaireHT?: number;
  remisePct?: number;
  tvaPct?: number;
  totalLigneHT?: number;
}

export interface IReceptionTotaux {
  totalHT: number;
  fodec?: number;
  totalTVA: number;
  timbre?: number;
  totalTTC: number;
}

export interface IReception extends Document {
  societeId: string;
  numero: string;
  dateDoc: Date;
  purchaseOrderId?: string;
  fournisseurId: string;
  fournisseurNom: string;
  statut: 'BROUILLON' | 'VALIDE' | 'ANNULE';
  lignes: IReceptionLine[];
  totaux: IReceptionTotaux;
  fodecActif?: boolean;
  tauxFodec?: number;
  timbreActif?: boolean;
  montantTimbre?: number;
  remiseGlobalePct?: number;
  notes?: string;
  warehouseId?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReceptionLineSchema = new Schema({
  productId: { type: String },
  reference: { type: String },
  designation: { type: String },
  uom: { type: String, default: 'PCE' },
  qteCommandee: { type: Number, min: 0 },
  qteRecue: { type: Number, required: true, min: 0 },
  qteRetournee: { type: Number, default: 0, min: 0 },
  prixUnitaireHT: { type: Number, min: 0 },
  remisePct: { type: Number, default: 0, min: 0, max: 100 },
  tvaPct: { type: Number, min: 0, max: 100 },
  totalLigneHT: { type: Number, default: 0 },
}, { _id: false });

const ReceptionTotauxSchema = new Schema({
  totalHT: { type: Number, default: 0, min: 0 },
  fodec: { type: Number, default: 0, min: 0 },
  totalTVA: { type: Number, default: 0, min: 0 },
  timbre: { type: Number, default: 0, min: 0 },
  totalTTC: { type: Number, default: 0, min: 0 },
}, { _id: false });

const ReceptionSchema = new Schema({
  societeId: {
    type: String,
    required: true,
    index: true,
  },
  numero: {
    type: String,
    required: true,
  },
  dateDoc: {
    type: Date,
    required: true,
    default: Date.now,
  },
  purchaseOrderId: {
    type: String,
    ref: 'PurchaseOrder',
  },
  fournisseurId: {
    type: String,
    required: true,
    ref: 'Supplier',
  },
  fournisseurNom: {
    type: String,
    required: true,
  },
  statut: {
    type: String,
    enum: ['BROUILLON', 'VALIDE', 'ANNULE'],
    default: 'BROUILLON',
    index: true,
  },
  lignes: {
    type: [ReceptionLineSchema],
    required: true,
    validate: {
      validator: function (v: IReceptionLine[]) {
        return v && v.length > 0;
      },
      message: 'Au moins une ligne est requise',
    },
  },
  totaux: {
    type: ReceptionTotauxSchema,
    required: true,
    default: () => ({ totalHT: 0, fodec: 0, totalTVA: 0, timbre: 0, totalTTC: 0 }),
  },
  fodecActif: {
    type: Boolean,
    default: false,
    required: false,
  },
  tauxFodec: {
    type: Number,
    default: 1,
    min: 0,
    max: 100,
    required: false,
  },
  timbreActif: {
    type: Boolean,
    default: true,
    required: false,
  },
  montantTimbre: {
    type: Number,
    default: 1.000,
    min: 0,
    required: false,
  },
  remiseGlobalePct: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
    required: false,
  },
  notes: {
    type: String,
  },
  warehouseId: {
    type: String,
    index: true,
  },
  createdBy: {
    type: String,
  },
}, {
  timestamps: true,
});

// Pre-save hook: ensure FODEC and TIMBRE fields exist
ReceptionSchema.pre('save', function (next) {
  // Ensure FODEC and TIMBRE fields exist with default values (FODEC inactive by default, TIMBRE active)
  if (this.fodecActif === undefined) {
    this.fodecActif = false;
  }
  if (this.tauxFodec === undefined) {
    this.tauxFodec = 1;
  }
  if (this.timbreActif === undefined) {
    this.timbreActif = true;
  }
  if (this.montantTimbre === undefined) {
    this.montantTimbre = 1.000;
  }
  if (this.remiseGlobalePct === undefined) {
    this.remiseGlobalePct = 0;
  }

  // Ensure totaux structure exists
  if (!this.totaux) {
    this.totaux = { totalHT: 0, fodec: 0, totalTVA: 0, timbre: 0, totalTTC: 0 };
  }
  if (this.totaux.fodec === undefined) {
    this.totaux.fodec = 0;
  }
  if (this.totaux.timbre === undefined) {
    this.totaux.timbre = 0;
  }

  next();
});

// Validation: ensure qteRecue >= 0
ReceptionSchema.pre('save', function (next) {
  if (this.lignes) {
    for (const ligne of this.lignes) {
      if (ligne.qteRecue < 0) {
        return next(new Error('La quantité reçue ne peut pas être négative'));
      }
    }
  }
  next();
});

// Pre-save hook: recalculate totals with FODEC and TIMBRE
ReceptionSchema.pre('save', function (next) {
  if (this.lignes && this.lignes.length > 0) {
    let totalHTBeforeDiscount = 0;
    let totalHTAfterLineDiscount = 0;
    let totalTVA = 0;

    // Calculate TotalHT before and after line remise
    this.lignes.forEach((ligne) => {
      if (ligne.prixUnitaireHT && ligne.qteRecue > 0) {
        const lineHTBeforeDiscount = ligne.prixUnitaireHT * ligne.qteRecue;
        totalHTBeforeDiscount += lineHTBeforeDiscount;

        // Apply line remise if exists
        let prixAvecRemise = ligne.prixUnitaireHT;
        const remisePct = ligne.remisePct || 0;
        if (remisePct > 0) {
          prixAvecRemise = prixAvecRemise * (1 - remisePct / 100);
        }
        const ligneHT = prixAvecRemise * ligne.qteRecue;
        ligne.totalLigneHT = ligneHT;
        totalHTAfterLineDiscount += ligneHT;
      } else {
        ligne.totalLigneHT = 0;
      }
    });

    // Apply global remise
    const remiseGlobalePct = this.remiseGlobalePct || 0;
    const totalHT = totalHTAfterLineDiscount * (1 - (remiseGlobalePct / 100));

    // Calculate FODEC if active (on totalHT after all discounts)
    const fodecActif = this.fodecActif || false;
    const tauxFodec = this.tauxFodec || 1;
    const fodec = fodecActif ? totalHT * (tauxFodec / 100) : 0;

    // Calculate TVA (base includes FODEC if active, after global remise)
    this.lignes.forEach((ligne) => {
      if (ligne.prixUnitaireHT && ligne.qteRecue > 0 && ligne.tvaPct) {
        // Apply line remise
        let prixAvecRemise = ligne.prixUnitaireHT;
        const remisePct = ligne.remisePct || 0;
        if (remisePct > 0) {
          prixAvecRemise = prixAvecRemise * (1 - remisePct / 100);
        }
        const ligneHT = prixAvecRemise * ligne.qteRecue;
        // Apply global remise to line HT for TVA calculation
        const lineHTAfterGlobalRemise = ligneHT * (1 - (remiseGlobalePct / 100));
        // Calculate FODEC proportion for this line
        const ligneFodec = fodecActif ? lineHTAfterGlobalRemise * (tauxFodec / 100) : 0;
        const ligneBaseTVA = lineHTAfterGlobalRemise + ligneFodec;
        const ligneTVA = ligneBaseTVA * (ligne.tvaPct / 100);
        totalTVA += ligneTVA;
      }
    });

    // Calculate TIMBRE if active
    const timbreActif = this.timbreActif || false;
    const montantTimbre = this.montantTimbre || 1.000;
    const timbre = timbreActif ? montantTimbre : 0;

    // Calculate TotalTTC
    const totalTTC = totalHT + fodec + totalTVA + timbre;

    this.totaux = {
      totalHT: totalHT,
      fodec: fodec,
      totalTVA: totalTVA,
      timbre: timbre,
      totalTTC: totalTTC,
    };
  } else {
    this.totaux = {
      totalHT: 0,
      fodec: 0,
      totalTVA: 0,
      timbre: 0,
      totalTTC: 0,
    };
  }

  next();
});

// Indexes
ReceptionSchema.index({ societeId: 1, numero: 1 }, { unique: true });
ReceptionSchema.index({ societeId: 1, statut: 1 });
ReceptionSchema.index({ societeId: 1, fournisseurId: 1 });
ReceptionSchema.index({ societeId: 1, dateDoc: -1 });
ReceptionSchema.index({ purchaseOrderId: 1 });

// Export model
if (mongoose.models && (mongoose.models as any)['Reception']) {
  delete (mongoose.models as any)['Reception'];
}

const Reception = mongoose.model<IReception>('Reception', ReceptionSchema as any);

export default Reception as any;
