import { NextResponse } from "next/server";
import { expenseInputSchema } from "@/domain/marketing/expenses";
import { requireInternalApiRole } from "@/lib/auth/api-authorization";
import { routeError } from "@/lib/http/route-error";
import { getMarketingRepository } from "@/repositories";

/** Registra un gasto comercial (único o mensual). */
export async function POST(request: Request) {
  try {
    const user = await requireInternalApiRole(["owner_admin", "sales", "finance"]);
    const input = expenseInputSchema.parse(await request.json());
    const expense = await getMarketingRepository().createExpense(input, user.id);
    return NextResponse.json({ expense }, { status: 201 });
  } catch (error) {
    return routeError(error, "marketing.expense.create_failed");
  }
}
