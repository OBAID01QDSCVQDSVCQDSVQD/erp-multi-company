#!/usr/bin/env node

// @ts-nocheck
// NestJS script
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ExpenseCategoryService } from '../services/expense-category.service';
import { Logger } from '@nestjs/common';

async function seedExpenseCategories() {
  const logger = new Logger('SeedExpenseCategories');
  
  try {
    const app = await NestFactory.createApplicationContext(AppModule);
    const expenseCategoryService = app.get(ExpenseCategoryService);

    // Récupérer le tenantId depuis les arguments de ligne de commande
    const args = process.argv.slice(2);
    const tenantArg = args.find(arg => arg.startsWith('--tenant='));
    
    if (!tenantArg) {
      logger.error('Paramètre --tenant manquant. Usage: pnpm api:seed-expense-categories --tenant=tenantId');
      process.exit(1);
    }

    const tenantId = tenantArg.split('=')[1];
    
    if (!tenantId) {
      logger.error('Valeur du paramètre --tenant manquante');
      process.exit(1);
    }

    logger.log(`Début du seeding des catégories de dépenses pour le tenant: ${tenantId}`);

    const categories = await expenseCategoryService.seedDefaultCategories(tenantId);
    
    logger.log(`Seeding terminé avec succès. ${categories.length} catégories traitées.`);
    
    await app.close();
    process.exit(0);
  } catch (error) {
    logger.error('Erreur lors du seeding:', error);
    process.exit(1);
  }
}

seedExpenseCategories();




