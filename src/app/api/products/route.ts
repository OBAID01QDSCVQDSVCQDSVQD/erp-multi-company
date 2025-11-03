import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Product from '@/lib/models/Product';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
    if (!tenantId) return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const categorie = searchParams.get('categorie') || undefined;
    const actif = searchParams.get('actif');
    const estStocke = searchParams.get('estStocke');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    await connectDB();
    const filter: any = { tenantId };
    if (q) filter.$text = { $search: q };
    if (categorie) filter.categorieCode = categorie.toUpperCase();
    if (actif === 'true' || actif === 'false') filter.actif = actif === 'true';
    if (estStocke === 'true' || estStocke === 'false') filter.estStocke = estStocke === 'true';

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      (Product as any).find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      (Product as any).countDocuments(filter),
    ]);

    return NextResponse.json({ items, total, page, limit });
  } catch (e) {
    console.error('Erreur GET /products', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
    if (!tenantId) return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });

    const body = await request.json();
    await connectDB();
    let sku = (body.sku || '').toUpperCase();
    if (!sku) {
      const year = new (Date as any)().getFullYear();
      const seq = String(Date.now()).slice(-5);
      sku = `P-${year}${seq}`.toUpperCase();
    }
    const payload = { ...body, tenantId, sku };
    const created = await (Product as any).create(payload);
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error('Erreur POST /products', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

