import {
  Controller,
  Delete,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GlobalExpenseCategory, GlobalExpenseCategoryDocument } from '../models/GlobalExpenseCategory';

@ApiTags('Admin - Global Expense Categories')
@Controller('admin/global-expense-categories')
@ApiBearerAuth()
export class AdminGlobalExpenseCategoryController {
  constructor(
    @InjectModel(GlobalExpenseCategory.name) 
    private globalExpenseCategoryModel: Model<GlobalExpenseCategoryDocument>
  ) {}

  @Delete(':code')
  @ApiOperation({ summary: 'Supprimer une catégorie globale par code' })
  @ApiResponse({ status: 200, description: 'Catégorie globale supprimée avec succès' })
  @ApiResponse({ status: 404, description: 'Catégorie globale non trouvée' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès refusé - Admin uniquement' })
  @HttpCode(HttpStatus.OK)
  async remove(@Param('code') code: string) {
    const result = await this.globalExpenseCategoryModel.findOneAndDelete({ code }).exec();
    
    if (!result) {
      throw new Error(`Catégorie globale avec le code '${code}' non trouvée`);
    }

    return { 
      message: 'Catégorie globale supprimée avec succès',
      deletedCategory: {
        code: result.code,
        nom: result.nom
      }
    };
  }
}




