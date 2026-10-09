import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { defaultSolutionCatalog } from "@/domain/config/edition";
import { assistantFallbackReply } from "@/domain/messaging/assistant-guards";
import { currentPricingRules } from "@/domain/pricing/rules";
import { assistantLimits, boundDaysRange, buildAssistantMessages, followUpSkipToken, SalesAssistant, turnFormatGuidance, type AssistantActions, type AssistantModelClient } from "./sales-assistant";

const config = {
  model: "claude-sonnet-5",
  brandName: "ImpulsIA",
  brandDescription: "Automatizamos procesos para pymes.",
  contactEmail: "contacto@impulsialabs.cl",
  locale: "es-CL",
  catalog: defaultSolutionCatalog,
  pricing: currentPricingRules,
};
const usage = { input_tokens: 1_000, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };

const textMessage = (text: string) => ({ content: [{ type: "text", text }], stop_reason: "end_turn", usage }) as unknown as Anthropic.Message;
const toolMessage = (name: string, input: unknown, id = `toolu_${name}`) =>
  ({ content: [{ type: "tool_use", id, name, input }], stop_reason: "tool_use", usage }) as unknown as Anthropic.Message;

function fakeClient(...responses: Anthropic.Message[]) {
  const create = vi.fn<AssistantModelClient["create"]>();
  for (const response of responses) create.mockResolvedValueOnce(response);
  return { create };
}

function fakeActions(): AssistantActions & { registerLead: ReturnType<typeof vi.fn>; requestHandoff: ReturnType<typeof vi.fn>; proposeQuote: ReturnType<typeof vi.fn> } {
  return { registerLead: vi.fn(async () => ({ leadId: "lead_1" })), requestHandoff: vi.fn(async () => {}), proposeQuote: vi.fn(async () => {}) };
}

const scheduling = { timeZone: "America/Santiago", meetingMinutes: 30 };
function schedulingActions() {
  return {
    ...fakeActions(),
    listMeetingSlots: vi.fn(async () => [new Date("2027-01-14T17:00:00.000Z"), new Date("2027-01-15T12:00:00.000Z")]),
    scheduleMeeting: vi.fn(async () => ({ ok: true as const, meetLink: "https://meet.google.com/x" })),
  };
}

const proposal = { nombre_solucion: "Integración ERP + ecommerce", alcance: "Sincronizar pedidos y stock entre Defontana y Shopify.", complejidad: "medium", dias_estimados: 4, costo_terceros_mensual: 0 };

const lastToolResult = (client: ReturnType<typeof fakeClient>, call: number) => {
  const params = client.create.mock.calls[call][0];
  const last = params.messages.at(-1)!;
  const block = (last.content as Anthropic.ToolResultBlockParam[])[0];
  return { ...block, parsed: JSON.parse(block.content as string) };
};

