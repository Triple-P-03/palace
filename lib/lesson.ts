import type { Lesson, PalaceChunk, QuizQuestion } from "./types";

export type GeneratedLesson = {
  title: string;
  paragraph: string;
  chunkMemories: Array<{
    anchorWords: string[];
    visualScene: string;
  }>;
  chunkTexts?: string[];
  quizQuestions: Array<{
    question: string;
    answer: string;
  }>;
  sources?: string[];
};

export function firstLetterPrompt(text: string) {
  return text
    .split(/(\s+)/)
    .map((part) => {
      if (/^\s+$/.test(part) || part.length === 0) return part;
      const firstMeaningfulCharacter = part.match(/[A-Za-z0-9]/)?.[0];
      if (!firstMeaningfulCharacter) return part;
      const suffix = /[.,!?;:]$/.test(part) ? part.slice(-1) : "";
      return `${firstMeaningfulCharacter}${suffix}`;
    })
    .join("");
}

function normalizeSpace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function chunksAreExact(paragraph: string, chunks: string[]) {
  if (chunks.length === 0) return false;
  return normalizeSpace(chunks.join(" ")) === normalizeSpace(paragraph);
}

function splitIntoFiveChunks(paragraph: string, count: number) {
  const words = paragraph.trim().split(/\s+/);
  const chunks: string[] = [];
  let cursor = 0;

  for (let index = 0; index < count; index += 1) {
    const remainingWords = words.length - cursor;
    const remainingChunks = count - index;
    const targetSize = Math.ceil(remainingWords / remainingChunks);
    chunks.push(words.slice(cursor, cursor + targetSize).join(" "));
    cursor += targetSize;
  }

  return chunks;
}

export function createLessonFromGenerated(
  generated: GeneratedLesson,
  routeLocations: string[],
  topic: string,
  demo = false,
): Lesson {
  const stopCount = routeLocations.length || 5;
  const suggestedChunks = generated.chunkTexts ?? [];
  const exactTexts = chunksAreExact(generated.paragraph, suggestedChunks)
    ? suggestedChunks
    : splitIntoFiveChunks(generated.paragraph, stopCount);

  const chunks: PalaceChunk[] = exactTexts.map((exactText, index) => {
    const memory = generated.chunkMemories[index] ?? {
      anchorWords: exactText.split(/\s+/).slice(0, 3),
      visualScene: "Make this chunk oversized, colorful, moving, and emotionally surprising.",
    };

    return {
      id: `chunk-${index + 1}`,
      stop: routeLocations[index] ?? `Stop ${index + 1}`,
      exactText,
      anchorWords: memory.anchorWords,
      visualScene: memory.visualScene,
      firstLetterPrompt: firstLetterPrompt(exactText),
    };
  });

  const quizQuestions: QuizQuestion[] = generated.quizQuestions.map((question, index) => ({
    id: `question-${index + 1}`,
    question: question.question,
    answer: question.answer,
  }));

  return {
    id: crypto.randomUUID(),
    title: generated.title,
    topic,
    paragraph: generated.paragraph.trim(),
    chunks,
    firstLetterPrompt: firstLetterPrompt(generated.paragraph.trim()),
    quizQuestions,
    sources: generated.sources ?? [],
    createdAt: new Date().toISOString(),
    status: "pending",
    demo,
  };
}

