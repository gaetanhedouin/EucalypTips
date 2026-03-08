import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';

interface EmailInput {
  to: string;
  subject: string;
  text: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly mode: 'mock' | 'smtp';
  private readonly transporter: Transporter | null;
  private readonly fromAddress: string;

  constructor() {
    const requestedMode =
      (process.env.EMAIL_MODE as 'mock' | 'smtp' | undefined) ??
      (process.env.NODE_ENV === 'production' ? 'smtp' : 'mock');
    this.fromAddress = process.env.SMTP_FROM ?? 'no-reply@eucanalyptips.local';

    if (requestedMode === 'smtp') {
      const host = process.env.SMTP_HOST;
      const port = Number(process.env.SMTP_PORT ?? 587);
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;
      const hasPlaceholderCreds =
        (user ?? '').includes('TON_EMAIL') ||
        (pass ?? '').includes('TON_MOT_DE_PASSE');

      if (!host || !Number.isFinite(port) || !user || !pass || hasPlaceholderCreds) {
        this.transporter = null;
        this.mode = 'mock';
        this.logger.warn(
          'SMTP config missing/placeholder, fallback to EMAIL_MODE=mock. Fill SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS with real values to enable real email.',
        );
        return;
      }

      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      this.mode = 'smtp';
      return;
    }

    this.mode = 'mock';
    this.transporter = null;
  }

  async sendVerificationEmail(input: { to: string; name: string; verifyUrl: string }): Promise<void> {
    await this.sendEmail({
      to: input.to,
      subject: 'Verification de ton email EucAnalypTips',
      text: `Bonjour ${input.name},\n\nConfirme ton email en cliquant ici : ${input.verifyUrl}\n\nCe lien expire dans 24h.`,
    });
  }

  async sendResetPasswordEmail(input: { to: string; name: string; resetUrl: string }): Promise<void> {
    await this.sendEmail({
      to: input.to,
      subject: 'Reinitialisation du mot de passe EucAnalypTips',
      text: `Bonjour ${input.name},\n\nReinitialise ton mot de passe ici : ${input.resetUrl}\n\nCe lien expire dans 1h.`,
    });
  }

  isMockMode(): boolean {
    return this.mode === 'mock';
  }

  private async sendEmail(input: EmailInput): Promise<void> {
    try {
      if (this.mode === 'mock') {
        this.logger.log(`[EMAIL MOCK] to=${input.to} subject="${input.subject}" body="${input.text.replace(/\n/g, ' ')}"`);
        return;
      }

      if (!this.transporter) {
        throw new Error('SMTP transporter is not configured');
      }

      await this.transporter.sendMail({
        from: this.fromAddress,
        to: input.to,
        subject: input.subject,
        text: input.text,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`SMTP send failed, fallback to mock log: ${message}`);
      this.logger.log(`[EMAIL MOCK] to=${input.to} subject="${input.subject}" body="${input.text.replace(/\n/g, ' ')}"`);
    }
  }
}
