import { mutation } from "convex-dev/server";
import { Id } from "convex-dev/values";
import { 
  GameState, 
  keyCodeToOperation, 
  Operation, 
  InternalGameState, 
  TimeFlow, 
  getConfig, 
  getUser, 
  getGame,
  getPlayers,
  getRelativeTime,
  GameObjectType,
  getGameState,
  bumpGameState,
} from "../common";

export default mutation(async ({ db, auth }, operation: Operation) => {
  const user = await getUser(db, auth);
  const currentTime = new Date();
  const game = await getGame(db, user);
  if (!game) {
    return;
  }
  await bumpGameState(db, game);
  const config = getConfig(game.level);
  if ((operation === Operation.Rewind || operation === Operation.UseTurnstile)
      && config.maxRewinds === game.currentPlayerIndex) {
    console.log("no more rewinds");
    return;
  }
  const state = await getGameState(db, game);
  if (state === null) {
    return;
  }
  const [gameState, realTime] = state;
  const relativeTime = getRelativeTime(game, realTime);
  if (gameState.completionMessage) {
    return;
  }
  const players = await getPlayers(db, game._id);
  const currentPlayer = players[game.currentPlayerIndex];
  const playerObject = gameState.objects[config.initialObjects.length + game.currentPlayerIndex];

  console.log("Navigating with operation", operation);
  if (operation !== Operation.UseTurnstile) {
    db.insert("moves", {
      gameId: game._id,
      playerIndex: game.currentPlayerIndex,
      millisSinceStart: relativeTime,
      operation,
      realTime,
      userAction: true,
    });
  }
  let isEnding = false;
  if (operation === Operation.Rewind) {
    const newPlayerIndex = game.currentPlayerIndex+1;
    db.update(game._id, {
      latestRealTime: currentTime.getTime(),
      currentPlayerIndex: newPlayerIndex,
    });
    db.insert("players", {
      gameId: game._id,
      index: newPlayerIndex,
      startX: config.playerStartX,
      startY: config.playerStartY,
      timeFlow: TimeFlow.Forward,
    });
    isEnding = true;
  } else if (operation === Operation.UseTurnstile) {
    // Check the current player is on a turnstile.
    let onTurnstile = false;
    for (let object of gameState.objects) {
      if (object.objectType === GameObjectType.Turnstile && object.locationX === playerObject.locationX && object.locationY === playerObject.locationY) {
        onTurnstile = true;
        break;
      }
    }
    if (onTurnstile) {
      const newPlayerIndex = game.currentPlayerIndex+1;
      const newTimeFlow = game.timeFlow === TimeFlow.Forward ? TimeFlow.Backward : TimeFlow.Forward;
      const newRealTime = realTime+1;
      const newRelativeTime = getRelativeTime(game, newRealTime);
      db.update(game._id, {
        latestRealTime: currentTime.getTime(),
        latestRelativeTime: newRelativeTime,
        currentPlayerIndex: newPlayerIndex,
        timeFlow: newTimeFlow,
      });
      db.insert("players", {
        gameId: game._id,
        index: newPlayerIndex,
        startX: playerObject.locationX,
        startY: playerObject.locationY,
        timeFlow: newTimeFlow,
      });
      db.insert("moves", {
        gameId: game._id,
        playerIndex: game.currentPlayerIndex,
        millisSinceStart: relativeTime,
        operation: Operation.End,
        realTime: realTime,
        userAction: true,
      });
      db.insert("moves", {
        gameId: game._id,
        playerIndex: game.currentPlayerIndex,
        millisSinceStart: newRelativeTime,
        operation: Operation.Start,
        realTime: newRealTime,
        userAction: false,
      });
      db.insert("moves", {
        gameId: game._id,
        playerIndex: newPlayerIndex,
        millisSinceStart: newRelativeTime,
        operation: Operation.Start,
        realTime: newRealTime,
        userAction: true,
      });
      isEnding = true;
    }
  }
  if (isEnding) {
    db.update(currentPlayer._id, {
      endX: playerObject.locationX,
      endY: playerObject.locationY,
    });
  }
});
