import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Attendance from '@/lib/models/Attendance';

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

    // Find attendance record
    const attendance = await (Attendance as any).findOne({
      _id: id,
      tenantId,
    });

    if (!attendance) {
      return NextResponse.json(
        { error: 'Enregistrement de présence non trouvé' },
        { status: 404 }
      );
    }

    // Check if already checked out
    if (attendance.checkOut) {
      return NextResponse.json(
        { error: 'Pointage de sortie déjà enregistré' },
        { status: 400 }
      );
    }

    // Check if checked in
    if (!attendance.checkIn) {
      return NextResponse.json(
        { error: 'Pointage d\'entrée non enregistré' },
        { status: 400 }
      );
    }

    // Set check-out time
    const checkOutTime = body.checkOut ? new Date(body.checkOut) : new Date();
    attendance.checkOut = checkOutTime;

    // Calculate total hours
    if (attendance.checkIn) {
      const diff = (checkOutTime.getTime() - attendance.checkIn.getTime()) / (1000 * 60 * 60);
      attendance.totalHours = Math.round(diff * 100) / 100;
    }

    // Update status
    if (attendance.status === 'absent') {
      attendance.status = 'present';
    }

    await attendance.save();

    // Populate employee data
    await attendance.populate('employeeId', 'firstName lastName position department');

    return NextResponse.json(attendance.toObject(), { status: 200 });
  } catch (error: any) {
    console.error('Error checking out:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}








