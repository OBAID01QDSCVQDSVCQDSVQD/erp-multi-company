import mongoose, { Schema, Document } from 'mongoose';

export interface IEvent extends Document {
    tenantId: string;
    title: string;
    description?: string;
    startDate: Date;
    endDate: Date;
    type: 'diagnostic' | 'maintenance' | 'meeting' | 'other';
    status: 'scheduled' | 'completed' | 'cancelled' | 'pending';
    clientId?: mongoose.Types.ObjectId;
    employeeId?: mongoose.Types.ObjectId; // Technician/Employee assigned
    location?: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
}

const EventSchema: Schema = new Schema({
    tenantId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true },
    type: {
        type: String,
        enum: ['diagnostic', 'maintenance', 'meeting', 'other'],
        default: 'other'
    },
    status: {
        type: String,
        enum: ['scheduled', 'completed', 'cancelled', 'pending'],
        default: 'scheduled'
    },
    clientId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee' },
    location: { type: String },
    photos: { type: [String], default: [] },
    createdBy: { type: String },
}, {
    timestamps: true
});

// Indexes for faster lookups
EventSchema.index({ tenantId: 1, startDate: 1 });
EventSchema.index({ tenantId: 1, type: 1 });
EventSchema.index({ tenantId: 1, clientId: 1 });

// Clear the model from cache if it exists
let Event: any;

if (mongoose.models.Event) {
    Event = mongoose.models.Event;
} else {
    Event = mongoose.model('Event', EventSchema);
}

export default Event;
