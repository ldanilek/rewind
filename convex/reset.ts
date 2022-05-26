import { mutation } from "convex-dev/server";
import { Id } from "convex-dev/values";
import { GameState, GameObjectType, InternalGameState, initialGameState, getUser } from "../common";

export default mutation(async ({ db, auth }, level: number) => {
  const user = await getUser(db, auth);
  console.log("resetting game to level", level);
  const state = initialGameState(level, user._id);
  return db.insert("games", state);
});
