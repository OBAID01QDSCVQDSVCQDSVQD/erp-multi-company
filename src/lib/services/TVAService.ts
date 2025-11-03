import connectDB from '@/lib/mongodb';
import TaxRate from '@/lib/models/TaxRate';
import CompanySettings from '@/lib/models/CompanySettings';

export interface TVALine {
  qty: number;
  unitPrice: number;
  remisePct?: number;
  taxCode?: string;
  productTaxCode?: string;
}

export interface TVACalculationResult {
  baseHT: number;
  tvaLigne: number;
  ttcLigne: number;
  tvaDeductible?: number;
  taxCode: string;
  tauxPct: number;
}

export interface TVADocumentResult {
  lines: TVACalculationResult[];
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  timbre?: number;
  retenue?: number;
  netAPayer?: number;
  totalTVADeductible?: number;
}

export class TVAService {
  /**
   * Calcule la TVA pour une ligne de document
   */
  static async calculateLineTVA(
    tenantId: string,
    line: TVALine,
    documentType: 'ventes' | 'achats' = 'ventes'
  ): Promise<TVACalculationResult> {
    await connectDB();

    // 1. Résolution du taux de TVA
    const taxRate = await this.resolveTaxRate(tenantId, line, documentType);
    
    // 2. Calcul de la base HT
    const baseHT = this.calculateBaseHT(line, taxRate.tauxPct);
    
    // 3. Calcul de la TVA
    const tvaLigne = this.calculateTVA(baseHT, taxRate.tauxPct);
    
    // 4. Calcul du TTC
    const ttcLigne = baseHT + tvaLigne;
    
    // 5. Calcul de la TVA déductible (pour les achats)
    // Après la suppression des pourcentages de déductibilité par taux,
    // on considère la TVA déductible à 100% pour les achats (peut évoluer via règles ultérieures)
    const tvaDeductible = documentType === 'achats' 
      ? tvaLigne
      : undefined;

    return {
      baseHT: Math.round(baseHT * 1000) / 1000, // Arrondi à 3 décimales
      tvaLigne: Math.round(tvaLigne * 1000) / 1000,
      ttcLigne: Math.round(ttcLigne * 1000) / 1000,
      tvaDeductible: tvaDeductible ? Math.round(tvaDeductible * 1000) / 1000 : undefined,
      taxCode: taxRate.code,
      tauxPct: taxRate.tauxPct,
    };
  }

  /**
   * Calcule la TVA pour un document complet
   */
  static async calculateDocumentTVA(
    tenantId: string,
    lines: TVALine[],
    documentType: 'ventes' | 'achats' = 'ventes'
  ): Promise<TVADocumentResult> {
    await connectDB();

    // Récupérer les paramètres TVA du tenant
    const settings = await (CompanySettings as any).findOne({ tenantId });
    if (!settings) {
      throw new Error('Paramètres TVA non trouvés');
    }

    const tvaSettings = settings.tva;

    // Calculer chaque ligne
    const calculatedLines: TVACalculationResult[] = [];
    for (const line of lines) {
      const result = await this.calculateLineTVA(tenantId, line, documentType);
      calculatedLines.push(result);
    }

    // Calculer les totaux
    const totalHT = calculatedLines.reduce((sum, line) => sum + line.baseHT, 0);
    const totalTVA = calculatedLines.reduce((sum, line) => sum + line.tvaLigne, 0);
    const totalTTC = totalHT + totalTVA;

    // Appliquer l'arrondi selon les paramètres
    const finalTotalHT = tvaSettings.arrondi === 'document' 
      ? Math.round(totalHT * 100) / 100 
      : totalHT;
    const finalTotalTVA = tvaSettings.arrondi === 'document' 
      ? Math.round(totalTVA * 100) / 100 
      : totalTVA;
    const finalTotalTTC = finalTotalHT + finalTotalTVA;

    // Ajouter le timbre fiscal si activé
    let timbre = 0;
    if (tvaSettings.timbreFiscal.actif) {
      timbre = tvaSettings.timbreFiscal.montantFixe;
    }

    // Calculer la retenue à la source si activée
    let retenue = 0;
    let netAPayer = finalTotalTTC + timbre;
    
    if (tvaSettings.retenueSource?.actif) {
      const shouldApplyRetenue = tvaSettings.retenueSource.appliquerSur === 'tous' ||
        (tvaSettings.retenueSource.appliquerSur === 'services' && this.isAllServices(lines));
      
      if (shouldApplyRetenue) {
        retenue = finalTotalHT * (tvaSettings.retenueSource.tauxPct / 100);
        netAPayer = finalTotalTTC + timbre - retenue;
      }
    }

    // Calculer la TVA déductible totale (pour les achats)
    const totalTVADeductible = documentType === 'achats' 
      ? calculatedLines.reduce((sum, line) => sum + (line.tvaDeductible || 0), 0)
      : undefined;

    return {
      lines: calculatedLines,
      totalHT: finalTotalHT,
      totalTVA: finalTotalTVA,
      totalTTC: finalTotalTTC,
      timbre: timbre > 0 ? timbre : undefined,
      retenue: retenue > 0 ? retenue : undefined,
      netAPayer: netAPayer !== finalTotalTTC + timbre ? netAPayer : undefined,
      totalTVADeductible,
    };
  }

