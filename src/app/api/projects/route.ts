import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Project from '@/lib/models/Project';
import Employee from '@/lib/models/Employee';
import Customer from '@/lib/models/Customer';
import NotificationService from '@/lib/services/NotificationService';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

// Generate project number
async function generateProjectNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  
  // Find the last project number for this year
  const lastProject = await (Project as any)
    .findOne({
      tenantId,
      projectNumber: { $regex: `^PROJ-${year}-` },
    })
    .sort({ projectNumber: -1 })
    .select('projectNumber')
    .lean();

  let nextNumber = 1;
  
  if (lastProject?.projectNumber) {
    // Extract the number from the last project number (e.g., "PROJ-2025-001" -> 1)
    const numericMatches = lastProject.projectNumber.match(/\d+/g);
    if (numericMatches && numericMatches.length >= 2) {
      const lastNumber = parseInt(numericMatches[numericMatches.length - 1], 10);
      nextNumber = (isNaN(lastNumber) ? 0 : lastNumber) + 1;
    }
  }

  const number = nextNumber.toString().padStart(3, '0');
  return `PROJ-${year}-${number}`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();
    
    // Get tenantId from header or session
    const tenantIdFromHeader = request.headers.get('X-Tenant-Id');
    const tenantId = tenantIdFromHeader || session.user.companyId?.toString() || '';
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID manquant' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');
    const q = searchParams.get('q');
    const actif = searchParams.get('actif');

    const query: any = { tenantId };

    // Handle actif parameter: filter for active projects (not completed or cancelled)
    if (actif === 'true') {
      query.status = { $nin: ['completed', 'cancelled'] };
    } else if (actif === 'false') {
      query.status = { $in: ['completed', 'cancelled'] };
    } else if (status && status !== 'all') {
      query.status = status;
    }

    if (customerId) {
      query.customerId = customerId;
    }

    if (q) {
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { projectNumber: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    // Ensure models are registered
    try {
      if (!mongoose.models.Employee) {
        void Employee;
      }
      if (!mongoose.models.Customer) {
        void Customer;
      }
    } catch (modelError) {
      console.error('Error ensuring models are registered:', modelError);
    }

    let projects, total;
    try {
      const queryBuilder = (Project as any).find(query);
      
      // Populate customerId
      queryBuilder.populate({
        path: 'customerId',
        select: 'nom prenom raisonSociale',
        model: Customer,
      });
      
      // Populate devisIds and blIds if they exist
      queryBuilder.populate('devisIds', 'numero totalTTC');
      queryBuilder.populate('blIds', 'numero totalTTC');
      
      // Populate assignedEmployees.employeeId
      queryBuilder.populate({
        path: 'assignedEmployees.employeeId',
        select: 'firstName lastName position',
      });

      [projects, total] = await Promise.all([
        queryBuilder
          .sort('-createdAt')
          .skip(skip)
          .limit(limit)
          .lean(),
        (Project as any).countDocuments(query),
      ]);
    } catch (populateError: any) {
      console.error('Error during populate:', populateError);
      console.error('Populate error details:', {
        message: populateError.message,
        stack: populateError.stack,
        name: populateError.name,
      });
      
      // If populate fails, try with minimal populate
      try {
        [projects, total] = await Promise.all([
          (Project as any)
            .find(query)
            .populate({
              path: 'customerId',
              select: 'nom prenom raisonSociale',
              model: Customer,
            })
          (Project as any)
            .find(query)
            .populate({
              path: 'customerId',
              select: 'nom prenom raisonSociale',
              model: Customer,
            })
            .sort('-createdAt')
            .skip(skip)
            .limit(limit)
            .lean(),
          (Project as any).countDocuments(query),
        ]);
      } catch (fallbackError: any) {
        console.error('Fallback query also failed:', fallbackError);
        // Last resort: query without any populate
        [projects, total] = await Promise.all([
          (Project as any)
            .find(query)
            .sort('-createdAt')
            .skip(skip)
            .limit(limit)
            .lean(),
          (Project as any).countDocuments(query),
        ]);
      }
    }

    return NextResponse.json({
      items: projects,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error('Error fetching projects:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
    });
    return NextResponse.json(
      { 
        error: 'Erreur serveur', 
        details: error.message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      },
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
    const currentUserEmail = session.user.email as string | undefined;

    // Validation
    if (!body.name || !body.customerId || !body.startDate) {
      return NextResponse.json(
        { error: 'Nom, Client et Date de début sont obligatoires' },
        { status: 400 }
      );
    }

    // Generate project number
    const projectNumber = await generateProjectNumber(tenantId);

    // Prepare project data
    const projectData: any = {
      tenantId,
      projectNumber,
      name: body.name.trim(),
      description: body.description?.trim() || undefined,
      customerId: new mongoose.Types.ObjectId(body.customerId),
      startDate: new Date(body.startDate),
      expectedEndDate: body.expectedEndDate ? new Date(body.expectedEndDate) : undefined,
      status: body.status || 'pending',
      budget: body.budget ? parseFloat(body.budget) : undefined,
      currency: body.currency || 'TND',
      devisIds: body.devisIds?.map((id: string) => new mongoose.Types.ObjectId(id)) || [],
      blIds: body.blIds?.map((id: string) => new mongoose.Types.ObjectId(id)) || [],
      assignedEmployees: body.assignedEmployees?.map((emp: any) => ({
        employeeId: new mongoose.Types.ObjectId(emp.employeeId),
        role: emp.role,
        hourlyRate: emp.hourlyRate ? parseFloat(emp.hourlyRate) : undefined,
        dailyRate: emp.dailyRate ? parseFloat(emp.dailyRate) : undefined,
        startDate: new Date(emp.startDate),
        endDate: emp.endDate ? new Date(emp.endDate) : undefined,
      })) || [],
      notes: body.notes?.trim() || undefined,
      tags: body.tags || [],
      createdBy: session.user.email,
      // Initialize calculated fields with defaults
      totalProductsCost: 0,
      totalExpensesCost: 0,
      totalLaborCost: 0,
      totalCost: 0,
      profit: 0,
      profitMargin: 0,
    };

    const project = new (Project as any)(projectData);
    await project.save();

    await project.populate('customerId', 'nom prenom raisonSociale');
    if (project.devisId) {
      await project.populate('devisId', 'numero totalTTC');
    }
    if (project.blId) {
      await project.populate('blId', 'numero totalTTC');
    }

    // ------------------------------------------------------------------
    // Notification: projet جديد مبدئي (مازال ما خرجتش فاتورتو)
    // ------------------------------------------------------------------
    try {
      if (currentUserEmail) {
        const { default: User } = await import('@/lib/models/User');
        const currentUser = await (User as any).findOne({
          email: currentUserEmail,
          companyId: new mongoose.Types.ObjectId(tenantId),
          isActive: true,
        }).lean();

        if (currentUser) {
          const userId = currentUser._id.toString();

          // اسم العميل
          let customerName = '';
          if (project.customerId && typeof project.customerId === 'object') {
            const c: any = project.customerId;
            customerName =
              c.raisonSociale || `${c.nom || ''} ${c.prenom || ''}`.trim();
          }

          const title = `Nouveau projet ${project.projectNumber}`;
          const message = customerName
            ? `Projet “${project.name}” créé pour client ${customerName}. Aucune facture émise pour le moment.`
            : `Projet “${project.name}” créé. Aucune facture émise pour le moment.`;

          await NotificationService.notifyUser({
            tenantId,
            userId,
            userEmail: currentUserEmail,
            type: 'project_created',
            title,
            message,
            link: `/projects/${project._id.toString()}`,
            channel: 'in_app',
            createdBy: currentUserEmail,
            dedupeKey: `project_created_${project._id.toString()}`,
          });
        }
      }
    } catch (notifError) {
      console.error('Erreur lors de la création de la notification projet:', notifError);
      // ما نوقّفوش إنشاء المشروع لو التنبيه فشل
    }

    return NextResponse.json(project.toObject(), { status: 201 });
  } catch (error: any) {
    console.error('Error creating project:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      errors: error.errors,
    });

    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Un projet avec ce numéro existe déjà' },
        { status: 400 }
      );
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors: any = {};
      if (error.errors) {
        Object.keys(error.errors).forEach((key) => {
          validationErrors[key] = error.errors[key].message;
        });
      }
      return NextResponse.json(
        { error: 'Erreur de validation', details: validationErrors, message: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message, stack: process.env.NODE_ENV === 'development' ? error.stack : undefined },
      { status: 500 }
    );
  }
}
