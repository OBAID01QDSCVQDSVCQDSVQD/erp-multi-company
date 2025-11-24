import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Project from '@/lib/models/Project';
import Attendance from '@/lib/models/Attendance';
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

    const project = await (Project as any).findOne({
      _id: params.id,
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
      if (!employeeId) continue;

      const employee = assignment.employeeId;
      const startDate = new Date(assignment.startDate);
      const endDate = assignment.endDate ? new Date(assignment.endDate) : new Date();
      const endDateForQuery = endDate > new Date() ? new Date() : endDate;

      // Get attendance records
      const attendanceRecords = await (Attendance as any).find({
        tenantId,
        employeeId,
        $or: [
          { projectId: params.id },
          { projectId: { $exists: false } },
        ],
        date: {
          $gte: startDate,
          $lte: endDateForQuery,
        },
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
      });
    }

    return NextResponse.json({
      labor: laborData,
      total: laborData.reduce((sum, l) => sum + l.laborCost, 0),
    });
  } catch (error: any) {
    console.error('Error fetching project labor:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}

