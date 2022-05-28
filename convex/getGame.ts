import { query } from "convex-dev/server";
import { GameState, getGame, getGameState, getPlayers, getRelativeTime, getUser, InternalGameState, PlayerMove } from "../common";

// Returns the GameState to render and the next timestamp where something will happen.
export default query(async ({ db, auth }, atTime: number): Promise<GameState | null> => {
  const user = await getUser(db, auth);
  // Order is by creation time, so the first in descending order is most recent.
  const game = await getGame(db, user);
  if (!game) {
    return null;
  }
  return getGameState(db, game, atTime);
});
