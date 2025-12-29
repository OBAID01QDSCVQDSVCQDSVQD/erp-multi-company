
import mongoose, { Model } from 'mongoose';
import ExpenseCategory, { IExpenseCategory } from '../models/ExpenseCategory';
import GlobalExpenseCategory, { IGlobalExpenseCategory } from '../models/GlobalExpenseCategory';
import { CreateExpenseCategoryDto, UpdateExpenseCategoryDto, ExpenseCategoryQueryDto, ExpenseCategoryScope } from '../dto/expense-category.dto';

// Custom Exceptions to replace NestJS exceptions
export class NotFoundException extends Error {
    statusCode = 404;
    constructor(message: string) {
        super(message);
        this.name = 'NotFoundException';
    }
}

export class ConflictException extends Error {
    statusCode = 409;
    constructor(message: string) {
        super(message);
        this.name = 'ConflictException';
    }
}

export class BadRequestException extends Error {
    statusCode = 400;
    constructor(message: string) {
        super(message);
        this.name = 'BadRequestException';
    }
}

export class ExpenseCategoryService {
    private expenseCategoryModel: Model<IExpenseCategory>;
    private globalExpenseCategoryModel: Model<IGlobalExpenseCategory>;

    constructor() {
        this.expenseCategoryModel = ExpenseCategory;
        this.globalExpenseCategoryModel = GlobalExpenseCategory;
    }

