import mongoose, { Document, Schema } from 'mongoose';

export interface ISociete {
  nom: string;
  adresse: {
    rue: string;
    ville: string;
    codePostal: string;
    pays: string;
  };
  tva: string;
  devise: string;
  langue: string;
  fuseau: string;
  logoUrl?: string;
  cachetUrl?: string;
  theme?: {
    primary?: string;
    secondary?: string;
  };
  // Informations pour en-tête et pied de page des documents
  enTete?: {
    slogan?: string;
    telephone?: string;
    email?: string;
    siteWeb?: string;
    matriculeFiscal?: string;
    registreCommerce?: string;
    capitalSocial?: string;
  };
  piedPage?: {
    texte?: string;
    conditionsGenerales?: string;
    mentionsLegales?: string;
    coordonneesBancaires?: {
      banque?: string;
      rib?: string;
      swift?: string;
    };
  };
}

export interface INumerotation {
  devis: string;
  bc: string;
  bl: string;
  fac: string;
  avoir: string;
  ca: string;
  br: string;
  facfo: string;
  avoirfo: string;
  pafo: string;
  int_fac?: string;
  retour: string;
  garantie: string;
  startingNumbers?: {
    devis?: number;
    bc?: number;
    bl?: number;
    fac?: number;
    avoir?: number;
    ca?: number;
    br?: number;
    facfo?: number;
    avoirfo?: number;
    pafo?: number;
    pac?: number;
    int_fac?: number;
    retour?: number;
    garantie?: number;
  };
}

export interface IVentes {
  tvaParDefautPct?: number;
  conditionsPaiementDefaut?: string;
  uniteParDefaut?: string;
}

export interface IAchats {
  modesReglement: string[];
}

export interface IPolitiqueValidation {
  autoJusqua?: number;
  approbationRequiseAuDela?: number;
}

export interface IDepenses {
  politiqueValidation: IPolitiqueValidation;
}

export interface IStock {
  // Entrepôts & emplacements
  multiEntrepots: boolean;
  binsActifs: boolean;
  transfertLeadTimeJours: number;
  // Règles & valorisation
  stockNegatif: 'autorise' | 'avertir' | 'interdit';
  methodeValorisation: 'fifo' | 'lifo' | 'cmp';
  decimalesQuantite: number;
  decimalesPrix: number;
  deviseCout: string;
  // Unités de base par catégorie
  baseUnits: {
    quantite: string;
    poids: string;
    volume: string;
    longueur: string;
    surface: string;
    temps: string;
  };
  stepMouvement: number;
  // Réappro
  reappro: {
    strategie: 'minmax' | 'eoq' | 'jit';
    minParDefaut: number;
    maxParDefaut: number;
    leadTimeJoursParDefaut: number;
    moqParDefaut: number;
    stepMouvement?: number;
  };
  // Traçabilité
  lotsActifs: boolean;
  seriesActifs: boolean;
  expirationActive: boolean;
  qualiteReception: { actif: boolean; plan: string };
  // Inventaires
  inventaire: {
    cycliqueActif: boolean;
    frequence: 'hebdo' | 'mensuel' | 'trimestriel';
    methodeABC: boolean;
  };
  // Alertes
  alertes: {
    rupture: boolean;
    expirationProcheJours: number;
    emails: string[];
  };
  // Comptabilité (optionnel)
  compta?: {
    cptStock?: string;
    cptVariation?: string;
    cptCOGS?: string;
    reconnaissanceCout?: 'livraison' | 'facturation';
  };
}

export interface ISecurite {
  motDePasseComplexe?: boolean;
  deuxFA?: boolean;
  reinitialisationMdp?: {
    actif: boolean;
    expirationMinutes: number;
  };
}

export interface ISysteme {
  maintenance?: boolean;
  version?: string;
}

export interface ITVA {
  tauxParDefautPct: number;
  regimeParDefautCode: string;
  arrondi: 'ligne' | 'document';
  prixIncluentTVA: boolean;
  timbreFiscal: {
    actif: boolean;
    montantFixe: number;
  };
  fodec?: {
    actif: boolean;
    tauxPct: number;
  };
  retenueSource?: {
    actif: boolean;
    tauxPct: number;
    appliquerSur: 'services' | 'tous';
  };
}

export interface ICompanySettings extends Document {
  tenantId: string;
  societe: ISociete;
  numerotation: INumerotation;
  ventes: IVentes;
  achats: IAchats;
  depenses: IDepenses;
  stock: IStock;
  securite: ISecurite;
  systeme: ISysteme;
  tva: ITVA;
  createdAt: Date;
  updatedAt: Date;
}

