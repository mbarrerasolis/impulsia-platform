import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInternalApiRole } from "@/lib/auth/api-authorization";
import { routeError } from "@/lib/http/route-error";
import { getMarketingRepository } from "@/repositories";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireInternalApiRole(["owner_admin", "finance"]);
    const { id } = await params;
    await getMarketingRepository().deleteExpense(z.uuid().parse(id));
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return routeError(error, "marketing.expense.delete_failed");
  }
}
