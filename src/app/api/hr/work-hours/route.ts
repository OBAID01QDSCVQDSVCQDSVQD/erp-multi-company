import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Attendance from '@/lib/models/Attendance';
import Employee from '@/lib/models/Employee';

export const dynamic = 'force-dynamic';

// Standard work hours per day (can be configured per employee)
const STANDARD_HOURS_PER_DAY = 8;

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();
    const tenantId = session.user.companyId?.toString() || '';

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'week';
    const employeeId = searchParams.get('employeeId');

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now);

    switch (period) {
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
    }

    endDate.setHours(23, 59, 59, 999);

    // Build query
    const query: any = {
      tenantId,
      date: { $gte: startDate, $lte: endDate },
      checkIn: { $exists: true, $ne: null },
      checkOut: { $exists: true, $ne: null },
    };

    if (employeeId) {
      query.employeeId = employeeId;
    }

    // Fetch attendance records
    const attendanceRecords = await (Attendance as any)
      .find(query)
      .populate('employeeId', 'firstName lastName position department')
      .sort({ date: -1 })
      .lean();

    // Group by employee and calculate totals
    const employeeMap = new Map<string, WorkHoursData>();

    for (const record of attendanceRecords) {
      if (!record.employeeId || !record.totalHours) continue;

      const empId = record.employeeId._id?.toString() || record.employeeId.toString();
      const empName = record.employeeId.firstName && record.employeeId.lastName
        ? `${record.employeeId.firstName} ${record.employeeId.lastName}`
        : 'N/A';
      const empPosition = record.employeeId.position || 'N/A';
      const empDepartment = record.employeeId.department || 'N/A';

      if (!employeeMap.has(empId)) {
        employeeMap.set(empId, {
          employeeId: empId,
          employeeName: empName,
          employeePosition: empPosition,
          employeeDepartment: empDepartment,
          totalHours: 0,
          daysWorked: 0,
          averageHoursPerDay: 0, // Will be recalculated later
          overtimeHours: 0,
          regularHours: 0,
          details: [],
        });
      }

      const empData = employeeMap.get(empId)!;
      empData.totalHours += record.totalHours || 0;
      empData.daysWorked += 1;
      
      // Calculate regular vs overtime hours
      const regularHours = Math.min(record.totalHours || 0, STANDARD_HOURS_PER_DAY);
      const overtime = Math.max(0, (record.totalHours || 0) - STANDARD_HOURS_PER_DAY);
      
      empData.regularHours += regularHours;
      empData.overtimeHours += overtime;

      // Add detail
      empData.details.push({
        date: record.date,
        hours: record.totalHours || 0,
        checkIn: record.checkIn,
        checkOut: record.checkOut,
      });
    }

    // Calculate averages and convert to array
    const workHoursData: WorkHoursData[] = Array.from(employeeMap.values()).map(emp => {
      // Calculate average first
      const avgHours = emp.daysWorked > 0 ? emp.totalHours / emp.daysWorked : 0;
      
      return {
        ...emp,
        // Round values
        totalHours: Math.round(emp.totalHours * 100) / 100,
        regularHours: Math.round(emp.regularHours * 100) / 100,
        overtimeHours: Math.round(emp.overtimeHours * 100) / 100,
        averageHoursPerDay: Math.round(avgHours * 100) / 100,
      };
    });

    // Sort by total hours descending
    workHoursData.sort((a, b) => b.totalHours - a.totalHours);

    return NextResponse.json({
      items: workHoursData,
      total: workHoursData.length,
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching work hours:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

interface WorkHoursData {
  employeeId: string;
  employeeName: string;
  employeePosition: string;
  employeeDepartment: string;
  totalHours: number;
  daysWorked: number;
  averageHoursPerDay: number;
  overtimeHours: number;
  regularHours: number;
  details: {
    date: string;
    hours: number;
    checkIn: string;
    checkOut: string;
  }[];
}

