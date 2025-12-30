import nodemailer from 'nodemailer';

interface EmailAttachment {
    filename: string;
    content: Buffer;
}

interface EmailOptions {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    attachments?: EmailAttachment[];
}

export class EmailService {
    private static transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD, // Updated to match user's .env
        },
    });

    /**
     * Send an invoice via email
     */
    static async sendInvoiceEmail(to: string, invoiceNumber: string, pdfBuffer: Buffer, companyName: string) {
        // Basic validation
        if (!to || !to.includes('@')) {
            throw new Error("L'adresse email du destinataire est invalide.");
        }

        if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
            console.warn('SMTP configuration missing (Host, User or Password). Email will not be sent.');
            throw new Error("Configuration SMTP incomplète (Vérifiez .env.local).");
        }

        const subject = `Votre facture ${invoiceNumber} de ${companyName}`;
        const html = `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2>Bonjour,</h2>
        <p>Veuillez trouver ci-joint votre facture n° <strong>${invoiceNumber}</strong> émise par <strong>${companyName}</strong>.</p>
        <p>Nous vous remercions de votre confiance.</p>
        <br />
        <p>Cordialement,</p>
        <p><strong>${companyName}</strong></p>
      </div>
    `;

        try {
            await this.transporter.sendMail({
                from: `"${companyName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
                to,
                subject,
                html,
                attachments: [
                    {
                        filename: `Facture-${invoiceNumber}.pdf`,
                        content: pdfBuffer,
                        contentType: 'application/pdf',
                    },
                ],
            });
            console.log(`Email sent successfully to ${to} for invoice ${invoiceNumber}`);
            return { success: true };
        } catch (error: any) {
            console.error('Error sending email:', error);
            throw new Error(`Erreur lors de l'envoi de l'email: ${error.message}`);
        }
    }

    /**
     * Send a quote via email
     */
    static async sendQuoteEmail(to: string, quoteNumber: string, pdfBuffer: Buffer, companyName: string) {
        // Basic validation
        if (!to || !to.includes('@')) {
            throw new Error("L'adresse email du destinataire est invalide.");
        }

        if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
            console.warn('SMTP configuration missing (Host, User or Password). Email will not be sent.');
            throw new Error("Configuration SMTP incomplète (Vérifiez .env.local).");
        }

        const subject = `Votre devis ${quoteNumber} de ${companyName}`;
        const html = `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2>Bonjour,</h2>
        <p>Veuillez trouver ci-joint votre devis n° <strong>${quoteNumber}</strong> émis par <strong>${companyName}</strong>.</p>
        <p>N'hésitez pas à nous contacter pour toute question.</p>
        <br />
        <p>Cordialement,</p>
        <p><strong>${companyName}</strong></p>
      </div>
    `;

        try {
            await this.transporter.sendMail({
                from: `"${companyName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
                to,
                subject,
                html,
                attachments: [
                    {
                        filename: `Devis-${quoteNumber}.pdf`,
                        content: pdfBuffer,
                        contentType: 'application/pdf',
                    },
                ],
            });
            console.log(`Email sent successfully to ${to} for quote ${quoteNumber}`);
            return { success: true };
        } catch (error: any) {
            console.error('Error sending quote email:', error);
            throw new Error(`Erreur lors de l'envoi de l'email: ${error.message}`);
        }
    }

    /**
     * Send a delivery note via email
     */
    static async sendDeliveryEmail(to: string, deliveryNumber: string, pdfBuffer: Buffer, companyName: string) {
        // Basic validation
        if (!to || !to.includes('@')) {
            throw new Error("L'adresse email du destinataire est invalide.");
        }

        if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
            console.warn('SMTP configuration missing (Host, User or Password). Email will not be sent.');
            throw new Error("Configuration SMTP incomplète (Vérifiez .env.local).");
        }

        const subject = `Bon de livraison ${deliveryNumber} de ${companyName}`;
        const html = `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2>Bonjour,</h2>
        <p>Veuillez trouver ci-joint votre bon de livraison n° <strong>${deliveryNumber}</strong> émis par <strong>${companyName}</strong>.</p>
        <p>Nous vous remercions de votre confiance.</p>
        <br />
        <p>Cordialement,</p>
        <p><strong>${companyName}</strong></p>
      </div>
    `;

        try {
            await this.transporter.sendMail({
                from: `"${companyName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
                to,
                subject,
                html,
                attachments: [
                    {
                        filename: `Bon-de-livraison-${deliveryNumber}.pdf`,
                        content: pdfBuffer,
                        contentType: 'application/pdf',
                    },
                ],
            });
            console.log(`Email sent successfully to ${to} for delivery ${deliveryNumber}`);
            return { success: true };
        } catch (error: any) {
            console.error('Error sending delivery email:', error);
            throw new Error(`Erreur lors de l'envoi de l'email: ${error.message}`);
        }
    }
}
