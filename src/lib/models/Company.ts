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
    taxNumber: string;
    registrationNumber: string;
    vatNumber?: string;
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

const CompanySchema = new Schema<ICompany>({
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
    taxNumber: { type: String, required: true },
    registrationNumber: { type: String, required: true },
    vatNumber: { type: String },
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

export default mongoose.models.Company || mongoose.model<ICompany>('Company', CompanySchema);
