import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { FLOW_STATUS_MAP, signFlowParams } from "./flow-payment-provider";

describe("signFlowParams", () => {
  it("concatena claves ordenadas alfabéticamente sin separadores, tal como documenta developers.flow.cl", () => {
    const params = { amount: 5000, apiKey: "XXXX-XXXX-XXXX", currency: "CLP" };
    const expected = createHmac("sha256", "secret").update("amount5000apiKeyXXXX-XXXX-XXXXcurrencyCLP").digest("hex");
    expect(signFlowParams(params, "secret")).toBe(expected);
  });

  it("ignora el orden de inserción del objeto de entrada", () => {
    const inOrder = signFlowParams({ b: 2, a: 1 }, "secret");
    const reversed = signFlowParams({ a: 1, b: 2 }, "secret");
    expect(inOrder).toBe(reversed);
  });

  it("cambia si cambia cualquier valor", () => {
    const original = signFlowParams({ amount: 5000 }, "secret");
    const changed = signFlowParams({ amount: 5001 }, "secret");
    expect(original).not.toBe(changed);
  });
});

describe("FLOW_STATUS_MAP", () => {
  it("mapea los cuatro códigos documentados por Flow", () => {
    expect(FLOW_STATUS_MAP[1]).toBe("pending");
    expect(FLOW_STATUS_MAP[2]).toBe("approved");
    expect(FLOW_STATUS_MAP[3]).toBe("rejected");
    expect(FLOW_STATUS_MAP[4]).toBe("cancelled");
  });
});