    async listUnion(tenantId: string, query: ExpenseCategoryQueryDto) {
        const {
            q,
            typeGlobal,
            page = 1,
            limit = 20,
            sortBy = 'nom',
            sortOrder = 'asc'
        } = query;

        // Construction du filtre pour les catégories tenant
        const tenantFilter: any = { tenantId, isActive: true };
        const globalFilter: any = { isActive: true }; // Ensure we only get active global categories too

        if (q) {
            const searchRegex = { $regex: q, $options: 'i' };
            tenantFilter.$or = [
                { nom: searchRegex },
                { code: searchRegex }
            ];
            globalFilter.$or = [
                { nom: searchRegex },
                { code: searchRegex }
            ];
        }

        if (typeGlobal) {
            tenantFilter.typeGlobal = typeGlobal;
            globalFilter.typeGlobal = typeGlobal;
        }

        // Construction du tri
        const sort: any = {};
        const sortKey = sortBy || 'nom';
        sort[sortKey] = sortOrder === 'desc' ? -1 : 1;

        // Calcul de la pagination
        const skip = ((page || 1) - 1) * (limit || 20);
        const limitVal = limit || 20;

        try {
            // Récupérer les catégories tenant et globales
            // @ts-ignore
            const [tenantCategories, globalCategories] = await Promise.all([
                this.expenseCategoryModel.find(tenantFilter).sort(sort).exec(),
                this.globalExpenseCategoryModel.find(globalFilter).sort(sort).exec()
            ]);

            // Fusionner les catégories par code (privilégier tenant)
            const categoryMap = new Map();

            // Ajouter d'abord les catégories globales
            // @ts-ignore
            globalCategories.forEach((category: any) => {
                categoryMap.set(category.code, {
                    ...category.toObject(),
                    _source: 'global',
                    _id: `global_${category._id}`,
                    originalId: category._id
                });
            });

            // Ajouter les catégories tenant (écrasent les globales si même code)
            // @ts-ignore
            tenantCategories.forEach((category: any) => {
                categoryMap.set(category.code, {
                    ...category.toObject(),
                    _source: 'tenant',
                });
            });

            // Convertir en tableau et trier
            const unionCategories = Array.from(categoryMap.values()).sort((a: any, b: any) => {
                const aValue = a[sortKey];
                const bValue = b[sortKey];

                let comparison = 0;
                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    comparison = aValue.localeCompare(bValue);
                } else if (aValue < bValue) {
                    comparison = -1;
                } else if (aValue > bValue) {
                    comparison = 1;
                }

                return sortOrder === 'desc' ? -comparison : comparison;
            });

            // Appliquer la pagination sur le résultat fusionné
            // Note: This is in-memory pagination after fetching potential matches. 
            // For very large datasets, this strategy might need adjustment, but for categories it's fine.
            const paginatedCategories = unionCategories.slice(skip, skip + limitVal);
            const total = unionCategories.length;

            return {
                data: paginatedCategories,
                pagination: {
                    page: page || 1,
                    limit: limitVal,
                    total,
                    pages: Math.ceil(total / limitVal)
                },
                meta: {
                    tenantCount: tenantCategories.length,
                    globalCount: globalCategories.length,
                    unionCount: unionCategories.length
                }
            };
        } catch (error) {
            console.error(`Erreur lors de la récupération des catégories pour le tenant ${tenantId}:`, error);
            throw error;
        }
    }

    async findAll(tenantId: string, query: ExpenseCategoryQueryDto) {
        return this.listUnion(tenantId, query);
    }

    async findOne(tenantId: string, id: string) {
        try {
            // @ts-ignore
            const category = await this.expenseCategoryModel.findOne({ _id: id, tenantId, isActive: true }).exec();

            if (!category) {
                throw new NotFoundException(`Catégorie avec l'ID ${id} non trouvée`);
            }

            return category;
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            console.error(`Erreur lors de la récupération de la catégorie ${id} pour le tenant ${tenantId}:`, error);
            throw error;
        }
    }

    async create(tenantId: string, createExpenseCategoryDto: CreateExpenseCategoryDto) {
        const { portee = ExpenseCategoryScope.TENANT, ...categoryData } = createExpenseCategoryDto;

        try {
            if (portee === ExpenseCategoryScope.GLOBAL) {
                // Créer/mettre à jour dans GlobalExpenseCategory
                const globalCategory = await this.globalExpenseCategoryModel.findOneAndUpdate(
                    { code: categoryData.code },
                    {
                        $setOnInsert: { code: categoryData.code },
                        $set: {
                            nom: categoryData.nom,
                            description: categoryData.description,
                            icone: categoryData.icone,
                            typeGlobal: categoryData.typeGlobal,
                        }
                    },
                    { upsert: true, new: true }
                ).exec();

                // @ts-ignore
                if (globalCategory) {
                    console.log(`Catégorie globale créée/mise à jour: ${globalCategory.code}`);
                    // @ts-ignore
                    return { ...globalCategory.toObject(), scope: 'globale' };
                }
                return null; // Should not happen with upsert: true

            } else {
                // Créer dans ExpenseCategory
                const existingCategory = await this.expenseCategoryModel.findOne({
                    tenantId,
                    code: categoryData.code
                }).exec();

                if (existingCategory) {
                    throw new ConflictException(`Une catégorie avec le code '${categoryData.code}' existe déjà pour ce tenant`);
                }

                const category = new this.expenseCategoryModel({
                    ...categoryData,
                    tenantId
                });

                const savedCategory = await category.save();
                console.log(`Catégorie tenant créée: ${savedCategory.code} pour le tenant ${tenantId}`);

                return { ...savedCategory.toObject(), scope: 'tenant' };
            }
        } catch (error) {
            if (error instanceof ConflictException) {
                throw error;
            }
            console.error(`Erreur lors de la création de la catégorie pour le tenant ${tenantId}:`, error);
            throw error;
        }
    }

    async update(tenantId: string, id: string, updateExpenseCategoryDto: UpdateExpenseCategoryDto) {
        try {
            // @ts-ignore
            const category = await this.expenseCategoryModel.findOne({ _id: id, tenantId, isActive: true }).exec();

            if (!category) {
                throw new NotFoundException(`Catégorie avec l'ID ${id} non trouvée`);
            }

            // Vérifier si c'est une catégorie globale (ne peut pas être modifiée via ce endpoint)
            if (id.startsWith('global_')) {
                throw new BadRequestException('Les catégories globales ne peuvent pas être modifiées via ce endpoint');
            }

            // Mise à jour des champs
            Object.assign(category, updateExpenseCategoryDto);

            const updatedCategory = await category.save();
            console.log(`Catégorie mise à jour: ${updatedCategory.code} pour le tenant ${tenantId}`);

            return updatedCategory;
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }
            console.error(`Erreur lors de la mise à jour de la catégorie ${id} pour le tenant ${tenantId}:`, error);
            throw error;
        }
    }

    async remove(tenantId: string, id: string, force: boolean = false): Promise<void> {
        try {
            // Vérifier si c'est une catégorie globale
            if (id.startsWith('global_')) {
                throw new BadRequestException('Les catégories globales ne peuvent pas être supprimées via ce endpoint');
            }

            const category = await this.expenseCategoryModel.findOne({ _id: id, tenantId, isActive: true }).exec();

            if (!category) {
                throw new NotFoundException(`Catégorie avec l'ID ${id} non trouvée`);
            }

            // Vérifier si la catégorie est utilisée par des dépenses
            if (!force) {
                // Note: Dans un vrai projet, vous importeriez le modèle Expense ici
                // const expenseCount = await this.expenseModel.countDocuments({ tenantId, categorieId: id }).exec();
                // if (expenseCount > 0) {
                //   throw new BadRequestException('Cette catégorie est utilisée par des dépenses et ne peut pas être supprimée');
                // }

                console.warn(`Vérification de l'utilisation de la catégorie ${id} non implémentée - suppression autorisée`);
            }

            // Suppression logique
            await this.expenseCategoryModel.findByIdAndUpdate(id, { isActive: false }).exec();
            console.log(`Catégorie supprimée: ${category.code} pour le tenant ${tenantId}`);
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }
            console.error(`Erreur lors de la suppression de la catégorie ${id} pour le tenant ${tenantId}:`, error);
            throw error;
        }
    }

    async seedDefaultCategories(tenantId: string) {
        const DEFAULT_EXPENSE_CATEGORIES = [
            { code: 'DEP_TRANSPORT', nom: 'Transport & Déplacements', typeGlobal: 'exploitation', icone: '🚗' },
            { code: 'DEP_RESTAURATION', nom: 'Repas & Restauration', typeGlobal: 'exploitation', icone: '🍽️' },
            { code: 'DEP_HEBERGEMENT', nom: 'Hébergement & Séjours', typeGlobal: 'exploitation', icone: '🏨' },
            { code: 'DEP_FOURNITURE', nom: 'Fournitures de bureau', typeGlobal: 'exploitation', icone: '🖇️' },
            { code: 'DEP_MATERIEL_CONSOM', nom: 'Matériel consommé', typeGlobal: 'consommable', icone: '🧰' },
            { code: 'DEP_ENTRETIEN', nom: 'Entretien & Nettoyage', typeGlobal: 'exploitation', icone: '🧼' },
            { code: 'DEP_COMMUNICATION', nom: 'Téléphone & Internet', typeGlobal: 'exploitation', icone: '📞' },
            { code: 'DEP_ENERGIE', nom: 'Électricité & Eau', typeGlobal: 'exploitation', icone: '💡' },
            { code: 'DEP_LOCATION', nom: 'Loyer & Charges locatives', typeGlobal: 'exploitation', icone: '🏢' },
            { code: 'DEP_BANQUE', nom: 'Frais bancaires', typeGlobal: 'financier', icone: '💳' },
            { code: 'DEP_INFORMATIQUE', nom: 'Informatique & Logiciels', typeGlobal: 'exploitation', icone: '💻' },
            { code: 'DEP_ASSURANCE', nom: 'Assurances', typeGlobal: 'exploitation', icone: '🛡️' },
            { code: 'DEP_CONSULTANT', nom: 'Honoraires & Prestations externes', typeGlobal: 'exploitation', icone: '🧾' },
            { code: 'DEP_INVEST', nom: 'Matériel durable / Investissement', typeGlobal: 'investissement', icone: '🏗️' },
            { code: 'DEP_EXCEP', nom: 'Dépenses exceptionnelles', typeGlobal: 'exceptionnel', icone: '⚠️' },
            { code: 'DEP_DIVERS', nom: 'Autres dépenses', typeGlobal: 'exploitation', icone: '📁' }
        ];

        const results = [];
        let inserted = 0;
        let alreadyExists = 0;

        for (const categoryData of DEFAULT_EXPENSE_CATEGORIES) {
            try {
                const existingCategory = await this.expenseCategoryModel.findOne({
                    tenantId,
                    code: categoryData.code
                }).exec();

                if (existingCategory) {
                    alreadyExists++;
                    results.push(existingCategory);
                } else {
                    const category = new this.expenseCategoryModel({
                        ...categoryData,
                        tenantId
                    });
                    const savedCategory = await category.save();
                    results.push(savedCategory);
                    inserted++;
                }
            } catch (error) {
                console.error(`Erreur lors de la création de la catégorie ${categoryData.code}:`, error);
            }
        }

        console.log(`Seeding terminé pour le tenant ${tenantId}: ${inserted} catégories créées, ${alreadyExists} déjà existantes`);

        return results;
    }
}