import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import CompanySettings from '@/lib/models/CompanySettings';

// PATCH /api/settings/tva - Mettre à jour les paramètres TVA
export async function PATCH(request: NextRequest) {
  try {
    console.log('🔧 TVA Settings API - PATCH request received');
    
    const session = await getServerSession(authOptions);
    console.log('👤 Session exists:', !!session);
    
    if (!session) {
      console.log('❌ No session found - returning 401');
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
    console.log('🏢 Tenant ID:', tenantId);
    
    if (!tenantId) {
      console.log('❌ No tenant ID found - returning 400');
      return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });
    }

    const body = await request.json();
    console.log('TVA Settings Update - Body:', body);
    
    const { 
      tauxParDefautPct, 
      regimeParDefautCode, 
      arrondi, 
      prixIncluentTVA, 
      timbreFiscal, 
      retenueSource 
    } = body;

    await connectDB();

    // Validation des données
    if (tauxParDefautPct !== undefined && (tauxParDefautPct < 0 || tauxParDefautPct > 100)) {
      return NextResponse.json(
        { error: 'Le taux par défaut doit être entre 0 et 100' },
        { status: 400 }
      );
    }

    if (arrondi && !['ligne', 'document'].includes(arrondi)) {
      return NextResponse.json(
        { error: 'L\'arrondi doit être "ligne" ou "document"' },
        { status: 400 }
      );
    }

    console.log('💾 Updating settings in database...');
    
    // Find or create settings
    let settings = await (CompanySettings as any).findOne({ tenantId });
    
    if (!settings) {
      console.log('❌ Settings not found, creating new ones...');
      // Create new settings if they don't exist
      settings = new CompanySettings({
        tenantId,
        societe: {
          nom: 'Nouvelle Entreprise',
          adresse: {
            rue: 'Non spécifié',
            ville: 'Non spécifié',
            codePostal: '0000',
            pays: 'Tunisie',
          },
          tva: 'Non spécifié',
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
      });
    }
    
    // Ensure required sections exist to satisfy schema validation
    if (!settings.societe) {
      settings.societe = {
        nom: 'Nouvelle Entreprise',
        adresse: { rue: 'Non spécifié', ville: 'Non spécifié', codePostal: '0000', pays: 'Tunisie' },
        tva: 'Non spécifié',
        devise: 'TND',
        langue: 'fr',
        fuseau: 'Africa/Tunis',
      } as any;
    }
    if (!settings.numerotation) {
      settings.numerotation = {
        devis: 'DEV-{{YYYY}}-{{SEQ:5}}',
        bl: 'BL-{{YY}}{{MM}}-{{SEQ:4}}',
        facture: 'FAC-{{YYYY}}-{{SEQ:5}}',
        avoir: 'AVR-{{YYYY}}-{{SEQ:5}}',
      } as any;
    }
    if (!settings.ventes) {
      settings.ventes = {
        tvaParDefautPct: 19,
        conditionsPaiementDefaut: '30 jours',
        uniteParDefaut: 'pièce',
      } as any;
    }
    if (!settings.achats) {
      settings.achats = { modesReglement: ['Espèces', 'Virement', 'Chèque', 'Carte'] } as any;
    }
    if (!settings.depenses) {
      settings.depenses = {
        politiqueValidation: { autoJusqua: 500, approbationRequiseAuDela: 1000 },
      } as any;
    }
    if (!settings.stock) {
      settings.stock = { methodeValorisation: 'cmp', seuilAlerte: 10 } as any;
    }
    if (!settings.securite) {
      settings.securite = { motDePasseComplexe: true, deuxFA: false } as any;
    }
    if (!settings.systeme) {
      settings.systeme = { maintenance: false, version: '1.0.0' } as any;
    }
    if (!settings.tva) {
      settings.tva = {
        tauxParDefautPct: 19,
        regimeParDefautCode: 'TN19',
        arrondi: 'ligne',
        prixIncluentTVA: false,
        timbreFiscal: { actif: false, montantFixe: 1.0 },
        retenueSource: { actif: false, tauxPct: 0, appliquerSur: 'services' },
      } as any;
    }
    
    // Apply updates
    if (tauxParDefautPct !== undefined) {
      settings.tva.tauxParDefautPct = tauxParDefautPct;
    }
    if (regimeParDefautCode !== undefined) {
      settings.tva.regimeParDefautCode = regimeParDefautCode;
    }
    if (arrondi !== undefined) {
      settings.tva.arrondi = arrondi;
    }
    if (prixIncluentTVA !== undefined) {
      settings.tva.prixIncluentTVA = prixIncluentTVA;
    }
    if (timbreFiscal !== undefined) {
      if (timbreFiscal.actif !== undefined) {
        settings.tva.timbreFiscal.actif = timbreFiscal.actif;
      }
      if (timbreFiscal.montantFixe !== undefined) {
        settings.tva.timbreFiscal.montantFixe = timbreFiscal.montantFixe;
      }
    }
    if (retenueSource !== undefined) {
      if (retenueSource.actif !== undefined) {
        settings.tva.retenueSource.actif = retenueSource.actif;
      }
      if (retenueSource.tauxPct !== undefined) {
        settings.tva.retenueSource.tauxPct = retenueSource.tauxPct;
      }
      if (retenueSource.appliquerSur !== undefined) {
        settings.tva.retenueSource.appliquerSur = retenueSource.appliquerSur;
      }
    }
    
    // Save the settings
    await (settings as any).save();
    
    console.log('✅ Settings updated successfully:', settings.tva);
    return NextResponse.json(settings);

  } catch (error) {
    console.error('Erreur lors de la mise à jour des paramètres TVA:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
