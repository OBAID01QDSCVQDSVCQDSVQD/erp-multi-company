import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Reception from '@/lib/models/Reception';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId?.toString() || '';

    // Find reception
    const reception = await (Reception as any).findOne({
      _id: id,
      societeId: tenantId,
    });

    if (!reception) {
      return NextResponse.json(
        { error: 'Bon de réception non trouvé' },
        { status: 404 }
      );
    }

    if (reception.statut !== 'BROUILLON') {
      return NextResponse.json(
        { error: 'Seuls les brouillons peuvent être annulés' },
        { status: 400 }
      );
    }

    // Update reception status to ANNULE
    const updatedReception = await (Reception as any).findOneAndUpdate(
      { _id: id, societeId: tenantId },
      { $set: { statut: 'ANNULE' } },
      { new: true }
    );

    return NextResponse.json({
      message: 'Bon de réception annulé',
      reception: updatedReception,
    });
  } catch (error) {
    console.error('Erreur POST /purchases/receptions/[id]/annuler:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}
