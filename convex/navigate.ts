import { mutation } from "convex-dev/server";
import { Id } from "convex-dev/values";
import { GameState, navigateInGame, keyCodeToOperation, Operation, InternalGameState } from "../pages/common";

export default mutation(async ({ db }, operation: Operation): Promise<number> => {
  const currentTime = new Date();
  const gameState: InternalGameState | null = await db.table("games").first();
  if (!gameState) {
    return currentTime.getTime();
  }
  console.log("Navigating with operation", operation);
  const relativeTime = currentTime.getTime() - gameState.latestRewindTime;
  let allPlayerMoves = gameState.playerMoves.slice();
  const currentPlayerMoves = allPlayerMoves[allPlayerMoves.length-1];
  let newMoves = currentPlayerMoves.moves.slice();
  newMoves.push({
    operation,
    millisSinceStart: relativeTime,
  });
  allPlayerMoves[allPlayerMoves.length-1] = {
    ...currentPlayerMoves,
    moves: newMoves,
  };
  let latestRewindTime = gameState.latestRewindTime;
  if (operation === Operation.Rewind) {
    allPlayerMoves.push({moves: []});
    latestRewindTime = currentTime.getTime();
  }
  db.update(gameState._id, {playerMoves: allPlayerMoves, latestRewindTime});
  return currentTime.getTime();
});
