import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import * as request from 'supertest';
import { ExpenseCategoryModule } from '../modules/expense-category.module';
import { ExpenseCategory, ExpenseCategoryType } from '../models/ExpenseCategoryNestJS';

describe('ExpenseCategoryController (e2e)', () => {
  let app: INestApplication;
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
    save: jest.fn().mockResolvedValue(this),
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

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ExpenseCategoryModule],
    })
      .overrideProvider(getModelToken(ExpenseCategory.name))
      .useValue(mockModel)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/expense-categories (POST)', () => {
    it('devrait créer une catégorie et retourner 201', () => {
      const createDto = {
        code: 'DEP_TRANSPORT',
        nom: 'Transport & Déplacements',
        typeGlobal: ExpenseCategoryType.EXPLOITATION,
        icone: '🚗',
      };

      mockModel.findOne.mockResolvedValue(null);
      mockModel.exec.mockResolvedValue(mockExpenseCategory);

      return request(app.getHttpServer())
        .post('/expense-categories')
        .set('X-Tenant-Id', 'tenant123')
        .set('Authorization', 'Bearer valid-token')
        .send(createDto)
        .expect(201)
        .expect((res) => {
          expect(res.body.code).toBe('DEP_TRANSPORT');
          expect(res.body.nom).toBe('Transport & Déplacements');
        });
    });

    it('devrait retourner 409 si le code existe déjà', () => {
      const createDto = {
        code: 'DEP_TRANSPORT',
        nom: 'Transport & Déplacements',
        typeGlobal: ExpenseCategoryType.EXPLOITATION,
      };

      mockModel.findOne.mockResolvedValue(mockExpenseCategory);

      return request(app.getHttpServer())
        .post('/expense-categories')
        .set('X-Tenant-Id', 'tenant123')
        .set('Authorization', 'Bearer valid-token')
        .send(createDto)
        .expect(409);
    });
  });

  describe('/expense-categories/:id (DELETE)', () => {
    it('devrait supprimer une catégorie et retourner 200', () => {
      mockModel.findOne.mockResolvedValue(mockExpenseCategory);
      mockModel.findByIdAndUpdate.mockResolvedValue(mockExpenseCategory);

      return request(app.getHttpServer())
        .delete('/expense-categories/507f1f77bcf86cd799439011')
        .set('X-Tenant-Id', 'tenant123')
        .set('Authorization', 'Bearer valid-token')
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Catégorie supprimée avec succès');
        });
    });

    it('devrait accepter la suppression avec force=true', () => {
      mockModel.findOne.mockResolvedValue(mockExpenseCategory);
      mockModel.findByIdAndUpdate.mockResolvedValue(mockExpenseCategory);

      return request(app.getHttpServer())
        .delete('/expense-categories/507f1f77bcf86cd799439011?force=true')
        .set('X-Tenant-Id', 'tenant123')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);
    });
  });

  describe('/expense-categories (GET)', () => {
    it('devrait retourner la liste des catégories', () => {
      const mockCategories = [mockExpenseCategory];
      mockModel.exec.mockResolvedValue(mockCategories);
      mockModel.countDocuments.mockResolvedValue(1);

      return request(app.getHttpServer())
        .get('/expense-categories')
        .set('X-Tenant-Id', 'tenant123')
        .set('Authorization', 'Bearer valid-token')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.pagination.total).toBe(1);
        });
    });
  });
});




