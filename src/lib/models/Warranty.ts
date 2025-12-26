import mongoose, { Document, Schema } from 'mongoose';

export interface IWarrantyItem {
    productId?: mongoose.Types.ObjectId;
    productName: string;
    serialNumber?: string;
    warrantyPeriod?: string; // e.g., "12 months"
}

export interface IWarranty extends Document {
    tenantId: string;
    templateId: mongoose.Types.ObjectId;
    certificateNumber: string;
    date: Date;
    status: 'active' | 'expired' | 'void';

    // Linked entities
    invoiceId?: mongoose.Types.ObjectId;
    customerId?: mongoose.Types.ObjectId;

    // Content
    // Content
    items: IWarrantyItem[];
    data: Record<string, any>; // Stores the values for dynamic fields defined in the template
    content?: string;
    exclusiveAdvantages?: string;
    publicToken?: string;

    createdAt: Date;
    updatedAt: Date;
}

const WarrantySchema = new Schema({
    tenantId: { type: String, required: true, index: true },
    templateId: { type: Schema.Types.ObjectId, ref: 'WarrantyTemplate', required: true },
    certificateNumber: { type: String, required: true },
    date: { type: Date, default: Date.now },
    status: {
        type: String,
        enum: ['active', 'expired', 'void'],
        default: 'active',
        index: true
    },

    invoiceId: { type: Schema.Types.ObjectId, ref: 'Document' },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },

    items: [{
        productId: { type: Schema.Types.ObjectId, ref: 'Product' },
        productName: { type: String, required: true },
        serialNumber: { type: String },
        warrantyPeriod: { type: String }
    }],

    data: { type: Schema.Types.Mixed, default: {} },
    content: { type: String }, // Override template content
    exclusiveAdvantages: { type: String },
    publicToken: { type: String, index: true }
}, {
    timestamps: true
});

// Ensure unique certificate number per tenant
WarrantySchema.index({ tenantId: 1, certificateNumber: 1 }, { unique: true });

// Force recompilation in development to pick up schema changes
if (process.env.NODE_ENV === 'development' && mongoose.models.Warranty) {
    delete mongoose.models.Warranty;
}

let Warranty: any;

if (mongoose.models.Warranty) {
    Warranty = mongoose.models.Warranty;
} else {
    Warranty = mongoose.model('Warranty', WarrantySchema);
}

export default Warranty;
