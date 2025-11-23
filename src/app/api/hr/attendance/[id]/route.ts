import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Attendance from '@/lib/models/Attendance';
import { recalculateSalary } from '../../salaries/recalculate';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    await connectDB();
    const tenantId = session.user.companyId?.toString() || '';

    console.log('=== Attendance Update Request ===');
    console.log('Record ID:', id);
    console.log('Tenant ID:', tenantId);
    console.log('Update data:', body);

    // Find attendance record
    const attendance = await (Attendance as any).findOne({
      _id: id,
      tenantId,
    });

    console.log('Found attendance record:', attendance ? 'YES' : 'NO');
    if (attendance) {
      console.log('Current employee ID:', attendance.employeeId);
      console.log('Current date:', attendance.date);
      console.log('Current checkIn:', attendance.checkIn);
      console.log('Current checkOut:', attendance.checkOut);
    }

    if (!attendance) {
      return NextResponse.json(
        { error: 'Enregistrement de présence non trouvé' },
        { status: 404 }
      );
    }

    // If date is being changed, check for duplicate
    if (body.date) {
      // Parse date string and create date at midnight UTC
      const dateStr = body.date.split('T')[0]; // Get YYYY-MM-DD part only
      const [year, month, day] = dateStr.split('-').map(Number);
      const newDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      
      console.log('Date update - Input:', body.date);
      console.log('Date update - Parsed date string:', dateStr);
      console.log('Date update - New date:', newDate.toISOString());
      
      // Get current date from the record - normalize to UTC midnight
      const currentDateRaw = new Date(attendance.date);
      const currentDate = new Date(Date.UTC(
        currentDateRaw.getUTCFullYear(),
        currentDateRaw.getUTCMonth(),
        currentDateRaw.getUTCDate(),
        0, 0, 0, 0
      ));
      
      console.log('Date update - Raw attendance.date:', attendance.date);
      console.log('Date update - Current date (normalized):', currentDate.toISOString());
      console.log('Date update - New date:', newDate.toISOString());
      console.log('Date update - Dates are equal:', newDate.getTime() === currentDate.getTime());
      
      // Only check for duplicate if the date is actually changing
      if (newDate.getTime() !== currentDate.getTime()) {
        console.log('Date is changing, checking for duplicates...');
        const endOfDay = new Date(newDate);
        endOfDay.setUTCHours(23, 59, 59, 999);

        // Check if there's another record with the same date and employee (excluding current record)
        const existingRecord = await (Attendance as any).findOne({
          tenantId,
          employeeId: attendance.employeeId,
          date: { $gte: newDate, $lte: endOfDay },
          _id: { $ne: id }
        });

        console.log('Duplicate check - Existing record found:', existingRecord ? 'YES' : 'NO');
        
        // If duplicate exists, delete it to allow the date change
        if (existingRecord) {
          console.log('Deleting duplicate record:', existingRecord._id);
          await (Attendance as any).findByIdAndDelete(existingRecord._id);
        }
      } else {
        console.log('Date not changing, skipping duplicate check');
      }

      attendance.date = newDate;
      console.log('Date update - Set attendance.date to:', attendance.date.toISOString());
    }

    // Update fields - only update if provided
    if (body.checkIn !== undefined) {
      console.log('Updating checkIn from', attendance.checkIn, 'to', body.checkIn);
      attendance.checkIn = body.checkIn ? new Date(body.checkIn) : null;
    }

    if (body.checkOut !== undefined) {
      console.log('Updating checkOut from', attendance.checkOut, 'to', body.checkOut);
      attendance.checkOut = body.checkOut ? new Date(body.checkOut) : null;
    }

    // Recalculate total hours if both checkIn and checkOut are present
    if (attendance.checkIn && attendance.checkOut) {
      const diff = (attendance.checkOut.getTime() - attendance.checkIn.getTime()) / (1000 * 60 * 60);
      attendance.totalHours = Math.round(diff * 100) / 100;
      attendance.status = 'present';
    }

    // Recalculate late minutes if checkIn is updated
    if (body.checkIn && attendance.checkIn) {
      const workStartTime = new Date(attendance.date);
      workStartTime.setUTCHours(8, 0, 0, 0); // Default work start time
      
      if (attendance.checkIn > workStartTime) {
        const lateMs = attendance.checkIn.getTime() - workStartTime.getTime();
        attendance.lateMinutes = Math.floor(lateMs / (1000 * 60));
        if (attendance.lateMinutes > 0) {
          attendance.status = 'late';
        }
      } else {
        attendance.lateMinutes = 0;
        if (attendance.status === 'late') {
          attendance.status = 'present';
        }
      }
    }

    console.log('Saving attendance record...');
    console.log('Final employee ID:', attendance.employeeId);
    console.log('Final date:', attendance.date);
    console.log('Final checkIn:', attendance.checkIn);
    console.log('Final checkOut:', attendance.checkOut);
    
    await attendance.save();
    console.log('Attendance saved successfully');

    // Recalculate salary if it exists for this period
    const attendanceDate = new Date(attendance.date);
    const attendanceMonth = attendanceDate.getUTCMonth() + 1; // getUTCMonth() returns 0-11
    const attendanceYear = attendanceDate.getUTCFullYear();
    
    console.log('Recalculating salary for period:', attendanceMonth, attendanceYear);
    await recalculateSalary(
      tenantId,
      attendance.employeeId.toString(),
      attendanceMonth,
      attendanceYear
    );

    // Populate employee data
    await attendance.populate('employeeId', 'firstName lastName position department');

    return NextResponse.json(attendance.toObject(), { status: 200 });
  } catch (error: any) {
    console.error('Error updating attendance:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Un enregistrement de présence existe déjà pour cette date et cet employé' },
        { status: 400 }
      );
    }
    
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

    const { id } = await params;
    await connectDB();
    const tenantId = session.user.companyId?.toString() || '';

    const attendance = await (Attendance as any).findOneAndDelete({
      _id: id,
      tenantId,
    });

    if (!attendance) {
      return NextResponse.json(
        { error: 'Enregistrement de présence non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Enregistrement supprimé' }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting attendance:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}

