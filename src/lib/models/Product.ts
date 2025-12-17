import mongoose, { Document, Schema } from 'mongoose';

export interface IProductSupplier {
  fournisseurId: string;
  codeAchat?: string;
  prix?: number;
  devise?: string;
  delai?: number;
  actif?: boolean;
}

export interface IProductVariantValue { attributCode: string; valeur: string; }
export interface IProductAttributeConfig { code: string; valeurs: string[]; }
export interface IProductPriceList { listeCode: string; prix: number; }
export interface IProductImage { url: string; alt?: string; ordre?: number; }
export interface IProductDoc { url: string; nom?: string; }

export interface IProduct extends Document {
  tenantId: string;
  sku: string;
  barcode?: string;
  referenceClient?: string;
  nom: string;
  description?: string;
  categorieCode?: string;
  taxCode?: string;
  tvaPct?: number;
  uomVenteCode?: string;
  uomAchatCode?: string;
  uomStockCode?: string;
  prixVenteHT?: number;
  prixVenteTTC?: number;
  prixAchatRef?: number;
  devise?: string;
  listesPrix?: IProductPriceList[];
  estStocke: boolean;
  min?: number; max?: number; leadTimeJours?: number; moq?: number;
  fournisseurs?: IProductSupplier[];
  estParent?: boolean;
  parentSku?: string;
  variantes?: IProductVariantValue[];
  attributsConfig?: IProductAttributeConfig[];
  images?: IProductImage[];
  documents?: IProductDoc[];
  actif: boolean;
  archive?: boolean;
  tags?: string[];
  createdBy?: string;
}

const ProductSchema = new Schema<any>({
  tenantId: { type: String, required: true, index: true },
  sku: { type: String, required: true, uppercase: true, trim: true },
  barcode: { type: String, default: undefined },
  referenceClient: { type: String },
  nom: { type: String, required: true, trim: true },
  description: { type: String },
  categorieCode: { type: String, uppercase: true, trim: true },
  taxCode: { type: String, uppercase: true, trim: true },
  tvaPct: { type: Number, min: 0, max: 100 },
  uomVenteCode: { type: String, uppercase: true, trim: true },
  uomAchatCode: { type: String, uppercase: true, trim: true },
  uomStockCode: { type: String, uppercase: true, trim: true },
  prixVenteHT: { type: Number, min: 0 },
  prixVenteTTC: { type: Number, min: 0 },
  prixAchatRef: { type: Number, min: 0 },
  devise: { type: String, default: 'TND' },
  listesPrix: [{ listeCode: String, prix: Number }],
  estStocke: { type: Boolean, default: true },
  min: { type: Number, min: 0 },
  max: { type: Number, min: 0 },
  leadTimeJours: { type: Number, min: 0 },
  moq: { type: Number, min: 0 },
  fournisseurs: [{ fournisseurId: String, codeAchat: String, prix: Number, devise: String, delai: Number, actif: { type: Boolean, default: true } }],
  estParent: { type: Boolean, default: false },
  parentSku: { type: String, uppercase: true, trim: true },
  variantes: [{ attributCode: String, valeur: String }],
  attributsConfig: [{ code: String, valeurs: [String] }],
  images: [{ url: String, alt: String, ordre: Number }],
  documents: [{ url: String, nom: String }],
  actif: { type: Boolean, default: true },
  archive: { type: Boolean, default: false },
  tags: { type: [String], index: true },
  createdBy: { type: String },
}, { timestamps: true });

ProductSchema.index({ tenantId: 1, sku: 1 }, { unique: true });
// Pas d'index sur barcode pour éviter les conflits avec null
ProductSchema.index({ tenantId: 1, categorieCode: 1, actif: 1 });
ProductSchema.index({ nom: 'text', description: 'text', tags: 'text' });

export default (mongoose.models.Product as any) || mongoose.model<any>('Product', ProductSchema);
