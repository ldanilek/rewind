import { internalMutation } from "./_generated/server";
import { 
  getUser, 
  getGame,
  bumpGameState,
} from "../common";
import { Id } from "./_generated/dataModel";

export default internalMutation(async ({ db, scheduler }, { gameId }: { gameId: Id<"games"> }) => {
  const game = await db.get(gameId);
  if (!game) {
    return;
  }
  await bumpGameState(db, game, scheduler);
});
