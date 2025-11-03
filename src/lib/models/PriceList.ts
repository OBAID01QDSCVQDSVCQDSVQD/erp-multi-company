import mongoose, { Document, Schema } from 'mongoose';

export interface IPriceList extends Document {
  tenantId: string;
  listeCode: string;
  nom: string;
  devise: string;
  actif: boolean;
}

const PriceListSchema = new Schema<IPriceList>({
  tenantId: { type: String, required: true, index: true },
  listeCode: { type: String, required: true, uppercase: true, trim: true },
  nom: { type: String, required: true, trim: true },
  devise: { type: String, default: 'TND' },
  actif: { type: Boolean, default: true },
}, { timestamps: true });

PriceListSchema.index({ tenantId: 1, listeCode: 1 }, { unique: true });

export default mongoose.models.PriceList || mongoose.model<IPriceList>('PriceList', PriceListSchema);


