import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: config.get<string>('SMTP_HOST', 'localhost'),
      port: config.get<number>('SMTP_PORT', 1025),
      secure: false,
    });
    this.from = config.get<string>('SMTP_FROM', 'no-reply@docmax.local');
  }

  async send(to: string, subject: string, html: string) {
    await this.transporter.sendMail({ from: this.from, to, subject, html });
    this.logger.log(`Email yuborildi: ${to} — "${subject}"`);
  }

  async sendInvite(to: string, fullName: string, acceptUrl: string) {
    await this.send(
      to,
      'DocMax — tashkilotga taklif',
      `<p>Salom, ${fullName}!</p>
       <p>Sizni DocMax tizimiga taklif qilishdi. Quyidagi havola orqali parolingizni o'rnating (72 soat amal qiladi):</p>
       <p><a href="${acceptUrl}">${acceptUrl}</a></p>`,
    );
  }

  async sendPasswordReset(to: string, resetUrl: string) {
    await this.send(
      to,
      'DocMax — parolni tiklash',
      `<p>Parolingizni tiklash uchun quyidagi havolani bosing (1 soat amal qiladi):</p>
       <p><a href="${resetUrl}">${resetUrl}</a></p>
       <p>Agar bu so'rovni siz yubormagan bo'lsangiz, xatni e'tiborsiz qoldiring.</p>`,
    );
  }
}
