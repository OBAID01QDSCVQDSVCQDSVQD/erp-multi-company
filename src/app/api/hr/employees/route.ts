import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Employee from '@/lib/models/Employee';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const tenantId = session.user.companyId?.toString() || '';
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status');
    const department = searchParams.get('department');
    const q = searchParams.get('q');

    const query: any = { tenantId };

    if (status && status !== 'all') {
      query.status = status;
    }

    if (department) {
      query.department = department;
    }

    if (q) {
      query.$or = [
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { position: { $regex: q, $options: 'i' } },
        { employeeNumber: { $regex: q, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [employees, total] = await Promise.all([
      (Employee as any).find(query)
        .sort('-createdAt')
        .skip(skip)
        .limit(limit)
        .lean(),
      (Employee as any).countDocuments(query)
    ]);

    return NextResponse.json({
      items: employees,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    await connectDB();

    const tenantId = session.user.companyId?.toString() || '';

    // Check if email already exists
    const existingEmployee = await (Employee as any).findOne({
      tenantId,
      email: body.email?.toLowerCase().trim()
    });

    if (existingEmployee) {
      return NextResponse.json(
        { error: 'Un employé avec cet email existe déjà' },
        { status: 400 }
      );
    }

    // Validation des champs obligatoires
    if (!body.firstName || !body.lastName || !body.email) {
      return NextResponse.json(
        { error: 'Prénom, Nom et Email sont obligatoires' },
        { status: 400 }
      );
    }

    if (!body.position || !body.department) {
      return NextResponse.json(
        { error: 'Poste et Département sont obligatoires' },
        { status: 400 }
      );
    }

    // Prepare employee data
    const employeeData: any = {
      tenantId,
      // Personal Information
      firstName: body.firstName?.trim(),
      lastName: body.lastName?.trim(),
      email: body.email?.toLowerCase().trim(),
      phone: body.phone?.trim() || undefined,
      mobile: body.mobile?.trim() || undefined,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
      address: body.address && body.address.line1 ? {
        line1: body.address.line1?.trim() || '',
        line2: body.address.line2?.trim() || '',
        city: body.address.city?.trim() || '',
        postalCode: body.address.postalCode?.trim() || '',
        country: body.address.country || 'TN'
      } : {
        line1: '',
        city: '',
        country: 'TN'
      },
      cin: body.cin?.trim() || undefined,
      socialSecurityNumber: body.socialSecurityNumber?.trim() || undefined,
      
      // Professional Information
      employeeNumber: body.employeeNumber?.trim() || undefined,
      position: body.position?.trim(),
      department: body.department?.trim(),
      manager: body.manager?.trim() || undefined,
      hireDate: body.hireDate ? new Date(body.hireDate) : new Date(),
      contractType: body.contractType || 'cdi',
      status: body.status || 'active',
      
      // Salary Information
      baseSalary: body.baseSalary ? parseFloat(body.baseSalary) : undefined,
      currency: body.currency || 'TND',
      paymentMethod: body.paymentMethod || 'bank_transfer',
      bankAccount: body.bankAccount || {},
      
      // Emergency Contact
      emergencyContact: body.emergencyContact || {},
      
      // Additional Information
      notes: body.notes?.trim() || undefined,
      skills: body.skills || [],
      languages: body.languages || [],
      
      createdBy: session.user.email,
    };

    const employee = new (Employee as any)(employeeData);
    await employee.save();

    return NextResponse.json(employee, { status: 201 });
  } catch (error: any) {
    console.error('Error creating employee:', error);
    
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Un employé avec cet email ou numéro existe déjà' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}

