import { query } from "convex-dev/server";
import { computeGameState, GameState, initialGameState, InternalGameState, PlayerMove } from "../common";

// Returns the GameState to render and the next timestamp where something will happen.
export default query(async ({ db }, title: string, level: number, atTime: number): Promise<GameState | null> => {
  // Order is by creation time, so the first in descending order is most recent.
  let game: InternalGameState = await db.table("games").order("desc").first();
  if (!game) {
    game = initialGameState(level);
  }
  const currentMillisSinceStart = atTime - game.latestRewindTime;
  let moves: PlayerMove[] = await db
    .table("moves")
    .filter(q => q.and(q.eq(q.field("gameId"), game._id), q.lte(q.field("millisSinceStart"), currentMillisSinceStart)))
    .collect();
  // It would be nice to sort in the query, but Convex doesn't support that yet.
  moves.sort((a, b) => (a.millisSinceStart > b.millisSinceStart) ? 1 : -1);

  // Get next move. Ideally this would be a ORDER BY with LIMIT 1 but Convex doesn't support ordering.
  let nextMoves: PlayerMove[] = await db
    .table("moves")
    .filter(q => q.and(q.eq(q.field("gameId"), game._id), q.gt(q.field("millisSinceStart"), currentMillisSinceStart)))
    .collect();
  nextMoves.sort((a, b) => (a.millisSinceStart > b.millisSinceStart) ? 1 : -1);
  let nextTime: number | null = null;
  if (nextMoves.length > 0) {
    nextTime = game.latestRewindTime + nextMoves[0].millisSinceStart;
  }

  try {
    console.log("fetching game");
    return computeGameState(game, moves, nextTime);
  } catch (error) {
    return computeGameState(initialGameState(level), [], null);
  }
});
