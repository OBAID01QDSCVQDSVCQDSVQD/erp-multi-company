import mongoose, { Schema, Document } from 'mongoose';

export interface IAttendance extends Document {
  tenantId: string;
  employeeId: mongoose.Types.ObjectId;
  date: Date;
  checkIn?: Date;
  checkOut?: Date;
  status: 'present' | 'absent' | 'late' | 'on_leave';
  totalHours?: number;
  lateMinutes?: number;
  notes?: string;
  location?: {
    latitude?: number;
    longitude?: number;
    address?: string;
  };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSchema = new (Schema as any)({
  tenantId: {
    type: String,
    required: true,
    index: true,
  },
  employeeId: {
    type: Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true,
  },
  date: {
    type: Date,
    required: true,
    index: true,
  },
  checkIn: {
    type: Date,
  },
  checkOut: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'on_leave'],
    default: 'absent',
  },
  totalHours: {
    type: Number,
  },
  lateMinutes: {
    type: Number,
    default: 0,
  },
  notes: {
    type: String,
  },
  location: {
    latitude: { type: Number },
    longitude: { type: Number },
    address: { type: String },
  },
  createdBy: {
    type: String,
    required: true,
  },
}, {
  timestamps: true,
});

// Compound index for unique attendance per employee per day
AttendanceSchema.index({ tenantId: 1, employeeId: 1, date: 1 }, { unique: true });

// Index for date range queries
AttendanceSchema.index({ tenantId: 1, date: 1 });

// Normalize date to UTC midnight before saving
AttendanceSchema.pre('save', function(next) {
  // Normalize date to UTC midnight
  if (this.date) {
    const date = new Date(this.date);
    this.date = new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0, 0, 0, 0
    ));
  }
  
  // Calculate total hours if both checkIn and checkOut are present
  if (this.checkIn && this.checkOut) {
    const diff = (this.checkOut.getTime() - this.checkIn.getTime()) / (1000 * 60 * 60);
    this.totalHours = Math.round(diff * 100) / 100;
    
    // Update status to present if not already set
    if (this.status === 'absent') {
      this.status = 'present';
    }
  }
  next();
});

// Export model
if (mongoose.models && (mongoose.models as any)['Attendance']) {
  delete (mongoose.models as any)['Attendance'];
}

const Attendance = mongoose.model<IAttendance>('Attendance', AttendanceSchema) as any;

export default Attendance;

