import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseStorefront } from "./storefront";

const editionsDir = join(import.meta.dirname, "../../editions");
const withStorefront = readdirSync(editionsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
  .map((entry) => ({ slug: entry.name, edition: JSON.parse(readFileSync(join(editionsDir, entry.name, "edition.json"), "utf8")) as { storefront?: unknown } }))
  .filter((item) => item.edition.storefront);

describe("vitrinas de las ediciones", () => {
  it.each(withStorefront.map((item) => [item.slug, item.edition.storefront]))("la vitrina de %s es válida", (_slug, storefront) => {
    expect(() => parseStorefront(storefront)).not.toThrow();
  });
});
