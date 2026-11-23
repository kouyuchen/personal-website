export type AnswerStatus = "empty" | "correct" | "incorrect";

/**
 * 判断填空答案：
 * - 去掉输入前后的空格；
 * - 不区分英文大小写；
 * - 空输入返回 "empty"，不参与对错判断。
 */
export function checkAnswer(input: string, answer: string): AnswerStatus {
  const normalizedInput = input.trim().toLowerCase();

  if (normalizedInput === "") {
    return "empty";
  }

  return normalizedInput === answer.trim().toLowerCase() ? "correct" : "incorrect";
}
