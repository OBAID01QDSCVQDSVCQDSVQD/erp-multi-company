import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Attendance from '@/lib/models/Attendance';
import Employee from '@/lib/models/Employee';

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
    const date = searchParams.get('date');
    const month = searchParams.get('month');
    const employeeId = searchParams.get('employeeId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const query: any = { tenantId };

    // Filter by date
    if (date) {
      // Parse date string and create date range at UTC midnight
      const dateStr = date.split('T')[0]; // Get YYYY-MM-DD part only
      const [year, month, day] = dateStr.split('-').map(Number);
      const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
      query.date = { $gte: startOfDay, $lte: endOfDay };
      
      console.log('Date filter - Input:', date);
      console.log('Date filter - Date string:', dateStr);
      console.log('Date filter - Start of day:', startOfDay.toISOString());
      console.log('Date filter - End of day:', endOfDay.toISOString());
    }

    // Filter by month
    if (month) {
      const [year, monthNum] = month.split('-').map(Number);
      const startOfMonth = new Date(year, monthNum - 1, 1);
      const endOfMonth = new Date(year, monthNum, 0, 23, 59, 59, 999);
      query.date = { $gte: startOfMonth, $lte: endOfMonth };
    }

    // Filter by employee
    if (employeeId) {
      query.employeeId = employeeId;
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      (Attendance as any)
        .find(query)
        .populate('employeeId', 'firstName lastName position department employeeNumber')
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      (Attendance as any).countDocuments(query),
    ]);

    console.log('=== Attendance GET ===');
    console.log('Query:', JSON.stringify(query, null, 2));
    console.log('Total records found:', total);
    console.log('Items returned:', items.length);
    if (items.length > 0) {
      items.forEach((item: any, index: number) => {
        console.log(`Item ${index + 1}:`, {
          _id: item._id,
          employeeId: item.employeeId,
          employeeIdType: typeof item.employeeId,
          employeeIdIsObject: typeof item.employeeId === 'object',
          employeeId_id: item.employeeId?._id,
          date: item.date,
          checkIn: item.checkIn,
          checkOut: item.checkOut
        });
      });
    }

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
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

    // Validation
    if (!body.employeeId || !body.date) {
      return NextResponse.json(
        { error: 'Employee ID et date sont obligatoires' },
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

    // Check if attendance record already exists for this date
    const date = new Date(body.date);
    date.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const existingRecord = await (Attendance as any).findOne({
      tenantId,
      employeeId: body.employeeId,
      date: { $gte: date, $lte: endOfDay },
    });

    if (existingRecord) {
      return NextResponse.json(
        { error: 'Un enregistrement de présence existe déjà pour cette date' },
        { status: 400 }
      );
    }

    // Create attendance record
    const attendanceData: any = {
      tenantId,
      employeeId: body.employeeId,
      date: date,
      checkIn: body.checkIn ? new Date(body.checkIn) : undefined,
      checkOut: body.checkOut ? new Date(body.checkOut) : undefined,
      status: body.status || 'present',
      notes: body.notes || undefined,
      location: body.location || undefined,
      createdBy: session.user.email,
    };

    // Calculate late minutes if check-in time is provided
    if (attendanceData.checkIn) {
      // Assuming work starts at 8:00 AM (can be configured)
      const workStartTime = new Date(date);
      workStartTime.setHours(8, 0, 0, 0);
      
      if (attendanceData.checkIn > workStartTime) {
        const lateMs = attendanceData.checkIn.getTime() - workStartTime.getTime();
        attendanceData.lateMinutes = Math.floor(lateMs / (1000 * 60));
        if (attendanceData.lateMinutes > 0) {
          attendanceData.status = 'late';
        }
      }
    }

    const attendance = new (Attendance as any)(attendanceData);
    await attendance.save();

    // Populate employee data
    await attendance.populate('employeeId', 'firstName lastName position department');

    return NextResponse.json(attendance.toObject(), { status: 201 });
  } catch (error: any) {
    console.error('Error creating attendance:', error);
    
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

