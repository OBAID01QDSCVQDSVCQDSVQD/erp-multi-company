import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    userName: String, // Store snapshot of name
    userEmail: String, // Store snapshot of email
    action: {
        type: String,
        required: true,
        // Examples: 'LOGIN', 'CREATE', 'UPDATE', 'DELETE', 'IMPERSONATE', 'SETTINGS_CHANGE'
    },
    resource: {
        type: String, // e.g., 'Company', 'User', 'Subscription'
    },
    details: {
        type: String, // Readable description
    },
    ipAddress: String,
    location: String, // Store City, Country
    metadata: {
        type: mongoose.Schema.Types.Mixed // Flexible object for diffs or IDs
    }
}, { timestamps: true });

// TTL Index: Auto-delete logs after 90 days to save space (optional, usually good practice)
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export default (mongoose.models.AuditLog as any) || mongoose.model('AuditLog', AuditLogSchema);
