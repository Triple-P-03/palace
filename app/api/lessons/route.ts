import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";

export async function GET() {
  const database = await getDatabase();
  if (!database) return NextResponse.json({ lessons: [] });

  const lessons = await database.collection("lessons").find({}).sort({ createdAt: -1 }).limit(50).toArray();
  return NextResponse.json({ lessons: lessons.map((document) => {
    const { _id: ignoredId, ...lesson } = document;
    void ignoredId;
    return lesson;
  }) });
}
