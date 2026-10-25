import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/lib/mongodb";

const lessonSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  topic: z.string().min(1),
  paragraph: z.string().min(1),
  chunks: z.array(z.object({
    id: z.string().min(1),
    stop: z.string().min(1),
    exactText: z.string().min(1),
    anchorWords: z.array(z.string()),
    visualScene: z.string().min(1),
    firstLetterPrompt: z.string(),
  })),
  firstLetterPrompt: z.string(),
  quizQuestions: z.array(z.object({
    id: z.string().min(1),
    question: z.string().min(1),
    answer: z.string().min(1),
  })),
  sources: z.array(z.string()),
  createdAt: z.string(),
  status: z.enum(["pending", "memorized", "skipped"]).default("pending"),
  statusUpdatedAt: z.string().optional(),
  demo: z.boolean().optional(),
});

export async function GET() {
  const database = await getDatabase();
  if (!database) return NextResponse.json({ lessons: [] });

  const lessons = await database.collection("lessons").find({}).sort({ createdAt: -1 }).limit(50).toArray();
  return NextResponse.json({ lessons: lessons.map((document) => {
    const { _id: ignoredId, ...lesson } = document;
    void ignoredId;
    return { ...lesson, status: lesson.status ?? "pending" };
  }) });
}

export async function POST(request: Request) {
  try {
    const lesson = lessonSchema.parse(await request.json());
    const database = await getDatabase();

    if (!database) {
      return NextResponse.json({ error: "MongoDB is not configured." }, { status: 503 });
    }

    await database.collection("lessons").replaceOne({ id: lesson.id }, lesson, { upsert: true });
    return NextResponse.json({ lesson });
  } catch {
    return NextResponse.json({ error: "Could not save lesson." }, { status: 400 });
  }
}
