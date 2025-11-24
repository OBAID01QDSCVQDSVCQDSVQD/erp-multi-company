import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Project from '@/lib/models/Project';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();
    const tenantId = session.user.companyId?.toString() || '';

    const project = await (Project as any)
      .findOne({
        _id: params.id,
        tenantId,
      })
      .populate('customerId', 'nom prenom raisonSociale email phone address')
      .populate('devisIds', 'numero dateDoc date totalBaseHT totalHT totalTTC')
      .populate('blIds', 'numero dateDoc date totalBaseHT totalHT totalTTC')
      .populate('assignedEmployees.employeeId', 'firstName lastName position department email phone')
      .lean();

    if (!project) {
      return NextResponse.json(
        { error: 'Projet non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json(project);
  } catch (error: any) {
    console.error('Error fetching project:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();
    const tenantId = session.user.companyId?.toString() || '';

    const body = await request.json();

    const project = await (Project as any).findOne({
      _id: params.id,
      tenantId,
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Projet non trouvé' },
        { status: 404 }
      );
    }

    // Update fields
    if (body.name !== undefined) project.name = body.name.trim();
    if (body.description !== undefined) project.description = body.description?.trim() || undefined;
    if (body.customerId !== undefined) project.customerId = body.customerId;
    if (body.startDate !== undefined) project.startDate = new Date(body.startDate);
    if (body.expectedEndDate !== undefined) {
      project.expectedEndDate = body.expectedEndDate ? new Date(body.expectedEndDate) : undefined;
    }
    if (body.actualEndDate !== undefined) {
      project.actualEndDate = body.actualEndDate ? new Date(body.actualEndDate) : undefined;
    }
    if (body.status !== undefined) project.status = body.status;
    if (body.budget !== undefined) project.budget = body.budget ? parseFloat(body.budget) : undefined;
    if (body.currency !== undefined) project.currency = body.currency;
    if (body.devisIds !== undefined) project.devisIds = body.devisIds || [];
    if (body.blIds !== undefined) project.blIds = body.blIds || [];
    if (body.assignedEmployees !== undefined) project.assignedEmployees = body.assignedEmployees || [];
    if (body.notes !== undefined) project.notes = body.notes?.trim() || undefined;
    if (body.tags !== undefined) project.tags = body.tags || [];

    await project.save();

    await project.populate('customerId', 'nom prenom raisonSociale');
    if (project.devisIds && project.devisIds.length > 0) {
      await project.populate('devisIds', 'numero dateDoc date totalBaseHT totalHT totalTTC');
    }
    if (project.blIds && project.blIds.length > 0) {
      await project.populate('blIds', 'numero dateDoc date totalBaseHT totalHT totalTTC');
    }
    await project.populate('assignedEmployees.employeeId', 'firstName lastName position department');

    return NextResponse.json(project.toObject());
  } catch (error: any) {
    console.error('Error updating project:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();
    const tenantId = session.user.companyId?.toString() || '';

    const project = await (Project as any).findOneAndDelete({
      _id: params.id,
      tenantId,
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Projet non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Projet supprimé avec succès' });
  } catch (error: any) {
    console.error('Error deleting project:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}

