
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface CompanyInfo {
    nom: string;
    adresse: {
        rue: string;
        ville: string;
        codePostal: string;
        pays: string;
    };
    logoUrl?: string;
    cachetUrl?: string;
    enTete?: {
        slogan?: string;
        telephone?: string;
        email?: string;
        siteWeb?: string;
        matriculeFiscal?: string;
        registreCommerce?: string;
        capitalSocial?: string;
    };
}

interface EmployeInfo {
    nomComplet: string;
    matricule?: string;
    poste: string;
    departement: string;
    adresse?: string;
    cin?: string;
    cnss?: string;
}

interface PeriodePaie {
    mois: string;
    annee: number;
    debut: string;
    fin: string;
    joursTravailles: number;
    joursAbsence: number;
    joursConges: number;
    totalJours: number;
}

interface LignePaie {
    libelle: string;
    base?: number;
    taux?: number;
    gain?: number;
    retenue?: number;
}

export interface PayslipData {
    numero: string;
    dateDoc: string;
    employe: EmployeInfo;
    periode: PeriodePaie;
    salaireBase: number;
    tauxJournalier: number;
    devise: string;
    lignes: LignePaie[];
    totalGains: number;
    totalRetenues: number;
    netAPayer: number;
    modePaiement: string;
    notes?: string;
}

function drawLogo(doc: jsPDF, base64: string | undefined, x: number = 15, y: number = 13, maxW: number = 45, maxH: number = 22): number {
    if (!base64) return y + maxH;

    try {
        const props = doc.getImageProperties(base64);
        const ratio = props.width / props.height;

        let w = maxW;
        let h = w / ratio;

        if (h > maxH) {
            h = maxH;
            w = h * ratio;
        }

        const format = base64.split(',')[0].split('/')[1].split(';')[0].toUpperCase();
        doc.addImage(base64, format, x, y, w, h, undefined, 'FAST');

        return y + h;
    } catch (error) {
        console.error('Error adding logo:', error);
        return y + maxH;
    }
}

function drawHeader(doc: jsPDF, companyInfo: CompanyInfo): number {
    // Fond header
    doc.setFillColor(244, 246, 251);
    doc.roundedRect(10, 10, 190, 32, 4, 4, 'F');

    // Logo à gauche
    drawLogo(doc, companyInfo.logoUrl, 15, 13, 45, 22);

    // Infos société à droite
    const rightX = 70;
    const topY = 15;
    doc.setFontSize(11).setFont('helvetica', 'bold');
    doc.text(companyInfo.nom, rightX, topY);

    doc.setFontSize(9).setFont('helvetica', 'normal');

    const adresseLines = [
        companyInfo.adresse.rue,
        [companyInfo.adresse.codePostal, companyInfo.adresse.ville].filter(Boolean).join(' '),
        companyInfo.adresse.pays
    ].filter(Boolean);

    adresseLines.forEach((line, i) => {
        doc.text(String(line), rightX, topY + 5 + (i * 4));
    });

    if (companyInfo.enTete?.telephone || companyInfo.enTete?.email) {
        doc.text(
            [
                companyInfo.enTete.telephone ? `Tél : ${companyInfo.enTete.telephone}` : '',
                companyInfo.enTete.email ? `Email : ${companyInfo.enTete.email}` : '',
                companyInfo.enTete.siteWeb ? `Web : ${companyInfo.enTete.siteWeb}` : '',
            ]
                .filter(Boolean)
                .join('  |  '),
            rightX,
            topY + 10
        );
    }

    if (companyInfo.enTete?.matriculeFiscal) {
        doc.text(`Matricule : ${companyInfo.enTete.matriculeFiscal}`, rightX, topY + 15);
    }

    return 10 + 32 + 4;
}

