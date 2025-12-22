// @ts-nocheck
import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'manager' | 'user';
  companyId: mongoose.Types.ObjectId;
  permissions: string[];
  isActive: boolean;
  isVerified: boolean;
  twoFactorSecret?: string;
  isTwoFactorEnabled?: boolean;
  twoFactorBackupCodes?: { code: string; used: boolean }[];
  emailTwoFactorCode?: string;
  emailTwoFactorCodeExpires?: Date;
  verificationToken?: string;
  verificationTokenExpires?: Date;
  failedLoginAttempts: number;
  lockoutUntil?: Date;
  lastLogin?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new (Schema as any)({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
  },
  role: {
    type: String,
    enum: ['admin', 'manager', 'user'],
    default: 'user',
  },
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
  },
  permissions: [{
    type: String,
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  twoFactorSecret: {
    type: String,
  },
  isTwoFactorEnabled: {
    type: Boolean,
    default: false,
  },
  twoFactorBackupCodes: [{
    code: { type: String, required: true },
    used: { type: Boolean, default: false }
  }],
  emailTwoFactorCode: {
    type: String,
  },
  emailTwoFactorCodeExpires: {
    type: Date,
  },
  verificationToken: {
    type: String,
  },
  verificationTokenExpires: {
    type: Date,
  },
  failedLoginAttempts: {
    type: Number,
    default: 0,
  },
  lockoutUntil: {
    type: Date,
  },
  lastLogin: {
    type: Date,
  },
  resetPasswordToken: {
    type: String,
  },
  resetPasswordExpires: {
    type: Date,
  },
}, {
  timestamps: true,
});

let User: mongoose.Model<IUser>;

if ((mongoose.models as any)['User']) {
  User = (mongoose.models as any)['User'] as mongoose.Model<IUser>;
} else {
  User = (mongoose.model('User', UserSchema) as any) as mongoose.Model<IUser>;
}

export default User;
