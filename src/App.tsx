import FillBlankQuiz from "./components/FillBlankQuiz";
import { siteText } from "./content";

export default function App() {
  return (
    <main className="page">
      <p className="page__text">{siteText}</p>
      <FillBlankQuiz />
    </main>
  );
}
