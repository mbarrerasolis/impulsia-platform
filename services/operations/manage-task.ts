import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const taskStatusSchema = z.enum(["pending", "in_progress", "done", "blocked"]);

export const createTaskSchema = z.object({
  title: z.string().trim().min(2).max(200),
  assignee: z.string().trim().min(1).optional().or(z.literal("")),
  estimateHours: z.number().positive().max(10_000).optional(),
  dueDate: z.string().trim().min(1).optional().or(z.literal("")),
});

export const updateTaskSchema = z.object({
  status: taskStatusSchema,
  assignee: z.string().trim().min(1).optional().or(z.literal("")),
  actualHours: z.number().nonnegative().max(10_000).optional(),
  dueDate: z.string().trim().min(1).optional().or(z.literal("")),
});

export class ManageTaskService {
  async create(clientSolutionId: string, input: unknown) {
    const command = createTaskSchema.parse(input);
    const client = await createSupabaseServerClient();
    const { data, error } = await client
      .from("implementation_tasks")
      .insert({
        client_solution_id: clientSolutionId,
        title: command.title,
        assignee: command.assignee || null,
        estimate_hours: command.estimateHours ?? null,
        due_date: command.dueDate || null,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`No fue posible crear la tarea: ${error?.message ?? "sin respuesta"}`);
    return { id: data.id as string };
  }

  async update(taskId: string, input: unknown) {
    const command = updateTaskSchema.parse(input);
    const client = await createSupabaseServerClient();
    const { error } = await client
      .from("implementation_tasks")
      .update({
        status: command.status,
        assignee: command.assignee || null,
        actual_hours: command.actualHours ?? null,
        due_date: command.dueDate || null,
      })
      .eq("id", taskId);
    if (error) throw new Error(`No fue posible actualizar la tarea: ${error.message}`);
  }
}
