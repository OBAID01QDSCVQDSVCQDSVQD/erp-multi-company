import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Plan from '@/lib/models/Plan';

export async function GET(request: NextRequest) {
    try {
        await connectDB();

        // 1. Fetch all plans
        let plans = await (Plan as any).find({}).sort({ sortOrder: 1 });

        // 2. If no plans exist, seed them with full features
        if (plans.length === 0) {
            const defaultPlans = [
                {
                    name: 'Gratuit',
                    slug: 'free',
                    description: 'Parfait pour tester et démarrer',
                    price: 0,
                    features: [
                        '100 documents par an',
                        'Gestion multi-entreprises',
                        'Clients et fournisseurs illimités',
                        'Gestion du stock',
                        'Facturation de base',
                        'Rapports basiques',
                        'Support par email'
                    ],
                    limits: { maxUsers: 1, maxCompanies: 1, maxDocuments: 100 },
                    isActive: true,
                    sortOrder: 1
                },
                {
                    name: 'Starter',
                    slug: 'starter',
                    description: 'Idéal pour les petites entreprises',
                    price: 20,
                    features: [
                        '1,000 documents par an',
                        'Gestion multi-entreprises',
                        'Clients et fournisseurs illimités',
                        'Gestion du stock avancée',
                        'Facturation complète',
                        'Rapports détaillés',
                        'Support prioritaire',
                        'Export de données',
                        'Personnalisation des documents'
                    ],
                    limits: { maxUsers: 4, maxCompanies: 1, maxDocuments: 1000 },
                    isActive: true,
                    isPopular: true,
                    sortOrder: 2
                },
                {
                    name: 'Premium',
                    slug: 'premium',
                    description: 'Pour les entreprises en croissance',
                    price: 40,
                    features: [
                        'Documents illimités',
                        'Gestion multi-entreprises',
                        'Clients et fournisseurs illimités',
                        'Gestion du stock avancée',
                        'Facturation complète',
                        'Rapports avancés et analytics',
                        'Support prioritaire 24/7',
                        'Export de données illimité',
                        'Personnalisation complète',
                        'API access',
                        'Intégrations tierces',
                        'Formation personnalisée'
                    ],
                    limits: { maxUsers: 10, maxCompanies: 3, maxDocuments: -1 },
                    isActive: true,
                    sortOrder: 3
                }
            ];

            await (Plan as any).insertMany(defaultPlans);
            plans = await (Plan as any).find({ isActive: true }).sort({ sortOrder: 1 });
        } else {
            // 3. Force update existing plans if they have very few features (recovery mode)
            let needsRefresh = false;
            for (const plan of plans) {
                if (plan.features && plan.features.length <= 4) {
                    let richFeatures: string[] = [];
                    let desc = '';
                    if (plan.slug === 'free') {
                        richFeatures = ['100 documents par an', 'Gestion multi-entreprises', 'Clients et fournisseurs illimités', 'Gestion du stock', 'Facturation de base', 'Rapports basiques', 'Support par email'];
                        desc = 'Parfait pour tester et démarrer';
                    } else if (plan.slug === 'starter') {
                        richFeatures = ['1,000 documents par an', 'Gestion multi-entreprises', 'Clients et fournisseurs illimités', 'Gestion du stock avancée', 'Facturation complète', 'Rapports détaillés', 'Support prioritaire', 'Export de données', 'Personnalisation des documents'];
                        desc = 'Idéal pour les petites entreprises';
                    } else if (plan.slug === 'premium') {
                        richFeatures = ['Documents illimités', 'Gestion multi-entreprises', 'Clients et fournisseurs illimités', 'Gestion du stock avancée', 'Facturation complète', 'Rapports avancés et analytics', 'Support prioritaire 24/7', 'Export de données illimité', 'Personnalisation complète', 'API access', 'Intégrations tierces', 'Formation personnalisée'];
                        desc = 'Pour les entreprises en croissance';
                    }

                    if (richFeatures.length > 0) {
                        await (Plan as any).findByIdAndUpdate(plan._id, {
                            $set: { features: richFeatures, description: desc }
                        });
                        needsRefresh = true;
                    }
                }
            }
            if (needsRefresh) {
                plans = await (Plan as any).find({ isActive: true }).sort({ sortOrder: 1 });
            }
        }

        return NextResponse.json(plans);
    } catch (error) {
        console.error('Error fetching plans:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}
