import type { RecallResult } from "./types";

function words(text: string) {
  return text.trim() ? text.trim().split(/\s+/) : [];
}

export function compareRecall(expectedText: string, actualText: string): RecallResult {
  const expected = words(expectedText);
  const actual = words(actualText);
  const maxLength = Math.max(expected.length, actual.length);
  const differences: RecallResult["differences"] = [];
  let matchedWords = 0;

  for (let index = 0; index < maxLength; index += 1) {
    const expectedWord = expected[index] ?? "";
    const actualWord = actual[index] ?? "";
    if (expectedWord === actualWord) {
      matchedWords += 1;
    } else if (differences.length < 12) {
      differences.push({ index, expected: expectedWord, actual: actualWord });
    }
  }

  const score = expected.length === 0 ? 0 : Math.round((matchedWords / expected.length) * 100);

  return {
    score,
    exact: expectedText === actualText,
    expectedWords: expected.length,
    matchedWords,
    differences,
  };
}
