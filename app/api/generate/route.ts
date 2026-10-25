import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { createDemoLesson, createLessonFromGenerated } from "@/lib/lesson";
import { getDatabase } from "@/lib/mongodb";

const requestSchema = z.object({
  topic: z.string().trim().min(1).max(80),
  routeLocations: z.array(z.string().trim().min(1).max(80)).min(1).max(8),
});

const generatedSchema = z.object({
  title: z.string().min(1),
  paragraph: z.string().min(80).max(1400),
  chunkTexts: z.array(z.string().min(1)).min(1).max(8),
  chunkMemories: z.array(
    z.object({
      anchorWords: z.array(z.string()).min(1).max(8),
      visualScene: z.string().min(1),
    }),
  ),
  quizQuestions: z.array(
    z.object({
      question: z.string().min(1),
      answer: z.string().min(1),
    }),
  ).min(2).max(6),
  sources: z.array(z.string()).optional(),
});

const responseJsonSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    paragraph: { type: "string" },
    chunkTexts: { type: "array", items: { type: "string" } },
    chunkMemories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          anchorWords: { type: "array", items: { type: "string" } },
          visualScene: { type: "string" },
        },
        required: ["anchorWords", "visualScene"],
      },
    },
    quizQuestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          answer: { type: "string" },
        },
        required: ["question", "answer"],
      },
    },
    sources: { type: "array", items: { type: "string" } },
  },
  required: ["title", "paragraph", "chunkTexts", "chunkMemories", "quizQuestions"],
};

function promptFor(topic: string, routeLocations: string[]) {
  return `Create one factual memorization lesson about "${topic}" for a memory-palace learner.

Write one polished paragraph between 90 and 150 words. Use concrete facts, dates, quantities, names, and actions. Do not use bullet points inside the paragraph. Avoid uncertain claims and include useful source references when known.

Split the exact paragraph into ${routeLocations.length} contiguous chunks. The chunkTexts must concatenate back to the paragraph with single spaces and must not paraphrase any words. Give each chunk 2-5 anchor words and one exaggerated, visual, moving memory scene. The palace locations, in order, are: ${routeLocations.map((location, index) => `${index + 1}. ${location}`).join("; ")}.

Create 3 short fact questions with direct answers. Return only JSON matching the requested schema. Do not include markdown fences.`;
}

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.parse(await request.json());
    const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      const lesson = createDemoLesson(parsed.topic, parsed.routeLocations);
      const database = await getDatabase();
      if (database) {
        await database.collection("lessons").replaceOne({ id: lesson.id }, lesson, { upsert: true });
      }
      return NextResponse.json({ lesson, demo: true, message: "Add GEMINI_API_KEY to generate new Gemini lessons." });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite",
      contents: promptFor(parsed.topic, parsed.routeLocations),
      config: {
        temperature: 0.75,
        maxOutputTokens: 3000,
        responseMimeType: "application/json",
        responseJsonSchema,
      },
    });

    const rawText = response.text?.trim();
    if (!rawText) throw new Error("Gemini returned an empty lesson.");

    const generated = generatedSchema.parse(JSON.parse(rawText));
    const lesson = createLessonFromGenerated(generated, parsed.routeLocations, parsed.topic);
    const database = await getDatabase();

    if (database) {
      await database.collection("lessons").replaceOne({ id: lesson.id }, lesson, { upsert: true });
    }

    return NextResponse.json({ lesson, demo: false });
  } catch (error) {
    console.error("Lesson generation failed", error);
    return NextResponse.json(
      { error: "Could not create a lesson. Check your Gemini key and try again." },
      { status: 400 },
    );
  }
}
