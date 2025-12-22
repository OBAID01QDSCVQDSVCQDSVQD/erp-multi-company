import nodemailer from 'nodemailer';

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

const smtpOptions = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
};

export const sendEmail = async (data: EmailPayload) => {
  const transporter = nodemailer.createTransport({
    ...smtpOptions,
  });

  return await transporter.sendMail({
    from: process.env.SMTP_FROM || '"ERP System" <no-reply@erp.com>',
    ...data,
  });
};

export const sendPasswordResetEmail = async (email: string, token: string, tenantId?: string) => {
  // Use current origin or default
  const origin = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const resetLink = `${origin}/auth/reset-password?token=${token}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4F46E5;">Réinitialisation de mot de passe</h2>
      <p>Vous avez demandé une réinitialisation de votre mot de passe.</p>
      <p>Veuillez cliquer sur le bouton ci-dessous pour définir un nouveau mot de passe :</p>
      <a href="${resetLink}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
        Réinitialiser mon mot de passe
      </a>
      <p style="color: #666; font-size: 14px;">Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.</p>
      <p style="color: #666; font-size: 14px;">Ce lien expirera dans 1 heure.</p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: 'Réinitialisation de mot de passe - ERP',
    html,
  });
};

export const sendVerificationEmail = async (email: string, token: string) => {
  const origin = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  // Point directly to the API route which handles verification and redirects
  const verifyLink = `${origin}/api/auth/verify?token=${token}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4F46E5;">Vérification de votre email</h2>
      <p>Bienvenue sur notre plateforme ERP !</p>
      <p>Veuillez confirmer votre adresse email en cliquant sur le lien ci-dessous :</p>
      <a href="${verifyLink}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
        Vérifier mon email
      </a>
      <p style="color: #666; font-size: 14px;">Si vous n'avez pas créé de compte, vous pouvez ignorer cet email.</p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: 'Vérifiez votre adresse email - ERP',
    html,
  });
};
