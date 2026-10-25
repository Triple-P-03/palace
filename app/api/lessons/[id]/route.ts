import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/lib/mongodb";

const statusSchema = z.object({
  status: z.enum(["pending", "memorized", "skipped"]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { status } = statusSchema.parse(await request.json());
    const statusUpdatedAt = new Date().toISOString();
    const database = await getDatabase();

    if (!database) {
      return NextResponse.json({ error: "MongoDB is not configured." }, { status: 503 });
    }

    const result = await database.collection("lessons").updateOne(
      { id },
      { $set: { status, statusUpdatedAt } },
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
    }

    return NextResponse.json({ id, status, statusUpdatedAt });
  } catch {
    return NextResponse.json({ error: "Could not update lesson status." }, { status: 400 });
  }
}
