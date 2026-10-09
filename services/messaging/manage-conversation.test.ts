import { describe, expect, it } from "vitest";
import { manualMessageSchema, updateConversationSchema } from "./manage-conversation";

describe("gestión humana de conversaciones", () => {
  it("acepta asignar y cerrar una conversación", () => {
    expect(updateConversationSchema.parse({
      assignedTo: "70cdd12b-77d0-4b9d-89eb-e5c66f994762",
      status: "closed",
    })).toEqual({
      assignedTo: "70cdd12b-77d0-4b9d-89eb-e5c66f994762",
      status: "closed",
    });
  });

  it("rechaza cambios vacíos o estados fuera del flujo", () => {
    expect(updateConversationSchema.safeParse({}).success).toBe(false);
    expect(updateConversationSchema.safeParse({ status: "qualified" }).success).toBe(false);
  });

  it("normaliza una respuesta manual y limita su tamaño", () => {
    expect(manualMessageSchema.parse({ body: "  Hola  " }).body).toBe("Hola");
    expect(manualMessageSchema.safeParse({ body: "" }).success).toBe(false);
    expect(manualMessageSchema.safeParse({ body: "a".repeat(4097) }).success).toBe(false);
  });
});
