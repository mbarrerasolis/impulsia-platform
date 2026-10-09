import type { Json } from "./database.types";

export function toJson(value: unknown): Json {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) return value.map(toJson);
  if (typeof value === "object") {
    const result: { [key: string]: Json | undefined } = {};
    for (const [key, nested] of Object.entries(value)) {
      if (nested !== undefined) result[key] = toJson(nested);
    }
    return result;
  }
  throw new Error(`El valor ${typeof value} no se puede persistir como JSON.`);
}
