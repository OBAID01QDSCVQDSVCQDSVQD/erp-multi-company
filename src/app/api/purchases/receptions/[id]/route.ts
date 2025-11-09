import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Reception from '@/lib/models/Reception';

export async function GET(
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

    const reception = await (Reception as any).findOne({
      _id: id,
      societeId: tenantId,
    }).lean();

    if (!reception) {
      return NextResponse.json(
        { error: 'Bon de réception non trouvé' },
        { status: 404 }
      );
    }

    // Ensure FODEC and TIMBRE fields exist with default values for old documents
    if (reception.fodecActif === undefined) {
      reception.fodecActif = false;
    }
    if (reception.tauxFodec === undefined) {
      reception.tauxFodec = 1;
    }
    if (reception.timbreActif === undefined) {
      reception.timbreActif = true;
    }
    if (reception.montantTimbre === undefined) {
      reception.montantTimbre = 1.000;
    }
    
    // Ensure totaux.fodec and totaux.timbre exist
    if (!reception.totaux) {
      reception.totaux = {};
    }
    if (reception.totaux.fodec === undefined) {
      reception.totaux.fodec = 0;
    }
    if (reception.totaux.timbre === undefined) {
      reception.totaux.timbre = 0;
    }

    return NextResponse.json(reception);
  } catch (error) {
    console.error('Erreur GET /purchases/receptions/[id]:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    await connectDB();

    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId?.toString() || '';

    // Check if reception exists and is in BROUILLON status
    const existingReception = await (Reception as any).findOne({
      _id: id,
      societeId: tenantId,
    });

    if (!existingReception) {
      return NextResponse.json(
        { error: 'Bon de réception non trouvé' },
        { status: 404 }
      );
    }

    if (existingReception.statut !== 'BROUILLON') {
      return NextResponse.json(
        { error: 'Seuls les brouillons peuvent être modifiés' },
        { status: 400 }
      );
    }

    // Validate qteRecue >= 0
    if (body.lignes) {
      for (const ligne of body.lignes) {
        if (ligne.qteRecue < 0) {
          return NextResponse.json(
            { error: 'La quantité reçue ne peut pas être négative' },
            { status: 400 }
          );
        }
      }
    }

    // Update reception
    const updatedReception = await (Reception as any).findOneAndUpdate(
      { _id: id, societeId: tenantId, statut: 'BROUILLON' },
      {
        $set: {
          dateDoc: body.dateDoc ? new Date(body.dateDoc) : existingReception.dateDoc,
          fournisseurId: body.fournisseurId || existingReception.fournisseurId,
          fournisseurNom: body.fournisseurNom || existingReception.fournisseurNom,
          lignes: body.lignes || existingReception.lignes,
          fodecActif: body.fodecActif !== undefined ? body.fodecActif : existingReception.fodecActif,
          tauxFodec: body.tauxFodec !== undefined ? body.tauxFodec : existingReception.tauxFodec,
          timbreActif: body.timbreActif !== undefined ? body.timbreActif : existingReception.timbreActif,
          montantTimbre: body.montantTimbre !== undefined ? body.montantTimbre : existingReception.montantTimbre,
          notes: body.notes !== undefined ? body.notes : existingReception.notes,
        },
      },
      { new: true }
    );

    if (!updatedReception) {
      return NextResponse.json(
        { error: 'Bon de réception non trouvé ou ne peut pas être modifié' },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedReception);
  } catch (error) {
    console.error('Erreur PUT /purchases/receptions/[id]:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Check if reception exists and is in BROUILLON status
    const existingReception = await (Reception as any).findOne({
      _id: id,
      societeId: tenantId,
    });

    if (!existingReception) {
      return NextResponse.json(
        { error: 'Bon de réception non trouvé' },
        { status: 404 }
      );
    }

    if (existingReception.statut !== 'BROUILLON') {
      return NextResponse.json(
        { error: 'Seuls les brouillons peuvent être supprimés' },
        { status: 400 }
      );
    }

    // Delete reception
    await (Reception as any).findOneAndDelete({
      _id: id,
      societeId: tenantId,
      statut: 'BROUILLON',
    });

    return NextResponse.json({ message: 'Bon de réception supprimé' });
  } catch (error) {
    console.error('Erreur DELETE /purchases/receptions/[id]:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}
