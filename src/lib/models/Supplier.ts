import mongoose, { Document, Schema } from 'mongoose';

export interface ISupplierAddress {
  ligne1: string;
  ligne2?: string;
  ville: string;
  codePostal?: string;
  gouvernorat?: string;
  pays?: string;
}

export interface ISupplierContact {
  nom: string;
  prenom?: string;
  role?: string;
  email?: string;
  telephone?: string;
  mobile?: string;
  principal?: boolean;
}

export interface ISupplierDocument {
  url: string;
  nom?: string;
  type?: 'contrat' | 'certificat' | 'autre';
  expiration?: Date;
}

export interface ISupplierRating {
  qualite?: number;
  delai?: number;
  prix?: number;
  service?: number;
  noteGlobale?: number;
}

export interface ISupplierCatalogue {
  productId: string;
  codeAchat?: string;
  designationFournisseur?: string;
  uomCode?: string;
  prixAchat?: number;
  devise?: string;
  delai?: number;
  actif?: boolean;
}

export interface ISupplier extends Document {
  tenantId: string;
  
  // Identité
  type: 'societe' | 'particulier';
  raisonSociale?: string;
  nom?: string;
  prenom?: string;
  matriculeFiscale?: string;
  nRegistreCommerce?: string;
  
  // Contact
  email?: string;
  telephone?: string;
  mobile?: string;
  siteWeb?: string;
  
  // Adresses
  adresseFacturation?: ISupplierAddress;
  adresseLivraison?: ISupplierAddress;
  
  // Contacts
  contacts?: ISupplierContact[];
  
  // Banque
  rib?: string;
  iban?: string;
  banqueNom?: string;
  swift?: string;
  
  // Achats
  conditionsPaiement?: string;
  modePaiementPrefere?: string;
  devise?: string;
  incoterm?: string;
  delaiLivraisonJours?: number;
  moq?: number;
  remiseCommercialePct?: number;
  retenueSource?: {
    actif: boolean;
    tauxPct: number;
  };
  
  // Catalogue
  catalogue?: ISupplierCatalogue[];
  fournisseurPrincipalPour?: string[];
  
  // Documents
  documents?: ISupplierDocument[];
  
  // Évaluation
  rating?: ISupplierRating;
  risque?: 'faible' | 'moyen' | 'eleve';
  
  // Statut
  actif: boolean;
  archive?: boolean;
  tags?: string[];
  noteInterne?: string;
  createdBy?: string;
}

const AddressSchema = new (Schema as any)({
  ligne1: { type: String },
  ligne2: { type: String },
  ville: { type: String },
  codePostal: { type: String },
  gouvernorat: { type: String },
  pays: { type: String, default: 'TN' }
}, { _id: false });

const ContactSchema = new (Schema as any)({
  nom: { type: String },
  prenom: { type: String },
  role: { type: String },
  email: { type: String },
  telephone: { type: String },
  mobile: { type: String },
  principal: { type: Boolean, default: false }
}, { _id: true });

const DocumentSchema = new (Schema as any)({
  url: { type: String },
  nom: { type: String },
  type: { type: String, enum: ['contrat', 'certificat', 'autre'] },
  expiration: { type: Date }
}, { _id: false });

const RatingSchema = new (Schema as any)({
  qualite: { type: Number, min: 0, max: 5 },
  delai: { type: Number, min: 0, max: 5 },
  prix: { type: Number, min: 0, max: 5 },
  service: { type: Number, min: 0, max: 5 },
  noteGlobale: { type: Number, min: 0, max: 5 }
}, { _id: false });

const CatalogueSchema = new (Schema as any)({
  productId: { type: String, required: true },
  codeAchat: { type: String },
  designationFournisseur: { type: String },
  uomCode: { type: String },
  prixAchat: { type: Number, min: 0 },
  devise: { type: String },
  delai: { type: Number, min: 0 },
  actif: { type: Boolean, default: true }
}, { _id: false });

const SupplierSchema = new (Schema as any)({
  tenantId: { type: String, required: true, index: true },
  
  type: { type: String, enum: ['societe', 'particulier'], default: 'societe' },
  
  raisonSociale: { type: String },
  nom: { type: String },
  prenom: { type: String },
  matriculeFiscale: { type: String, uppercase: true, trim: true },
  nRegistreCommerce: { type: String },
  
  email: { type: String, lowercase: true, trim: true },
  telephone: { type: String },
  mobile: { type: String },
  siteWeb: { type: String },
  
  adresseFacturation: { type: AddressSchema },
  adresseLivraison: { type: AddressSchema },
  
  contacts: [ContactSchema],
  
  rib: { type: String },
  iban: { type: String },
  banqueNom: { type: String },
  swift: { type: String },
  
  conditionsPaiement: { type: String },
  modePaiementPrefere: { type: String, enum: ['Espèces', 'Virement', 'Chèque', 'Carte'] },
  devise: { type: String, default: 'TND' },
  incoterm: { type: String },
  delaiLivraisonJours: { type: Number, min: 0 },
  moq: { type: Number, min: 0 },
  remiseCommercialePct: { type: Number, min: 0, max: 100 },
  retenueSource: {
    actif: { type: Boolean, default: false },
    tauxPct: { type: Number, min: 0, max: 100 }
  },
  
  catalogue: [CatalogueSchema],
  fournisseurPrincipalPour: [{ type: String }],
  
  documents: [DocumentSchema],
  
  rating: { type: RatingSchema },
  risque: { type: String, enum: ['faible', 'moyen', 'eleve'] },
  
  actif: { type: Boolean, default: true },
  archive: { type: Boolean, default: false },
  tags: { type: [String], index: true },
  noteInterne: { type: String },
  createdBy: { type: String }
}, { timestamps: true });

// Indexes
SupplierSchema.index({ tenantId: 1, matriculeFiscale: 1 }, { unique: true, sparse: true });
SupplierSchema.index({ tenantId: 1, email: 1 }, { unique: true, sparse: true });
SupplierSchema.index({ tenantId: 1, actif: 1, 'adresseFacturation.ville': 1 });
SupplierSchema.index({ 
  raisonSociale: 'text', 
  nom: 'text', 
  prenom: 'text',
  'contacts.nom': 'text',
  'contacts.email': 'text',
  tags: 'text' 
});

let Supplier: mongoose.Model<ISupplier>;

if ((mongoose.models as any)['Supplier']) {
  Supplier = (mongoose.models as any)['Supplier'] as mongoose.Model<ISupplier>;
} else {
  Supplier = (mongoose.model('Supplier', SupplierSchema) as any) as mongoose.Model<ISupplier>;
}

export default Supplier;