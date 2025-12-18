
import mongoose from 'mongoose';

const SystemSettingsSchema = new mongoose.Schema({
    systemName: {
        type: String,
        default: 'ERP Multi-Entreprises',
        trim: true,
    },
    registrationEnabled: {
        type: Boolean,
        default: true,
    },
    maintenanceMode: {
        type: Boolean,
        default: false,
    },
    announcementMessage: {
        type: String,
        default: '',
    },
    contactEmail: {
        type: String,
        trim: true,
    },
    supportPhone: {
        type: String,
        trim: true,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }
}, { timestamps: true });

// Ensure only one settings document exists usually, but we'll handle that in logic
export default (mongoose.models.SystemSettings as any) || mongoose.model('SystemSettings', SystemSettingsSchema);
