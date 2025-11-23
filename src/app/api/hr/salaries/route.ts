import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Salary from '@/lib/models/Salary';
import Employee from '@/lib/models/Employee';
import Attendance from '@/lib/models/Attendance';

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
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const employeeId = searchParams.get('employeeId');

    // Build query
    const query: any = { tenantId };
    
    if (month && year) {
      query['period.month'] = parseInt(month, 10);
      query['period.year'] = parseInt(year, 10);
    }
    
    if (employeeId) {
      query.employeeId = employeeId;
    }

    const salaries = await (Salary as any)
      .find(query)
      .populate('employeeId', 'firstName lastName employeeNumber position department baseSalary currency paymentMethod')
      .sort({ 'period.year': -1, 'period.month': -1, createdAt: -1 });

    return NextResponse.json({ items: salaries });
  } catch (error: any) {
    console.error('Error fetching salaries:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
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

    await connectDB();
    const tenantId = session.user.companyId?.toString() || '';

    const body = await request.json();
    const {
      employeeId,
      month,
      year,
      baseSalary,
      workedDays,
      absentDays,
      leaveDays,
      dailyRate,
      earnings,
      deductions,
      paymentMethod,
      notes,
    } = body;

    // Validation
    if (!employeeId || !month || !year) {
      return NextResponse.json(
        { error: 'Employee ID, month, and year are required' },
        { status: 400 }
      );
    }

    // Get employee
    const employee = await (Employee as any).findOne({
      _id: employeeId,
      tenantId,
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employé non trouvé' },
        { status: 404 }
      );
    }

    // Calculate period dates
    const periodMonth = parseInt(month, 10);
    const periodYear = parseInt(year, 10);
    const startDate = new Date(Date.UTC(periodYear, periodMonth - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(periodYear, periodMonth, 0, 23, 59, 59, 999));

    // Get attendance data for the period
    const attendanceRecords = await (Attendance as any).find({
      tenantId,
      employeeId,
      date: { $gte: startDate, $lte: endDate },
    }).lean();

    // Calculate total days in the month
    const daysInMonth = endDate.getUTCDate();
    
    // Calculate worked days, absent days, and leave days from attendance records
    let calculatedWorkedDays = 0;
    let calculatedAbsentDays = 0;
    let calculatedLeaveDays = 0;

    // Count days based on actual attendance records
    attendanceRecords.forEach((record: any) => {
      if (record.status === 'present' || record.status === 'late') {
        calculatedWorkedDays += 1;
      } else if (record.status === 'on_leave') {
        calculatedLeaveDays += 1;
      } else if (record.status === 'absent') {
        calculatedAbsentDays += 1;
      }
    });

    // Total days with records (worked + absent + leave)
    const daysWithRecords = calculatedWorkedDays + calculatedAbsentDays + calculatedLeaveDays;
    
    // Days without any records are considered absent
    const daysWithoutRecords = daysInMonth - daysWithRecords;
    calculatedAbsentDays += daysWithoutRecords;

    console.log('=== Salary Calculation ===');
    console.log('Employee ID:', employeeId);
    console.log('Period:', `${periodMonth}/${periodYear}`);
    console.log('Days in month:', daysInMonth);
    console.log('Attendance records found:', attendanceRecords.length);
    console.log('Worked days:', calculatedWorkedDays);
    console.log('Absent days:', calculatedAbsentDays);
    console.log('Leave days:', calculatedLeaveDays);
    console.log('Days with records:', daysWithRecords);
    console.log('Days without records:', daysWithoutRecords);

    // Use provided days or calculated days
    const finalWorkedDays = workedDays ?? calculatedWorkedDays;
    const finalAbsentDays = absentDays ?? calculatedAbsentDays;
    const finalLeaveDays = leaveDays ?? calculatedLeaveDays;
    const finalTotalDays = daysInMonth;

    // Use employee's base salary or provided base salary
    const finalBaseSalary = baseSalary ?? employee.baseSalary ?? 0;
    
    // Use employee's daily rate if available, otherwise calculate from base salary
    const finalDailyRate = dailyRate ?? employee.dailyRate ?? (finalBaseSalary / daysInMonth);

    // Calculate earnings based on worked days using daily rate
    const baseSalaryEarning = finalDailyRate * finalWorkedDays;
    const overtimePay = 0; // No overtime when calculating by days
    const bonuses = earnings?.bonuses || 0;
    const allowances = earnings?.allowances || 0;
    const otherEarnings = earnings?.otherEarnings || 0;
    const totalEarnings = baseSalaryEarning + overtimePay + bonuses + allowances + otherEarnings;

    // Calculate deductions (simplified - should be configurable)
    const taxes = deductions?.taxes || (totalEarnings * 0.1); // 10% tax (example)
    const socialSecurity = deductions?.socialSecurity || (totalEarnings * 0.09); // 9% social security (example)
    const insurance = deductions?.insurance || 0;
    
    // Calculate advances from advancesList if provided, otherwise use direct advances value
    let advances = 0;
    let advancesList: Array<{ amount: number; date: Date; notes?: string }> = [];
    
    if (deductions?.advancesList && Array.isArray(deductions.advancesList)) {
      advancesList = deductions.advancesList;
      advances = advancesList.reduce((sum, advance) => sum + advance.amount, 0);
    } else if (deductions?.advances) {
      advances = deductions.advances;
    }
    
    const otherDeductions = deductions?.otherDeductions || 0;
    const totalDeductions = taxes + socialSecurity + insurance + advances + otherDeductions;

    // Calculate net salary
    const netSalary = totalEarnings - totalDeductions;

    // Check if salary already exists for this period
    const existingSalary = await (Salary as any).findOne({
      tenantId,
      employeeId,
      'period.month': periodMonth,
      'period.year': periodYear,
    });

    if (existingSalary) {
      // Update existing salary
      existingSalary.baseSalary = finalBaseSalary;
      existingSalary.totalDays = finalTotalDays;
      existingSalary.workedDays = finalWorkedDays;
      existingSalary.absentDays = finalAbsentDays;
      existingSalary.leaveDays = finalLeaveDays;
      existingSalary.dailyRate = finalDailyRate;
      existingSalary.earnings = {
        baseSalary: baseSalaryEarning,
        overtimePay,
        bonuses,
        allowances,
        otherEarnings,
        totalEarnings,
      };
      existingSalary.deductions = {
        taxes,
        socialSecurity,
        insurance,
        advances,
        otherDeductions,
        totalDeductions,
      };
      existingSalary.netSalary = netSalary;
      existingSalary.paymentMethod = paymentMethod || employee.paymentMethod || 'bank_transfer';
      existingSalary.notes = notes;

      await existingSalary.save();
      await existingSalary.populate('employeeId', 'firstName lastName employeeNumber position department');

      return NextResponse.json(existingSalary.toObject(), { status: 200 });
    }

    // Create new salary
    const salary = new (Salary as any)({
      tenantId,
      employeeId,
      period: {
        month: periodMonth,
        year: periodYear,
        startDate,
        endDate,
      },
      baseSalary: finalBaseSalary,
      currency: employee.currency || 'TND',
      totalDays: finalTotalDays,
      workedDays: finalWorkedDays,
      absentDays: finalAbsentDays,
      leaveDays: finalLeaveDays,
      dailyRate: finalDailyRate,
      earnings: {
        baseSalary: baseSalaryEarning,
        overtimePay,
        bonuses,
        allowances,
        otherEarnings,
        totalEarnings,
      },
      deductions: {
        taxes,
        socialSecurity,
        insurance,
        advances,
        advancesList: advancesList.length > 0 ? advancesList : undefined,
        otherDeductions,
        totalDeductions,
      },
      netSalary,
      paymentMethod: paymentMethod || employee.paymentMethod || 'bank_transfer',
      paymentStatus: 'pending',
      notes,
      createdBy: session.user.email,
    });

    await salary.save();
    await salary.populate('employeeId', 'firstName lastName employeeNumber position department');

    return NextResponse.json(salary.toObject(), { status: 201 });
  } catch (error: any) {
    console.error('Error creating salary:', error);
    
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Un salaire existe déjà pour cette période' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}

