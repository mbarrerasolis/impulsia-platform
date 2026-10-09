// Invita a una persona del equipo interno de una edición: crea el usuario en Supabase Auth con
// invitación por correo (define su contraseña en /auth/set-password) y su perfil con el rol dado.
// Uso: npm run admin:invite -- --slug <edición> --email <correo> --name "<nombre>" [--role owner_admin]
// Lee las credenciales de .impulsia-secrets/<slug>.env y no imprime ningún secreto.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { deploymentPaths, parseEnv, readJson, slugPattern } from "./provisioning-core.mjs";

const internalRoles = ["owner_admin", "sales", "technical", "finance", "support"];

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const slug = argument("slug");
const email = argument("email")?.trim().toLowerCase();
const name = argument("name")?.trim();
const role = argument("role") ?? "owner_admin";
if (!slug || !slugPattern.test(slug)) throw new Error("--slug es obligatorio.");
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("--email debe ser un correo válido.");
if (!name || name.length < 2) throw new Error("--name es obligatorio.");
if (!internalRoles.includes(role)) throw new Error(`--role debe ser ${internalRoles.join(", ")}.`);

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const paths = deploymentPaths(root, slug);
const deployment = readJson(paths.deployment);
const secrets = parseEnv(readFileSync(paths.secrets, "utf8"));
const url = secrets.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = secrets.SUPABASE_SECRET_KEY || secrets.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error(`Faltan NEXT_PUBLIC_SUPABASE_URL y la clave de servicio en .impulsia-secrets/${slug}.env.`);

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const redirectTo = new URL("/auth/set-password", deployment.appUrl).toString();

const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, { redirectTo, data: { display_name: name } });
let userId = invited?.user?.id;
if (inviteError) {
  // Si ya existe, se reutiliza el usuario y sólo se asegura su perfil.
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw new Error(`No se pudo invitar (${inviteError.message}) ni listar usuarios (${listError.message}).`);
  userId = list.users.find((user) => user.email?.toLowerCase() === email)?.id;
  if (!userId) throw new Error(`No se pudo invitar a ${email}: ${inviteError.message}`);
  process.stdout.write(`${email} ya existía en Auth; se actualiza su perfil.\n`);
} else {
  process.stdout.write(`Invitación enviada a ${email} (definirá su contraseña en ${redirectTo}).\n`);
}

const { error: profileError } = await supabase.from("profiles").upsert({ id: userId, role, display_name: name, account_id: null }, { onConflict: "id" });
if (profileError) throw new Error(`Perfil no creado: ${profileError.message}`);
process.stdout.write(`Perfil ${role} listo para ${name} en ${slug}.\n`);
