import Lobby from "./Lobby";
import Room from "./Room";

export default function GomokuPage({ roomId }: { roomId?: string }) {
  return <main className="game-page">{roomId ? <Room roomId={roomId} /> : <Lobby />}</main>;
}
