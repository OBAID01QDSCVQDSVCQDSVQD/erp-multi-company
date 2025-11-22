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
      fodec,
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
          fodec: {
            actif: false,
            tauxPct: 1,
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
          fodec: { actif: false, tauxPct: 1 },
          retenueSource: { actif: false, tauxPct: 0, appliquerSur: 'services' },
      } as any;
    }
    
    // Use findOne to get the document, then update it directly and save
    // This ensures Mongoose properly handles nested objects
    const settingsDoc = await (CompanySettings as any).findOne({ tenantId });
    
    if (!settingsDoc) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
    }
    
    // Update all fields directly on the document
    if (tauxParDefautPct !== undefined) settingsDoc.tva.tauxParDefautPct = tauxParDefautPct;
    if (regimeParDefautCode !== undefined) settingsDoc.tva.regimeParDefautCode = regimeParDefautCode;
    if (arrondi !== undefined) settingsDoc.tva.arrondi = arrondi;
    if (prixIncluentTVA !== undefined) settingsDoc.tva.prixIncluentTVA = prixIncluentTVA;
    
    if (timbreFiscal !== undefined) {
      if (!settingsDoc.tva.timbreFiscal) {
        settingsDoc.tva.timbreFiscal = { actif: false, montantFixe: 1 };
      }
      if (timbreFiscal.actif !== undefined) settingsDoc.tva.timbreFiscal.actif = timbreFiscal.actif;
      if (timbreFiscal.montantFixe !== undefined) settingsDoc.tva.timbreFiscal.montantFixe = timbreFiscal.montantFixe;
      (settingsDoc as any).markModified('tva.timbreFiscal');
    }
    
    if (fodec !== undefined) {
      // Ensure fodec exists
      if (!settingsDoc.tva.fodec) {
        settingsDoc.tva.fodec = { actif: false, tauxPct: 1 };
      }
      if (fodec.actif !== undefined) settingsDoc.tva.fodec.actif = fodec.actif;
      if (fodec.tauxPct !== undefined) settingsDoc.tva.fodec.tauxPct = fodec.tauxPct;
      (settingsDoc as any).markModified('tva.fodec');
    }
    
    if (retenueSource !== undefined) {
      if (!settingsDoc.tva.retenueSource) {
        settingsDoc.tva.retenueSource = { actif: false, tauxPct: 0, appliquerSur: 'tous' };
      }
      if (retenueSource.actif !== undefined) settingsDoc.tva.retenueSource.actif = retenueSource.actif;
      if (retenueSource.tauxPct !== undefined) settingsDoc.tva.retenueSource.tauxPct = retenueSource.tauxPct;
      if (retenueSource.appliquerSur !== undefined) settingsDoc.tva.retenueSource.appliquerSur = retenueSource.appliquerSur;
      (settingsDoc as any).markModified('tva.retenueSource');
    }
    
    // Mark tva as modified to ensure all nested changes are saved
    (settingsDoc as any).markModified('tva');
    
    // Save the document
    await settingsDoc.save();
    
    // If fodec was updated, ensure it's saved to MongoDB directly
    // This is necessary because Mongoose sometimes doesn't save new nested objects properly
    if (fodec !== undefined && settingsDoc.tva.fodec) {
      const db = (CompanySettings as any).db;
      const collection = db.collection('companysettings');
      
      await collection.updateOne(
        { tenantId },
        { 
          $set: { 
            'tva.fodec': {
              actif: settingsDoc.tva.fodec.actif,
              tauxPct: settingsDoc.tva.fodec.tauxPct
            }
          } 
        }
      );
    }
    
    // Reload to get the final state
    const updatedSettings = await (CompanySettings as any).findOne({ tenantId });
    
    // Convert to plain object for JSON response
    const responseData = updatedSettings?.toObject ? updatedSettings.toObject() : updatedSettings;
    
    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Erreur lors de la mise à jour des paramètres TVA:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
