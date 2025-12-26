
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Warranty from '@/lib/models/Warranty';
import WarrantyTemplate from '@/lib/models/WarrantyTemplate';

export async function GET() {
    try {
        await connectDB();

        // Fetch latest warrantytemplate to see if field exists
        const template = await (WarrantyTemplate as any).findOne({}).sort({ updatedAt: -1 });

        // Fetch latest warranty
        const warranty = await (Warranty as any).findOne({}).sort({ updatedAt: -1 }).populate('templateId');

        return NextResponse.json({
            template: {
                _id: template?._id,
                name: template?.name,
                exclusiveAdvantages: template?.exclusiveAdvantages || 'UNDEFINED',
                hasField: template?.toObject().hasOwnProperty('exclusiveAdvantages')
            },
            warranty: {
                _id: warranty?._id,
                certificateNumber: warranty?.certificateNumber,
                exclusiveAdvantages: warranty?.exclusiveAdvantages || 'UNDEFINED',
                templateId_exclusiveAdvantages: (warranty?.templateId as any)?.exclusiveAdvantages || 'UNDEFINED',
                hasField: warranty?.toObject().hasOwnProperty('exclusiveAdvantages')
            }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, stack: error.stack });
    }
}
