import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReturnLine {
    reference?: string;
    designation?: string;
    quantite: number;
    unite?: string;
    prixUnitaireHT?: number;
    remisePct?: number;
    tvaPct?: number;
    totalLigneHT?: number;
}

interface RetourAchatData {
    numero: string;
    dateDoc: string;
    documentType: string;
    supplierName?: string;
    supplierAddress?: string;
    supplierPhone?: string;
    supplierEmail?: string;
    brNumero?: string;
    brDate?: string;
    devise: string;
    lignes: ReturnLine[];
    totalHT: number;
    totalTVA: number;
    totalTTC: number;
    notes?: string;
    statut: string;
}

interface CompanyInfo {
    nom: string;
    adresse: {
        rue: string;
        ville: string;
        codePostal: string;
        pays: string;
    };
    logoUrl?: string;
    enTete?: {
        slogan?: string;
        telephone?: string;
        email?: string;
        siteWeb?: string;
        matriculeFiscal?: string;
        registreCommerce?: string;
        capitalSocial?: string;
    };
    piedPage?: {
        texte?: string;
        conditionsGenerales?: string;
        mentionsLegales?: string;
        coordonneesBancaires?: {
            banque?: string;
            rib?: string;
            swift?: string;
        };
    };
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
        doc.addImage(base64, format, x, y, w, h);

        return y + h;
    } catch (error) {
        console.error('Error adding logo:', error);
        return y + maxH;
    }
}

function drawHeader(doc: jsPDF, companyInfo: CompanyInfo): number {
    doc.setFillColor(244, 246, 251);
    doc.roundedRect(10, 10, 190, 32, 4, 4, 'F');

    const bottomLogo = drawLogo(doc, companyInfo.logoUrl, 15, 13, 45, 22);

    const rightX = 70;
    const topY = 15;
    doc.setFontSize(11).setFont('helvetica', 'bold');
    doc.text(companyInfo.nom, rightX, topY);

    doc.setFontSize(9).setFont('helvetica', 'normal');
    if (companyInfo.adresse.rue) {
        doc.text(companyInfo.adresse.rue, rightX, topY + 5);
    }

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

function drawTitle(doc: jsPDF): number {
    const startY = 10 + 32 + 8;

    doc.setFontSize(16).setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38); // Red color for Returns
    doc.text('Bon de retour achat', 10, startY);
    doc.setTextColor(0, 0, 0);

    return startY + 8;
}

function drawInfoBlocks(doc: jsPDF, data: RetourAchatData, companyInfo: CompanyInfo, startY: number): number {
    const col1X = 12;
    const col2X = 75;
    const supplierX = 120;
    const h = 32; // Slightly taller to fit BR info

    doc.setFontSize(9).setFont('helvetica', 'normal');
    doc.text('Numéro de retour', col1X, startY + 4);
    doc.setTextColor(220, 38, 38);
    doc.setFont('helvetica', 'bold');
    doc.text(data.numero, col1X, startY + 10);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');

    // Date
    doc.text('Date', col2X, startY + 4);
    doc.setFont('helvetica', 'bold');
    doc.text(new Date(data.dateDoc).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }), col2X, startY + 10);
    doc.setFont('helvetica', 'normal');

    // Linked BR Info
    if (data.brNumero) {
        doc.text('Bon de réception lié', col1X, startY + 17);
        doc.setFont('helvetica', 'bold');
        doc.text(`${data.brNumero} ${data.brDate ? `(${new Date(data.brDate).toLocaleDateString('fr-FR')})` : ''}`, col1X, startY + 23);
        doc.setFont('helvetica', 'normal');
    }

    // Statut
    doc.text('Statut', col2X, startY + 17);
    doc.setFont('helvetica', 'bold');
    const statutText = data.statut === 'VALIDE' ? 'Validé' : data.statut === 'ANNULE' ? 'Annulé' : 'Brouillon';
    doc.text(statutText, col2X, startY + 23);

    // Bloc fournisseur
    let textY = startY + 12;
    let dynamicHeight = 6;

    let addressLines = 0;
    if (data.supplierAddress) {
        const addressText = `Adresse: ${data.supplierAddress}`;
        const addressWidth = 72;
        const splitAddress = doc.splitTextToSize(addressText, addressWidth);
        addressLines = splitAddress.length;
        dynamicHeight += 5 + (addressLines * 4);
    } else {
        dynamicHeight += 5;
    }

    if (data.supplierPhone) {
        dynamicHeight += 5;
    }

    if (data.supplierEmail) {
        dynamicHeight += 5;
    }

    dynamicHeight = Math.max(dynamicHeight, h);

    doc.setFillColor(238, 244, 255);
    doc.roundedRect(supplierX, startY, 80, dynamicHeight, 3, 3, 'F');

    doc.setFontSize(9).setFont('helvetica', 'bold');
    doc.text('Fournisseur', supplierX + 4, startY + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(data.supplierName || '—', supplierX + 4, textY);
    textY += 5;

    if (data.supplierAddress) {
        const addressText = `Adresse: ${data.supplierAddress}`;
        const addressWidth = 72;
        const splitAddress = doc.splitTextToSize(addressText, addressWidth);
        splitAddress.forEach((line: string, idx: number) => {
            doc.text(line, supplierX + 4, textY + (idx * 4));
        });
        textY += splitAddress.length * 4;
    }

    if (data.supplierPhone) {
        doc.text(`Tél: ${data.supplierPhone}`, supplierX + 4, textY);
        textY += 5;
    }

    if (data.supplierEmail) {
        doc.text(`Email: ${data.supplierEmail}`, supplierX + 4, textY);
    }

    return startY + dynamicHeight + 6;
}

