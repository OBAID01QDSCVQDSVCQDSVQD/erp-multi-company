import mongoose, { Schema, Document } from 'mongoose';

export interface IEmployee extends Document {
  tenantId: string;
  
  // Personal Information
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  mobile?: string;
  dateOfBirth?: Date;
  address: {
    line1: string;
    line2?: string;
    city: string;
    postalCode?: string;
    country: string;
  };
  cin?: string;
  socialSecurityNumber?: string;
  
  // Professional Information
  employeeNumber?: string;
  position: string;
  department: string;
  manager?: string;
  hireDate: Date;
  contractType: 'cdi' | 'cdd' | 'stage' | 'freelance';
  status: 'active' | 'inactive' | 'on_leave';
  
  // Salary Information
  baseSalary?: number;
  dailyRate?: number;
  currency: string;
  paymentMethod: 'bank_transfer' | 'check' | 'cash';
  bankAccount: {
    bankName?: string;
    accountNumber?: string;
    rib?: string;
    iban?: string;
  };
  
  // Emergency Contact
  emergencyContact: {
    name?: string;
    relationship?: string;
    phone?: string;
    email?: string;
  };
  
  // Additional Information
  notes?: string;
  skills?: string[];
  languages?: string[];
  
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

const AddressSchema = new Schema({
  line1: { type: String, required: true },
  line2: { type: String },
  city: { type: String, required: true },
  postalCode: { type: String },
  country: { type: String, default: 'TN' },
}, { _id: false });

const BankAccountSchema = new Schema({
  bankName: { type: String },
  accountNumber: { type: String },
  rib: { type: String },
  iban: { type: String },
}, { _id: false });

const EmergencyContactSchema = new Schema({
  name: { type: String },
  relationship: { type: String },
  phone: { type: String },
  email: { type: String },
}, { _id: false });

const EmployeeSchema = new Schema<IEmployee>({
  tenantId: { type: String, required: true, index: true },
  
  // Personal Information
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: { type: String },
  mobile: { type: String },
  dateOfBirth: { type: Date },
  address: { type: AddressSchema, required: true },
  cin: { type: String },
  socialSecurityNumber: { type: String },
  
  // Professional Information
  employeeNumber: { type: String },
  position: { type: String, required: true, trim: true },
  department: { type: String, required: true, trim: true },
  manager: { type: String },
  hireDate: { type: Date, required: true },
  contractType: { 
    type: String, 
    enum: ['cdi', 'cdd', 'stage', 'freelance'],
    default: 'cdi'
  },
  status: { 
    type: String, 
    enum: ['active', 'inactive', 'on_leave'],
    default: 'active'
  },
  
  // Salary Information
  baseSalary: { type: Number },
  dailyRate: { type: Number },
  currency: { type: String, default: 'TND' },
  paymentMethod: { 
    type: String, 
    enum: ['bank_transfer', 'check', 'cash'],
    default: 'bank_transfer'
  },
  bankAccount: { type: BankAccountSchema, default: {} },
  
  // Emergency Contact
  emergencyContact: { type: EmergencyContactSchema, default: {} },
  
  // Additional Information
  notes: { type: String },
  skills: [{ type: String }],
  languages: [{ type: String }],
  
  createdBy: { type: String },
}, {
  timestamps: true,
});

// Indexes
EmployeeSchema.index({ tenantId: 1, email: 1 }, { unique: true });
EmployeeSchema.index({ tenantId: 1, employeeNumber: 1 });
EmployeeSchema.index({ tenantId: 1, status: 1 });
EmployeeSchema.index({ tenantId: 1, department: 1 });

// Export
if (mongoose.models && mongoose.models['Employee']) {
  delete (mongoose.models as any)['Employee'];
}

const Employee = mongoose.model<IEmployee>('Employee', EmployeeSchema as any);

export default Employee as any;

