import { describe, expect, it } from "vitest";
import {
  getSupabaseAuthStorageKey,
  getSupabaseSessionCookieNames,
  isSupabaseSessionCookie,
} from "./session-cookies";

const productionUrl = "https://abcdefghijklmnopqrst.supabase.co";

describe("Supabase session cookies", () => {
  it("derives the same storage key used by supabase-js", () => {
    expect(getSupabaseAuthStorageKey(productionUrl)).toBe(
      "sb-abcdefghijklmnopqrst-auth-token",
    );
  });

  it("matches the session, chunks and related auth cookies for one project", () => {
    expect(isSupabaseSessionCookie("sb-abcdefghijklmnopqrst-auth-token", productionUrl)).toBe(true);
    expect(isSupabaseSessionCookie("sb-abcdefghijklmnopqrst-auth-token.0", productionUrl)).toBe(true);
    expect(isSupabaseSessionCookie("sb-abcdefghijklmnopqrst-auth-token-code-verifier", productionUrl)).toBe(true);
  });

  it("does not clear cookies from another Supabase project", () => {
    expect(getSupabaseSessionCookieNames([
      "theme",
      "sb-abcdefghijklmnopqrst-auth-token.0",
      "sb-another-project-auth-token",
    ], productionUrl)).toEqual(["sb-abcdefghijklmnopqrst-auth-token.0"]);
  });
});
