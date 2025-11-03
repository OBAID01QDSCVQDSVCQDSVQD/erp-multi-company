import jsPDF from 'jspdf';

interface QuoteLine {
  produit?: string;
  description?: string;
  quantite: number;
  unite?: string;
  prixUnitaireHT: number;
  remisePct?: number;
  tvaPct?: number;
  totalHT?: number;
  totalTTC?: number;
}

interface QuoteData {
  numero: string;
  dateDoc: string;
  dateValidite?: string;
  customerName?: string;
  customerAddress?: string;
  customerMatricule?: string;
  customerCode?: string;
  devise: string;
  lignes: QuoteLine[];
  totalBaseHT: number;
  totalTVA: number;
  timbreFiscal?: number;
  totalTTC: number;
  modePaiement?: string;
  notes?: string;
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

export function generateQuotePDF(quoteData: QuoteData, companyInfo: CompanyInfo): jsPDF {
  const doc = new jsPDF();
  let yPosition = 20;

  // Colors
  const primaryColor = [64, 81, 181]; // Indigo

  // Helper function to add logo with proper aspect ratio
  const addLogo = () => {
    if (companyInfo.logoUrl && companyInfo.logoUrl.startsWith('data:image')) {
      try {
        doc.addImage(companyInfo.logoUrl, 'PNG', 20, 15, 30, 20);
        yPosition = 40;
      } catch (error) {
        console.error('Error adding logo:', error);
        yPosition = 20;
      }
    } else {
      yPosition = 20;
    }
  };

  // Helper function to add text
  const addText = (text: string, x: number, y: number, size: number = 10, style: 'normal' | 'bold' | 'italic' = 'normal') => {
    doc.setFontSize(size);
    doc.setFont('helvetica', style);
    doc.text(text, x, y);
  };

  // Helper function to draw table with proper sizing
  const drawTable = (startY: number, headers: string[], data: any[][]) => {
    const lineHeight = 7;
    // Adjusted column widths to fit A4 page (width: 210mm, margins: 20mm each side = 170mm usable)
    // Convert mm to points (1mm = 2.834 points, so 170mm = 482 points)
    // Let's use ~165mm = ~468 points total width
    const colWidths = [12, 80, 20, 25, 30, 20, 20, 40, 40];
    const tableWidth = colWidths.reduce((sum, w) => sum + w, 0);
    let currentY = startY;
    
    // Draw header
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(20, currentY, tableWidth, lineHeight, 'F');
    
    let xPos = 20;
    headers.forEach((header, idx) => {
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      
      // Truncate long header text if needed
      let headerText = header;
      if (idx === 1 && headerText.length > 12) { // Produit column
        headerText = headerText.substring(0, 12);
      }
      
      doc.text(headerText, xPos + 1, currentY + lineHeight - 2);
      xPos += colWidths[idx];
    });
    
    currentY += lineHeight;
    
    // Draw rows
    data.forEach((row, rowIdx) => {
      // Check if we need a new page
      if (currentY > 270) { // 297mm - 20mm margin = 277mm max
        doc.addPage();
        currentY = 30;
        
        // Redraw header on new page
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(20, currentY, tableWidth, lineHeight, 'F');
        xPos = 20;
        headers.forEach((header, idx) => {
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          let headerText = header;
          if (idx === 1 && headerText.length > 12) {
            headerText = headerText.substring(0, 12);
          }
          doc.text(headerText, xPos + 1, currentY + lineHeight - 2);
          xPos += colWidths[idx];
        });
        currentY += lineHeight;
      }
      
      if (rowIdx % 2 === 0) {
        doc.setFillColor(245, 247, 250);
        doc.rect(20, currentY, tableWidth, lineHeight, 'F');
      }
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      
      xPos = 20;
      row.forEach((cell, idx) => {
        let cellText = String(cell);
        
        // Truncate product name if too long
        if (idx === 1 && cellText.length > 25) {
          cellText = cellText.substring(0, 22) + '...';
        }
        
        doc.text(cellText, xPos + 1, currentY + lineHeight - 2);
        xPos += colWidths[idx];
      });
      
      currentY += lineHeight;
    });
    
    // Draw borders
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    
    // Vertical lines
    xPos = 20;
    for (let i = 0; i <= colWidths.length; i++) {
      if (i > 0) xPos += colWidths[i - 1];
      doc.line(xPos, startY, xPos, currentY);
    }
    
    // Horizontal lines
    doc.line(20, startY, 20 + tableWidth, startY);
    doc.line(20, startY + lineHeight, 20 + tableWidth, startY + lineHeight);
    doc.line(20, currentY, 20 + tableWidth, currentY);
    
    return currentY;
  };

  // Page 1: Header with company logo and info
  addLogo();

  // Company name and address
  const startX = companyInfo.logoUrl ? 50 : 20;
  addText(companyInfo.nom, startX, 25, 12, 'bold');
  
  if (companyInfo.enTete?.slogan) {
    addText(companyInfo.enTete.slogan, startX, 30, 8, 'italic');
  }

  let infoY = 25;
  if (companyInfo.adresse.rue) {
    addText(companyInfo.adresse.rue, startX, infoY += 6, 8);
  }
  if (companyInfo.adresse.ville) {
    addText(`${companyInfo.adresse.ville} ${companyInfo.adresse.codePostal}`, startX, infoY += 5, 8);
  }
  if (companyInfo.adresse.pays) {
    addText(companyInfo.adresse.pays, startX, infoY += 5, 8);
  }

  // Company contact info (right side)
  let rightY = 25;
  if (companyInfo.enTete?.telephone) {
    addText(`Tél: ${companyInfo.enTete.telephone}`, 140, rightY, 7);
    rightY += 5;
  }
  if (companyInfo.enTete?.email) {
    addText(`Email: ${companyInfo.enTete.email}`, 140, rightY, 7);
    rightY += 5;
  }
  if (companyInfo.enTete?.siteWeb) {
    addText(`Web: ${companyInfo.enTete.siteWeb}`, 140, rightY, 7);
    rightY += 5;
  }
  if (companyInfo.enTete?.matriculeFiscal) {
    addText(`Mat: ${companyInfo.enTete.matriculeFiscal}`, 140, rightY, 7);
  }

  // Title and quote info
  yPosition = 55;
  addText('DEVIS', 20, yPosition, 16, 'bold');
  yPosition += 10;

  addText(`N°: ${quoteData.numero}`, 20, yPosition, 10, 'bold');
  yPosition += 6;
  addText(`Date: ${new Date(quoteData.dateDoc).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, 20, yPosition, 9);
  if (quoteData.dateValidite) {
    yPosition += 6;
    addText(`Validité: ${new Date(quoteData.dateValidite).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, 20, yPosition, 9);
  }

  // Customer info
  yPosition += 12;
  addText('CLIENT', 20, yPosition, 10, 'bold');
  yPosition += 8;
  
  if (quoteData.customerName) {
    addText(quoteData.customerName, 20, yPosition, 9, 'bold');
    yPosition += 6;
  }
  if (quoteData.customerAddress) {
    addText(quoteData.customerAddress, 20, yPosition, 8);
    yPosition += 5;
  }
  if (quoteData.customerMatricule) {
    addText(`Matricule: ${quoteData.customerMatricule}`, 20, yPosition, 8);
    yPosition += 5;
  }
  if (quoteData.customerCode) {
    addText(`Code: ${quoteData.customerCode}`, 20, yPosition, 8);
    yPosition += 5;
  }

  // Lines table
  yPosition += 8;
  
  const tableData = quoteData.lignes.map((line, index) => {
    const remise = line.remisePct || 0;
    const prixHTAfterDiscount = line.prixUnitaireHT * (1 - remise / 100);
    const montantHT = prixHTAfterDiscount * line.quantite;
    const montantTTC = montantHT * (1 + (line.tvaPct || 0) / 100);
    
    // Get product name - prefer produit over description
    const productName = line.produit || line.description || '';
    
    return [
      index + 1,
      productName,
      line.quantite.toString(),
      line.unite || 'PIECE',
      line.prixUnitaireHT.toFixed(3),
      `${remise}%`,
      `${line.tvaPct || 0}%`,
      montantHT.toFixed(3),
      montantTTC.toFixed(3)
    ];
  });

  const headers = ['N°', 'Produit', 'Qté', 'Unité', 'Prix HT', 'Remise', 'TVA', 'Total HT', 'Total TTC'];
  const finalY = drawTable(yPosition, headers, tableData);
  
  // Totals section - better positioning
  yPosition = finalY + 8;
  
  // Calculate totals box width
  const totalsWidth = 70;
  const totalsStartX = 127; // Right aligned
  
  // Draw background box for totals
  doc.setFillColor(245, 247, 250);
  const totalsHeight = (quoteData.timbreFiscal && quoteData.timbreFiscal > 0) ? 50 : 42;
  doc.roundedRect(totalsStartX, yPosition - 5, totalsWidth, totalsHeight, 3, 3, 'F');

  doc.setTextColor(0, 0, 0);
  yPosition += 6;
  addText('Sous-total HT:', totalsStartX + 2, yPosition, 8);
  addText(`${quoteData.totalBaseHT.toFixed(3)} ${quoteData.devise}`, totalsStartX + 50, yPosition, 8, 'bold');
  
  yPosition += 7;
  addText('TVA:', totalsStartX + 2, yPosition, 8);
  addText(`${quoteData.totalTVA.toFixed(3)} ${quoteData.devise}`, totalsStartX + 50, yPosition, 8);
  
  if (quoteData.timbreFiscal && quoteData.timbreFiscal > 0) {
    yPosition += 7;
    addText('Timbre:', totalsStartX + 2, yPosition, 8);
    addText(`${quoteData.timbreFiscal.toFixed(3)} ${quoteData.devise}`, totalsStartX + 50, yPosition, 8);
  }
  
  yPosition += 8;
  doc.setLineWidth(0.3);
  doc.line(totalsStartX + 2, yPosition, totalsStartX + totalsWidth - 4, yPosition);
  yPosition += 6;
  
  addText('Total TTC:', totalsStartX + 2, yPosition, 10, 'bold');
  addText(`${quoteData.totalTTC.toFixed(3)} ${quoteData.devise}`, totalsStartX + 50, yPosition, 10, 'bold');

  // Payment method
  if (quoteData.modePaiement) {
    yPosition += 12;
    addText(`Mode de paiement: ${quoteData.modePaiement}`, 20, yPosition, 8);
  }

  // Notes
  if (quoteData.notes) {
    yPosition += 10;
    addText('Notes:', 20, yPosition, 9, 'bold');
    yPosition += 6;
    doc.setFont('helvetica', 'normal');
    
    // Split notes into multiple lines if needed
    const notesLines = doc.splitTextToSize(quoteData.notes, 170);
    notesLines.forEach((line: string) => {
      addText(line, 20, yPosition, 8);
      yPosition += 5;
    });
  }

  // Footer
  const pageHeight = doc.internal.pageSize.height;
  
  if (companyInfo.piedPage) {
    yPosition = Math.min(yPosition + 10, pageHeight - 50);
    
    if (companyInfo.piedPage.texte) {
      addText(companyInfo.piedPage.texte, 20, yPosition, 7);
      yPosition += 5;
    }
    
    if (companyInfo.piedPage.conditionsGenerales) {
      doc.setFont('helvetica', 'bold');
      addText('Conditions générales:', 20, yPosition, 7);
      yPosition += 5;
      doc.setFont('helvetica', 'normal');
      const conditions = doc.splitTextToSize(companyInfo.piedPage.conditionsGenerales, 170);
      conditions.forEach((line: string) => {
        addText(line, 20, yPosition, 7);
        yPosition += 4;
      });
    }
    
    if (companyInfo.piedPage.mentionsLegales) {
      yPosition += 3;
      doc.setFont('helvetica', 'bold');
      addText('Mentions légales:', 20, yPosition, 7);
      yPosition += 5;
      doc.setFont('helvetica', 'normal');
      const mentions = doc.splitTextToSize(companyInfo.piedPage.mentionsLegales, 170);
      mentions.forEach((line: string) => {
        addText(line, 20, yPosition, 7);
        yPosition += 4;
      });
    }
    
    if (companyInfo.piedPage.coordonneesBancaires) {
      yPosition += 3;
      doc.setFont('helvetica', 'bold');
      addText('Coordonnées bancaires:', 20, yPosition, 7);
      yPosition += 5;
      doc.setFont('helvetica', 'normal');
      const banc = companyInfo.piedPage.coordonneesBancaires;
      if (banc.banque) addText(`Banque: ${banc.banque}`, 20, yPosition, 7);
      yPosition += 4;
      if (banc.rib) addText(`RIB: ${banc.rib}`, 20, yPosition, 7);
      yPosition += 4;
      if (banc.swift) addText(`SWIFT: ${banc.swift}`, 20, yPosition, 7);
    }
  }

  // Page number
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    addText(`Page ${i} / ${pageCount}`, 180, pageHeight - 10, 7);
  }

  return doc;
}
