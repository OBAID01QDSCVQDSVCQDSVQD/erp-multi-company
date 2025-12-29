
/**
 * Test adapté pour Next.js (Jest standard sans @nestjs/testing)
 */

import { ExpenseCategoryService, NotFoundException, ConflictException } from '../services/expense-category.service';
import { ExpenseCategoryScope } from '../dto/expense-category.dto';

// Mock simple des Models Mongoose
const mockExpenseCategoryModel = {
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  countDocuments: jest.fn(),
};

const mockGlobalExpenseCategoryModel = {
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
};

// Mock du constructeur de Model
jest.mock('../models/ExpenseCategory', () => {
  return {
    __esModule: true,
    default: Object.assign(
      jest.fn((data) => ({ ...data, save: jest.fn().mockResolvedValue({ ...data, _id: 'new_id', toObject: () => ({ ...data, _id: 'new_id' }) }) })),
      mockExpenseCategoryModel
    )
  };
});

jest.mock('../models/GlobalExpenseCategory', () => {
  return {
    __esModule: true,
    default: Object.assign(
      jest.fn(),
      mockGlobalExpenseCategoryModel
    )
  };
});

describe('ExpenseCategoryService - Union Global/Tenant', () => {
  let service: ExpenseCategoryService;

  const mockTenantCategory = {
    _id: 'tenant_cat_1',
    code: 'CAT_TENANT',
    nom: 'Catégorie Tenant',
    tenantId: 'tenant123',
    isActive: true,
    toObject: () => mockTenantCategory
  };

  const mockGlobalCategory = {
    _id: 'global_cat_1',
    code: 'CAT_GLOBAL',
    nom: 'Catégorie Globale',
    typeGlobal: 'exploitation',
    isActive: true,
    toObject: () => mockGlobalCategory
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ExpenseCategoryService();
  });

  describe('listUnion', () => {
    it('should merge tenant and global categories', async () => {
      // Setup mocks
      const mockTenantFind = {
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockTenantCategory])
      };

      const mockGlobalFind = {
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockGlobalCategory])
      };

      mockExpenseCategoryModel.find.mockReturnValue(mockTenantFind);
      mockGlobalExpenseCategoryModel.find.mockReturnValue(mockGlobalFind);

      const result = await service.listUnion('tenant123', {});

      expect(result.data).toHaveLength(2);
      expect(result.meta.tenantCount).toBe(1);
      expect(result.meta.globalCount).toBe(1);

      // Verify global category transformation
      const globalResult = result.data.find((c: any) => c.code === 'CAT_GLOBAL');
      expect(globalResult._source).toBe('global');
      expect(globalResult._id).toBe('global_global_cat_1');
    });

    it('should prioritize tenant category over global when codes match', async () => {
      const mockOverridingTenantCategory = {
        _id: 'tenant_cat_override',
        code: 'CAT_GLOBAL', // Same code as global
        nom: 'Catégorie Globale Modifiée',
        tenantId: 'tenant123',
        isActive: true,
        toObject: () => mockOverridingTenantCategory
      };

      // Setup mocks
      const mockTenantFind = {
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockOverridingTenantCategory])
      };

      const mockGlobalFind = {
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockGlobalCategory])
      };

      mockExpenseCategoryModel.find.mockReturnValue(mockTenantFind);
      mockGlobalExpenseCategoryModel.find.mockReturnValue(mockGlobalFind);

      const result = await service.listUnion('tenant123', {});

      expect(result.data).toHaveLength(1); // Should have merged to 1
      expect(result.data[0]._source).toBe('tenant');
      expect(result.data[0].nom).toBe('Catégorie Globale Modifiée');
    });
  });

  describe('CRUD Operations', () => {
    it('should create a tenant category', async () => {
      // Since we are mocking the module, the "new" call in the service uses the mocked default export
      // The save method is already mocked in the factory above
      const dto = {
        code: 'NEW_CAT',
        nom: 'Nouvelle Catégorie',
        portee: ExpenseCategoryScope.TENANT
      };

      mockExpenseCategoryModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      const result = await service.create('tenant123', dto as any);

      expect(result).toBeDefined();
      expect(result.scope).toBe('tenant');
      expect(result.code).toBe('NEW_CAT');
    });

    it('should retrieve a category by id', async () => {
      mockExpenseCategoryModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockTenantCategory) });

      const result = await service.findOne('tenant123', 'tenant_cat_1');

      expect(result).toBeDefined();
      expect(result._id).toBe('tenant_cat_1');
    });

    it('should throw NotFoundException if category not found', async () => {
      mockExpenseCategoryModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(service.findOne('tenant123', 'unknown_id'))
        .rejects.toThrow(NotFoundException);
    });
  });
});
