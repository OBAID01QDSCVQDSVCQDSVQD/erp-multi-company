import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Employee from '@/lib/models/Employee';

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

    const employee = await (Employee as any).findOne({
      _id: params.id,
      tenantId,
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employé non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json(employee.toObject());
  } catch (error: any) {
    console.error('Error fetching employee:', error);
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

    // Check if employee exists
    const employee = await (Employee as any).findOne({
      _id: params.id,
      tenantId,
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employé non trouvé' },
        { status: 404 }
      );
    }

    // Check if email is being changed and if it already exists
    if (body.email && body.email !== employee.email) {
      const existingEmployee = await (Employee as any).findOne({
        tenantId,
        email: body.email.toLowerCase().trim(),
        _id: { $ne: params.id }
      });

      if (existingEmployee) {
        return NextResponse.json(
          { error: 'Un employé avec cet email existe déjà' },
          { status: 400 }
        );
      }
    }

    // Update employee fields
    Object.keys(body).forEach(key => {
      if (key === 'address' || key === 'bankAccount' || key === 'emergencyContact') {
        // Handle nested objects
        if (body[key]) {
          employee[key] = { ...employee[key], ...body[key] };
        }
      } else if (key === 'skills' || key === 'languages') {
        // Handle arrays
        employee[key] = body[key] || [];
      } else if (key !== '_id' && key !== 'tenantId' && key !== 'createdAt' && key !== 'updatedAt') {
        employee[key] = body[key];
      }
    });

    await employee.save();

    return NextResponse.json(employee.toObject());
  } catch (error: any) {
    console.error('Error updating employee:', error);
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

    const employee = await (Employee as any).findOneAndDelete({
      _id: params.id,
      tenantId,
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employé non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Employé supprimé avec succès' });
  } catch (error: any) {
    console.error('Error deleting employee:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}

