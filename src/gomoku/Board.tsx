const SIZE = 15;
const STARS: Array<[number, number]> = [
  [3, 3],
  [3, 11],
  [11, 3],
  [11, 11],
  [7, 7],
];

export interface BoardProps {
  board: number[];
  disabled: boolean;
  lastMove: { row: number; col: number; color: number } | null;
  winningLine: number[] | null;
  onPlay: (row: number, col: number) => void;
}

export default function Board({ board, disabled, lastMove, winningLine, onPlay }: BoardProps) {
  const lines = [];
  for (let i = 0; i < SIZE; i += 1) {
    lines.push(
      <line key={"h" + i} x1={0} y1={i} x2={SIZE - 1} y2={i} className="board__line" />,
    );
    lines.push(
      <line key={"v" + i} x1={i} y1={0} x2={i} y2={SIZE - 1} className="board__line" />,
    );
  }

  return (
    <div className="board-wrap">
      <svg
        className={"board" + (disabled ? " board--disabled" : "")}
        viewBox="-0.7 -0.7 15.4 15.4"
        role="img"
        aria-label="五子棋棋盘，15 行 15 列，点击交叉点落子"
      >
        <rect x="-0.7" y="-0.7" width="15.4" height="15.4" rx="0.2" className="board__bg" />
        <g aria-hidden="true">
          {lines}
          {STARS.map(([r, c]) => (
            <circle key={"star-" + r + "-" + c} cx={c} cy={r} r={0.07} className="board__star" />
          ))}
        </g>

        <g aria-hidden="true">
          {board.map((cell, index) => {
            if (!cell) return null;
            const row = Math.floor(index / SIZE);
            const col = index % SIZE;
            return (
              <circle
                key={"stone-" + index}
                cx={col}
                cy={row}
                r={0.42}
                className={cell === 1 ? "board__stone board__stone--black" : "board__stone board__stone--white"}
              />
            );
          })}

          {winningLine?.map((index) => (
            <circle
              key={"win-" + index}
              cx={index % SIZE}
              cy={Math.floor(index / SIZE)}
              r={0.47}
              className="board__win"
            />
          ))}

          {lastMove && (
            <circle
              cx={lastMove.col}
              cy={lastMove.row}
              r={0.12}
              className="board__last"
            />
          )}
        </g>

        <g>
          {board.map((cell, index) => {
            const row = Math.floor(index / SIZE);
            const col = index % SIZE;
            return (
              <circle
                key={"hit-" + index}
                cx={col}
                cy={row}
                r={0.5}
                className="board__hit"
                data-row={row}
                data-col={col}
                onClick={() => onPlay(row, col)}
                aria-hidden="true"
                style={disabled ? { pointerEvents: "none" } : undefined}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