describe("SalesAssistant", () => {
  it("responde en texto con el prompt en caché, esfuerzo bajo y tope de salida", async () => {
    const client = fakeClient(textMessage("¡Hola! ¿Qué proceso te gustaría automatizar?"));
    const result = await new SalesAssistant(client, config).runTurn({ history: [], message: "Hola" }, fakeActions());

    expect(result.reply).toBe("¡Hola! ¿Qué proceso te gustaría automatizar?");
    expect(result.modelCalls).toBe(1);
    expect(result.costUsd).toBeCloseTo((1_000 * 2 + 100 * 10) / 1_000_000);
    const params = client.create.mock.calls[0][0];
    expect(params.model).toBe("claude-sonnet-5");
    expect(params.max_tokens).toBe(assistantLimits.maxOutputTokens);
    expect(params.output_config).toEqual({ effort: "low" });
    expect((params.system as Anthropic.TextBlockParam[])[0].cache_control).toEqual({ type: "ephemeral" });
  });

  it("usa el motor de precios para dar rangos", async () => {
    const client = fakeClient(toolMessage("estimar_precio", { complejidad: "medium", dias_minimos: 3, dias_maximos: 5 }), textMessage("Referencialmente entre $720.000 y $1.200.000."));
    await new SalesAssistant(client, config).runTurn({ history: [], message: "¿Cuánto cuesta integrar mi ERP?" }, fakeActions());

    const toolResult = lastToolResult(client, 1);
    expect(toolResult.is_error).toBeUndefined();
    expect(toolResult.parsed.implementacion).toMatch(/720\.000.*1\.200\.000/);
  });

  it("calcula el impacto con la herramienta en vez de hacerlo de memoria", async () => {
    const client = fakeClient(toolMessage("calcular_impacto", { cantidad_por_dia: 60, minutos_por_unidad: 2, dias_habiles_mes: 22 }), textMessage("Son unas 44 horas al mes."));
    await new SalesAssistant(client, config).runTurn({ history: [], message: "Son 60 exámenes al día" }, fakeActions());

    expect(lastToolResult(client, 1).parsed).toMatchObject({ horas_al_mes: 44, calculo: expect.stringContaining("≈ 44 horas al mes") });
    const context = (client.create.mock.calls[0][0].system as Anthropic.TextBlockParam[])[1].text;
    expect(context).toContain("es tu primera respuesta");
  });

  it("no registra el lead sin consentimiento explícito", async () => {
    const lead = { nombre: "Ana", empresa: "Demo SpA", email: "ana@demo.cl", necesidad: "Conciliar pagos", objetivo: "Ahorrar tiempo", sistemas: [], interes: "medio" };
    const client = fakeClient(toolMessage("registrar_lead", { ...lead, consentimiento_explicito: false }), textMessage("¿Autorizas que te contactemos?"));
    const actions = fakeActions();
    const result = await new SalesAssistant(client, config).runTurn({ history: [], message: "Soy Ana de Demo SpA" }, actions);

    expect(actions.registerLead).not.toHaveBeenCalled();
    expect(lastToolResult(client, 1).is_error).toBe(true);
    expect(result.leadCreated).toBe(false);
  });

  it("registra el lead con consentimiento y no lo duplica", async () => {
    const lead = { nombre: "Ana", empresa: "Demo SpA", email: "Ana@Demo.cl", necesidad: "Conciliar pagos", objetivo: "Ahorrar tiempo", sistemas: ["Defontana"], interes: "alto", consentimiento_explicito: true };
    const client = fakeClient(toolMessage("registrar_lead", lead, "a"), toolMessage("registrar_lead", lead, "b"), textMessage("¡Listo, Ana!"));
    const actions = fakeActions();
    const result = await new SalesAssistant(client, config).runTurn({ history: [], message: "Sí, autorizo" }, actions);

    expect(actions.registerLead).toHaveBeenCalledTimes(1);
    expect(actions.registerLead).toHaveBeenCalledWith(expect.objectContaining({ email: "ana@demo.cl", systems: ["Defontana"], interest: "alto" }));
    expect(lastToolResult(client, 2).parsed).toEqual({ ok: true, ya_registrado: true });
    expect(result).toMatchObject({ leadId: "lead_1", leadCreated: true, reply: "¡Listo, Ana!" });
  });

  it("deriva a una persona cuando el modelo lo decide", async () => {
    const client = fakeClient(toolMessage("derivar_a_humano", { motivo: "Quiere negociar descuento", prioridad: "alta" }), textMessage("Te contactará una persona del equipo."));
    const actions = fakeActions();
    const result = await new SalesAssistant(client, config).runTurn({ history: [], message: "¿Me hacen descuento?" }, actions);

    expect(actions.requestHandoff).toHaveBeenCalledWith({ reason: "Quiere negociar descuento", priority: "alta" });
    expect(result.handoff).toEqual({ reason: "Quiere negociar descuento", priority: "alta" });
  });

  it("corta el loop de herramientas y deriva con respuesta fija", async () => {
    const loop = Array.from({ length: assistantLimits.maxModelCalls + 2 }, (_, index) => toolMessage("estimar_precio", { complejidad: "standard", dias_minimos: 1, dias_maximos: 2 }, `t${index}`));
    const client = fakeClient(...loop);
    const actions = fakeActions();
    const result = await new SalesAssistant(client, config).runTurn({ history: [], message: "Hola" }, actions);

    expect(client.create).toHaveBeenCalledTimes(assistantLimits.maxModelCalls);
    expect(result.reply).toBe(assistantFallbackReply);
    expect(actions.requestHandoff).toHaveBeenCalledTimes(1);
  });

  it("no propone cotización sin prospecto registrado", async () => {
    const client = fakeClient(toolMessage("proponer_cotizacion", proposal), textMessage("Primero necesito tus datos."));
    const actions = fakeActions();
    const result = await new SalesAssistant(client, config).runTurn({ history: [], message: "Quiero la cotización" }, actions);

    expect(actions.proposeQuote).not.toHaveBeenCalled();
    expect(lastToolResult(client, 1).is_error).toBe(true);
    expect(result.quoteProposal).toBeNull();
  });

  it("envía la propuesta al equipo con la referencia del motor de precios", async () => {
    const client = fakeClient(toolMessage("proponer_cotizacion", proposal), textMessage("Un asesor revisará tu cotización."));
    const actions = fakeActions();
    const result = await new SalesAssistant(client, config).runTurn({ history: [], message: "Quiero la cotización formal", existingLeadId: "lead_9" }, actions);

    expect(actions.proposeQuote).toHaveBeenCalledWith(expect.objectContaining({ leadId: "lead_9", name: "Integración ERP + ecommerce", estimatedDays: 4, complexity: "medium" }));
    expect(result.quoteProposal).toMatchObject({ estimatedDays: 4, implementationEstimate: 960_000 });
    expect(result.quoteProposal!.monthlyMaintenanceEstimate).toBeGreaterThan(0);
    expect(lastToolResult(client, 1).parsed.ok).toBe(true);
  });

  it("respeta el tope de propuestas por conversación", async () => {
    const client = fakeClient(toolMessage("proponer_cotizacion", proposal), textMessage("Te derivo con una persona."));
    const actions = fakeActions();
    const result = await new SalesAssistant(client, config).runTurn({ history: [], message: "Cámbiala", existingLeadId: "lead_9", quoteProposalsSent: assistantLimits.maxQuoteProposalsPerConversation }, actions);

    expect(actions.proposeQuote).not.toHaveBeenCalled();
    expect(lastToolResult(client, 1).is_error).toBe(true);
    expect(result.quoteProposal).toBeNull();
  });

  it("sólo ofrece herramientas de agenda si está activa", async () => {
    const client = fakeClient(textMessage("Hola"), textMessage("Hola"));
    await new SalesAssistant(client, config).runTurn({ history: [], message: "Hola" }, fakeActions());
    await new SalesAssistant(client, { ...config, scheduling }).runTurn({ history: [], message: "Hola" }, schedulingActions());

    const toolNames = (call: number) => client.create.mock.calls[call][0].tools!.map((tool) => (tool as Anthropic.Tool).name);
    expect(toolNames(0)).not.toContain("agendar_reunion");
    expect(toolNames(1)).toEqual(expect.arrayContaining(["ver_horarios_disponibles", "agendar_reunion"]));
  });

  it("ofrece horarios reales en hora de Chile", async () => {
    const client = fakeClient(toolMessage("ver_horarios_disponibles", {}), textMessage("¿Te acomoda el jueves a las 14:00?"));
    await new SalesAssistant(client, { ...config, scheduling }).runTurn({ history: [], message: "¿Podemos juntarnos?" }, schedulingActions());

    const parsed = lastToolResult(client, 1).parsed;
    expect(parsed.horarios[0]).toEqual({ id: "2027-01-14T17:00:00.000Z", texto: expect.stringMatching(/jueves.*14:00/) });
  });

  it("agenda sólo con prospecto registrado y horario confirmado", async () => {
    const booking = { inicio: "2027-01-14T17:00:00.000Z", tema: "Diagnóstico ERP" };
    const client = fakeClient(
      toolMessage("agendar_reunion", { ...booking, confirmado_por_cliente: true }, "a"),
      toolMessage("agendar_reunion", { ...booking, confirmado_por_cliente: false }, "b"),
      textMessage("Necesito tus datos."),
    );
    const actions = schedulingActions();
    await new SalesAssistant(client, { ...config, scheduling }).runTurn({ history: [], message: "El jueves 14:00" }, actions);
    expect(actions.scheduleMeeting).not.toHaveBeenCalled();

    const ok = fakeClient(toolMessage("agendar_reunion", { ...booking, confirmado_por_cliente: true }), textMessage("¡Agendado!"));
    const result = await new SalesAssistant(ok, { ...config, scheduling }).runTurn({ history: [], message: "Sí, el jueves 14:00", existingLeadId: "lead_9" }, actions);
    expect(actions.scheduleMeeting).toHaveBeenCalledWith({ leadId: "lead_9", start: new Date(booking.inicio), topic: "Diagnóstico ERP" });
    expect(result.meeting).toEqual({ start: booking.inicio, topic: "Diagnóstico ERP", meetLink: "https://meet.google.com/x" });
    expect(lastToolResult(ok, 1).parsed.fecha).toMatch(/jueves/);
  });

  it("pide otro horario si el elegido se ocupó y respeta el tope de reuniones", async () => {
    const booking = { inicio: "2027-01-14T17:00:00.000Z", tema: "Diagnóstico ERP", confirmado_por_cliente: true };
    const busyActions = { ...schedulingActions(), scheduleMeeting: vi.fn(async () => ({ ok: false as const, reason: "busy" as const })) };
    const client = fakeClient(toolMessage("agendar_reunion", booking), textMessage("Ese horario se ocupó."));
    const result = await new SalesAssistant(client, { ...config, scheduling }).runTurn({ history: [], message: "Sí", existingLeadId: "lead_9" }, busyActions);
    expect(lastToolResult(client, 1).parsed.error).toMatch(/ocupó/);
    expect(result.meeting).toBeNull();

    const actions = schedulingActions();
    const limited = fakeClient(toolMessage("agendar_reunion", booking), textMessage("Te derivo."));
    await new SalesAssistant(limited, { ...config, scheduling }).runTurn({ history: [], message: "Otra reunión", existingLeadId: "lead_9", meetingsScheduled: 1 }, actions);
    expect(actions.scheduleMeeting).not.toHaveBeenCalled();
  });

  it("deriva si el modelo rechaza responder", async () => {
    const refusal = { content: [], stop_reason: "refusal", usage } as unknown as Anthropic.Message;
    const result = await new SalesAssistant(fakeClient(refusal), config).runTurn({ history: [], message: "..." }, fakeActions());
    expect(result.reply).toBe(assistantFallbackReply);
    expect(result.handoff).not.toBeNull();
  });
});

