export interface EmailMessage {
  to: string;
  cc?: string[];
  subject: string;
  text: string;
  replyTo?: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<{ externalMessageId: string }>;
}
