
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Salary from '@/lib/models/Salary';
import Employee from '@/lib/models/Employee';
import CompanySettings from '@/lib/models/CompanySettings';
import { generatePayslipPdf, PayslipData } from '@/lib/utils/pdf/payslipTemplate';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
        }

        const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });
        }

        const { id } = await params;
        await connectDB();

        // Fetch salary with employee details
        const salary = await (Salary as any).findOne({
            _id: id,
            tenantId
        }).populate('employeeId');

        if (!salary) {
            return NextResponse.json({ error: 'Fiche de paie non trouvée' }, { status: 404 });
        }

        // Fetch company settings
        const settings = await (CompanySettings as any).findOne({ tenantId });
        if (!settings) {
            return NextResponse.json({ error: 'Paramètres de société non trouvés' }, { status: 404 });
        }

        // Prepare Company Info
        const companyInfo = {
            nom: settings.societe?.nom || 'Ma Société',
            adresse: {
                rue: settings.societe?.adresse?.rue || '',
                ville: settings.societe?.adresse?.ville || '',
                codePostal: settings.societe?.adresse?.codePostal || '',
                pays: settings.societe?.adresse?.pays || ''
            },
            logoUrl: settings.societe?.logoUrl,
            cachetUrl: settings.societe?.cachetUrl,
            enTete: {
                slogan: settings.societe?.slogan,
                telephone: settings.societe?.telephone,
                email: settings.societe?.email,
                siteWeb: settings.societe?.siteWeb,
                matriculeFiscal: settings.societe?.matriculeFiscal,
                registreCommerce: settings.societe?.registreCommerce,
                capitalSocial: settings.societe?.capitalSocial
            }
        };

        // Prepare Payslip Data
        // We need to construct lines from earnings and deductions
        const lines = [];

        // Earnings
        if (salary.earnings.baseSalary > 0) {
            lines.push({
                libelle: 'Salaire de base',
                gain: salary.earnings.baseSalary
            });
        }
        if (salary.earnings.overtimePay > 0) {
            lines.push({
                libelle: 'Heures supplémentaires',
                gain: salary.earnings.overtimePay
            });
        }
        if (salary.earnings.bonuses > 0) {
            lines.push({
                libelle: 'Primes',
                gain: salary.earnings.bonuses
            });
        }
        if (salary.earnings.allowances > 0) {
            lines.push({
                libelle: 'Indemnités',
                gain: salary.earnings.allowances
            });
        }
        if (salary.earnings.otherEarnings > 0) {
            lines.push({
                libelle: 'Autres gains',
                gain: salary.earnings.otherEarnings
            });
        }

        // Deductions
        if (salary.deductions.taxes > 0) {
            lines.push({
                libelle: 'Retenue à la source (IRPP)',
                retenue: salary.deductions.taxes
            });
        }
        if (salary.deductions.socialSecurity > 0) {
            lines.push({
                libelle: 'CNSS (9.18%)',
                taux: 9.18,
                retenue: salary.deductions.socialSecurity
            });
        }
        if (salary.deductions.insurance > 0) {
            lines.push({
                libelle: 'Assurance',
                retenue: salary.deductions.insurance
            });
        }
        if (salary.deductions.advances > 0) {
            lines.push({
                libelle: 'Avances sur salaire',
                retenue: salary.deductions.advances
            });
        }
        if (salary.deductions.otherDeductions > 0) {
            lines.push({
                libelle: 'Autres déductions',
                retenue: salary.deductions.otherDeductions
            });
        }

        const employee = salary.employeeId;

        const payslipData: PayslipData = {
            numero: `PAIE-${salary.period.month}-${salary.period.year}`,
            dateDoc: new Date().toISOString(), // Date of generation? Or creating date? Utiliser created at generally
            employe: {
                nomComplet: `${employee.firstName} ${employee.lastName}`,
                matricule: employee.employeeNumber,
                poste: employee.position,
                departement: employee.department,
                cin: employee.cin,
                cnss: employee.socialSecurityNumber
            },
            periode: {
                mois: getMonthName(salary.period.month),
                annee: salary.period.year,
                debut: new Date(salary.period.startDate).toLocaleDateString('fr-FR'),
                fin: new Date(salary.period.endDate).toLocaleDateString('fr-FR'),
                joursTravailles: salary.workedDays,
                joursAbsence: salary.absentDays,
                joursConges: salary.leaveDays,
                totalJours: salary.totalDays
            },
            salaireBase: salary.baseSalary,
            tauxJournalier: salary.dailyRate,
            devise: salary.currency,
            lignes: lines,
            totalGains: salary.earnings.totalEarnings,
            totalRetenues: salary.deductions.totalDeductions,
            netAPayer: salary.netSalary,
            modePaiement: getPaymentMethodLabel(salary.paymentMethod),
            notes: salary.notes
        };

        // Generate PDF
        const pdfDoc = generatePayslipPdf(payslipData, companyInfo);
        const pdfBuffer = Buffer.from(pdfDoc.output('arraybuffer'));

        const filename = `Fiche_Paie_${employee.firstName}_${employee.lastName}_${salary.period.month}_${salary.period.year}.pdf`;

        return new NextResponse(pdfBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });

    } catch (error: any) {
        console.error('Error generating PDF:', error);
        return NextResponse.json(
            { error: 'Erreur lors de la génération du PDF', details: error.message },
            { status: 500 }
        );
    }
}

function getMonthName(month: number) {
    const months = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    return months[month - 1];
}

function getPaymentMethodLabel(method: string) {
    const methods: { [key: string]: string } = {
        'bank_transfer': 'Virement bancaire',
        'check': 'Chèque',
        'cash': 'Espèces'
    };
    return methods[method] || method;
}
