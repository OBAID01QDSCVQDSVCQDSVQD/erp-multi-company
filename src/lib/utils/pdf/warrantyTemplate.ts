import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateWarrantyPdf = (warranty: any, companySettings: any, includeStamp: boolean = false) => {
    // Initialize PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // --- Helper: Draw Header (Invoice Style) ---
    // Background Box
    doc.setFillColor(244, 246, 251);
    doc.roundedRect(10, 10, 190, 32, 4, 4, 'F');

    // Logo (Attempt to draw if available)
    const logoUrl = companySettings?.societe?.logoUrl;
    if (logoUrl) {
        try {
            const format = logoUrl.split(',')[0].split('/')[1].split(';')[0].toUpperCase();
            doc.addImage(logoUrl, format, 15, 13, 45, 22, undefined, 'FAST');
        } catch (e) {
            // Silently fail if logo cannot be added
        }
    }

    // Company Info (Right side of header box)
    const rightX = 70;
    let topY = 15;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(companySettings?.societe?.nom || 'Ma Société', rightX, topY);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    const address = companySettings?.societe?.adresse;
    if (address) {
        const addrLine = [address.rue, address.ville, address.codePostal, address.pays].filter(Boolean).join(', ');
        doc.text(addrLine, rightX, topY + 5);
    }

    const contact = companySettings?.societe?.enTete;
    if (contact) {
        const contactLine = [
            contact.telephone ? `Tél : ${contact.telephone}` : '',
            contact.email ? `Email : ${contact.email}` : '',
            contact.siteWeb ? `Web : ${contact.siteWeb}` : ''
        ].filter(Boolean).join('  |  ');
        doc.text(contactLine, rightX, topY + 10);

        if (contact.matriculeFiscal) {
            doc.text(`Matricule : ${contact.matriculeFiscal}`, rightX, topY + 15);
        }
    }

    let yPos = 50; // Start content below header box

    // Helper for Section Headers (Inner Content)
    const addSectionHeader = (text: string, y: number) => {
        doc.setFillColor(245, 247, 250);
        doc.setDrawColor(220, 220, 220);
        doc.rect(15, y, pageWidth - 30, 8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        doc.text(text.toUpperCase(), 20, y + 5.5);
        return y + 12;
    };

    // Document Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(47, 95, 255); // Blue like invoice
    doc.text('CERTIFICAT DE GARANTIE', 10, yPos);
    yPos += 10;

    // Info Block (Left)
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    doc.text('Numéro de certificat', 12, yPos + 4);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(47, 95, 255);
    doc.text(warranty.certificateNumber, 12, yPos + 10);

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.text('Date d\'émission', 12, yPos + 17);
    doc.text(new Date(warranty.date).toLocaleDateString('fr-FR'), 12, yPos + 23);

    // Client Box (Right) - Invoice Style
    const clientX = 120;
    doc.setFillColor(238, 244, 255);
    doc.roundedRect(clientX, yPos, 80, 28, 3, 3, 'F');

    const customerName = warranty.customerId
        ? (warranty.customerId.raisonSociale || `${warranty.customerId.prenom} ${warranty.customerId.nom}`)
        : 'Client Passager';

    doc.setFont('helvetica', 'bold');
    doc.text('Client', clientX + 4, yPos + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(customerName, clientX + 4, yPos + 12);

    if (warranty.customerId?.code) {
        doc.text(`Code: ${warranty.customerId.code}`, clientX + 4, yPos + 17);
    }

    yPos += 35; // Move down past info blocks

    // 1. Articles Table
    // No custom header needed, autoTable has its own
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(52, 152, 219);
    doc.text('ARTICLES COUVERTS', 20, yPos);
    yPos += 3; // Space before table

    autoTable(doc, {
        startY: yPos,
        head: [['Produit / Service', 'N° Série / IMEI', 'Durée Garantie']],
        body: warranty.items.map((item: any) => [
            item.productName,
            item.serialNumber || '-',
            item.warrantyPeriod || '-'
        ]),
        theme: 'striped',
        headStyles: { fillColor: [52, 152, 219], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 50 },
            2: { cellWidth: 40 }
        }
    });

    yPos = (doc as any).lastAutoTable.finalY + 6;

    // 2. Dynamic Fields (Details)
    if (warranty.templateId && warranty.templateId.fields?.length > 0) {

        // Check page break before header
        if (yPos > doc.internal.pageSize.height - 40) {
            doc.addPage();
            yPos = 20;
        }

        yPos = addSectionHeader('DÉTAILS DE LA GARANTIE', yPos);

        doc.setFontSize(10);

        warranty.templateId.fields.forEach((field: any) => {
            const value = warranty.data?.[field.id] !== undefined ? String(warranty.data[field.id]) : '-';

            const pageHeight = doc.internal.pageSize.height;
            const margin = 20;

            // Simple check for basic single line fields
            if (yPos > pageHeight - margin) {
                doc.addPage();
                yPos = margin;
            }

            doc.setFont('helvetica', 'bold');
            doc.setTextColor(80, 80, 80);
            doc.text(`${field.label}`, 25, yPos);

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);

            // Handle Multi-line values
            const splitValue = doc.splitTextToSize(value, pageWidth - 100);

            // If value is multi-line, it might span pages
            if (splitValue.length > 1) {
                splitValue.forEach((line: string, i: number) => {
                    if (yPos > pageHeight - margin) {
                        doc.addPage();
                        yPos = margin;
                    }
                    doc.text(line, 80, yPos);
                    yPos += 5;
                });
                yPos += 2; // Extra paragraph spacing
            } else {
                // Single line
                doc.text(value, 80, yPos);
                yPos += 6; // Compact field spacing
            }
        });

        yPos += 5;
    }

    yPos += 5;

    // --- Support for Rich Text Content (Exclusive Advantages & Condition Terms) ---
    const renderRichText = (content: string, title: string) => {
        if (!content || !content.trim()) return;

        // Check page break before title
        if (yPos > doc.internal.pageSize.height - 30) {
            doc.addPage();
            yPos = 20;
        }

        // Render Section Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(47, 95, 255);
        doc.text(title.toUpperCase(), 20, yPos);
        yPos += 8;

        doc.setFontSize(10);
        const maxWidth = pageWidth - 40;
        const margin = 20;
        const currentX = margin;
        const lineHeight = 4.5; // Reduced line height

        // HTML Parser logic
        let processedContent = content.replace(/[\r\n]+/g, ' ');

        processedContent = processedContent.replace(/<ol[^>]*>(.*?)<\/ol>/gi, (match: string, inner: string) => {
            let count = 1;
            return inner.replace(/<li[^>]*>/gi, () => `\n${count++}. `);
        });

        processedContent = processedContent
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<h[1-6]>/gi, '\n\n')
            .replace(/<\/h[1-6]>/gi, '\n')
            .replace(/<ul>/gi, '\n')
            .replace(/<\/ul>/gi, '\n')
            .replace(/<li[^>]*>/gi, '\n• ')
            .replace(/<\/li>/gi, '')
            .replace(/<\/ol>/gi, '\n')
            .replace(/&nbsp;/g, ' ');

        processedContent = processedContent
            .replace(/<strong[^>]*>/gi, '<strong>')
            .replace(/<b[^>]*>/gi, '<b>')
            .replace(/<span[^>]*>/gi, '')
            .replace(/<\/span>/gi, '');

        processedContent = processedContent.replace(/<(?!\/?(b|strong))[^>]+>/gi, '');

        processedContent = processedContent
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');

        const paragraphs = processedContent.split('\n');
        doc.setTextColor(80, 80, 80);

        paragraphs.forEach((paragraph: string) => {
            if (!paragraph.trim()) {
                return;
            }

            if (yPos > doc.internal.pageSize.height - margin) {
                doc.addPage();
                yPos = margin;
            }

            const parts = paragraph.split(/(<\/?(?:b|strong)>)/g);
            let isBold = false;
            let currentLineWords: { text: string, bold: boolean, width: number }[] = [];
            let currentLineWidth = 0;

            parts.forEach(part => {
                if (part.match(/<(b|strong)>/)) {
                    isBold = true;
                } else if (part.match(/<\/(b|strong)>/)) {
                    isBold = false;
                } else {
                    const text = part.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
                    doc.setFont('helvetica', isBold ? 'bold' : 'normal');

                    const words = text.split(' ');
                    words.forEach((word, i) => {
                        const wordWithSpace = (i === 0 && text.startsWith(' ') ? ' ' : '') + word + (i < words.length - 1 || text.endsWith(' ') ? ' ' : '');
                        const wordWidth = doc.getTextWidth(wordWithSpace);

                        if (currentLineWidth + wordWidth > maxWidth) {
                            let x = currentX;
                            currentLineWords.forEach(w => {
                                doc.setFont('helvetica', w.bold ? 'bold' : 'normal');
                                doc.text(w.text, x, yPos);
                                x += w.width;
                            });
                            yPos += lineHeight;

                            if (yPos > doc.internal.pageSize.height - margin) {
                                doc.addPage();
                                yPos = margin;
                            }

                            currentLineWords = [];
                            currentLineWidth = 0;
                            const trimmedWord = wordWithSpace.trimStart();
                            const trimmedWidth = doc.getTextWidth(trimmedWord);
                            currentLineWords.push({ text: trimmedWord, bold: isBold, width: trimmedWidth });
                            currentLineWidth = trimmedWidth;
                        } else {
                            currentLineWords.push({ text: wordWithSpace, bold: isBold, width: wordWidth });
                            currentLineWidth += wordWidth;
                        }
                    });
                }
            });

            if (currentLineWords.length > 0) {
                let x = currentX;
                currentLineWords.forEach(w => {
                    doc.setFont('helvetica', w.bold ? 'bold' : 'normal');
                    doc.text(w.text, x, yPos);
                    x += w.width;
                });
                yPos += lineHeight;
            }
        });

        yPos += 2; // Significantly reduced spacing after section
    };

    // Render 1. Terms & Conditions (Now First)
    const terms = warranty.content || (warranty.templateId as any)?.content;
    if (terms && terms.replace(/<[^>]*>/g, '').trim()) {
        renderRichText(terms, 'Conditions de garantie');
    }

    // Render 2. Exclusive Advantages (Now Second)
    // Note: ensure we check both the warranty instance and the template
    const advantages = warranty.exclusiveAdvantages || (warranty.templateId as any)?.exclusiveAdvantages;
    if (advantages && advantages.replace(/<[^>]*>/g, '').trim()) {
        renderRichText(advantages, 'Avantages Exclusifs');
    }

    // --- Stamp / Cachet ---
    if (includeStamp && companySettings?.societe?.cachetUrl) {
        // Check if we need a new page for the stamp
        if (yPos > doc.internal.pageSize.height - 40) {
            doc.addPage();
            yPos = 20;
        } else {
            yPos += 10;
        }

        // Draw Cachet
        const stampWidth = 40;
        const stampHeight = 40;
        const stampX = pageWidth - stampWidth - 20; // Right aligned

        try {
            // Assuming cachetUrl is a base64 string or accessible URL
            const format = companySettings.societe.cachetUrl.split(',')[0].split('/')[1].split(';')[0].toUpperCase();
            doc.addImage(companySettings.societe.cachetUrl, format, stampX, yPos, stampWidth, stampHeight, undefined, 'FAST');

            // Add "Signature & Cachet" text above if desired, or just let image speak
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('Signature & Cachet', stampX + (stampWidth / 2), yPos - 2, { align: 'center' });

        } catch (e) {
            console.error('Error adding stamp to PDF', e);
        }
    }

    // Footer (Invoice Style)
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);

        const footerY = pageHeight - 15;
        doc.setDrawColor(220, 220, 220);
        doc.line(10, footerY, pageWidth - 10, footerY);

        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);

        // Build Footer Text
        const footerItems = [];
        if (companySettings?.societe?.adresse) {
            const a = companySettings.societe.adresse;
            footerItems.push([a.rue, a.ville, a.codePostal, a.pays].filter(Boolean).join(', '));
        }
        if (companySettings?.societe?.enTete?.telephone) {
            footerItems.push(`Tél : ${companySettings.societe.enTete.telephone}`);
        }
        if (companySettings?.societe?.enTete?.capitalSocial) {
            footerItems.push(`Capital social : ${companySettings.societe.enTete.capitalSocial}`);
        }
        // Bank
        const banc = companySettings?.societe?.piedPage?.coordonneesBancaires;
        if (banc?.banque || banc?.rib) {
            footerItems.push(`${banc.banque || ''} ${banc.rib ? 'RIB : ' + banc.rib : ''}`);
        }

        if (footerItems.length > 0) {
            doc.text(footerItems.join(' - '), pageWidth / 2, footerY + 6, { align: 'center' });
        }

        // Page Number
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text(`${i} / ${pageCount}`, pageWidth - 10, footerY - 3, { align: 'right' });
    }

    return doc;
};
