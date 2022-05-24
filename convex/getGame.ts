import { query } from "convex-dev/server";
import { computeGameState, GameState, initialGameState, InternalGameState } from "../pages/common";

// Returns the GameState to render and the next timestamp where something will happen.
export default query(async ({ db }, title: string, level: number, atTime: number): Promise<GameState | null> => {
  let game: InternalGameState = await db.table("games").first();
  if (!game) {
    game = initialGameState(level);
  }
  try {
    console.log("fetching game");
    return computeGameState(game, atTime);
  } catch (error) {
    return computeGameState(initialGameState(level), atTime);
  }
});