  /**
   * Résout le taux de TVA à utiliser pour une ligne
   */
  private static async resolveTaxRate(
    tenantId: string,
    line: TVALine,
    documentType: 'ventes' | 'achats'
  ) {
    // Priorité: line.taxCode -> product.taxCode -> settings.regimeParDefautCode
    let taxCode = line.taxCode || line.productTaxCode;
    
    if (!taxCode) {
      // Utiliser le régime par défaut
      const settings = await (CompanySettings as any).findOne({ tenantId });
      taxCode = settings?.tva?.regimeParDefautCode || 'TN19';
    }

    // Récupérer le taux de TVA
    const taxRate = await (TaxRate as any).findOne({ 
      tenantId, 
      code: taxCode.toUpperCase(),
      actif: true 
    });

    if (taxRate) {
      // Vérifier que le taux est applicable au type de document
      if (taxRate.applicableA === 'les_deux' || taxRate.applicableA === documentType) {
        return taxRate;
      }
    }

    // Fallback: utiliser le taux par défaut des paramètres
    const settings = await (CompanySettings as any).findOne({ tenantId });
    const defaultRate = settings?.tva?.tauxParDefautPct || 19;
    
    return {
      code: 'DEFAULT',
      tauxPct: defaultRate,
    } as any;
  }

  /**
   * Calcule la base HT selon les paramètres
   */
  private static calculateBaseHT(line: TVALine, tauxPct: number): number {
    const remisePct = line.remisePct || 0;
    const basePrice = line.qty * line.unitPrice * (1 - remisePct / 100);
    
    // Si les prix incluent la TVA, extraire la base HT
    // Sinon, la base HT est le prix de base
    return basePrice;
  }

  /**
   * Calcule la TVA
   */
  private static calculateTVA(baseHT: number, tauxPct: number): number {
    return baseHT * (tauxPct / 100);
  }

  /**
   * Vérifie si toutes les lignes sont des services
   */
  private static isAllServices(lines: TVALine[]): boolean {
    // Cette logique dépend de votre modèle de données
    // Pour l'instant, on considère que toutes les lignes sont des services
    return true;
  }

  /**
   * Obtient tous les taux de TVA actifs pour un tenant
   */
  static async getActiveTaxRates(tenantId: string, documentType?: 'ventes' | 'achats') {
    await connectDB();

    const query: any = { tenantId, actif: true };
    if (documentType) {
      query.$or = [
        { applicableA: 'les_deux' },
        { applicableA: documentType }
      ];
    }

    return await (TaxRate as any).find(query).sort({ code: 1 });
  }
}
