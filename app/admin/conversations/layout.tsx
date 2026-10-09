import { requireModule } from "@/lib/business";

/** Bandeja de WhatsApp y asistente con IA. */
export default function WhatsappModuleLayout({ children }: { children: React.ReactNode }) {
  requireModule("whatsapp");
  return children;
}
