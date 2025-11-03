import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import CompanySettings from '@/lib/models/CompanySettings';
import Counter from '@/lib/models/Counter';

// GET /api/settings - Récupérer les paramètres du tenant
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
    
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });
    }

    await connectDB();

    // Chercher les paramètres existants
    let settings = await (CompanySettings as any).findOne({ tenantId });

    // Si aucun paramètre n'existe, créer avec les valeurs par défaut
    if (!settings) {
      settings = await createDefaultSettings(tenantId);
    }

    return NextResponse.json(settings);

  } catch (error) {
    console.error('Erreur lors de la récupération des paramètres:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// PATCH /api/settings - Mettre à jour les paramètres
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
    
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });
    }

    const body = await request.json();
    
    await connectDB();

    // Mettre à jour les paramètres
    const updatedSettings = await (CompanySettings as any).findOneAndUpdate(
      { tenantId },
      { $set: body },
      { new: true, upsert: true }
    );

    // Log d'audit (à implémenter)
    console.log(`Settings updated for tenant ${tenantId} by user ${session.user.id}`);

    return NextResponse.json(updatedSettings);

  } catch (error) {
    console.error('Erreur lors de la mise à jour des paramètres:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// Fonction pour créer les paramètres par défaut
async function createDefaultSettings(tenantId: string) {
  const defaultSettings = {
    tenantId,
    societe: {
      nom: 'Nouvelle Entreprise',
      adresse: {
        rue: '',
        ville: '',
        codePostal: '',
        pays: 'Tunisie',
      },
      tva: '',
      devise: 'TND',
      langue: 'fr',
      fuseau: 'Africa/Tunis',
      enTete: {
        slogan: '',
        telephone: '',
        email: '',
        siteWeb: '',
        matriculeFiscal: '',
        registreCommerce: '',
        capitalSocial: '',
      },
      piedPage: {
        texte: '',
        conditionsGenerales: '',
        mentionsLegales: '',
        coordonneesBancaires: {
          banque: '',
          rib: '',
          swift: '',
        },
      },
    },
    numerotation: {
      devis: 'DEV-{{YYYY}}-{{SEQ:5}}',
      bl: 'BL-{{YY}}{{MM}}-{{SEQ:4}}',
      facture: 'FAC-{{YYYY}}-{{SEQ:5}}',
      avoir: 'AVR-{{YYYY}}-{{SEQ:5}}',
    },
    ventes: {
      tvaParDefautPct: 19,
      conditionsPaiementDefaut: '30 jours',
      uniteParDefaut: 'pièce',
    },
    achats: {
      modesReglement: ['Espèces', 'Virement', 'Chèque', 'Carte'],
    },
    depenses: {
      politiqueValidation: {
        autoJusqua: 500,
        approbationRequiseAuDela: 1000,
      },
    },
    stock: {
      methodeValorisation: 'cmp',
      seuilAlerte: 10,
    },
    securite: {
      motDePasseComplexe: true,
      deuxFA: false,
    },
    systeme: {
      maintenance: false,
      version: '1.0.0',
    },
    tva: {
      tauxParDefautPct: 19,
      regimeParDefautCode: 'TN19',
      arrondi: 'ligne',
      prixIncluentTVA: false,
      timbreFiscal: {
        actif: false,
        montantFixe: 1.0,
      },
      retenueSource: {
        actif: false,
        tauxPct: 0,
        appliquerSur: 'services',
      },
    },
  };

  const settings = new (CompanySettings as any)(defaultSettings);
  await (settings as any).save();

  // Initialiser les compteurs
  const sequenceTypes = ['devis', 'bl', 'facture', 'avoir'];
  for (const seqName of sequenceTypes) {
    await (Counter as any).findOneAndUpdate(
      { tenantId, seqName },
      { value: 0 },
      { upsert: true }
    );
  }

  return settings;
}
