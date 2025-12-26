import mongoose, { Document, Schema } from 'mongoose';

export interface IWarrantyField {
    id: string;
    label: string;
    type: 'text' | 'textarea' | 'date' | 'boolean' | 'number';
    required: boolean;
    defaultValue?: string;
    placeholder?: string;
    order: number;
}

export interface IWarrantyTemplate extends Document {
    tenantId: string;
    name: string;
    isActive: boolean;
    content: string; // The static text content (e.g., terms and conditions)
    exclusiveAdvantages?: string;
    fields: IWarrantyField[]; // The dynamic fields definition
    createdAt: Date;
    updatedAt: Date;
}

const WarrantyTemplateSchema = new Schema({
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    content: { type: String, default: '' },
    exclusiveAdvantages: { type: String, default: '' },
    fields: [{
        id: { type: String, required: true },
        label: { type: String, required: true },
        type: { type: String, enum: ['text', 'textarea', 'date', 'boolean', 'number'], default: 'text' },
        required: { type: Boolean, default: false },
        defaultValue: { type: String },
        placeholder: { type: String },
        order: { type: Number, default: 0 }
    }]
}, {
    timestamps: true
});

// Compound index to ensure unique template names per tenant
WarrantyTemplateSchema.index({ tenantId: 1, name: 1 }, { unique: true });

// Force recompilation in development to pick up schema changes
if (process.env.NODE_ENV === 'development' && mongoose.models.WarrantyTemplate) {
    delete mongoose.models.WarrantyTemplate;
}

let WarrantyTemplate: any;

if (mongoose.models.WarrantyTemplate) {
    WarrantyTemplate = mongoose.models.WarrantyTemplate;
} else {
    WarrantyTemplate = mongoose.model('WarrantyTemplate', WarrantyTemplateSchema);
}

export default WarrantyTemplate;
