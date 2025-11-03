// @ts-nocheck
// NestJS file - not used in Next.js app
import { IsString, IsOptional, IsEnum, IsNotEmpty, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ExpenseCategoryType {
  EXPLOITATION = 'exploitation',
  CONSOMMABLE = 'consommable',
  INVESTISSEMENT = 'investissement',
  FINANCIER = 'financier',
  EXCEPTIONNEL = 'exceptionnel',
}

export enum ExpenseCategoryScope {
  TENANT = 'tenant',
  GLOBAL = 'globale',
}

export class CreateExpenseCategoryDto {
  @ApiProperty({ 
    description: 'Code unique de la catégorie',
    example: 'DEP_TRANSPORT',
    pattern: '^[A-Z_]+$'
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z_]+$/, { message: 'Le code doit contenir uniquement des lettres majuscules et des underscores' })
  @MaxLength(50)
  code: string;

  @ApiProperty({ 
    description: 'Nom de la catégorie',
    example: 'Transport & Déplacements'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nom: string;

  @ApiPropertyOptional({ 
    description: 'Description de la catégorie',
    example: 'Dépenses liées aux transports et déplacements professionnels'
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ 
    description: 'Icône de la catégorie (emoji)',
    example: '🚗'
  })
  @IsString()
  @IsOptional()
  @MaxLength(10)
  icone?: string;

  @ApiProperty({ 
    description: 'Type global de la catégorie',
    enum: ExpenseCategoryType,
    example: ExpenseCategoryType.EXPLOITATION
  })
  @IsEnum(ExpenseCategoryType)
  typeGlobal: ExpenseCategoryType;

  @ApiPropertyOptional({ 
    description: 'Portée de la catégorie',
    enum: ExpenseCategoryScope,
    example: ExpenseCategoryScope.TENANT,
    default: ExpenseCategoryScope.TENANT
  })
  @IsEnum(ExpenseCategoryScope)
  @IsOptional()
  portee?: ExpenseCategoryScope = ExpenseCategoryScope.TENANT;
}

export class UpdateExpenseCategoryDto {
  @ApiPropertyOptional({ 
    description: 'Nom de la catégorie',
    example: 'Transport & Déplacements'
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  nom?: string;

  @ApiPropertyOptional({ 
    description: 'Description de la catégorie',
    example: 'Dépenses liées aux transports et déplacements professionnels'
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ 
    description: 'Icône de la catégorie (emoji)',
    example: '🚗'
  })
  @IsString()
  @IsOptional()
  @MaxLength(10)
  icone?: string;

  @ApiPropertyOptional({ 
    description: 'Type global de la catégorie',
    enum: ExpenseCategoryType,
    example: ExpenseCategoryType.EXPLOITATION
  })
  @IsEnum(ExpenseCategoryType)
  @IsOptional()
  typeGlobal?: ExpenseCategoryType;
}

export class ExpenseCategoryQueryDto {
  @ApiPropertyOptional({ 
    description: 'Recherche par nom ou code',
    example: 'transport'
  })
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ 
    description: 'Filtrer par type global',
    enum: ExpenseCategoryType,
    example: ExpenseCategoryType.EXPLOITATION
  })
  @IsEnum(ExpenseCategoryType)
  @IsOptional()
  typeGlobal?: ExpenseCategoryType;

  @ApiPropertyOptional({ 
    description: 'Page pour la pagination',
    example: 1,
    minimum: 1
  })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ 
    description: 'Nombre d\'éléments par page',
    example: 20,
    minimum: 1,
    maximum: 100
  })
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({ 
    description: 'Champ de tri',
    example: 'nom',
    enum: ['nom', 'code', 'typeGlobal', 'createdAt']
  })
  @IsString()
  @IsOptional()
  sortBy?: string = 'nom';

  @ApiPropertyOptional({ 
    description: 'Ordre de tri',
    example: 'asc',
    enum: ['asc', 'desc']
  })
  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'asc';
}