export function createDemoLesson(topic: string, routeLocations: string[]): Lesson {
  const isAstronomy = /astronomy|space|planet|solar/i.test(topic);
  const paragraph = isAstronomy
    ? "Jupiter is the largest planet in the Solar System, with a mass more than twice that of all the other planets combined. Its famous Great Red Spot is a giant storm that has been observed for centuries, while the planet's rapid rotation creates a day lasting only about ten hours. Surrounded by a faint ring system and dozens of moons, Jupiter acts as a powerful gravitational guide for many smaller bodies orbiting the Sun."
    : "Constructed during the 26th century BCE under the reign of Pharaoh Khufu, the Great Pyramid of Giza stands as the ultimate architectural triumph of Egypt’s Old Kingdom. Built over two decades using an estimated 2.3 million massive limestone and granite blocks, the monument was aligned to true cardinal north with precision. Employing an advanced royal bureaucracy, skilled seasonal labor, and a complex network of ramps and copper tools, the Egyptians transformed a massive royal tomb into an enduring symbol of divine pharaonic authority and eternal life.";

  const exactTexts = isAstronomy
    ? [
        "Jupiter is the largest planet in the Solar System, with a mass more than twice that of all the other planets combined.",
        "Its famous Great Red Spot is a giant storm that has been observed for centuries,",
        "while the planet's rapid rotation creates a day lasting only about ten hours.",
        "Surrounded by a faint ring system and dozens of moons, Jupiter acts as a powerful gravitational guide",
        "for many smaller bodies orbiting the Sun.",
      ]
    : [
        "Constructed during the 26th century BCE under the reign of Pharaoh Khufu, the Great Pyramid of Giza stands as the ultimate architectural triumph of Egypt’s Old Kingdom.",
        "Built over two decades using an estimated 2.3 million massive limestone and granite blocks,",
        "the monument was aligned to true cardinal north with precision.",
        "Employing an advanced royal bureaucracy, skilled seasonal labor, and a complex network of ramps and copper tools,",
        "the Egyptians transformed a massive royal tomb into an enduring symbol of divine pharaonic authority and eternal life.",
      ];

  const memoryScenes = isAstronomy
    ? [
        { anchorWords: ["Jupiter", "largest", "twice"], visualScene: "At the entrance, a giant Jupiter is wearing a crown and outweighing every other planet in a balance scale." },
        { anchorWords: ["Great Red Spot", "storm", "centuries"], visualScene: "At the threshold, a red spinning storm is blowing ancient calendars through the air." },
        { anchorWords: ["rapid rotation", "ten hours"], visualScene: "At the doorway, Jupiter spins so fast that a huge clock completes a ten-hour day." },
        { anchorWords: ["rings", "moons", "gravitational guide"], visualScene: "At the desk, moons follow a glowing ring-road pulled by a magnetic Jupiter traffic officer." },
        { anchorWords: ["smaller bodies", "Sun"], visualScene: "At the window, Jupiter safely guides tiny asteroids into a bright orbit around the Sun." },
      ]
    : [
        { anchorWords: ["26th century BCE", "Khufu", "Pyramid"], visualScene: "At the entrance, Pharaoh Khufu sits on a golden pyramid holding a trophy made of 26 glowing stones." },
        { anchorWords: ["two decades", "2.3 million", "blocks"], visualScene: "At the threshold, millions of limestone blocks stack themselves around a giant stone counter." },
        { anchorWords: ["True North", "precision"], visualScene: "At the doorway, a glowing compass needle points exactly north while the pyramid locks into place." },
        { anchorWords: ["bureaucracy", "workers", "ramps", "copper"], visualScene: "At the desk, scribes direct seasonal workers up a zigzag ramp with a giant copper chisel." },
        { anchorWords: ["royal tomb", "authority", "eternal life"], visualScene: "At the window, a sarcophagus bursts open and releases a golden ankh into the sky." },
      ];

  return createLessonFromGenerated(
    {
      title: isAstronomy ? "Jupiter: The Solar System’s Giant" : "The Great Pyramid of Giza",
      paragraph,
      chunkTexts: exactTexts,
      chunkMemories: memoryScenes,
      quizQuestions: isAstronomy
        ? [
            { question: "Which planet is the largest in the Solar System?", answer: "Jupiter." },
            { question: "How long is a day on Jupiter?", answer: "About ten hours." },
            { question: "What is the Great Red Spot?", answer: "A giant storm on Jupiter." },
          ]
        : [
            { question: "Who commissioned the Great Pyramid of Giza?", answer: "Pharaoh Khufu." },
            { question: "How many blocks were estimated to be used?", answer: "About 2.3 million limestone and granite blocks." },
            { question: "What did the pyramid symbolize?", answer: "Divine pharaonic authority and eternal life." },
          ],
      sources: ["Demo lesson — replace with generated sources when GEMINI_API_KEY is configured."],
    },
    routeLocations,
    topic,
    true,
  );
}
