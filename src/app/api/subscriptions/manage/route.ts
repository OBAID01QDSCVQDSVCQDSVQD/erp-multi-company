import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Subscription from '@/lib/models/Subscription';
import Company from '@/lib/models/Company';

// GET - Get all subscriptions (admin only)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Accès refusé. Admin uniquement.' }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const plan = searchParams.get('plan');
    const search = searchParams.get('search');

    // Build query
    const query: any = {};
    if (status) query.status = status;
    if (plan) query.plan = plan;

    // Fetch subscriptions with company details
    let subscriptions = await (Subscription as any).find(query)
      .populate('companyId', 'name code contact.email')
      .sort({ createdAt: -1 })
      .lean();

    // Filter to show pending plan changes first
    subscriptions.sort((a: any, b: any) => {
      if (a.pendingPlanChange && !b.pendingPlanChange) return -1;
      if (!a.pendingPlanChange && b.pendingPlanChange) return 1;
      return 0;
    });

    // Filter by search term (company name or email)
    if (search) {
      const searchLower = search.toLowerCase();
      subscriptions = subscriptions.filter((sub: any) => {
        const company = sub.companyId;
        if (typeof company === 'object' && company) {
          return (
            company.name?.toLowerCase().includes(searchLower) ||
            company.code?.toLowerCase().includes(searchLower) ||
            company.contact?.email?.toLowerCase().includes(searchLower)
          );
        }
        return false;
      });
    }

    // Get statistics
    const stats = {
      total: await (Subscription as any).countDocuments(),
      active: await (Subscription as any).countDocuments({ status: 'active' }),
      inactive: await (Subscription as any).countDocuments({ status: 'inactive' }),
      cancelled: await (Subscription as any).countDocuments({ status: 'cancelled' }),
      free: await (Subscription as any).countDocuments({ plan: 'free' }),
      starter: await (Subscription as any).countDocuments({ plan: 'starter' }),
      premium: await (Subscription as any).countDocuments({ plan: 'premium' }),
      pendingRequests: await (Subscription as any).countDocuments({ pendingPlanChange: { $exists: true, $ne: null } }),
    };

    return NextResponse.json({
      subscriptions,
      stats,
    });
  } catch (error: any) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des abonnements' },
      { status: 500 }
    );
  }
}

// PATCH - Update subscription status (admin only)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Accès refusé. Admin uniquement.' }, { status: 403 });
    }

    await connectDB();

    const data = await req.json();
    const { subscriptionId, ...updateData } = data;

    if (!subscriptionId) {
      return NextResponse.json({ error: 'ID d\'abonnement requis' }, { status: 400 });
    }

    // If cancelling, set cancelledAt
    if (updateData.status === 'cancelled' && !updateData.cancelledAt) {
      updateData.cancelledAt = new Date();
    }

    // If activating, clear cancelledAt
    if (updateData.status === 'active' && updateData.cancelledAt) {
      updateData.cancelledAt = undefined;
    }

    const subscription = await (Subscription as any).findByIdAndUpdate(
      subscriptionId,
      updateData,
      { new: true }
    ).populate('companyId', 'name code contact.email');

    if (!subscription) {
      return NextResponse.json({ error: 'Abonnement non trouvé' }, { status: 404 });
    }

    return NextResponse.json({ subscription });
  } catch (error: any) {
    console.error('Error updating subscription:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de l\'abonnement' },
      { status: 500 }
    );
  }
}