const SocieteSchema = new Schema({
  nom: { type: String, required: true },
  adresse: {
    rue: { type: String, required: true },
    ville: { type: String, required: true },
    codePostal: { type: String, required: true },
    pays: { type: String, required: true, default: 'Tunisie' },
  },
  tva: { type: String, required: true },
  devise: { type: String, required: true, default: 'TND' },
  langue: { type: String, required: true, default: 'fr' },
  fuseau: { type: String, required: true, default: 'Africa/Tunis' },
  logoUrl: { type: String },
  cachetUrl: { type: String },
  theme: {
    primary: { type: String },
    secondary: { type: String },
  },
  enTete: {
    slogan: { type: String },
    telephone: { type: String },
    email: { type: String },
    siteWeb: { type: String },
    matriculeFiscal: { type: String },
    registreCommerce: { type: String },
    capitalSocial: { type: String },
  },
  piedPage: {
    texte: { type: String },
    conditionsGenerales: { type: String },
    mentionsLegales: { type: String },
    coordonneesBancaires: {
      banque: { type: String },
      rib: { type: String },
      swift: { type: String },
    },
  },
}, { _id: false });

const NumerotationSchema = new Schema({
  devis: { type: String, required: true, default: 'DEV-{{YYYY}}-{{SEQ:5}}' },
  bc: { type: String, required: true, default: 'BC-{{YYYY}}-{{SEQ:5}}' },
  bl: { type: String, required: true, default: 'BL-{{YY}}{{MM}}-{{SEQ:4}}' },
  fac: { type: String, required: true, default: 'FAC-{{YYYY}}-{{SEQ:5}}' },
  avoir: { type: String, required: true, default: 'AVR-{{YYYY}}-{{SEQ:5}}' },
  ca: { type: String, required: true, default: 'CA-{{YYYY}}-{{SEQ:5}}' },
  br: { type: String, required: true, default: 'BR-{{YYYY}}-{{SEQ:5}}' },
  facfo: { type: String, required: true, default: 'FACFO-{{YYYY}}-{{SEQ:5}}' },
  avoirfo: { type: String, required: true, default: 'AVOIRFO-{{YYYY}}-{{SEQ:5}}' },
  pafo: { type: String, required: true, default: 'PAFO-{{YYYY}}-{{SEQ:5}}' },
  int_fac: { type: String, default: '{{SEQ:4}}' },
  retour: { type: String, default: 'RET-{{YYYY}}-{{SEQ:4}}' },
  garantie: { type: String, default: 'GAR-{{YYYY}}-{{SEQ:5}}' },
  startingNumbers: {
    devis: { type: Number, default: 0 },
    bc: { type: Number, default: 0 },
    bl: { type: Number, default: 0 },
    fac: { type: Number, default: 0 },
    avoir: { type: Number, default: 0 },
    ca: { type: Number, default: 0 },
    br: { type: Number, default: 0 },
    facfo: { type: Number, default: 0 },
    avoirfo: { type: Number, default: 0 },
    pafo: { type: Number, default: 0 },
    pac: { type: Number, default: 0 },
    int_fac: { type: Number, default: 0 },
    retour: { type: Number, default: 0 },
    garantie: { type: Number, default: 0 },
  },
}, { _id: false });

const VentesSchema = new Schema({
  tvaParDefautPct: { type: Number, default: 19 },
  conditionsPaiementDefaut: { type: String, default: '30 jours' },
  uniteParDefaut: { type: String, default: 'pièce' },
}, { _id: false });

const AchatsSchema = new Schema({
  modesReglement: {
    type: [String],
    default: ['Espèces', 'Virement', 'Chèque', 'Carte']
  },
}, { _id: false });

const DepensesSchema = new Schema({
  politiqueValidation: {
    autoJusqua: { type: Number, default: 500 },
    approbationRequiseAuDela: { type: Number, default: 1000 },
  },
}, { _id: false });

