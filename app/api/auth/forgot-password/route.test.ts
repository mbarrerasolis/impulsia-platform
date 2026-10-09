import { beforeEach, describe, expect, it, vi } from "vitest";

const resetPasswordForEmail = vi.fn();

vi.mock("@/lib/env", () => ({ getServerEnv: () => ({ APP_MODE: "supabase" }) }));
vi.mock("@/lib/site-url", () => ({
  getPasswordResetRedirectUrl: () => new URL("https://impulsialabs.cl/auth/set-password"),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { resetPasswordForEmail } }),
}));

import { POST } from "./route";

describe("password recovery endpoint", () => {
  beforeEach(() => resetPasswordForEmail.mockReset());

  it("solicita un enlace con el retorno oficial y responde sin revelar la cuenta", async () => {
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    const response = await POST(new Request("https://impulsialabs.cl/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "persona@empresa.cl" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: "Si el email está registrado, recibirás un enlace para recuperar tu acceso.",
    });
    expect(resetPasswordForEmail).toHaveBeenCalledWith("persona@empresa.cl", {
      redirectTo: "https://impulsialabs.cl/auth/set-password",
    });
  });

  it("rechaza emails inválidos antes de llamar al proveedor", async () => {
    const response = await POST(new Request("https://impulsialabs.cl/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "no-es-un-email" }),
    }));

    expect(response.status).toBe(400);
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });
});
