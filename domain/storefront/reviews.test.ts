import { describe, expect, it } from "vitest";
import { publicName, reviewSubmissionSchema, summarizeRatings, toPublicReview } from "./reviews";

describe("reviews", () => {
  it("cleans and validates a submission", () => {
    const parsed = reviewSubmissionSchema.parse({ rating: 5, body: "  Llegó   rápido y fresco.  ", authorName: " Ana  Rojas ", productLabel: "", contact: "" });
    expect(parsed).toEqual({ rating: 5, body: "Llegó rápido y fresco.", authorName: "Ana Rojas", productLabel: undefined, contact: undefined });
  });

  it("rejects bad ratings and too short texts", () => {
    expect(reviewSubmissionSchema.safeParse({ rating: 0, body: "Muy bueno todo", authorName: "Ana" }).success).toBe(false);
    expect(reviewSubmissionSchema.safeParse({ rating: 6, body: "Muy bueno todo", authorName: "Ana" }).success).toBe(false);
    expect(reviewSubmissionSchema.safeParse({ rating: 4, body: "Bueno", authorName: "Ana" }).success).toBe(false);
    expect(reviewSubmissionSchema.safeParse({ rating: 4.5, body: "Muy bueno todo", authorName: "Ana" }).success).toBe(false);
  });

  it("shortens the last name in public", () => {
    expect(publicName("María José Pérez")).toBe("María José P.");
    expect(publicName("Ana")).toBe("Ana");
    expect(toPublicReview({ id: "1", rating: 5, body: "Excelente nuez", authorName: "Luis soto", contact: "luis@correo.cl", status: "approved", source: "web", createdAt: "2026-10-01T00:00:00Z" }))
      .toEqual({ id: "1", rating: 5, body: "Excelente nuez", authorName: "Luis S.", productLabel: undefined, createdAt: "2026-10-01T00:00:00Z" });
  });

  it("summarizes ratings", () => {
    expect(summarizeRatings([])).toBeUndefined();
    expect(summarizeRatings([5, 4, 5])).toEqual({ average: 4.7, count: 3 });
  });
});
