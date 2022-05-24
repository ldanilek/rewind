import { mutation } from "convex-dev/server";
import { Id } from "convex-dev/values";
import { GameState, navigateInGame, keyCodeToOperation, Operation, InternalGameState } from "../pages/common";

export default mutation(async ({ db }, operation: Operation): Promise<number> => {
  const currentTime = new Date();
  const gameState: InternalGameState | null = await db.table("games").order("desc").first();
  if (!gameState) {
    return currentTime.getTime();
  }
  console.log("Navigating with operation", operation);
  const relativeTime = currentTime.getTime() - gameState.latestRewindTime;
  db.insert("moves", {
    gameId: gameState._id,
    playerIndex: gameState.currentPlayerIndex,
    millisSinceStart: relativeTime,
    operation,
  });
  if (operation === Operation.Rewind) {
    db.update(gameState._id, {
      latestRewindTime: currentTime.getTime(),
      currentPlayerIndex: gameState.currentPlayerIndex+1,
    });
  }
  return currentTime.getTime();
});