describe("buildAssistantMessages", () => {
  it("adjunta imágenes y PDF al último turno del cliente, antes del texto", () => {
    const messages = buildAssistantMessages(
      [{ direction: "inbound", body: "[Imagen] así lo hacemos hoy" }],
      "¿Se puede automatizar?",
      [{ kind: "image", mediaType: "image/png", data: "aW1n" }, { kind: "unreadable", description: "video (no puedes ver videos)" }],
    );
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toEqual([
      { type: "image", source: { type: "base64", media_type: "image/png", data: "aW1n" } },
      { type: "text", text: "[Archivo que no pudiste abrir: video (no puedes ver videos)]" },
      { type: "text", text: "[Imagen] así lo hacemos hoy\n¿Se puede automatizar?" },
    ]);
  });

  it("indica al modelo cuándo su respuesta saldrá como nota de voz", () => {
    expect(turnFormatGuidance({ replyFormat: "voice" })).toContain("nota de voz");
    expect(turnFormatGuidance({ attachments: [{ kind: "pdf", data: "x" }] })).toContain("un archivo");
    expect(turnFormatGuidance({})).toBe("");
  });

  it("parte con el usuario, une mensajes seguidos y recorta textos largos", () => {
    const messages = buildAssistantMessages([
      { direction: "outbound", body: "Mensaje previo del equipo" },
      { direction: "inbound", body: "Hola" },
      { direction: "inbound", body: "¿Están?" },
      { direction: "outbound", body: "¡Hola!" },
    ], "x".repeat(5_000));

    expect(messages.map((message) => message.role)).toEqual(["user", "assistant", "user"]);
    expect(messages[0].content).toBe("Hola\n¿Están?");
    expect((messages[2].content as string).length).toBe(assistantLimits.maxInputChars + 1);
  });
});

