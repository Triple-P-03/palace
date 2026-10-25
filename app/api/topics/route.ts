import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/lib/mongodb";

const topicSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(80),
  enabled: z.boolean(),
});

export async function GET() {
  const database = await getDatabase();
  if (!database) return NextResponse.json({ topics: [] });

  const topics = await database.collection("topics").find({}).sort({ name: 1 }).toArray();
  return NextResponse.json({ topics: topics.map((document) => {
    const { _id: ignoredId, ...topic } = document;
    void ignoredId;
    return topic;
  }) });
}

export async function POST(request: Request) {
  try {
    const topic = topicSchema.parse(await request.json());
    const database = await getDatabase();
    if (database) {
      await database.collection("topics").updateOne(
        { id: topic.id },
        { $set: topic },
        { upsert: true },
      );
    }
    return NextResponse.json({ topic });
  } catch {
    return NextResponse.json({ error: "Invalid topic." }, { status: 400 });
  }
}
