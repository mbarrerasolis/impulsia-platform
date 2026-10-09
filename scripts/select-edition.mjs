// Antes de compilar: si IMPULSIA_EDITION indica una edición, la copia como edición activa
// (config/edition.json). Así cada proyecto de Vercel compila su propio cliente desde el mismo código.
// Sin la variable no hace nada (ImpulsIA y el desarrollo local siguen igual).
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const slug = process.env.IMPULSIA_EDITION?.trim();
if (!slug) process.exit(0);
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`IMPULSIA_EDITION inválido: ${slug}`);

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "editions", slug, "edition.json");
if (!existsSync(source)) throw new Error(`No existe editions/${slug}/edition.json para IMPULSIA_EDITION.`);
if (JSON.parse(readFileSync(source, "utf8")).slug !== slug) throw new Error(`editions/${slug}/edition.json declara otro slug.`);
copyFileSync(source, join(root, "config", "edition.json"));
process.stdout.write(`Edición activa para el build: ${slug}\n`);
