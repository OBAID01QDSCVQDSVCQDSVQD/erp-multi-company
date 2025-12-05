interface SendNotificationEmailPayload {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Placeholder EmailService used by NotificationService.
 * Currently it just logs to the console to avoid breaking the app
 * when email infrastructure is not configured yet.
 *
 * Later you can replace the implementation to integrate with
 * a real email provider (SMTP, SendGrid, Mailgun, etc.).
 */
const EmailService = {
  async sendNotificationEmail(payload: SendNotificationEmailPayload) {
    // For now, just log the email payload in development.
    // In production, you can plug in a real email sender here.
    if (process.env.NODE_ENV !== 'production') {
      console.log('[EmailService] sendNotificationEmail', payload);
    }
    return;
  },
};

export default EmailService;



