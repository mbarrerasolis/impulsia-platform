import { describe, expect, it } from "vitest";
import { createPageResult, normalizePageRequest, parsePage } from "./pagination";

describe("pagination", () => {
  it("normaliza páginas inválidas y limita el tamaño máximo", () => {
    expect(parsePage("0")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage(["3", "4"])).toBe(3);
    expect(normalizePageRequest({ page: 3, pageSize: 500 })).toMatchObject({ page: 3, pageSize: 100, from: 200, to: 299 });
  });

  it("calcula el total de páginas sin producir una página cero", () => {
    expect(createPageResult([], 0, 1, 20).totalPages).toBe(1);
    expect(createPageResult([1], 41, 2, 20)).toMatchObject({ page: 2, total: 41, totalPages: 3 });
  });
});
