import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ExpenseCategoryService } from '../services/expense-category.service';
import { ExpenseCategory } from '../models/ExpenseCategory';
import { GlobalExpenseCategory } from '../models/GlobalExpenseCategory';
import { ExpenseCategoryScope } from '../dto/expense-category.dto';

describe('ExpenseCategoryService - Union Global/Tenant', () => {
  let service: ExpenseCategoryService;
  let mockExpenseCategoryModel: any;
  let mockGlobalExpenseCategoryModel: any;

  const mockTenantCategory = {
    _id: 'tenant123',
    tenantId: 'tenant123',
    code: 'DEP_TRANSPORT',
    nom: 'Transport Tenant',
    typeGlobal: 'exploitation',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockGlobalCategory = {
    _id: 'global123',
    code: 'DEP_RESTAURATION',
    nom: 'Restaurant Global',
    typeGlobal: 'exploitation',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockExpenseCategoryModel = {
      find: jest.fn().mockReturnThis(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      sort: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    };

    mockGlobalExpenseCategoryModel = {
      find: jest.fn().mockReturnThis(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      sort: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpenseCategoryService,
        {
          provide: getModelToken(ExpenseCategory.name),
          useValue: mockExpenseCategoryModel,
        },
        {
          provide: getModelToken(GlobalExpenseCategory.name),
          useValue: mockGlobalExpenseCategoryModel,
        },
      ],
    }).compile();

    service = module.get<ExpenseCategoryService>(ExpenseCategoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listUnion', () => {
    it('devrait fusionner les catégories tenant et globales', async () => {
      const query = { page: 1, limit: 20 };
      
      mockExpenseCategoryModel.exec.mockResolvedValue([mockTenantCategory]);
      mockGlobalExpenseCategoryModel.exec.mockResolvedValue([mockGlobalCategory]);

      const result = await service.listUnion('tenant123', query);

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toHaveProperty('_source', 'tenant');
      expect(result.data[1]).toHaveProperty('_source', 'global');
      expect(result.meta.tenantCount).toBe(1);
      expect(result.meta.globalCount).toBe(1);
    });

    it('devrait privilégier les catégories tenant en cas de conflit de code', async () => {
      const query = { page: 1, limit: 20 };
      
      const conflictingGlobal = {
        ...mockGlobalCategory,
        code: 'DEP_TRANSPORT',
        nom: 'Transport Global',
      };

      mockExpenseCategoryModel.exec.mockResolvedValue([mockTenantCategory]);
      mockGlobalExpenseCategoryModel.exec.mockResolvedValue([conflictingGlobal]);

      const result = await service.listUnion('tenant123', query);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].nom).toBe('Transport Tenant');
      expect(result.data[0]._source).toBe('tenant');
    });
  });

  describe('create', () => {
    it('devrait créer une catégorie globale si portee=globale', async () => {
      const createDto = {
        code: 'DEP_NEW',
        nom: 'Nouvelle catégorie',
        typeGlobal: 'exploitation',
        portee: ExpenseCategoryScope.GLOBAL,
      };

      const mockGlobalResult = {
        ...mockGlobalCategory,
        code: 'DEP_NEW',
        nom: 'Nouvelle catégorie',
      };

      mockGlobalExpenseCategoryModel.findOneAndUpdate.mockResolvedValue(mockGlobalResult);

      const result = await service.create('tenant123', createDto);

      expect(mockGlobalExpenseCategoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        { code: 'DEP_NEW' },
        expect.objectContaining({
          $setOnInsert: { code: 'DEP_NEW' },
          $set: expect.objectContaining({
            nom: 'Nouvelle catégorie',
            typeGlobal: 'exploitation',
          }),
        }),
        { upsert: true, new: true }
      );
      expect(result.scope).toBe('globale');
    });

    it('devrait créer une catégorie tenant si portee=tenant', async () => {
      const createDto = {
        code: 'DEP_NEW',
        nom: 'Nouvelle catégorie',
        typeGlobal: 'exploitation',
        portee: ExpenseCategoryScope.TENANT,
      };

      mockExpenseCategoryModel.findOne.mockResolvedValue(null);
      mockExpenseCategoryModel.prototype.save = jest.fn().mockResolvedValue(mockTenantCategory);

      const result = await service.create('tenant123', createDto);

      expect(result.scope).toBe('tenant');
    });

    it('devrait rejeter si code dupliqué pour le même tenant', async () => {
      const createDto = {
        code: 'DEP_TRANSPORT',
        nom: 'Transport',
        typeGlobal: 'exploitation',
        portee: ExpenseCategoryScope.TENANT,
      };

      mockExpenseCategoryModel.findOne.mockResolvedValue(mockTenantCategory);

      await expect(service.create('tenant123', createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('devrait refuser la suppression d\'une catégorie globale', async () => {
      await expect(service.remove('tenant123', 'global_123')).rejects.toThrow(
        'Les catégories globales ne peuvent pas être supprimées via ce endpoint'
      );
    });

    it('devrait supprimer une catégorie tenant', async () => {
      mockExpenseCategoryModel.findOne.mockResolvedValue(mockTenantCategory);
      mockExpenseCategoryModel.findByIdAndUpdate.mockResolvedValue(mockTenantCategory);

      await service.remove('tenant123', 'tenant123');

      expect(mockExpenseCategoryModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'tenant123',
        { isActive: false }
      );
    });
  });
});




