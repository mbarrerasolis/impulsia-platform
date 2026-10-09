import type { EmailMessage, EmailProvider } from "./email-provider";

export class MockEmailProvider implements EmailProvider {
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage) {
    this.sent.push(message);
    return { externalMessageId: `mock_email_${this.sent.length}` };
  }
}
