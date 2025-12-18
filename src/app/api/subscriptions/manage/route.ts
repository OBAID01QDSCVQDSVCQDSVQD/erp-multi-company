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

    // Ensure all companies have a subscription
    const companies = await (Company as any).find({}).select('_id');
    const existingSubs = await (Subscription as any).find({}).select('companyId');
    const companiesWithSubs = new Set(existingSubs.map((s: any) => s.companyId?.toString()));

    const missingSubs = companies.filter((c: any) => !companiesWithSubs.has(c._id.toString()));

    if (missingSubs.length > 0) {
      // Create default free subscriptions
      const newSubs = missingSubs.map((c: any) => ({
        companyId: c._id,
        plan: 'free',
        status: 'active',
        startDate: new Date(),
        documentsLimit: 100, // Default limit for free
        documentsUsed: 0,
        price: 0,
        currency: 'TND',
        autoRenew: true
      }));

      await (Subscription as any).insertMany(newSubs);
    }

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

    // Recalculate usage (Total Lifetime)
    const DocumentModel = (await import('@/lib/models/Document')).default; // Lazy load to avoid circular dep issues if any

    // Aggregate counts for all fetched subscriptions
    const companyIds = subscriptions.map((s: any) => s.companyId?._id || s.companyId);

    // Count ALL documents for these tenants (no date filter)
    const usageStats = await (DocumentModel as any).aggregate([
      {
        $match: {
          tenantId: { $in: companyIds.map((id: any) => id ? id.toString() : '') }
        }
      },
      {
        $group: {
          _id: '$tenantId',
          count: { $sum: 1 }
        }
      }
    ]);

    const usageMap = new Map(usageStats.map((s: any) => [s._id.toString(), s.count]));

    // Update subscriptions with real usage
    subscriptions = subscriptions.map((sub: any) => {
      const companyId = sub.companyId?._id?.toString() || sub.companyId?.toString();
      const realUsage = usageMap.get(companyId) || 0;
      // Update in memory for response
      sub.documentsUsed = realUsage;
      return sub;
    });

    // Fire and forget: Update DB in background to keep it synced
    Promise.all(subscriptions.map((sub: any) =>
      (Subscription as any).findByIdAndUpdate(sub._id, { documentsUsed: sub.documentsUsed })
    )).catch(err => console.error('Background usage sync error', err));

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
