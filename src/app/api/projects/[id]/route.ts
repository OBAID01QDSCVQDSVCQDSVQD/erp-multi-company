import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Project from '@/lib/models/Project';
import Employee from '@/lib/models/Employee';
import Customer from '@/lib/models/Customer';
import DocumentModel from '@/lib/models/Document';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();
    const tenantId = session.user.companyId?.toString() || '';
    const { id } = await params;

    // Validate ObjectId format
    if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
      return NextResponse.json(
        { error: 'ID de projet invalide' },
        { status: 400 }
      );
    }

    // Ensure referenced models are registered
    if (!mongoose.models.Employee) {
      void Employee;
    }
    if (!mongoose.models.Customer) {
      void Customer;
    }
    if (!mongoose.models.Document) {
      void DocumentModel;
    }

    let project;
    try {
      project = await (Project as any)
        .findOne({
          _id: id,
          tenantId,
        })
        .populate({
          path: 'customerId',
          select: 'nom prenom raisonSociale email phone address',
          model: Customer,
        })
        .populate({
          path: 'devisIds',
          select: 'numero dateDoc date totalBaseHT totalHT totalTTC',
          model: DocumentModel,
        })
        .populate({
          path: 'blIds',
          select: 'numero dateDoc date totalBaseHT totalHT totalTTC',
          model: DocumentModel,
        })
        .populate({
          path: 'assignedEmployees.employeeId',
          select: 'firstName lastName position department email phone',
          model: Employee,
        })
        .lean();
    } catch (populateError) {
      console.error('Error populating project details:', populateError);
      project = await (Project as any)
        .findOne({
          _id: id,
          tenantId,
        })
        .lean();
    }

    if (!project) {
      return NextResponse.json(
        { error: 'Projet non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json(project);
  } catch (error: any) {
    console.error('Error fetching project:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();
    const tenantId = session.user.companyId?.toString() || '';
    const { id } = await params;

    // Validate ObjectId format
    if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
      return NextResponse.json(
        { error: 'ID de projet invalide' },
        { status: 400 }
      );
    }

    const body = await request.json();

    const project = await (Project as any).findOne({
      _id: id,
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
    if (body.customerId !== undefined) project.customerId = new mongoose.Types.ObjectId(body.customerId);
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
    if (body.devisIds !== undefined) {
      project.devisIds = body.devisIds?.map((id: string) => new mongoose.Types.ObjectId(id)) || [];
    }
    if (body.blIds !== undefined) {
      project.blIds = body.blIds?.map((id: string) => new mongoose.Types.ObjectId(id)) || [];
    }
    if (body.assignedEmployees !== undefined) {
      project.assignedEmployees = body.assignedEmployees?.map((emp: any) => ({
        employeeId: new mongoose.Types.ObjectId(emp.employeeId),
        role: emp.role,
        hourlyRate: emp.hourlyRate ? parseFloat(emp.hourlyRate) : undefined,
        dailyRate: emp.dailyRate ? parseFloat(emp.dailyRate) : undefined,
        startDate: new Date(emp.startDate),
        endDate: emp.endDate ? new Date(emp.endDate) : undefined,
      })) || [];
    }
    if (body.notes !== undefined) project.notes = body.notes?.trim() || undefined;
    if (body.tags !== undefined) project.tags = body.tags || [];

    await project.save();

    // Ensure Employee model is registered
    if (!mongoose.models.Employee) {
      // Import will register the model
      void Employee;
    }

    await project.populate({
      path: 'customerId',
      select: 'nom prenom raisonSociale',
      model: Customer,
    });
    if (project.devisIds && project.devisIds.length > 0) {
      await project.populate({
        path: 'devisIds',
        select: 'numero dateDoc date totalBaseHT totalHT totalTTC',
        model: DocumentModel,
      });
    }
    if (project.blIds && project.blIds.length > 0) {
      await project.populate({
        path: 'blIds',
        select: 'numero dateDoc date totalBaseHT totalHT totalTTC',
        model: DocumentModel,
      });
    }
    await project.populate({
      path: 'assignedEmployees.employeeId',
      select: 'firstName lastName position department',
      model: Employee,
    });

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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();
    const tenantId = session.user.companyId?.toString() || '';
    const { id } = await params;

    // Validate ObjectId format
    if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
      return NextResponse.json(
        { error: 'ID de projet invalide' },
        { status: 400 }
      );
    }

    const project = await (Project as any).findOneAndDelete({
      _id: id,
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

