import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Subscription from '@/lib/models/Subscription';
import Company from '@/lib/models/Company';
import mongoose from 'mongoose';

// GET - Get subscription for current company
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    // Convert companyId to ObjectId to ensure proper matching
    const companyId = new mongoose.Types.ObjectId(session.user.companyId);
    
    // Find subscription for this company only (strict filter by companyId)
    let subscription = await (Subscription as any).findOne({ 
      companyId: companyId 
    }).lean();
    
    if (!subscription) {
      // Create free plan subscription by default for this company
      const company = await (Company as any).findById(companyId);
      if (!company) {
        return NextResponse.json({ error: 'Entreprise non trouvée' }, { status: 404 });
      }

      subscription = await (Subscription as any).create({
        companyId: companyId,
        plan: 'free',
        status: 'active',
        startDate: new Date(),
        documentsUsed: 0,
        documentsLimit: 100,
        price: 0,
        currency: 'TND',
        autoRenew: true,
      });
      
      // Convert to plain object
      subscription = subscription.toObject ? subscription.toObject() : subscription;
    }

    // Ensure we only return the subscription for this company
    // Double-check that companyId matches
    if (subscription.companyId && subscription.companyId.toString() !== companyId.toString()) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    return NextResponse.json({ subscription });
  } catch (error: any) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de l\'abonnement' },
      { status: 500 }
    );
  }
}

// POST - Create or update subscription
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    // Convert companyId to ObjectId to ensure proper matching
    const companyId = new mongoose.Types.ObjectId(session.user.companyId);
    const data = await req.json();

    // Plan limits
    const planLimits: { [key: string]: number } = {
      free: 100,
      starter: 1000,
      premium: -1, // unlimited
    };

    const planPrices: { [key: string]: number } = {
      free: 0,
      starter: 20,
      premium: 40,
    };

    const documentsLimit = data.documentsLimit ?? planLimits[data.plan] ?? 100;
    const price = data.price ?? planPrices[data.plan] ?? 0;

    // Calculate renewal date (1 year from now for paid plans, or end of year for free)
    let renewalDate = new Date();
    if (data.plan === 'free') {
      renewalDate = new Date(renewalDate.getFullYear() + 1, 0, 1);
    } else {
      renewalDate.setFullYear(renewalDate.getFullYear() + 1);
    }

    // Update or create subscription
    const subscription = await (Subscription as any).findOneAndUpdate(
      { companyId },
      {
        ...data,
        companyId,
        documentsLimit,
        price,
        renewalDate,
        status: data.status || 'active',
      },
      { new: true, upsert: true }
    );

    return NextResponse.json({ subscription });
  } catch (error: any) {
    console.error('Error updating subscription:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de l\'abonnement' },
      { status: 500 }
    );
  }
}

