import mongoose from 'mongoose';

const PlanSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Le nom du plan est requis'],
        trim: true,
    },
    slug: {
        type: String,
        unique: true,
        required: true,
        lowercase: true,
        trim: true,
    },
    description: String,
    price: {
        type: Number,
        required: true,
        min: 0,
    },
    currency: {
        type: String,
        default: 'TND',
    },
    interval: {
        type: String,
        enum: ['month', 'year'],
        default: 'month',
    },
    features: [{
        type: String, // Description displayed to user, e.g. "5 Utilisateurs"
    }],
    limits: {
        maxUsers: { type: Number, default: 1 },
        maxCompanies: { type: Number, default: 1 },
        maxDocuments: { type: Number, default: 100 }, // Total lifetime documents
        maxInvoicesPerMonth: { type: Number, default: -1 }, // Deprecated or kept for compatibility
        maxStorageMB: { type: Number, default: 1024 },
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    isPopular: {
        type: Boolean,
        default: false,
    },
    sortOrder: {
        type: Number,
        default: 0,
    }
}, { timestamps: true, strict: false });

// Force delete the model in development to ensure schema changes are picked up
if (process.env.NODE_ENV === 'development') {
    delete mongoose.models.Plan;
}

export default (mongoose.models.Plan as any) || mongoose.model('Plan', PlanSchema);
