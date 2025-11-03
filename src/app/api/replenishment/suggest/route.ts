import { NextResponse } from 'next/server';

export async function POST() {
  // Mock suggestions
  const suggestions = [
    { productCode: 'P-001', qty: 50 },
    { productCode: 'P-002', qty: 20 },
  ];
  return NextResponse.json({ data: suggestions });
}


