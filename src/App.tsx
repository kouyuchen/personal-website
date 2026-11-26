import FillBlankQuiz from "./components/FillBlankQuiz";
import { siteText } from "./content";
import GomokuPage from "./gomoku/GomokuPage";
import { useHashRoute } from "./lib/useHashRoute";

export default function App() {
  const route = useHashRoute();

  if (route.name === "gomoku") {
    return <GomokuPage roomId={route.roomId} />;
  }

  return (
    <main className="page">
      <p className="page__text">{siteText}</p>
      <FillBlankQuiz />
      <section className="home__game" aria-labelledby="home-game-title">
        <h2 id="home-game-title" className="home__game-title">
          在线五子棋
        </h2>
        <p className="home__game-text">
          和朋友用手机或电脑在线对弈。创建棋局后，把邀请链接发给对方即可。
        </p>
        <a className="home__game-link" href="#/gomoku">
          进入五子棋
        </a>
      </section>
    </main>
  );
}
