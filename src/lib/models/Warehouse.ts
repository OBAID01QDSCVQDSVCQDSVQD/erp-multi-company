import mongoose from 'mongoose';

// Force delete model in dev to pick up schema changes
if (process.env.NODE_ENV !== 'production') {
  delete mongoose.models.Warehouse;
}

const WarehouseSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: [true, 'Le nom de l\'entrepôt est requis'],
    trim: true,
  },
  code: {
    type: String,
    trim: true,
    uppercase: true,
  },
  type: {
    type: String,
    enum: ['DEPOT', 'SHOWROOM', 'CAMION', 'OTHER'],
    default: 'DEPOT',
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: { type: String, default: 'Tunisie' },
  },
  manager: {
    name: String,
    phone: String,
    email: String,
  },
  leadTimeJours: {
    type: Number,
    default: 1
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Compound index to ensure unique warehouse names per tenant
WarehouseSchema.index({ tenantId: 1, name: 1 }, { unique: true });

// Ensure only one default warehouse per tenant
WarehouseSchema.pre('save', async function (next) {
  if (this.isDefault) {
    const Warehouse = mongoose.models.Warehouse || mongoose.model('Warehouse', WarehouseSchema);
    await Warehouse.updateMany(
      { tenantId: this.tenantId, _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    );
  }
  next();
});

export default (mongoose.models.Warehouse as any) || mongoose.model('Warehouse', WarehouseSchema);