describe("boundDaysRange", () => {
  it("ordena el rango y recorta el máximo a 1,5 veces el mínimo o mínimo + 2", () => {
    expect(boundDaysRange(8, 20)).toEqual({ minDays: 8, maxDays: 12 });
    expect(boundDaysRange(10, 4)).toEqual({ minDays: 4, maxDays: 6 });
    expect(boundDaysRange(1, 5)).toEqual({ minDays: 1, maxDays: 3 });
    expect(boundDaysRange(3, 4)).toEqual({ minDays: 3, maxDays: 4 });
  });
});

describe("SalesAssistant.writeFollowUp", () => {
  const history = [
    { direction: "inbound" as const, body: "Hola, tengo una consulta médica y quiero recordatorios por WhatsApp" },
    { direction: "outbound" as const, body: "¡Buenísimo! ¿Cuántos pacientes atiendes al día?" },
  ];

  it("redacta un seguimiento sin herramientas y termina con un turno del cliente", async () => {
    const client = fakeClient(textMessage("¿Pudiste ver lo de los recordatorios? Si te tinca, lo vemos en una videollamada corta."));
    const result = await new SalesAssistant(client, { ...config, scheduling }).writeFollowUp({ history, minutesSilent: 42, leadRegistered: false });
    expect(result.reply).toContain("videollamada");
    expect(result.costUsd).toBeGreaterThan(0);
    const params = client.create.mock.calls[0][0];
    expect(params.tools).toBeUndefined();
    expect(params.messages.at(-1)?.role).toBe("user");
    expect(JSON.stringify(params.system)).toContain("42 minutos");
  });

  it("no envía nada si el modelo decide que la conversación terminó", async () => {
    const client = fakeClient(textMessage(followUpSkipToken));
    const result = await new SalesAssistant(client, config).writeFollowUp({ history, minutesSilent: 40, leadRegistered: true });
    expect(result.reply).toBeNull();
  });
});
