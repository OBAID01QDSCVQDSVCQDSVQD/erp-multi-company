import connectDB from '@/lib/mongodb';
import CompanySettings from '@/lib/models/CompanySettings';
import Counter from '@/lib/models/Counter';

export type SequenceType = 'devis' | 'bc' | 'bl' | 'fac' | 'avoir' | 'ca' | 'br' | 'facfo' | 'avoirfo' | 'pafo' | 'pac' | 'int_fac' | 'retour' | 'retour_achat';


export class NumberingService {
  /**
   * Génère le prochain numéro de séquence pour un tenant donné
   */
  static async next(tenantId: string, seqName: SequenceType): Promise<string> {
    await connectDB();

    // Récupérer les paramètres de numérotation du tenant (without lean to allow updates)
    const settings = await (CompanySettings as any).findOne({ tenantId });
    if (!settings) {
      throw new Error(`Paramètres non trouvés pour le tenant ${tenantId}`);
    }

    // Récupérer le template de numérotation
    let template = settings.numerotation?.[seqName];

    // Fallback: if ca not found, use po template
    if (!template && seqName === 'ca' && settings.numerotation.po) {
      template = settings.numerotation.po.replace(/PO-/g, 'CA-');
    }

    // Fallback: if pafo not found, use default template
    if (!template && seqName === 'pafo') {
      template = 'PAFO-{{YYYY}}-{{SEQ:5}}';
    }

    // Fallback: if pac not found, use default template
    if (!template && seqName === 'pac') {
      template = 'PAC-{{YYYY}}-{{SEQ:5}}';
    }

    // Fallback: if int_fac not found, use default template (just number, no prefix)
    if (!template && seqName === 'int_fac') {
      template = '{{SEQ:4}}';
    }

    // Fallback: if retour not found, use default template
    if (!template && seqName === 'retour') {
      template = 'RET-{{YYYY}}-{{SEQ:4}}';
      // Also update settings to persist the template
      try {
        if (!settings.numerotation) {
          settings.numerotation = {};
        }
        settings.numerotation.retour = template;
        (settings as any).markModified('numerotation');
        await (settings as any).save();
      } catch (err: any) {
        console.warn('Failed to save retour template to settings:', err);
        // Continue anyway with the fallback template
      }
    }

    // Fallback: if retour_achat not found, use default template
    if (!template && seqName === 'retour_achat') {
      template = 'RETA-{{YYYY}}-{{SEQ:4}}';
      // Also update settings to persist the template
      try {
        if (!settings.numerotation) {
          settings.numerotation = {};
        }
        settings.numerotation.retour_achat = template;
        (settings as any).markModified('numerotation');
        await (settings as any).save();
      } catch (err: any) {
        console.warn('Failed to save retour_achat template to settings:', err);
      }
    }

    if (!template) {
      throw new Error(`Template de numérotation non trouvé pour ${seqName}`);
    }

    // Vérifier si le compteur existe déjà
    let counter = await (Counter as any).findOne({ tenantId, seqName });

    if (!counter) {
      // Si le compteur n'existe pas, utiliser la valeur de départ si définie
      const startingNumber = settings.numerotation.startingNumbers?.[seqName];
      const initialValue = startingNumber !== undefined && startingNumber !== null ? startingNumber : 0;
      counter = await (Counter as any).findOneAndUpdate(
        { tenantId, seqName },
        { $set: { value: initialValue } },
        { upsert: true, new: true }
      );
    } else {
      // Si le compteur existe, vérifier si startingNumber a été mis à jour et est plus grand
      const startingNumber = settings.numerotation.startingNumbers?.[seqName];
      if (startingNumber !== undefined && startingNumber !== null && counter.value < startingNumber) {
        // Mettre à jour le compteur si startingNumber est plus grand que la valeur actuelle
        counter = await (Counter as any).findOneAndUpdate(
          { tenantId, seqName },
          { $set: { value: startingNumber } },
          { new: true }
        );
      }
    }

    // Incrémenter le compteur
    counter = await (Counter as any).findOneAndUpdate(
      { tenantId, seqName },
      { $inc: { value: 1 } },
      { new: true }
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

    let template = settings.numerotation[seqName];

    // Fallback: if pafo not found, use default template
    if (!template && seqName === 'pafo') {
      template = 'PAFO-{{YYYY}}-{{SEQ:5}}';
    }

    // Fallback: if pac not found, use default template
    if (!template && seqName === 'pac') {
      template = 'PAC-{{YYYY}}-{{SEQ:5}}';
    }

    // Fallback: if int_fac not found, use default template (just number, no prefix)
    if (!template && seqName === 'int_fac') {
      template = '{{SEQ:4}}';
    }

    // Fallback: if retour_achat, use default
    if (!template && seqName === 'retour_achat') {
      template = 'RETA-{{YYYY}}-{{SEQ:4}}';
    }

    if (!template) {
      throw new Error(`Template de numérotation non trouvé pour ${seqName}`);
    }

    // Récupérer la valeur actuelle du compteur
    const counter = await (Counter as any).findOne({ tenantId, seqName });
    let currentValue = counter ? counter.value : 0;

    // Si le compteur n'existe pas, utiliser la valeur de départ si définie
    if (!counter) {
      const startingNumber = settings.numerotation.startingNumbers?.[seqName];
      if (startingNumber !== undefined && startingNumber !== null) {
        currentValue = startingNumber;
      }
    }

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

    const sequenceTypes: SequenceType[] = ['devis', 'bc', 'bl', 'fac', 'avoir', 'ca', 'br', 'facfo', 'avoirfo', 'pafo', 'pac', 'int_fac', 'retour', 'retour_achat'];

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

  /**
   * Assure que le compteur est au moins à une certaine valeur
   * Utilisé pour la réparation automatique en cas de collision
   */
  static async ensureSequenceAhead(tenantId: string, seqName: SequenceType, minVal: number): Promise<void> {
    await connectDB();

    // Find counter first to check value
    const counter = await (Counter as any).findOne({ tenantId, seqName });

    // Only update if current value is less than minVal
    if (!counter || counter.value < minVal) {
      await (Counter as any).findOneAndUpdate(
        { tenantId, seqName },
        { $set: { value: minVal } },
        { upsert: true, new: true }
      );
    }
  }
}
