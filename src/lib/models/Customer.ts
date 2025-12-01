import mongoose, { Document, Schema } from 'mongoose';

export interface ICustomerAddress {
  ligne1: string;
  ligne2?: string;
  ville: string;
  codePostal?: string;
  gouvernorat?: string;
  pays?: string; // default 'TN'
}

export interface ICustomerContact {
  nom: string;
  prenom?: string;
  role?: string;
  email?: string;
  telephone?: string;
  mobile?: string;
  principal?: boolean;
}

export interface ICustomerStats {
  caCumule?: number;
  soldeDu?: number;
  dernierAchat?: Date;
  nbFactures?: number;
}

export interface ICustomer extends Document {
  tenantId: string;
  
  // Type
  type: 'societe' | 'particulier';
  
  // Identité
  raisonSociale?: string;
  nom?: string;
  prenom?: string;
  matriculeFiscale?: string;
  tvaCode?: string;
  nRegistreCommerce?: string;
  
  // Contact
  email?: string;
  telephone?: string;
  mobile?: string;
  siteWeb?: string;
  
  // Adresses
  adresseFacturation: ICustomerAddress;
  adresseLivraison?: ICustomerAddress;
  
  // Contacts
  contacts?: ICustomerContact[];
  
  // Paiement & Commercial
  conditionsPaiement?: string;
  modePaiementPrefere?: string;
  listePrixCode?: string;
  plafondCredit?: number;
  delaiGraceJours?: number;
  bloque?: boolean;
  
  // Banque
  rib?: string;
  iban?: string;
  banqueNom?: string;
  swift?: string;
  
  // Comptabilité
  compteCollectif?: string;
  centreCout?: string;
  
  // Divers
  noteInterne?: string;
  tags?: string[];
  commercialId?: string;
  
  // Stats
  stats?: ICustomerStats;
  
  // Statut
  actif: boolean;
  archive?: boolean;
  createdBy?: string;
}

const AddressSchema = new Schema<ICustomerAddress>({
  ligne1: { type: String, required: true },
  ligne2: { type: String },
  ville: { type: String, required: true },
  codePostal: { type: String },
  gouvernorat: { type: String },
  pays: { type: String, default: 'TN' }
}, { _id: false });

const ContactSchema = new Schema<ICustomerContact>({
  nom: { type: String, required: true },
  prenom: { type: String },
  role: { type: String },
  email: { type: String },
  telephone: { type: String },
  mobile: { type: String },
  principal: { type: Boolean, default: false }
}, { _id: true });

const StatsSchema = new Schema<ICustomerStats>({
  caCumule: { type: Number, default: 0 },
  soldeDu: { type: Number, default: 0 },
  dernierAchat: { type: Date },
  nbFactures: { type: Number, default: 0 }
}, { _id: false });

const CustomerSchema = new Schema<ICustomer>({
  tenantId: { type: String, required: true, index: true },
  
  type: { type: String, enum: ['societe', 'particulier'], default: 'societe' },
  
  raisonSociale: { type: String },
  nom: { type: String },
  prenom: { type: String },
  matriculeFiscale: { type: String, uppercase: true, trim: true },
  tvaCode: { type: String, uppercase: true, trim: true },
  nRegistreCommerce: { type: String },
  
  email: { type: String, lowercase: true, trim: true },
  telephone: { type: String },
  mobile: { type: String },
  siteWeb: { type: String },
  
  adresseFacturation: { type: AddressSchema, required: true },
  adresseLivraison: { type: AddressSchema },
  
  contacts: [ContactSchema],
  
  conditionsPaiement: { type: String },
  modePaiementPrefere: { type: String },
  listePrixCode: { type: String },
  plafondCredit: { type: Number, min: 0 },
  delaiGraceJours: { type: Number, min: 0 },
  bloque: { type: Boolean, default: false },
  
  rib: { type: String },
  iban: { type: String },
  banqueNom: { type: String },
  swift: { type: String },
  
  compteCollectif: { type: String },
  centreCout: { type: String },
  
  noteInterne: { type: String },
  tags: { type: [String], index: true },
  commercialId: { type: String },
  
  stats: { type: StatsSchema, default: {} },
  
  actif: { type: Boolean, default: true },
  archive: { type: Boolean, default: false },
  createdBy: { type: String }
}, { timestamps: true });

// Indexes
// On autorise maintenant les doublons sur matriculeFiscale et email (plus de contrainte unique)
// On garde un index simple (non unique) sur (tenantId, email) uniquement pour les performances de recherche.
CustomerSchema.index({ tenantId: 1, email: 1 }, { sparse: true });
CustomerSchema.index({ tenantId: 1, type: 1, actif: 1 });
CustomerSchema.index({ tenantId: 1, commercialId: 1 });
CustomerSchema.index({ 'adresseFacturation.ville': 'text', 'adresseLivraison.ville': 'text' });
CustomerSchema.index({ 
  raisonSociale: 'text', 
  nom: 'text', 
  prenom: 'text', 
  'contacts.nom': 'text',
  'contacts.prenom': 'text',
  'contacts.email': 'text',
  tags: 'text' 
});

// Clear the model from cache if it exists
if (mongoose.models.Customer) {
  delete mongoose.models.Customer;
}

export default mongoose.model<ICustomer>('Customer', CustomerSchema);