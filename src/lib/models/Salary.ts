import mongoose, { Schema, Document } from 'mongoose';

export interface ISalary extends Document {
  tenantId: string;
  employeeId: mongoose.Types.ObjectId;
  
  // Period
  period: {
    month: number; // 1-12
    year: number;
    startDate: Date;
    endDate: Date;
  };
  
  // Salary Details
  baseSalary: number;
  currency: string;
  
  // Work Days
  totalDays: number;
  workedDays: number;
  absentDays: number;
  leaveDays: number;
  dailyRate: number;
  
  // Earnings
  earnings: {
    baseSalary: number;
    overtimePay: number;
    bonuses: number;
    allowances: number;
    otherEarnings: number;
    totalEarnings: number;
  };
  
  // Deductions
  deductions: {
    taxes: number;
    socialSecurity: number;
    insurance: number;
    advances: number;
    advancesList?: Array<{
      amount: number;
      date: Date;
      notes?: string;
    }>;
    otherDeductions: number;
    totalDeductions: number;
  };
  deductionsEnabled?: boolean;
  
  // Net Salary
  netSalary: number;
  
  // Payment
  paymentMethod: 'bank_transfer' | 'check' | 'cash';
  paymentDate?: Date;
  paymentStatus: 'pending' | 'paid' | 'partial' | 'owing' | 'cancelled';
  
  // Additional Info
  notes?: string;
  
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

const PeriodSchema = new Schema({
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
}, { _id: false });

const EarningsSchema = new Schema({
  baseSalary: { type: Number, default: 0 },
  overtimePay: { type: Number, default: 0 },
  bonuses: { type: Number, default: 0 },
  allowances: { type: Number, default: 0 },
  otherEarnings: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
}, { _id: false });

const AdvanceSchema = new Schema({
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, required: true },
  notes: { type: String },
}, { _id: false });

const DeductionsSchema = new Schema({
  taxes: { type: Number, default: 0 },
  socialSecurity: { type: Number, default: 0 },
  insurance: { type: Number, default: 0 },
  advances: { type: Number, default: 0 },
  advancesList: { type: [AdvanceSchema], default: [] },
  otherDeductions: { type: Number, default: 0 },
  totalDeductions: { type: Number, default: 0 },
}, { _id: false });

const SalarySchema = new (Schema as any)({
  tenantId: { type: String, required: true, index: true },
  employeeId: {
    type: Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true,
  },
  
  period: { type: PeriodSchema, required: true },
  
  baseSalary: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'TND' },
  
  totalDays: { type: Number, default: 0 },
  workedDays: { type: Number, default: 0 },
  absentDays: { type: Number, default: 0 },
  leaveDays: { type: Number, default: 0 },
  dailyRate: { type: Number, default: 0 },
  
  earnings: { type: EarningsSchema, default: {} },
  deductions: { type: DeductionsSchema, default: {} },
  deductionsEnabled: { type: Boolean, default: false },
  
  netSalary: { type: Number, required: true },
  
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'check', 'cash'],
    default: 'bank_transfer',
  },
  paymentDate: { type: Date },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'partial', 'owing', 'cancelled'],
    default: 'pending',
  },
  
  notes: { type: String },
  createdBy: { type: String },
}, {
  timestamps: true,
});

// Calculate totals before saving
SalarySchema.pre('save', function(next) {
  // Calculate total earnings
  this.earnings.totalEarnings = 
    (this.earnings.baseSalary || 0) +
    (this.earnings.overtimePay || 0) +
    (this.earnings.bonuses || 0) +
    (this.earnings.allowances || 0) +
    (this.earnings.otherEarnings || 0);
  
  // Calculate total deductions
  this.deductions.totalDeductions = 
    (this.deductions.taxes || 0) +
    (this.deductions.socialSecurity || 0) +
    (this.deductions.insurance || 0) +
    (this.deductions.advances || 0) +
    (this.deductions.otherDeductions || 0);
  
  // Calculate net salary
  this.netSalary = this.earnings.totalEarnings - this.deductions.totalDeductions;
  
  next();
});

// Index for unique salary per employee per period
SalarySchema.index({ tenantId: 1, employeeId: 1, 'period.month': 1, 'period.year': 1 }, { unique: true });

// Index for period queries
SalarySchema.index({ tenantId: 1, 'period.month': 1, 'period.year': 1 });

// Export model
if (mongoose.models && (mongoose.models as any)['Salary']) {
  delete (mongoose.models as any)['Salary'];
}

const Salary = mongoose.model<ISalary>('Salary', SalarySchema) as any;

export default Salary;

