import { useState, type FormEvent } from "react";
import { checkAnswer, type AnswerStatus } from "../lib/gradeAnswer";
import { fillBlankQuestions, type FillBlankQuestion } from "../questions";

function CheckIcon() {
  return (
    <svg
      className="quiz__icon"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm4.1 6.3-5 5a1 1 0 0 1-1.4 0l-2.4-2.4a1 1 0 1 1 1.4-1.4l1.7 1.7 4.3-4.3a1 1 0 1 1 1.4 1.4Z" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg
      className="quiz__icon"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm3.5 10.6a1 1 0 0 1-1.4 1.4L10 11.4l-2.1 2.1a1 1 0 1 1-1.4-1.4L8.6 10 6.5 7.9a1 1 0 0 1 1.4-1.4L10 8.6l2.1-2.1a1 1 0 1 1 1.4 1.4L11.4 10l2.1 2.1Z" />
    </svg>
  );
}

function QuestionCard({ question }: { question: FillBlankQuestion }) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<AnswerStatus | null>(null);

  const inputId = `answer-${question.id}`;
  const feedbackId = `feedback-${question.id}`;
  const feedbackClass = status
    ? `quiz__feedback quiz__feedback--${status}`
    : "quiz__feedback";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(checkAnswer(value, question.answer));
  }

  return (
    <form className="quiz__card" onSubmit={handleSubmit} noValidate>
      <p className="quiz__sentence">{question.sentence}</p>

      <label className="sr-only" htmlFor={inputId}>
        请填写缺失的英文单词
      </label>
      <input
        id={inputId}
        className="quiz__input"
        type="text"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setStatus(null);
        }}
        placeholder="输入单词"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        aria-describedby={feedbackId}
      />

      <button className="quiz__button" type="submit">
        检查答案
      </button>

      <p id={feedbackId} className={feedbackClass} role="status" aria-live="polite">
        {status === "correct" && (
          <>
            <CheckIcon />
            <span>回答正确！</span>
          </>
        )}
        {status === "incorrect" && (
          <>
            <CrossIcon />
            <span>回答错误，请再试一次。</span>
          </>
        )}
        {status === "empty" && <span>请先填写答案。</span>}
      </p>
    </form>
  );
}

export default function FillBlankQuiz() {
  return (
    <section className="quiz" aria-labelledby="quiz-title">
      <h2 id="quiz-title" className="quiz__title">
        英语填空练习
      </h2>
      <p className="quiz__hint">根据句意，填入缺失的英文单词。</p>
      {fillBlankQuestions.map((question) => (
        <QuestionCard key={question.id} question={question} />
      ))}
    </section>
  );
}
