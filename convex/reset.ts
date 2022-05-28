import { mutation } from "convex-dev/server";
import { Id } from "convex-dev/values";
import { getUser, getConfig, TimeFlow, Operation } from "../common";

export default mutation(async ({ db, auth }, level: number) => {
  const user = await getUser(db, auth);
  console.log("resetting game to level", level);
  const config = getConfig(level);
  const gameId = db.insert("games", {
    userId: user._id,
    level,
    latestRealTime: (new Date()).getTime(),
    latestRelativeTime: 0,
    currentPlayerIndex: 0,
    timeFlow: TimeFlow.Forward,
  });
  db.insert("players", {
    gameId,
    index: 0,
    startX: config.playerStartX,
    startY: config.playerStartY,
    timeFlow: TimeFlow.Forward,
  });
  db.insert("moves", {
    gameId,
    playerIndex: 0,
    millisSinceStart: 0,
    operation: Operation.Start,
  });
});
