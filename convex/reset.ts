import { mutation } from "./_generated/server";
import { getUser, getConfig, TimeFlow, Operation } from "../common";

export default mutation(async ({ db, auth }, { level }: { level: number }) => {
  const user = await getUser(db, auth);
  console.log("resetting game to level", level);
  const config = getConfig(level);
  const realTime = new Date().getTime();
  const gameId = await db.insert("games", {
    userId: user._id,
    level,
    latestRealTime: realTime,
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
    realTime,
    userAction: true,
  });
});
