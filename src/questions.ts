/**
 * 英语填空题目。
 *
 * 修改规则：
 * - sentence：题目句子，用 _____ 表示空缺位置；
 * - answer：标准答案（判断时忽略前后空格和英文大小写）。
 *
 * 以后要加题，直接在数组里追加一项即可，id 不要重复。
 */
export type FillBlankQuestion = {
  id: string;
  sentence: string;
  answer: string;
};

export const fillBlankQuestions: FillBlankQuestion[] = [
  {
    id: "tissue-1",
    sentence: "He wiped his tears with a _____.",
    answer: "tissue",
  },
];
