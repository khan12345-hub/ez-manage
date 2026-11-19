import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import 'dotenv/config';
import { notificationEmailTemplate } from './templates/comment-mention.template';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  private readonly isConfigured =
    !!process.env.MAIL_HOST &&
    !!process.env.MAIL_PORT &&
    !!process.env.MAIL_USER &&
    !!process.env.MAIL_PASSWORD;

  private transporter = this.isConfigured
    ? nodemailer.createTransport({
        host: process.env.MAIL_HOST,
        port: Number(process.env.MAIL_PORT),
        secure: process.env.MAIL_SECURE === 'true',
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASSWORD,
        },
      })
    : null;

  async sendMail(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }) {
    if (!this.isConfigured || !this.transporter) {
      this.logger.warn('Mail not configured — skipping email send');
      return null;
    }
    // Staging safety (both empty on live):
    //  MAIL_REDIRECT_TO=qa@company.com → every email goes to that one inbox instead of the real person
    //  MAIL_ALLOW_ONLY=company.com,example.test → only these domains / addresses get email, others are skipped
    let to = options.to;
    let subject = options.subject;
    const redirect = process.env.MAIL_REDIRECT_TO?.trim();
    const allow = (process.env.MAIL_ALLOW_ONLY ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (redirect) {
      subject = `[to ${options.to}] ${options.subject}`;
      to = redirect;
    } else if (allow.length) {
      const ok = String(options.to).split(',').map((a) => a.trim().toLowerCase()).filter((a) => allow.some((x) => a === x || a.endsWith(`@${x}`)));
      if (!ok.length) {
        this.logger.warn(`Mail skipped (MAIL_ALLOW_ONLY): ${String(options.to).replace(/(.).*@/, '$1***@')}`);
        return null;
      }
      to = ok.join(', ');
    }
    try {
      const info = await this.transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.MAIL_USER,
        to,
        subject,
        text: options.text,
        html: options.html,
      });

      this.logger.log(`Email sent: ${info.messageId}`);

      return info;
    } catch (error) {
      this.logger.error('Failed to send email', error);
      throw error;
    }
  }

  async sendNotificationEmail(params: {
    to: string;
    subject: string;
    title: string;
    message: string;
    metadata?: Record<string, any>;
  }) {
    const notificationUrl = this.getNotificationUrl(params.metadata);
    const template = notificationEmailTemplate(
      params.to,
      params.subject,
      params.title,
      params.message,
      notificationUrl,
    );
    return this.sendMail({
      to: template.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  private getNotificationUrl(metadata?: Record<string, any>): string {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    if (metadata?.workspaceId && metadata?.boardId) {
      return `${baseUrl}/workspace/${metadata.workspaceId}/board/${metadata.boardId}`;
    }

    if (metadata?.workspaceId) {
      return `${baseUrl}/workspace/${metadata.workspaceId}`;
    }

    return `${baseUrl}/dashboard`;
  }
}
