import type { EmailMessage, EmailProvider } from "./email-provider";

const RESEND_API_URL = "https://api.resend.com/emails";

export class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly config: { apiKey: string; from: string },
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async send(message: EmailMessage) {
    const response = await this.fetchImpl(RESEND_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: this.config.from,
        to: [message.to],
        ...(message.cc?.length ? { cc: message.cc } : {}),
        subject: message.subject,
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {})
      })
    });
    if (!response.ok) {
      throw new Error(`Resend respondió ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }
    const body = await response.json() as { id?: string };
    if (!body.id) throw new Error("Resend no devolvió id de mensaje.");
    return { externalMessageId: body.id };
  }
}
