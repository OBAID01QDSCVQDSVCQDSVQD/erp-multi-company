import connectDB from '@/lib/mongodb';
import GlobalUnit, { IGlobalUnit } from '@/lib/models/GlobalUnit';
import Unit, { IUnit } from '@/lib/models/Unit';

export class UnitConversionService {
  private static async getUnionMap(tenantId: string): Promise<Map<string, (IGlobalUnit | IUnit) & { origine: 'global' | 'local' }>> {
    await connectDB();
    const [globals, locals] = await Promise.all([
      (GlobalUnit as any).find({ actif: true }),
      (Unit as any).find({ tenantId, actif: true }),
    ]);

    const map = new Map<string, (IGlobalUnit | IUnit) & { origine: 'global' | 'local' }>();
    for (const g of globals) {
      map.set(g.code.toUpperCase(), Object.assign(g, { origine: 'global' as const }));
    }
    for (const l of locals) {
      map.set(l.code.toUpperCase(), Object.assign(l, { origine: 'local' as const }));
    }
    return map;
  }

  static async normalizeToBase(params: { tenantId: string; quantite: number; codeUnite: string }) {
    const { tenantId, quantite, codeUnite } = params;
    const union = await this.getUnionMap(tenantId);
    const unit = union.get(codeUnite.toUpperCase());
    if (!unit) {
      throw new Error(`Unité inconnue: ${codeUnite}`);
    }
    const qtyBase = quantite * (unit.facteurVersBase || 1);
    return { quantiteBase: qtyBase, codeBase: unit.baseCategorie };
  }

  static async convert(params: { tenantId: string; quantite: number; deCode: string; versCode: string }) {
    const { tenantId, quantite, deCode, versCode } = params;
    const union = await this.getUnionMap(tenantId);
    const from = union.get(deCode.toUpperCase());
    const to = union.get(versCode.toUpperCase());
    if (!from) throw new Error(`Unité inconnue: ${deCode}`);
    if (!to) throw new Error(`Unité inconnue: ${versCode}`);
    if (from.categorie !== to.categorie) {
      throw new Error(`Conversion invalide: catégories différentes (${from.categorie} vs ${to.categorie})`);
    }
    if (from.baseCategorie !== to.baseCategorie) {
      throw new Error(`Incohérence de baseCategorie (${from.baseCategorie} vs ${to.baseCategorie})`);
    }
    const qtyBase = quantite * (from.facteurVersBase || 1);
    const result = qtyBase / (to.facteurVersBase || 1);
    return { quantite: result, code: to.code, codeBase: to.baseCategorie };
  }
}

export default UnitConversionService;


