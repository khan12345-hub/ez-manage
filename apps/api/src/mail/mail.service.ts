import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import 'dotenv/config';
import { notificationEmailTemplate } from './templates/comment-mention.template';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  private transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    secure: process.env.MAIL_SECURE === 'true',
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASSWORD,
    },
  });

  async sendMail(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }) {
    try {
      const info = await this.transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.MAIL_USER,
        to: options.to,
        subject: options.subject,
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

    if (metadata?.boardId) {
      return `${baseUrl}/boards/${metadata.boardId}`;
    }

    if (metadata?.taskId) {
      return `${baseUrl}/tasks/${metadata.taskId}`;
    }

    return baseUrl;
  }
}
