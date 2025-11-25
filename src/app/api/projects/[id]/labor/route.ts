import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import Project from '@/lib/models/Project';
import Attendance from '@/lib/models/Attendance';
import Employee from '@/lib/models/Employee';
import Salary from '@/lib/models/Salary';

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

    const tenantIdFromHeader = request.headers.get('X-Tenant-Id');
    const tenantId = tenantIdFromHeader || session.user.companyId?.toString() || '';

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID manquant' },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json(
        { error: 'Identifiant projet invalide' },
        { status: 400 }
      );
    }

    const projectObjectId = new mongoose.Types.ObjectId(params.id);

    const project = await (Project as any).findOne({
      _id: projectObjectId,
      tenantId,
    }).populate('assignedEmployees.employeeId', 'firstName lastName position department dailyRate');

    if (!project) {
      return NextResponse.json(
        { error: 'Projet non trouvé' },
        { status: 404 }
      );
    }

    const assignedEmployees = project.assignedEmployees || [];
    const laborData = [];

    for (const assignment of assignedEmployees) {
      const employeeId = assignment.employeeId?._id || assignment.employeeId;
      if (!employeeId) {
        console.warn('Skipping assignment without employeeId', assignment);
        continue;
      }

      if (!mongoose.Types.ObjectId.isValid(employeeId)) {
        console.warn('Skipping assignment with invalid employeeId', employeeId);
        continue;
      }

      const employeeObjectId = new mongoose.Types.ObjectId(employeeId);
      const employee = typeof assignment.employeeId === 'object' ? assignment.employeeId : undefined;
      const startDate = new Date(assignment.startDate);
      const endDate = assignment.endDate ? new Date(assignment.endDate) : new Date();
      const endDateForQuery = endDate > new Date() ? new Date() : endDate;

      // Get attendance records - show all records linked to this project, regardless of assignment dates
      const attendanceRecords = await (Attendance as any).find({
        tenantId,
        employeeId: employeeObjectId,
        $or: [
          { projectId: projectObjectId },
          { projectAssignments: projectObjectId },
        ],
        // Removed date filter to show all historical attendance records linked to the project
      });

      const daysWorked = attendanceRecords.filter((a: any) => 
        a.checkIn && a.checkOut
      ).length;

      const totalHours = attendanceRecords.reduce((sum: number, a: any) => 
        sum + (a.totalHours || 0), 0
      );

      // Get daily rate from assignment or employee
      const dailyRate = assignment.dailyRate || employee?.dailyRate || 0;
      const hourlyRate = assignment.hourlyRate || (dailyRate / 8); // Assume 8 hours per day
      const laborCost = dailyRate > 0 ? (dailyRate * daysWorked) : (hourlyRate * totalHours);

      // Calculate advances from salary records overlapping with the assignment period
      const salaries = await (Salary as any).find({
        tenantId,
        employeeId: employeeObjectId,
        'period.startDate': { $lte: endDateForQuery },
        'period.endDate': { $gte: startDate },
      }).select('deductions.advances period');

      const advanceAmount = salaries.reduce(
        (sum: number, salary: any) => sum + (salary.deductions?.advances || 0),
        0
      );

      const advanceDays = dailyRate > 0 ? advanceAmount / dailyRate : 0;

      laborData.push({
        employee: {
          _id: employeeId,
          firstName: employee?.firstName || '',
          lastName: employee?.lastName || '',
          position: employee?.position || '',
          department: employee?.department || '',
        },
        role: assignment.role || '',
        startDate: assignment.startDate,
        endDate: assignment.endDate,
        dailyRate: dailyRate,
        hourlyRate: hourlyRate,
        daysWorked: daysWorked,
        totalHours: totalHours,
        laborCost: laborCost,
        attendanceRecords: attendanceRecords.length,
        advanceAmount,
        advanceDays,
      });
    }

    const summary = {
      totalEmployees: laborData.length,
      totalDays: laborData.reduce((sum, l) => sum + (l.daysWorked || 0), 0),
      totalHours: laborData.reduce((sum, l) => sum + (l.totalHours || 0), 0),
      totalCost: laborData.reduce((sum, l) => sum + (l.laborCost || 0), 0),
      totalAdvances: laborData.reduce((sum, l) => sum + (l.advanceAmount || 0), 0),
    };

    return NextResponse.json({
      labor: laborData,
      summary,
    });
  } catch (error: any) {
    console.error('Error fetching project labor:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}

