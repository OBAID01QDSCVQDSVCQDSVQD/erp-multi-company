import connectDB from '@/lib/mongodb';
import CompanySettings from '@/lib/models/CompanySettings';
import Counter from '@/lib/models/Counter';

export type SequenceType = 'devis' | 'bc' | 'bl' | 'fac' | 'avoir' | 'ca' | 'br' | 'facfo' | 'avoirfo';

export class NumberingService {
  /**
   * Génère le prochain numéro de séquence pour un tenant donné
   */
  static async next(tenantId: string, seqName: SequenceType): Promise<string> {
    await connectDB();

    // Récupérer les paramètres de numérotation du tenant
    const settings = await (CompanySettings as any).findOne({ tenantId });
    if (!settings) {
      throw new Error(`Paramètres non trouvés pour le tenant ${tenantId}`);
    }

    // Récupérer le template de numérotation
    let template = settings.numerotation[seqName];
    
    // Fallback: if ca not found, use po template
    if (!template && seqName === 'ca' && settings.numerotation.po) {
      template = settings.numerotation.po.replace(/PO-/g, 'CA-');
    }
    
    if (!template) {
      throw new Error(`Template de numérotation non trouvé pour ${seqName}`);
    }

    // Incrémenter le compteur dans une transaction
    const counter = await (Counter as any).findOneAndUpdate(
      { tenantId, seqName },
      { $inc: { value: 1 } },
      { upsert: true, new: true }
    );

    // Générer le numéro à partir du template
    return this.generateNumber(template, counter.value);
  }

  /**
   * Génère un numéro à partir d'un template
   */
  private static generateNumber(template: string, sequenceValue: number): string {
    const now = new Date();
    
    let result = template;
    
    // Remplacer les variables de date
    result = result.replace(/\{\{YYYY\}\}/g, now.getFullYear().toString());
    result = result.replace(/\{\{YY\}\}/g, now.getFullYear().toString().slice(-2));
    result = result.replace(/\{\{MM\}\}/g, (now.getMonth() + 1).toString().padStart(2, '0'));
    result = result.replace(/\{\{DD\}\}/g, now.getDate().toString().padStart(2, '0'));
    
    // Remplacer les variables de séquence
    const seqMatch = result.match(/\{\{SEQ:(\d+)\}\}/);
    if (seqMatch) {
      const padding = parseInt(seqMatch[1]);
      const paddedSequence = sequenceValue.toString().padStart(padding, '0');
      result = result.replace(/\{\{SEQ:\d+\}\}/g, paddedSequence);
    }
    
    return result;
  }

  /**
   * Prévisualise un numéro sans incrémenter le compteur
   */
  static async preview(tenantId: string, seqName: SequenceType): Promise<string> {
    await connectDB();

    const settings = await (CompanySettings as any).findOne({ tenantId });
    if (!settings) {
      throw new Error(`Paramètres non trouvés pour le tenant ${tenantId}`);
    }

    const template = settings.numerotation[seqName];
    if (!template) {
      throw new Error(`Template de numérotation non trouvé pour ${seqName}`);
    }

    // Récupérer la valeur actuelle du compteur
    const counter = await (Counter as any).findOne({ tenantId, seqName });
    const currentValue = counter ? counter.value : 0;

    // Générer le numéro avec la valeur actuelle + 1
    return this.generateNumber(template, currentValue + 1);
  }

  /**
   * Réinitialise un compteur
   */
  static async reset(tenantId: string, seqName: SequenceType): Promise<void> {
    await connectDB();
    
    await (Counter as any).findOneAndUpdate(
      { tenantId, seqName },
      { value: 0 },
      { upsert: true }
    );
  }

  /**
   * Réinitialise tous les compteurs d'un tenant
   */
  static async resetAll(tenantId: string): Promise<void> {
    await connectDB();
    
    const sequenceTypes: SequenceType[] = ['devis', 'bc', 'bl', 'fac', 'avoir', 'ca', 'br', 'facfo', 'avoirfo'];
    
    for (const seqName of sequenceTypes) {
      await (Counter as any).findOneAndUpdate(
        { tenantId, seqName },
        { value: 0 },
        { upsert: true }
      );
    }
  }

  /**
   * Obtient la valeur actuelle d'un compteur
   */
  static async getCurrentValue(tenantId: string, seqName: SequenceType): Promise<number> {
    await connectDB();
    
    const counter = await (Counter as any).findOne({ tenantId, seqName });
    return counter ? counter.value : 0;
  }
}
