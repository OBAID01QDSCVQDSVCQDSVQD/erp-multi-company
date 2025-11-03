import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExpenseCategory, ExpenseCategorySchema } from '../models/ExpenseCategory';
import { GlobalExpenseCategory, GlobalExpenseCategorySchema } from '../models/GlobalExpenseCategory';
import { ExpenseCategoryController } from '../controllers/expense-category.controller';
import { AdminGlobalExpenseCategoryController } from '../controllers/admin-global-expense-category.controller';
import { ExpenseCategoryService } from '../services/expense-category.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ExpenseCategory.name, schema: ExpenseCategorySchema },
      { name: GlobalExpenseCategory.name, schema: GlobalExpenseCategorySchema }
    ])
  ],
  controllers: [ExpenseCategoryController, AdminGlobalExpenseCategoryController],
  providers: [ExpenseCategoryService],
  exports: [ExpenseCategoryService]
})
export class ExpenseCategoryModule {}