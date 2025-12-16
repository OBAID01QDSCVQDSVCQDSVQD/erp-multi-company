import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Attendance from '@/lib/models/Attendance';
import Employee from '@/lib/models/Employee';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    await connectDB();
    const tenantId = session.user.companyId?.toString() || '';

    // Validation
    if (!body.employeeId) {
      return NextResponse.json(
        { error: 'Employee ID est obligatoire' },
        { status: 400 }
      );
    }

    // Check if employee exists
    const employee = await (Employee as any).findOne({
      _id: body.employeeId,
      tenantId,
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employé non trouvé' },
        { status: 404 }
      );
    }

    // Get target date from body or use today's date at UTC midnight
    let targetDate: Date;
    if (body.date) {
      // Parse the date string (YYYY-MM-DD) to UTC midnight
      const dateParts = body.date.split('-');
      targetDate = new Date(Date.UTC(
        parseInt(dateParts[0], 10),
        parseInt(dateParts[1], 10) - 1, // Month is 0-indexed
        parseInt(dateParts[2], 10),
        0, 0, 0, 0
      ));
    } else {
      // Use today if no date specified
      const now = new Date();
      targetDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    }
    
    const endOfDay = new Date(Date.UTC(
      targetDate.getUTCFullYear(),
      targetDate.getUTCMonth(),
      targetDate.getUTCDate(),
      23, 59, 59, 999
    ));

    // Check if attendance record already exists for the target date
    let attendance = await (Attendance as any).findOne({
      tenantId,
      employeeId: body.employeeId,
      date: { $gte: targetDate, $lte: endOfDay },
    });


    const checkInTime = body.checkIn ? new Date(body.checkIn) : new Date();

    if (attendance) {
      // Update existing record
      if (attendance.checkIn) {
        return NextResponse.json(
          { error: 'Pointage d\'entrée déjà enregistré pour cette date' },
          { status: 400 }
        );
      }
      
      attendance.checkIn = checkInTime;
      attendance.status = 'present';

      if (body.projectId !== undefined) {
        attendance.projectId = body.projectId
          ? new mongoose.Types.ObjectId(body.projectId)
          : undefined;
      }
      
      // Calculate late minutes
      const workStartTime = new Date(targetDate);
      workStartTime.setUTCHours(8, 0, 0, 0); // Default work start time
      
      if (checkInTime > workStartTime) {
        const lateMs = checkInTime.getTime() - workStartTime.getTime();
        attendance.lateMinutes = Math.floor(lateMs / (1000 * 60));
        if (attendance.lateMinutes > 0) {
          attendance.status = 'late';
        }
      }
      
      await attendance.save();
    } else {
      // Create new record
      attendance = new (Attendance as any)({
        tenantId,
        employeeId: body.employeeId,
        date: targetDate,
        checkIn: checkInTime,
        status: 'present',
        createdBy: session.user.email,
      });

      if (body.projectId) {
        attendance.projectId = new mongoose.Types.ObjectId(body.projectId);
      }

      // Calculate late minutes
      const workStartTime = new Date(targetDate);
      workStartTime.setUTCHours(8, 0, 0, 0);
      
      if (checkInTime > workStartTime) {
        const lateMs = checkInTime.getTime() - workStartTime.getTime();
        attendance.lateMinutes = Math.floor(lateMs / (1000 * 60));
        if (attendance.lateMinutes > 0) {
          attendance.status = 'late';
        }
      }

      await attendance.save();
      console.log('Attendance record saved successfully');
    }

    // Populate employee data
    await attendance.populate([
      { path: 'employeeId', select: 'firstName lastName position department' },
      { path: 'projectId', select: 'name projectNumber' }
    ]);

    return NextResponse.json(attendance.toObject(), { status: 200 });
  } catch (error: any) {
    console.error('Error checking in:', error);
    
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Un enregistrement de présence existe déjà pour cette date' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}

