import { mutation } from "convex-dev/server";
import { Id } from "convex-dev/values";
import { GameState, navigateInGame, keyCodeToOperation, Operation, InternalGameState, getConfig, getUser, getGame } from "../common";

export default mutation(async ({ db, auth }, operation: Operation): Promise<number> => {
  const user = await getUser(db, auth);
  const currentTime = new Date();
  const gameState = await getGame(db, user);
  if (!gameState) {
    return currentTime.getTime();
  }
  const config = getConfig(gameState.level);
  if (operation === Operation.Rewind && config.maxRewinds === gameState.currentPlayerIndex) {
    console.log("no more rewinds");
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
