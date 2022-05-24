import { mutation } from "convex-dev/server";
import { Id } from "convex-dev/values";
import { GameState, GameObjectType, InternalGameState, initialGameState } from "../pages/common";

export default mutation(async ({ db }, level: number) => {
  console.log("resetting game to level", level);
  const gameState: InternalGameState | null = await db.table("games").first();
  if (gameState) {
    db.delete(gameState._id);
  }
  const currentTime = new Date();
  const state = initialGameState(level);
  return db.insert("games", state);
});