const StockSchema = new Schema({
  multiEntrepots: { type: Boolean, default: true },
  binsActifs: { type: Boolean, default: false },
  transfertLeadTimeJours: { type: Number, default: 1 },
  stockNegatif: { type: String, enum: ['autorise', 'avertir', 'interdit'], default: 'interdit' },
  methodeValorisation: { type: String, enum: ['fifo', 'lifo', 'cmp'], default: 'cmp' },
  decimalesQuantite: { type: Number, default: 3 },
  decimalesPrix: { type: Number, default: 3 },
  deviseCout: { type: String, default: 'TND' },
  baseUnits: {
    quantite: { type: String, default: 'PIECE' },
    poids: { type: String, default: 'G' },
    volume: { type: String, default: 'ML' },
    longueur: { type: String, default: 'MM' },
    surface: { type: String, default: 'CM2' },
    temps: { type: String, default: 'MIN' },
  },
  stepMouvement: { type: Number, default: 0.001 },
  reappro: {
    strategie: { type: String, enum: ['minmax', 'eoq', 'jit'], default: 'minmax' },
    minParDefaut: { type: Number, default: 0 },
    maxParDefaut: { type: Number, default: 0 },
    leadTimeJoursParDefaut: { type: Number, default: 3 },
    moqParDefaut: { type: Number, default: 1 },
  },
  lotsActifs: { type: Boolean, default: false },
  seriesActifs: { type: Boolean, default: false },
  expirationActive: { type: Boolean, default: false },
  qualiteReception: { actif: { type: Boolean, default: false }, plan: { type: String, default: 'AQL-ISO2859' } },
  inventaire: {
    cycliqueActif: { type: Boolean, default: true },
    frequence: { type: String, enum: ['hebdo', 'mensuel', 'trimestriel'], default: 'mensuel' },
    methodeABC: { type: Boolean, default: true },
  },
  alertes: {
    rupture: { type: Boolean, default: true },
    expirationProcheJours: { type: Number, default: 30 },
    emails: { type: [String], default: [] },
  },
  compta: {
    cptStock: { type: String },
    cptVariation: { type: String },
    cptCOGS: { type: String },
    reconnaissanceCout: { type: String, enum: ['livraison', 'facturation'], default: 'livraison' },
  },
}, { _id: false });

const SecuriteSchema = new Schema({
  motDePasseComplexe: { type: Boolean, default: true },
  deuxFA: { type: Boolean, default: false },
  reinitialisationMdp: {
    actif: { type: Boolean, default: true },
    expirationMinutes: { type: Number, default: 60 },
  },
}, { _id: false });

const SystemeSchema = new Schema({
  maintenance: { type: Boolean, default: false },
  version: { type: String, default: '1.0.0' },
}, { _id: false });

const TVASchema = new Schema({
  tauxParDefautPct: { type: Number, default: 19 },
  regimeParDefautCode: { type: String, default: 'TN19' },
  arrondi: {
    type: String,
    enum: ['ligne', 'document'],
    default: 'ligne'
  },
  prixIncluentTVA: { type: Boolean, default: false },
  timbreFiscal: {
    actif: { type: Boolean, default: false },
    montantFixe: { type: Number, default: 1.0 },
  },
  fodec: {
    actif: { type: Boolean, default: false },
    tauxPct: { type: Number, default: 1, min: 0, max: 100 },
  },
  retenueSource: {
    actif: { type: Boolean, default: false },
    tauxPct: { type: Number, default: 0 },
    appliquerSur: {
      type: String,
      enum: ['services', 'tous'],
      default: 'services'
    },
  },
}, { _id: false });

const CompanySettingsSchema = new Schema({
  tenantId: {
    type: String,
    required: true,
    unique: true,
  },
  societe: {
    type: SocieteSchema,
    required: true,
  },
  numerotation: {
    type: NumerotationSchema,
    required: true,
  },
  ventes: {
    type: VentesSchema,
    required: true,
  },
  achats: {
    type: AchatsSchema,
    required: true,
  },
  depenses: {
    type: DepensesSchema,
    required: true,
  },
  stock: {
    type: StockSchema,
    required: true,
  },
  securite: {
    type: SecuriteSchema,
    required: true,
  },
  systeme: {
    type: SystemeSchema,
    required: true,
  },
  tva: {
    type: TVASchema,
    required: true,
  },
}, {
  timestamps: true,
});

// Note: 'unique: true' on tenantId already creates the unique index.
// Avoid defining a duplicate index to prevent Mongoose duplicate index warnings.

const CompanySettingsModel = mongoose.models.CompanySettings || (
  // @ts-ignore - Schema type is too complex for TypeScript to infer, but works at runtime
  mongoose.model<ICompanySettings>('CompanySettings', CompanySettingsSchema)
);

export default CompanySettingsModel;