function drawInfoBlocks(doc: jsPDF, data: PayslipData, startY: number): number {
    const col1X = 10;
    const col2X = 110;
    const w = 90;
    const h = 40;

    // Bloc Employé
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(col1X, startY, w, h, 2, 2);

    doc.setFontSize(10).setFont('helvetica', 'bold');
    doc.text('INFORMATIONS EMPLOYÉ', col1X + 4, startY + 6);

    doc.setFontSize(9).setFont('helvetica', 'normal');
    let y = startY + 12;

    doc.setFont('helvetica', 'bold');
    doc.text('Nom :', col1X + 4, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.employe.nomComplet, col1X + 25, y);
    y += 5;

    if (data.employe.matricule) {
        doc.setFont('helvetica', 'bold');
        doc.text('Matricule :', col1X + 4, y);
        doc.setFont('helvetica', 'normal');
        doc.text(data.employe.matricule, col1X + 25, y);
        y += 5;
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Poste :', col1X + 4, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.employe.poste, col1X + 25, y);
    y += 5;

    doc.setFont('helvetica', 'bold');
    doc.text('Dépt :', col1X + 4, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.employe.departement, col1X + 25, y);
    y += 5;

    if (data.employe.cin) {
        doc.setFont('helvetica', 'bold');
        doc.text('CIN :', col1X + 4, y);
        doc.setFont('helvetica', 'normal');
        doc.text(data.employe.cin, col1X + 25, y);
    }


    // Bloc Période
    doc.roundedRect(col2X, startY, w, h, 2, 2);

    doc.setFontSize(10).setFont('helvetica', 'bold');
    doc.text('PÉRIODE DE PAIE', col2X + 4, startY + 6);

    doc.setFontSize(9).setFont('helvetica', 'normal');
    y = startY + 12;

    doc.text(`Mois : ${data.periode.mois} ${data.periode.annee}`, col2X + 4, y);
    y += 5;
    doc.text(`Du ${data.periode.debut} au ${data.periode.fin}`, col2X + 4, y);
    y += 8;

    // Jours details
    doc.setFontSize(8);
    const infoJours = [
        `Jours travaillés: ${data.periode.joursTravailles}`,
        `Jours congés: ${data.periode.joursConges}`,
        `Jours absence: ${data.periode.joursAbsence}`,
        `Total jours: ${data.periode.totalJours}`
    ].join('  |  ');
    doc.text(infoJours, col2X + 4, y);

    return startY + h + 8;
}

function drawPaymentTable(doc: jsPDF, data: PayslipData, startY: number): number {

    const body = data.lignes.map(line => [
        line.libelle,
        line.base ? line.base.toFixed(2) : '',
        line.taux ? `${line.taux}%` : '',
        line.gain ? line.gain.toFixed(3) : '',
        line.retenue ? line.retenue.toFixed(3) : ''
    ]);

    // Fill empty rows if needed to make it look uniform
    // body.push(['', '', '', '', '']); 

    autoTable(doc, {
        startY,
        head: [[
            'Rubrique',
            'Base',
            'Taux',
            'Gains',
            'Retenues'
        ]],
        body,
        theme: 'grid',
        styles: {
            fontSize: 9,
            cellPadding: 3,
            valign: 'middle',
        },
        headStyles: {
            fillColor: [41, 128, 185],
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center'
        },
        columnStyles: {
            0: { halign: 'left', cellWidth: 'auto' },
            1: { halign: 'right', cellWidth: 25 },
            2: { halign: 'right', cellWidth: 20 },
            3: { halign: 'right', cellWidth: 30 },
            4: { halign: 'right', cellWidth: 30 },
        },
        foot: [[
            'TOTAUX',
            '',
            '',
            data.totalGains.toFixed(3),
            data.totalRetenues.toFixed(3)
        ]],
        footStyles: {
            fillColor: [240, 240, 240],
            textColor: 0,
            fontStyle: 'bold',
            halign: 'right'
        }
    });

    return (doc as any).lastAutoTable.finalY + 10;
}

function drawNetPay(doc: jsPDF, data: PayslipData, startY: number): number {
    const x = 120;
    const w = 80;
    const h = 25;

    doc.setFillColor(41, 128, 185); // Blue
    doc.roundedRect(x, startY, w, h, 2, 2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10).setFont('helvetica', 'normal');
    doc.text('NET À PAYER', x + w / 2, startY + 8, { align: 'center' });

    doc.setFontSize(16).setFont('helvetica', 'bold');
    const currencySymbol = data.devise === 'TND' ? ' DT' : ` ${data.devise}`;
    doc.text(`${data.netAPayer.toFixed(3)}${currencySymbol}`, x + w / 2, startY + 18, { align: 'center' });

    // Reset
    doc.setTextColor(0, 0, 0);

    // Payment mode below
    doc.setFontSize(9).setFont('helvetica', 'normal');
    doc.text(`Mode de paiement : ${data.modePaiement}`, 10, startY + 8);
    doc.text(`Fait le : ${new Date().toLocaleDateString('fr-FR')}`, 10, startY + 14);

    return startY + h + 15;
}

export function generatePayslipPdf(data: PayslipData, companyInfo: CompanyInfo): jsPDF {
    const doc = new jsPDF();

    // 1. Header
    let y = drawHeader(doc, companyInfo);

    // 2. Title
    doc.setFontSize(16).setFont('helvetica', 'bold');
    doc.setTextColor(47, 95, 255);
    doc.text('FICHE DE PAIE', 10, y + 8);
    doc.setTextColor(0, 0, 0);

    y += 15;

    // 3. Info Blocks
    y = drawInfoBlocks(doc, data, y);

    // 4. Table
    y = drawPaymentTable(doc, data, y);

    // 5. Net Pay
    // Ensure we don't overflow
    if (y > 250) {
        doc.addPage();
        y = 20;
    }
    y = drawNetPay(doc, data, y);

    // 6. Notes if any
    if (data.notes) {
        if (y > 270) {
            doc.addPage();
            y = 20;
        }
        doc.setFontSize(9).setFont('helvetica', 'bold');
        doc.text('Notes:', 10, y);
        doc.setFont('helvetica', 'normal');
        doc.text(data.notes, 10, y + 5);
        y += 15;
    }

    // 7. Footer (Page numbers)
    const pageCount = (doc as any).internal.getNumberOfPages();
    doc.setFontSize(8);
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(`Page ${i} sur ${pageCount}`, 190, 287, { align: 'right' });

        // Quick footer details
        doc.text(`${companyInfo.nom} - ${companyInfo.enTete?.matriculeFiscal || ''}`, 105, 287, { align: 'center' });
    }

    return doc;
}
