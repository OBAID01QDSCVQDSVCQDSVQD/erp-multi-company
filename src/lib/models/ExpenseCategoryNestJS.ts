// @ts-nocheck
// NestJS file - not used in Next.js app
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ExpenseCategoryDocument = ExpenseCategory & Document;

export enum ExpenseCategoryType {
  EXPLOITATION = 'exploitation',
  CONSOMMABLE = 'consommable',
  INVESTISSEMENT = 'investissement',
  FINANCIER = 'financier',
  EXCEPTIONNEL = 'exceptionnel',
}

@Schema({ timestamps: true })
export class ExpenseCategory {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, trim: true, uppercase: true })
  code: string;

  @Prop({ required: true, trim: true })
  nom: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ trim: true })
  icone?: string;

  @Prop({ 
    type: String, 
    enum: ExpenseCategoryType,
    default: ExpenseCategoryType.EXPLOITATION 
  })
  typeGlobal: ExpenseCategoryType;

  @Prop({ default: true })
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const ExpenseCategorySchema = SchemaFactory.createForClass(ExpenseCategory);

// Index unique pour tenantId + code
ExpenseCategorySchema.index({ tenantId: 1, code: 1 }, { unique: true });

// Index pour la recherche par nom
ExpenseCategorySchema.index({ tenantId: 1, nom: 1 });

// Index pour la recherche par type
ExpenseCategorySchema.index({ tenantId: 1, typeGlobal: 1 });




