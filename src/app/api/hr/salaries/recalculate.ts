import connectDB from '@/lib/mongodb';
import Salary from '@/lib/models/Salary';
import Attendance from '@/lib/models/Attendance';
import Employee from '@/lib/models/Employee';

/**
 * Recalculate salary for an employee in a specific period
 */
export async function recalculateSalary(
  tenantId: string,
  employeeId: string,
  month: number,
  year: number
) {
  try {
    await connectDB();

    // Get employee
    const employee = await (Employee as any).findOne({
      _id: employeeId,
      tenantId,
    });

    if (!employee) {
      console.log('Employee not found for salary recalculation');
      return null;
    }

    // Calculate period dates
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

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

    // Find existing salary
    const existingSalary = await (Salary as any).findOne({
      tenantId,
      employeeId,
      'period.month': month,
      'period.year': year,
    });

    if (!existingSalary) {
      console.log('No salary found to recalculate');
      return null;
    }

    // Get base salary from existing salary or employee
    const baseSalary = existingSalary.baseSalary || employee.baseSalary || 0;
    
    // Use employee's daily rate if available, otherwise calculate from base salary
    const dailyRate = existingSalary.dailyRate || employee.dailyRate || (baseSalary / daysInMonth);

    // Calculate earnings based on worked days using daily rate
    const baseSalaryEarning = dailyRate * calculatedWorkedDays;
    const overtimePay = existingSalary.earnings?.overtimePay || 0;
    const bonuses = existingSalary.earnings?.bonuses || 0;
    const allowances = existingSalary.earnings?.allowances || 0;
    const otherEarnings = existingSalary.earnings?.otherEarnings || 0;
    const totalEarnings = baseSalaryEarning + overtimePay + bonuses + allowances + otherEarnings;

    // Calculate deductions (keep existing deductions or recalculate)
    const taxes = existingSalary.deductions?.taxes || (totalEarnings * 0.1);
    const socialSecurity = existingSalary.deductions?.socialSecurity || (totalEarnings * 0.09);
    const insurance = existingSalary.deductions?.insurance || 0;
    const advances = existingSalary.deductions?.advances || 0;
    const otherDeductions = existingSalary.deductions?.otherDeductions || 0;
    const totalDeductions = taxes + socialSecurity + insurance + advances + otherDeductions;

    // Calculate net salary
    const netSalary = totalEarnings - totalDeductions;

    // Update salary
    existingSalary.totalDays = daysInMonth;
    existingSalary.workedDays = calculatedWorkedDays;
    existingSalary.absentDays = calculatedAbsentDays;
    existingSalary.leaveDays = calculatedLeaveDays;
    existingSalary.dailyRate = dailyRate; // Use the calculated daily rate (from employee or calculated)
    existingSalary.earnings.baseSalary = baseSalaryEarning;
    existingSalary.earnings.totalEarnings = totalEarnings;
    existingSalary.deductions.totalDeductions = totalDeductions;
    existingSalary.netSalary = netSalary;

    await existingSalary.save();
    await existingSalary.populate('employeeId', 'firstName lastName employeeNumber position department');

    console.log('Salary recalculated successfully:', {
      employeeId,
      month,
      year,
      workedDays: calculatedWorkedDays,
      absentDays: calculatedAbsentDays,
      leaveDays: calculatedLeaveDays,
      netSalary,
    });

    return existingSalary.toObject();
  } catch (error: any) {
    console.error('Error recalculating salary:', error);
    return null;
  }
}

