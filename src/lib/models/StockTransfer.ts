import mongoose, { Document, Schema } from 'mongoose';

export interface IStockTransferLine {
    productId: string;
    designation?: string;
    quantity: number;
    uom?: string;
}

export interface IStockTransfer extends Document {
    societeId: string;
    numero: string; // TSF-{YYYY}-{SEQ}
    date: Date;
    sourceWarehouseId: string;
    destinationWarehouseId: string;
    statut: 'BROUILLON' | 'VALIDE' | 'ANNULE';
    notes?: string;
    lignes: IStockTransferLine[];
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
}

const StockTransferLineSchema = new Schema({
    productId: { type: String, required: true },
    designation: { type: String },
    quantity: { type: Number, required: true, min: 0 },
    uom: { type: String },
}, { _id: false });

const StockTransferSchema = new Schema({
    societeId: {
        type: String,
        required: true,
        index: true,
    },
    numero: {
        type: String,
        required: true,
    },
    date: {
        type: Date,
        required: true,
        default: Date.now,
    },
    sourceWarehouseId: {
        type: String,
        required: true,
    },
    destinationWarehouseId: {
        type: String,
        required: true,
    },
    statut: {
        type: String,
        enum: ['BROUILLON', 'VALIDE', 'ANNULE'],
        default: 'BROUILLON',
    },
    notes: {
        type: String,
    },
    lignes: {
        type: [StockTransferLineSchema],
        required: true,
        validate: {
            validator: function (v: IStockTransferLine[]) {
                return v && v.length > 0;
            },
            message: 'Au moins une ligne est requise',
        },
    },
    createdBy: {
        type: String,
    },
}, {
    timestamps: true,
});

// Indexes
StockTransferSchema.index({ societeId: 1, date: -1 });
StockTransferSchema.index({ societeId: 1, sourceWarehouseId: 1 });
StockTransferSchema.index({ societeId: 1, destinationWarehouseId: 1 });
StockTransferSchema.index({ societeId: 1, numero: 1 }, { unique: true });

// Delete model if exists to avoid overwrite errors in dev
if (mongoose.models && (mongoose.models as any)['StockTransfer']) {
    delete (mongoose.models as any)['StockTransfer'];
}

const StockTransfer = mongoose.model<IStockTransfer>('StockTransfer', StockTransferSchema as any);

export default StockTransfer as any;
