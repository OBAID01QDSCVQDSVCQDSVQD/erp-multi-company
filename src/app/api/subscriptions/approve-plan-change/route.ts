import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Subscription from '@/lib/models/Subscription';
import mongoose from 'mongoose';

// POST - Approve plan change request (admin only)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Check if user is admin or the specific system admin
    if (session.user.role !== 'admin' && session.user.email !== 'admin@entreprise-demo.com') {
      return NextResponse.json({ error: 'Accès refusé. Admin uniquement.' }, { status: 403 });
    }

    await connectDB();

    const data = await req.json();
    const { subscriptionId, approve, directChange, newPlan } = data;

    if (!subscriptionId) {
      return NextResponse.json({ error: 'ID d\'abonnement requis' }, { status: 400 });
    }

    const subscription = await (Subscription as any).findById(subscriptionId);

    if (!subscription) {
      return NextResponse.json({ error: 'Abonnement non trouvé' }, { status: 404 });
    }

    // If directChange is true, admin is changing plan directly (no pending request needed)
    if (directChange && newPlan) {
      const planLimits: { [key: string]: number } = {
        free: 100,
        starter: 1000,
        premium: -1,
      };

      const planPrices: { [key: string]: number } = {
        free: 0,
        starter: 20,
        premium: 40,
      };

      const targetPlan = newPlan;
      const documentsLimit = planLimits[targetPlan] ?? 100;
      const price = planPrices[targetPlan] ?? 0;

      // Calculate renewal date
      let renewalDate = new Date();
      if (targetPlan === 'free') {
        renewalDate = new Date(renewalDate.getFullYear() + 1, 0, 1);
      } else {
        renewalDate.setFullYear(renewalDate.getFullYear() + 1);
      }

      // Update subscription with new plan
      subscription.plan = targetPlan;
      subscription.documentsLimit = documentsLimit;
      subscription.price = price;
      subscription.renewalDate = renewalDate;
      subscription.status = 'active';
      
      // Clear pending plan change fields if any
      subscription.pendingPlanChange = null;
      subscription.pendingPlanChangeDate = null;
      subscription.pendingPlanChangeReason = null;

      await subscription.save();

      return NextResponse.json({ 
        subscription,
        message: `Plan changé avec succès vers ${targetPlan}`
      });
    }

    if (!subscription.pendingPlanChange) {
      return NextResponse.json({ error: 'Aucune demande de changement de plan en attente' }, { status: 400 });
    }

    if (approve) {
      // Approve the plan change
      const planLimits: { [key: string]: number } = {
        free: 100,
        starter: 1000,
        premium: -1,
      };

      const planPrices: { [key: string]: number } = {
        free: 0,
        starter: 20,
        premium: 40,
      };

      const targetPlan = subscription.pendingPlanChange;
      const documentsLimit = planLimits[targetPlan] ?? 100;
      const price = planPrices[targetPlan] ?? 0;

      // Calculate renewal date
      let renewalDate = new Date();
      if (targetPlan === 'free') {
        renewalDate = new Date(renewalDate.getFullYear() + 1, 0, 1);
      } else {
        renewalDate.setFullYear(renewalDate.getFullYear() + 1);
      }

      // Update subscription with new plan
      subscription.plan = targetPlan;
      subscription.documentsLimit = documentsLimit;
      subscription.price = price;
      subscription.renewalDate = renewalDate;
      subscription.status = 'active';
      
      // Clear pending plan change fields
      subscription.pendingPlanChange = null;
      subscription.pendingPlanChangeDate = null;
      subscription.pendingPlanChangeReason = null;

      await subscription.save();

      return NextResponse.json({ 
        subscription,
        message: 'Changement de plan approuvé avec succès'
      });
    } else {
      // Reject the plan change
      subscription.pendingPlanChange = null;
      subscription.pendingPlanChangeDate = null;
      subscription.pendingPlanChangeReason = null;

      await subscription.save();

      return NextResponse.json({ 
        subscription,
        message: 'Demande de changement de plan rejetée'
      });
    }
  } catch (error: any) {
    console.error('Error approving/rejecting plan change:', error);
    return NextResponse.json(
      { error: 'Erreur lors du traitement de la demande' },
      { status: 500 }
    );
  }
}

