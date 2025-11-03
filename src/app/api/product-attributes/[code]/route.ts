import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import ProductAttribute from '@/lib/models/ProductAttribute';

export async function PATCH(request: NextRequest, { params }: { params: { code: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
  await connectDB();
  const body = await request.json();
  const update: any = {};
  for (const k of ['nom','type','valeurs','actif']) if (body[k] !== undefined) update[k] = body[k];
  const doc = await (ProductAttribute as any).findOneAndUpdate({ tenantId, code: params.code.toUpperCase() }, { $set: update }, { new: true });
  if (!doc) return NextResponse.json({ error: 'Attribut introuvable' }, { status: 404 });
  return NextResponse.json(doc);
}

export async function DELETE(request: NextRequest, { params }: { params: { code: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
  await connectDB();
  await (ProductAttribute as any).findOneAndUpdate({ tenantId, code: params.code.toUpperCase() }, { $set: { actif: false } });
  return NextResponse.json({ message: 'Attribut désactivé' });
}


