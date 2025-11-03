import mongoose, { Document, Schema } from 'mongoose';

export type UniteCategorie = 'quantite' | 'poids' | 'volume' | 'longueur' | 'surface' | 'temps';

export interface IGlobalUnit extends Document {
  code: string;
  libelle: string;
  symbole: string;
  categorie: UniteCategorie;
  baseCategorie: string; // code de l'unité de base de la catégorie
  facteurVersBase: number; // 1 UNITÉ = facteurVersBase * BASE
  actif: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const GlobalUnitSchema = new Schema<IGlobalUnit>({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  libelle: { type: String, required: true, trim: true },
  symbole: { type: String, required: true, trim: true },
  categorie: { type: String, required: true, enum: ['quantite','poids','volume','longueur','surface','temps'] },
  baseCategorie: { type: String, required: true, uppercase: true, trim: true },
  facteurVersBase: { type: Number, required: true, min: 0 },
  actif: { type: Boolean, default: true },
}, { timestamps: true });

// Note: 'unique: true' on code already creates the unique index. Avoid duplicate definitions.

export default mongoose.models.GlobalUnit || mongoose.model<IGlobalUnit>('GlobalUnit', GlobalUnitSchema);