function drawLinesTable(doc: jsPDF, data: RetourAchatData, startY: number): number {
    const body = data.lignes.map((l, index) => {
        const rawDesignation = l.designation && l.designation.trim().length > 0
            ? l.designation
            : `Ligne ${index + 1}`;

        const designation = rawDesignation
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<p[^>]*>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<div[^>]*>/gi, '\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<li[^>]*>/gi, '')
            .replace(/<\/li>/gi, '\n')
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\n\s*\n\s*\n/g, '\n\n')
            .trim();

        return [
            l.reference || '—',
            designation,
            l.quantite.toString(),
            l.unite || 'PCE',
            l.prixUnitaireHT ? l.prixUnitaireHT.toFixed(3) : '—',
            l.remisePct !== undefined && l.remisePct !== null && l.remisePct > 0 ? `${l.remisePct} %` : '—',
            l.tvaPct ? `${l.tvaPct} %` : '—',
            l.totalLigneHT ? l.totalLigneHT.toFixed(3) : '—',
        ];
    });

    autoTable(doc, {
        startY,
        head: [[
            'Réf',
            'Désignation',
            'Qté',
            'Unité',
            'Prix\nHT',
            'Remise\n%',
            'TVA\n%',
            'Total\nHT'
        ]],
        body,
        margin: { top: startY, left: 10, right: 10 },
        tableWidth: 190,
        showHead: 'everyPage',
        willDrawPage: (data: any) => {
            if (data.pageNumber > 1) {
                data.cursor.y = 10;
            }
        },
        styles: {
            fontSize: 9,
            cellPadding: 3,
            valign: 'middle',
            overflow: 'linebreak',
        },
        headStyles: {
            fillColor: [244, 246, 251], // Light gray/blue
            textColor: 0,
            fontStyle: 'bold',
            halign: 'left',
            fontSize: 8,
            cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
            valign: 'middle',
        },
        alternateRowStyles: {
            fillColor: [252, 252, 252],
        },
        columnStyles: {
            0: { cellWidth: 20, halign: 'left' },              // Réf
            1: { cellWidth: 58, halign: 'left' },              // Désignation
            2: { cellWidth: 16, halign: 'right' }, // Qté
            3: { cellWidth: 14, halign: 'center' },              // Unité
            4: { cellWidth: 20, halign: 'right' }, // Prix HT
            5: { cellWidth: 16, halign: 'right' }, // Remise %
            6: { cellWidth: 16, halign: 'right' }, // TVA %
            7: { cellWidth: 20, halign: 'right' }, // Total HT
        },
        theme: 'grid',
    });

    return (doc as any).lastAutoTable.finalY + 6;
}

function drawNotes(doc: jsPDF, notes: string | undefined, startY: number): number {
    if (!notes) return startY;

    doc.setFontSize(9);
    const cleanNotes = notes.trim();

    const label = 'Notes :';
    doc.setFont('helvetica', 'bold');
    doc.text(label, 10, startY + 4);

    doc.setFont('helvetica', 'normal');
    const splitNotes = doc.splitTextToSize(cleanNotes, 190);
    splitNotes.forEach((line: string, i: number) => {
        doc.text(line, 10, startY + 9 + (i * 5));
    });

    return startY + 9 + (splitNotes.length * 5) + 4;
}

