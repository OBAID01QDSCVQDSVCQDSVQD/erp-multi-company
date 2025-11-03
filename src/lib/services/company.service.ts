// @ts-nocheck
// NestJS file - not used in Next.js app
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Company } from '../models/Company';
import { ExpenseCategoryService } from './expense-category.service';

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);

  constructor(
    @InjectModel(Company.name) private companyModel: Model<Company>,
    private expenseCategoryService: ExpenseCategoryService,
  ) {}

  async create(companyData: any): Promise<Company> {
    try {
      // Créer la société
      const company = new this.companyModel(companyData);
      const savedCompany = await company.save();

      this.logger.log(`Société créée: ${savedCompany.name} (${savedCompany._id})`);

      // Seeding automatique des catégories de dépenses
      try {
        await this.expenseCategoryService.seedDefaultCategories(savedCompany._id.toString());
        this.logger.log(`Catégories de dépenses créées pour la société ${savedCompany.name}`);
      } catch (error) {
        this.logger.warn(`Erreur lors du seeding des catégories pour la société ${savedCompany.name}:`, error);
        // Ne pas faire échouer la création de la société si le seeding échoue
      }

      return savedCompany;
    } catch (error) {
      this.logger.error('Erreur lors de la création de la société:', error);
      throw error;
    }
  }

  async findAll(): Promise<Company[]> {
    return this.companyModel.find().exec();
  }

  async findOne(id: string): Promise<Company> {
    return this.companyModel.findById(id).exec();
  }

  async update(id: string, updateData: any): Promise<Company> {
    return this.companyModel.findByIdAndUpdate(id, updateData, { new: true }).exec();
  }

  async remove(id: string): Promise<void> {
    await this.companyModel.findByIdAndDelete(id).exec();
  }
}




