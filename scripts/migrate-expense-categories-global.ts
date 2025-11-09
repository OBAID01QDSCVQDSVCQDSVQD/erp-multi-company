#!/usr/bin/env node

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/lib/app.module';
import { ExpenseCategoryService } from '../src/lib/services/expense-category.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GlobalExpenseCategory, GlobalExpenseCategoryDocument } from '../src/lib/models/GlobalExpenseCategory';
import { Company, CompanyDocument } from '../src/lib/models/Company';
import { Logger } from '@nestjs/common';

const DEFAULT_EXPENSE_CATEGORIES = [
  { code: 'DEP_TRANSPORT', nom: 'Transport & Déplacements', typeGlobal: 'exploitation', icone: '🚗' },
  { code: 'DEP_RESTAURATION', nom: 'Repas & Restauration', typeGlobal: 'exploitation', icone: '🍽️' },
  { code: 'DEP_HEBERGEMENT', nom: 'Hébergement & Séjours', typeGlobal: 'exploitation', icone: '🏨' },
  { code: 'DEP_FOURNITURE', nom: 'Fournitures de bureau', typeGlobal: 'exploitation', icone: '🖇️' },
  { code: 'DEP_MATERIEL_CONSOM', nom: 'Matériel consommé', typeGlobal: 'consommable', icone: '🧰' },
  { code: 'DEP_ENTRETIEN', nom: 'Entretien & Nettoyage', typeGlobal: 'exploitation', icone: '🧼' },
  { code: 'DEP_COMMUNICATION', nom: 'Téléphone & Internet', typeGlobal: 'exploitation', icone: '📞' },
  { code: 'DEP_ENERGIE', nom: 'Électricité & Eau', typeGlobal: 'exploitation', icone: '💡' },
  { code: 'DEP_LOCATION', nom: 'Loyer & Charges locatives', typeGlobal: 'exploitation', icone: '🏢' },
  { code: 'DEP_BANQUE', nom: 'Frais bancaires', typeGlobal: 'financier', icone: '💳' },
  { code: 'DEP_INFORMATIQUE', nom: 'Informatique & Logiciels', typeGlobal: 'exploitation', icone: '💻' },
  { code: 'DEP_ASSURANCE', nom: 'Assurances', typeGlobal: 'exploitation', icone: '🛡️' },
  { code: 'DEP_CONSULTANT', nom: 'Honoraires & Prestations externes', typeGlobal: 'exploitation', icone: '🧾' },
  { code: 'DEP_INVEST', nom: 'Matériel durable / Investissement', typeGlobal: 'investissement', icone: '🏗️' },
  { code: 'DEP_EXCEP', nom: 'Dépenses exceptionnelles', typeGlobal: 'exceptionnel', icone: '⚠️' },
  { code: 'DEP_DIVERS', nom: 'Autres dépenses', typeGlobal: 'exploitation', icone: '📁' }
];

async function migrateExpenseCategoriesGlobal() {
  const logger = new Logger('MigrateExpenseCategoriesGlobal');
  
  try {
    const app = await NestFactory.createApplicationContext(AppModule);
    
    const globalExpenseCategoryModel = app.get<Model<GlobalExpenseCategoryDocument>>(
      'GlobalExpenseCategoryModel'
    );
    const companyModel = app.get<Model<CompanyDocument>>('CompanyModel');
    const expenseCategoryService = app.get<ExpenseCategoryService>(ExpenseCategoryService);

    // Récupérer les arguments de ligne de commande
    const args = process.argv.slice(2);
    const backfillTenantCopies = args.includes('--backfillTenantCopies=true');

    logger.log('Début de la migration des catégories de dépenses globales');

    // 1. Upsert dans GlobalExpenseCategory
    let globalInserted = 0;
    let globalMatched = 0;

    for (const categoryData of DEFAULT_EXPENSE_CATEGORIES) {
      try {
        const result = await globalExpenseCategoryModel.findOneAndUpdate(
          { code: categoryData.code },
          {
            $setOnInsert: { code: categoryData.code },
            $set: {
              nom: categoryData.nom,
              description: categoryData.description,
              icone: categoryData.icone,
              typeGlobal: categoryData.typeGlobal,
            }
          },
          { upsert: true, new: true }
        ).exec();

        if (result.isNew) {
          globalInserted++;
          logger.log(`Catégorie globale créée: ${categoryData.code}`);
        } else {
          globalMatched++;
          logger.log(`Catégorie globale mise à jour: ${categoryData.code}`);
        }
      } catch (error) {
        logger.error(`Erreur lors de la migration de la catégorie globale ${categoryData.code}:`, error);
      }
    }

    logger.log(`Migration globale terminée: ${globalInserted} créées, ${globalMatched} mises à jour`);

    // 2. Backfill vers les tenants si demandé
    if (backfillTenantCopies) {
      logger.log('Début du backfill vers les tenants');
      
      const companies = await companyModel.find({ isActive: true }).exec();
      logger.log(`${companies.length} entreprises trouvées`);

      for (const company of companies) {
        const tenantId = company._id.toString();
        let tenantInserted = 0;
        let tenantMatched = 0;

        for (const categoryData of DEFAULT_EXPENSE_CATEGORIES) {
          try {
            const result = await expenseCategoryService['expenseCategoryModel'].findOneAndUpdate(
              { tenantId, code: categoryData.code },
              {
                $setOnInsert: { tenantId, code: categoryData.code },
                $set: {
                  nom: categoryData.nom,
                  description: categoryData.description,
                  icone: categoryData.icone,
                  typeGlobal: categoryData.typeGlobal,
                  isActive: true,
                }
              },
              { upsert: true, new: true }
            ).exec();

            if (result.isNew) {
              tenantInserted++;
            } else {
              tenantMatched++;
            }
          } catch (error) {
            logger.error(`Erreur lors du backfill de ${categoryData.code} pour le tenant ${tenantId}:`, error);
          }
        }

        logger.log(`Backfill terminé pour ${company.name} (${tenantId}): ${tenantInserted} créées, ${tenantMatched} mises à jour`);
      }
    }

    logger.log('Migration terminée avec succès');
    
    await app.close();
    process.exit(0);
  } catch (error) {
    logger.error('Erreur lors de la migration:', error);
    process.exit(1);
  }
}

migrateExpenseCategoriesGlobal();





