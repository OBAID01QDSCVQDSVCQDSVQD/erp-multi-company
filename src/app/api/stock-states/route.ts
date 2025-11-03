import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import StockState from '@/lib/models/StockState';

export async function GET() {
  try {
    await connectDB();
    const data = await (StockState as any).find({ actif: true }).lean();
    return NextResponse.json({ data });
  } catch (e) {
    console.error('Erreur GET /stock-states', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}


