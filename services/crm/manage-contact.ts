import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const contactRoleSchema = z.enum(["commercial", "billing", "technical", "administrative", "management"]);

export const createContactSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.email(),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  jobTitle: z.string().trim().max(120).optional().or(z.literal("")),
  roles: z.array(contactRoleSchema).min(1, "Selecciona al menos un rol."),
  isPrimaryBilling: z.boolean().default(false),
});

export const updateContactSchema = z.object({
  roles: z.array(contactRoleSchema).min(1, "Selecciona al menos un rol."),
  isPrimaryBilling: z.boolean(),
  isActive: z.boolean(),
});

export class ManageContactService {
  async create(accountId: string, input: unknown) {
    const command = createContactSchema.parse(input);
    const client = await createSupabaseServerClient();

    if (command.isPrimaryBilling) {
      const clear = await client.from("contacts").update({ is_primary_billing: false }).eq("account_id", accountId);
      if (clear.error) throw new Error(`No fue posible actualizar el contacto de facturación previo: ${clear.error.message}`);
    }

    const { data: contact, error } = await client
      .from("contacts")
      .insert({
        account_id: accountId,
        first_name: command.firstName,
        last_name: command.lastName,
        email: command.email,
        phone: command.phone || null,
        job_title: command.jobTitle || null,
        is_primary_billing: command.isPrimaryBilling,
      })
      .select("id")
      .single();
    if (error || !contact) throw new Error(`No fue posible crear el contacto: ${error?.message ?? "sin respuesta"}`);

    const { error: rolesError } = await client.from("contact_roles").insert(command.roles.map((role) => ({ contact_id: contact.id, role })));
    if (rolesError) throw new Error(`No fue posible asignar los roles: ${rolesError.message}`);

    return { id: contact.id as string };
  }

  async update(contactId: string, accountId: string, input: unknown) {
    const command = updateContactSchema.parse(input);
    const client = await createSupabaseServerClient();

    if (command.isPrimaryBilling) {
      const clear = await client.from("contacts").update({ is_primary_billing: false }).eq("account_id", accountId).neq("id", contactId);
      if (clear.error) throw new Error(`No fue posible actualizar el contacto de facturación previo: ${clear.error.message}`);
    }

    const { error } = await client
      .from("contacts")
      .update({ is_primary_billing: command.isPrimaryBilling, is_active: command.isActive })
      .eq("id", contactId);
    if (error) throw new Error(`No fue posible actualizar el contacto: ${error.message}`);

    const { error: deleteError } = await client.from("contact_roles").delete().eq("contact_id", contactId);
    if (deleteError) throw new Error(`No fue posible actualizar los roles: ${deleteError.message}`);

    const { error: insertError } = await client.from("contact_roles").insert(command.roles.map((role) => ({ contact_id: contactId, role })));
    if (insertError) throw new Error(`No fue posible actualizar los roles: ${insertError.message}`);
  }
}
