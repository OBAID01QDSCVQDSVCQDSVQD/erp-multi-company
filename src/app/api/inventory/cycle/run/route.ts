import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const warehouse = searchParams.get('warehouse') || 'MAIN';
  // Mock planification
  return NextResponse.json({ message: `Plan de comptage cyclique lancé pour ${warehouse}` });
}


