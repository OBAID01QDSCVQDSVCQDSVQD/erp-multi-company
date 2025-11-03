import mongoose, { Document, Schema } from 'mongoose';
import { UniteCategorie } from './GlobalUnit';

export interface IUnit extends Document {
  tenantId: string;
  code: string;
  libelle: string;
  symbole: string;
  categorie: UniteCategorie;
  baseCategorie: string;
  facteurVersBase: number;
  actif: boolean;
  estParDefaut?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UnitSchema = new Schema<IUnit>({
  tenantId: { type: String, required: true, index: true },
  code: { type: String, required: true, uppercase: true, trim: true },
  libelle: { type: String, required: true, trim: true },
  symbole: { type: String, required: true, trim: true },
  categorie: { type: String, required: true, enum: ['quantite','poids','volume','longueur','surface','temps'] },
  baseCategorie: { type: String, required: true, uppercase: true, trim: true },
  facteurVersBase: { type: Number, required: true, min: 0 },
  actif: { type: Boolean, default: true },
  estParDefaut: { type: Boolean, default: false },
}, { timestamps: true });

UnitSchema.index({ tenantId: 1, code: 1 }, { unique: true });
UnitSchema.index({ tenantId: 1, categorie: 1, estParDefaut: 1 });

export default mongoose.models.Unit || mongoose.model<IUnit>('Unit', UnitSchema);


