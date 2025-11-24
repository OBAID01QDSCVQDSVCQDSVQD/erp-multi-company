import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Project from '@/lib/models/Project';
import Expense from '@/lib/models/Expense';
import MouvementStock from '@/lib/models/MouvementStock';
import Attendance from '@/lib/models/Attendance';
import Employee from '@/lib/models/Employee';

export const dynamic = 'force-dynamic';

export async function POST(
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

    // Calculate expenses cost
    const expenses = await (Expense as any).find({
      tenantId,
      projetId: params.id,
      statut: { $in: ['valide', 'paye'] },
    });

    const totalExpensesCost = expenses.reduce((sum: number, exp: any) => {
      return sum + (exp.totalHT || 0);
    }, 0);

    // Calculate products cost (from stock movements)
    const stockMovements = await (MouvementStock as any).find({
      societeId: tenantId,
      projectId: params.id,
      type: 'SORTIE', // Only outgoing movements (consumption)
    });

    // Get product prices
    const Product = (await import('@/lib/models/Product')).default;
    let totalProductsCost = 0;
    
    for (const movement of stockMovements) {
      const product = await (Product as any).findOne({
        _id: movement.productId,
        tenantId,
      }).lean();
      
      if (product) {
        const cost = product.prixAchatRef || product.prixVenteHT || 0;
        totalProductsCost += cost * (movement.qte || 0);
      }
    }

    // Calculate labor cost (from attendance and employee rates)
    const assignedEmployees = project.assignedEmployees || [];
    let totalLaborCost = 0;

    for (const assignment of assignedEmployees) {
      const employeeId = assignment.employeeId;
      const startDate = new Date(assignment.startDate);
      const endDate = assignment.endDate ? new Date(assignment.endDate) : new Date();
      const endDateForQuery = endDate > new Date() ? new Date() : endDate;

      // Get attendance records for this employee in the project period
      // First try to get records with projectId, then fallback to employeeId only
      const attendanceRecords = await (Attendance as any).find({
        tenantId,
        employeeId,
        $or: [
          { projectId: params.id },
          { projectId: { $exists: false } }, // Include records without projectId if employee is assigned
        ],
        date: {
          $gte: startDate,
          $lte: endDateForQuery,
        },
      });

      // Calculate days worked
      const daysWorked = attendanceRecords.filter((a: any) => 
        a.checkIn && a.checkOut
      ).length;

      // Use dailyRate from assignment or from employee
      const dailyRate = assignment.dailyRate || 0;
      if (!dailyRate) {
        const employee = await (Employee as any).findById(employeeId);
        if (employee && employee.dailyRate) {
          totalLaborCost += employee.dailyRate * daysWorked;
        }
      } else {
        totalLaborCost += dailyRate * daysWorked;
      }
    }

    // Get document total if exists (from devis or BL)
    let documentTotal = 0;
    const Document = (await import('@/lib/models/Document')).default;
    
    // Sum all devis totals
    if (project.devisIds && project.devisIds.length > 0) {
      for (const devisId of project.devisIds) {
        const devis = await (Document as any).findById(devisId);
        if (devis) {
          documentTotal += devis.totalTTC || devis.totalBaseHT || 0;
        }
      }
    }
    
    // Sum all BL totals
    if (project.blIds && project.blIds.length > 0) {
      for (const blId of project.blIds) {
        const bl = await (Document as any).findById(blId);
        if (bl) {
          documentTotal += bl.totalTTC || bl.totalBaseHT || 0;
        }
      }
    }

    // Calculate profit
    const totalCost = totalProductsCost + totalExpensesCost + totalLaborCost;
    const profit = documentTotal - totalCost;
    const profitMargin = totalCost > 0 ? (profit / totalCost) * 100 : 0;

    // Update project
    project.totalProductsCost = totalProductsCost;
    project.totalExpensesCost = totalExpensesCost;
    project.totalLaborCost = totalLaborCost;
    project.totalCost = totalCost;
    project.profit = profit;
    project.profitMargin = profitMargin;

    await project.save();

    return NextResponse.json({
      totalProductsCost,
      totalExpensesCost,
      totalLaborCost,
      totalCost,
      profit,
      profitMargin,
      documentTotal,
    });
  } catch (error: any) {
    console.error('Error calculating project costs:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}

