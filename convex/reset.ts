import { mutation } from "convex-dev/server";
import { Id } from "convex-dev/values";
import { GameState, GameObjectType, InternalGameState, initialGameState } from "../common";

export default mutation(async ({ db }, level: number) => {
  console.log("resetting game to level", level);
  const state = initialGameState(level);
  return db.insert("games", state);
});
