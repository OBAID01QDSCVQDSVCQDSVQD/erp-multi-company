import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import GlobalUnit from '@/lib/models/GlobalUnit';
import Unit from '@/lib/models/Unit';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
    if (!tenantId) return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });

    await connectDB();

    const [globals, locals] = await Promise.all([
      (GlobalUnit as any).find({}).lean(),
      (Unit as any).find({ tenantId }).lean(),
    ]);

    const byCode = new Map<string, any>();
    for (const g of globals) byCode.set(g.code, { ...g, origine: 'global' });
    for (const l of locals) byCode.set(l.code, { ...l, origine: 'local' });

    return NextResponse.json({ data: Array.from(byCode.values()) });
  } catch (error) {
    console.error('Erreur GET /units/union:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}


