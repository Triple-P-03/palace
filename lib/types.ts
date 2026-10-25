export type Topic = {
  id: string;
  name: string;
  enabled: boolean;
};

export type PalaceChunk = {
  id: string;
  stop: string;
  exactText: string;
  anchorWords: string[];
  visualScene: string;
  firstLetterPrompt: string;
};

export type QuizQuestion = {
  id: string;
  question: string;
  answer: string;
};

export type Lesson = {
  id: string;
  title: string;
  topic: string;
  paragraph: string;
  chunks: PalaceChunk[];
  firstLetterPrompt: string;
  quizQuestions: QuizQuestion[];
  sources: string[];
  createdAt: string;
  demo?: boolean;
};

export type RecallResult = {
  score: number;
  exact: boolean;
  expectedWords: number;
  matchedWords: number;
  differences: Array<{
    index: number;
    expected: string;
    actual: string;
  }>;
};