function drawTotals(doc: jsPDF, data: RetourAchatData, startY: number, maxHeightBeforeFooter: number): number {
    const x = 125;
    const w = 75;
    const lineH = 6;
    const currencySymbol = data.devise === 'TND' ? ' DT' : ` ${data.devise}`;

    const lineCount = 3; // Total HT, Total TVA, Total TTC
    const totalBoxH = 6 + (lineCount * lineH) + 6 + 7;

    const totalsY = maxHeightBeforeFooter - totalBoxH;
    const actualStartY = Math.min(startY, totalsY);

    doc.setFillColor(245, 246, 251);
    doc.roundedRect(x, actualStartY, w, totalBoxH, 3, 3, 'F');

    doc.setFontSize(9);
    let y = actualStartY + 6;

    doc.setFont('helvetica', 'normal');
    doc.text('Total HT', x + 4, y);
    doc.setFont('helvetica', 'bold');
    doc.text(`${data.totalHT.toFixed(3)}${currencySymbol}`, x + w - 4, y, { align: 'right' });
    y += lineH;

    doc.setFont('helvetica', 'normal');
    doc.text('Total TVA', x + 4, y);
    doc.setFont('helvetica', 'bold');
    doc.text(`${data.totalTVA.toFixed(3)}${currencySymbol}`, x + w - 4, y, { align: 'right' });
    y += lineH;

    doc.setDrawColor(220, 220, 220);
    doc.line(x + 4, y + 1, x + w - 4, y + 1);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text('Total TTC', x + 4, y + 7);
    doc.text(`${data.totalTTC.toFixed(3)}${currencySymbol}`, x + w - 4, y + 7, { align: 'right' });
    doc.setTextColor(0, 0, 0);

    return actualStartY + totalBoxH;
}

function drawFooter(doc: jsPDF, companyInfo: CompanyInfo, footerY: number, pageNumber?: number, totalPages?: number): void {
    doc.setDrawColor(220, 220, 220);
    doc.line(10, footerY, 200, footerY);

    const yPos = footerY + 6;
    doc.setFontSize(9).setTextColor(0, 0, 0);

    const footerItems: string[] = [];

    const addressParts = [
        companyInfo.adresse.rue,
        companyInfo.adresse.ville,
        companyInfo.adresse.codePostal,
        companyInfo.adresse.pays
    ].filter(Boolean);
    if (addressParts.length > 0) {
        footerItems.push(addressParts.join(', '));
    }

    if (companyInfo.enTete?.telephone) {
        footerItems.push(`Tél : ${companyInfo.enTete.telephone}`);
    }

    if (footerItems.length > 0) {
        const footerText = footerItems.join(' - ');
        const centerX = 105;
        doc.text(footerText, centerX, yPos, { align: 'center' });
    }

    if (pageNumber !== undefined && totalPages !== undefined) {
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        const pageText = `Page ${pageNumber} / ${totalPages}`;
        doc.text(pageText, 200 - 20, footerY - 5, { align: 'right' });
        doc.setTextColor(0, 0, 0);
    }
}

export function generateRetourAchatPdf(data: RetourAchatData, companyInfo: CompanyInfo): jsPDF {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageHeight = 297;
    const footerY = 280;

    let y = drawHeader(doc, companyInfo);
    y = drawTitle(doc);
    y = drawInfoBlocks(doc, data, companyInfo, y);
    let tableEndY = drawLinesTable(doc, data, y);

    const approximateTotalBoxH = 50;
    const availableSpace = footerY - tableEndY - 3;

    if (data.notes) {
        if (availableSpace < 30) {
            doc.addPage();
            tableEndY = 10;
            doc.setPage(doc.getNumberOfPages());
        }
        tableEndY = drawNotes(doc, data.notes, tableEndY);
    }

    const availableSpaceForTotals = footerY - tableEndY - 3;
    if (availableSpaceForTotals < approximateTotalBoxH) {
        doc.addPage();
        drawTotals(doc, data, 10, footerY - 3);
    } else {
        drawTotals(doc, data, tableEndY + 5, footerY - 3);
    }

    const finalPageCount = doc.getNumberOfPages();
    for (let i = 1; i <= finalPageCount; i++) {
        doc.setPage(i);
        drawFooter(doc, companyInfo, footerY, i, finalPageCount);
    }

    return doc;
}
