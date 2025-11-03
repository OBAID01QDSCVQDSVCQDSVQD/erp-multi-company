import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ExpenseCategoryService } from '../services/expense-category.service';
import { ExpenseCategory, ExpenseCategoryType } from '../models/ExpenseCategoryNestJS';

describe('ExpenseCategoryService', () => {
  let service: ExpenseCategoryService;
  let mockModel: any;

  const mockExpenseCategory = {
    _id: '507f1f77bcf86cd799439011',
    tenantId: 'tenant123',
    code: 'DEP_TRANSPORT',
    nom: 'Transport & Déplacements',
    description: 'Dépenses de transport',
    icone: '🚗',
    typeGlobal: ExpenseCategoryType.EXPLOITATION,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    mockModel = {
      find: jest.fn().mockReturnThis(),
      findOne: jest.fn(),
      countDocuments: jest.fn(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpenseCategoryService,
        {
          provide: getModelToken(ExpenseCategory.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<ExpenseCategoryService>(ExpenseCategoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('devrait créer une catégorie avec succès', async () => {
      const createDto = {
        code: 'DEP_TRANSPORT',
        nom: 'Transport & Déplacements',
        typeGlobal: ExpenseCategoryType.EXPLOITATION,
        icone: '🚗',
      };

      mockModel.findOne.mockResolvedValue(null); // Aucune catégorie existante
      mockModel.exec.mockResolvedValue(mockExpenseCategory);

      const result = await service.create('tenant123', createDto);

      expect(mockModel.findOne).toHaveBeenCalledWith({
        tenantId: 'tenant123',
        code: 'DEP_TRANSPORT',
      });
      expect(result).toEqual(mockExpenseCategory);
    });

    it('devrait rejeter si le code existe déjà pour le même tenant', async () => {
      const createDto = {
        code: 'DEP_TRANSPORT',
        nom: 'Transport & Déplacements',
        typeGlobal: ExpenseCategoryType.EXPLOITATION,
      };

      mockModel.findOne.mockResolvedValue(mockExpenseCategory); // Catégorie existante

      await expect(service.create('tenant123', createDto)).rejects.toThrow(
        ConflictException
      );
    });
  });

  describe('findOne', () => {
    it('devrait retourner une catégorie existante', async () => {
      mockModel.findOne.mockResolvedValue(mockExpenseCategory);

      const result = await service.findOne('tenant123', '507f1f77bcf86cd799439011');

      expect(mockModel.findOne).toHaveBeenCalledWith({
        _id: '507f1f77bcf86cd799439011',
        tenantId: 'tenant123',
        isActive: true,
      });
      expect(result).toEqual(mockExpenseCategory);
    });

    it('devrait lancer NotFoundException si la catégorie n\'existe pas', async () => {
      mockModel.findOne.mockResolvedValue(null);

      await expect(service.findOne('tenant123', '507f1f77bcf86cd799439011')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('remove', () => {
    it('devrait supprimer une catégorie avec succès', async () => {
      mockModel.findOne.mockResolvedValue(mockExpenseCategory);
      mockModel.findByIdAndUpdate.mockResolvedValue(mockExpenseCategory);

      await service.remove('tenant123', '507f1f77bcf86cd799439011');

      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        { isActive: false }
      );
    });

    it('devrait lancer NotFoundException si la catégorie n\'existe pas', async () => {
      mockModel.findOne.mockResolvedValue(null);

      await expect(service.remove('tenant123', '507f1f77bcf86cd799439011')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('seedDefaultCategories', () => {
    it('devrait créer les catégories par défaut', async () => {
      mockModel.findOne.mockResolvedValue(null); // Aucune catégorie existante
      mockModel.exec.mockResolvedValue(mockExpenseCategory);

      const result = await service.seedDefaultCategories('tenant123');

      expect(result).toHaveLength(16); // 16 catégories par défaut
      expect(mockModel.findOne).toHaveBeenCalledTimes(16);
    });

    it('devrait ignorer les catégories déjà existantes', async () => {
      mockModel.findOne
        .mockResolvedValueOnce(mockExpenseCategory) // Première catégorie existe déjà
        .mockResolvedValue(null); // Autres catégories n'existent pas
      mockModel.exec.mockResolvedValue(mockExpenseCategory);

      const result = await service.seedDefaultCategories('tenant123');

      expect(result).toHaveLength(16);
    });
  });
});




