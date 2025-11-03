import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { ExpenseCategoryService } from '../services/expense-category.service';
import { CreateExpenseCategoryDto, UpdateExpenseCategoryDto, ExpenseCategoryQueryDto } from '../dto/expense-category.dto';

@ApiTags('Expense Categories')
@Controller('expense-categories')
export class ExpenseCategoryController {
  constructor(private readonly expenseCategoryService: ExpenseCategoryService) {}

  @Get()
  @ApiOperation({ summary: 'Récupérer la liste des catégories de dépenses (union globales + tenant)' })
  @ApiResponse({ status: 200, description: 'Liste des catégories récupérée avec succès' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  async findAll(@Req() req: any, @Query() query: ExpenseCategoryQueryDto, @Res() res: Response) {
    const tenantId = req.tenantId || req.headers['x-tenant-id'];
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Header X-Tenant-Id manquant' });
    }

    const result = await this.expenseCategoryService.listUnion(tenantId, query);
    
    // Ajouter le header de debug
    res.set('X-Source', 'union-global-tenant');
    
    return res.json(result);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer une catégorie de dépense par ID' })
  @ApiResponse({ status: 200, description: 'Catégorie récupérée avec succès' })
  @ApiResponse({ status: 404, description: 'Catégorie non trouvée' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  async findOne(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.headers['x-tenant-id'];
    return this.expenseCategoryService.findOne(tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Créer une nouvelle catégorie de dépense (tenant ou globale)' })
  @ApiResponse({ status: 201, description: 'Catégorie créée avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 409, description: 'Conflit - Code déjà existant' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: any, @Body() createExpenseCategoryDto: CreateExpenseCategoryDto) {
    const tenantId = req.tenantId || req.headers['x-tenant-id'];
    return this.expenseCategoryService.create(tenantId, createExpenseCategoryDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour une catégorie de dépense (tenant uniquement)' })
  @ApiResponse({ status: 200, description: 'Catégorie mise à jour avec succès' })
  @ApiResponse({ status: 404, description: 'Catégorie non trouvée' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateExpenseCategoryDto: UpdateExpenseCategoryDto
  ) {
    const tenantId = req.tenantId || req.headers['x-tenant-id'];
    return this.expenseCategoryService.update(tenantId, id, updateExpenseCategoryDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer une catégorie de dépense (tenant uniquement)' })
  @ApiQuery({ name: 'force', required: false, type: Boolean, description: 'Forcer la suppression même si la catégorie est utilisée' })
  @ApiResponse({ status: 200, description: 'Catégorie supprimée avec succès' })
  @ApiResponse({ status: 404, description: 'Catégorie non trouvée' })
  @ApiResponse({ status: 400, description: 'Catégorie utilisée par des dépenses ou catégorie globale' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  @HttpCode(HttpStatus.OK)
  async remove(
    @Req() req: any,
    @Param('id') id: string,
    @Query('force') force?: boolean
  ) {
    const tenantId = req.tenantId || req.headers['x-tenant-id'];
    await this.expenseCategoryService.remove(tenantId, id, force === true);
    return { message: 'Catégorie supprimée avec succès' };
  }
}