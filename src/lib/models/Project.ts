import mongoose, { Schema, Document } from 'mongoose';

export interface IProject extends Document {
  tenantId: string;
  
  // Basic Information
  projectNumber: string; // Auto-generated: PROJ-2025-001
  name: string;
  description?: string;
  customerId: mongoose.Types.ObjectId; // Reference to Customer
  
  // Dates
  startDate: Date;
  expectedEndDate?: Date;
  actualEndDate?: Date;
  
  // Status
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  
  // Budget
  budget?: number;
  currency: string;
  
  // Links
  devisIds?: mongoose.Types.ObjectId[]; // References to Documents (Quotes/Devis)
  blIds?: mongoose.Types.ObjectId[]; // References to Documents (Bons de livraison)
  
  // Team
  assignedEmployees: Array<{
    employeeId: mongoose.Types.ObjectId;
    role: string;
    hourlyRate?: number;
    dailyRate?: number;
    startDate: Date;
    endDate?: Date;
  }>;
  
  // Calculated Costs (will be calculated from linked data)
  totalProductsCost: number;
  totalExpensesCost: number;
  totalLaborCost: number;
  totalCost: number;
  profit: number;
  profitMargin: number; // percentage
  
  // Additional Info
  notes?: string;
  tags?: string[];
  
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

const AssignedEmployeeSchema = new Schema({
  employeeId: {
    type: Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
  },
  role: { type: String, required: true },
  hourlyRate: { type: Number },
  dailyRate: { type: Number },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
}, { _id: false });

const ProjectSchema = new (Schema as any)({
  tenantId: { type: String, required: true, index: true },
  
  projectNumber: { 
    type: String, 
    required: true, 
    unique: false, // Will be unique per tenant
    index: true 
  },
  name: { type: String, required: true, trim: true },
  description: { type: String },
  customerId: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true,
  },
  
  startDate: { type: Date, required: true },
  expectedEndDate: { type: Date },
  actualEndDate: { type: Date },
  
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'cancelled'],
    default: 'pending',
    index: true,
  },
  
  budget: { type: Number, min: 0 },
  currency: { type: String, default: 'TND' },
  
  devisIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Document',
  }],
  blIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Document',
  }],
  
  assignedEmployees: { type: [AssignedEmployeeSchema], default: [] },
  
  totalProductsCost: { type: Number, default: 0 },
  totalExpensesCost: { type: Number, default: 0 },
  totalLaborCost: { type: Number, default: 0 },
  totalCost: { type: Number, default: 0 },
  profit: { type: Number, default: 0 },
  profitMargin: { type: Number, default: 0 },
  
  notes: { type: String },
  tags: [{ type: String }],
  
  createdBy: { type: String },
}, {
  timestamps: true,
});

// Compound index for unique project number per tenant
ProjectSchema.index({ tenantId: 1, projectNumber: 1 }, { unique: true });

// Indexes for queries
ProjectSchema.index({ tenantId: 1, status: 1 });
ProjectSchema.index({ tenantId: 1, customerId: 1 });
ProjectSchema.index({ tenantId: 1, startDate: 1 });

// Calculate totals before saving
ProjectSchema.pre('save', function(next) {
  this.totalCost = 
    (this.totalProductsCost || 0) +
    (this.totalExpensesCost || 0) +
    (this.totalLaborCost || 0);
  
  // Calculate profit if proforma exists (will be set from API)
  if (this.profit !== undefined) {
    this.profitMargin = this.totalCost > 0 
      ? ((this.profit / this.totalCost) * 100) 
      : 0;
  }
  
  next();
});

// Export model
if (mongoose.models && (mongoose.models as any)['Project']) {
  delete (mongoose.models as any)['Project'];
}

const Project = mongoose.model<IProject>('Project', ProjectSchema) as any;

export default Project;

