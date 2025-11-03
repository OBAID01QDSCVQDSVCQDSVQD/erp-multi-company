import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import ProductCategory from '@/lib/models/ProductCategory';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
  await connectDB();
  const data = await (ProductCategory as any).find({ tenantId, actif: true }).lean();
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
  await connectDB();
  const body = await request.json();
  const doc = await (ProductCategory as any).findOneAndUpdate(
    { tenantId, code: body.code.toUpperCase() },
    { tenantId, code: body.code.toUpperCase(), nom: body.nom, description: body.description, parentCode: body.parentCode?.toUpperCase(), actif: body.actif !== false },
    { new: true, upsert: true }
  );
  return NextResponse.json(doc, { status: 201 });
}


