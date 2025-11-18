import mongoose, { Document, Schema } from 'mongoose';

export interface ICompany extends Document {
  name: string;
  code: string;
  address: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  contact: {
    email: string;
    phone: string;
    website?: string;
  };
  fiscal: {
    taxNumber?: string;
    registrationNumber?: string;
    vatNumber?: string;
  };
  enTete?: {
    slogan?: string;
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
  settings: {
    currency: string;
    timezone: string;
    language: string;
    dateFormat: string;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CompanySchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },
  address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },
  },
  contact: {
    email: { type: String, required: true },
    phone: { type: String, required: true },
    website: { type: String },
  },
  fiscal: {
    taxNumber: { type: String },
    registrationNumber: { type: String },
    vatNumber: { type: String },
  },
  enTete: {
    slogan: { type: String },
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
  settings: {
    currency: { type: String, default: 'EUR' },
    timezone: { type: String, default: 'Europe/Paris' },
    language: { type: String, default: 'fr' },
    dateFormat: { type: String, default: 'DD/MM/YYYY' },
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// In Next.js, models are cached. Delete from cache in development to ensure schema updates
if (process.env.NODE_ENV === 'development' && mongoose.models.Company) {
  delete mongoose.models.Company;
}

  // @ts-ignore - Schema type is too complex for TypeScript to infer, but works at runtime
const CompanyModel = mongoose.models.Company || mongoose.model<ICompany>('Company', CompanySchema);

export default CompanyModel;
