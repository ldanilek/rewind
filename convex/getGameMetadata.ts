import { query } from "./_generated/server";
import { GameMetadata, GameState, getConfig, getGame, getUser, InternalGameState, PlayerMove } from "../common";

export default query(async ({ db, auth }): Promise<GameMetadata | null> => {
  const user = await getUser(db, auth);
  // Order is by creation time, so the first in descending order is most recent.
  const game = await getGame(db, user);
  if (!game) {
    return null;
  }
  const config = getConfig(game.level);
  return {
    rewindsRemaining: config.maxRewinds - game.currentPlayerIndex,
    level: game.level,
    timeFlow: game.timeFlow,
  };
});
