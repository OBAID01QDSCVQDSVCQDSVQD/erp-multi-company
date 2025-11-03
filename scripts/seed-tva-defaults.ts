import mongoose from 'mongoose';
import connectDB from '../src/lib/mongodb';
import TaxRate from '../src/lib/models/TaxRate';
import CompanySettings from '../src/lib/models/CompanySettings';

// Taux de TVA par défaut pour la Tunisie
const defaultTaxRates = [
  { code: 'TN19', libelle: 'TVA 19%', tauxPct: 19, applicableA: 'les_deux' as const },
  { code: 'TN13', libelle: 'TVA 13%', tauxPct: 13, applicableA: 'les_deux' as const },
  { code: 'TN7', libelle: 'TVA 7%', tauxPct: 7, applicableA: 'les_deux' as const },
  { code: 'TN0', libelle: 'TVA 0%', tauxPct: 0, applicableA: 'les_deux' as const },
  { code: 'EXON', libelle: 'Exonéré', tauxPct: 0, applicableA: 'les_deux' as const },
];

// Paramètres TVA par défaut
const defaultTVASettings = {
  tauxParDefautPct: 19,
  regimeParDefautCode: 'TN19',
  arrondi: 'ligne' as const,
  prixIncluentTVA: false,
  timbreFiscal: {
    actif: false,
    montantFixe: 1.0,
  },
  retenueSource: {
    actif: false,
    tauxPct: 0,
    appliquerSur: 'services' as const,
  },
};

async function seedTVADefaults(tenantId?: string) {
  try {
    await connectDB();
    console.log('✅ Connecté à MongoDB');

    if (tenantId) {
      // Seed pour un tenant spécifique
      await seedForTenant(tenantId);
    } else {
    // Seed pour tous les tenants existants
    const tenants = await CompanySettings.distinct('tenantId').exec();
    console.log(`📋 Trouvé ${tenants.length} tenants`);
      
      for (const tenant of tenants) {
        await seedForTenant(tenant);
      }
    }

    console.log('🎉 Seed TVA terminé avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur lors du seed TVA :', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
  }
}

async function seedForTenant(tenantId: string) {
  console.log(`\n🏢 Traitement du tenant: ${tenantId}`);

  // 1. Vérifier si des taux existent déjà
  const existingRates = await TaxRate.find({ tenantId }).exec();
  if (existingRates.length > 0) {
    console.log(`  ⚠️  ${existingRates.length} taux existants trouvés, skip...`);
    return;
  }

  // 2. Créer les taux de TVA
  const taxRates = await TaxRate.insertMany(
    defaultTaxRates.map(rate => ({
      ...rate,
      tenantId,
      deductiblePctVentes: 100,
      deductiblePctAchats: 100,
      dateEffet: new Date(),
      actif: true,
    })) as any
  );
  console.log(`  ✅ ${taxRates.length} taux de TVA créés`);

  // 3. Mettre à jour les paramètres TVA
  const settings = await CompanySettings.findOne({ tenantId }).exec();
  if (settings) {
    // Mettre à jour la section TVA
    await CompanySettings.findOneAndUpdate(
      { tenantId },
      { 
        $set: { 
          'tva.tauxParDefautPct': defaultTVASettings.tauxParDefautPct,
          'tva.regimeParDefautCode': defaultTVASettings.regimeParDefautCode,
          'tva.arrondi': defaultTVASettings.arrondi,
          'tva.prixIncluentTVA': defaultTVASettings.prixIncluentTVA,
          'tva.timbreFiscal': defaultTVASettings.timbreFiscal,
          'tva.retenueSource': defaultTVASettings.retenueSource,
        }
      }
    ).exec();
    console.log('  ✅ Paramètres TVA mis à jour');
  } else {
    // Créer les paramètres par défaut
    const newSettings = new CompanySettings({
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
      tva: defaultTVASettings,
    });
    
    await newSettings.save();
    console.log('  ✅ Paramètres par défaut créés');
  }

  // 4. Afficher les taux créés
  console.log('  📋 Taux créés :');
  taxRates.forEach(rate => {
    console.log(`    ${rate.code} - ${rate.libelle} (${rate.tauxPct}%)`);
  });
}

// Exécuter le script
const args = process.argv.slice(2);
const tenantIdArg = args.find(arg => arg.startsWith('--tenant='));
const tenantId = tenantIdArg ? tenantIdArg.split('=')[1] : undefined;

seedTVADefaults(tenantId);
