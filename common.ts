import { Auth } from "convex/server";
import { Doc, Id } from "./convex/_generated/dataModel";
import { DatabaseReader, DatabaseWriter } from "./convex/_generated/server";

export enum GameObjectType {
  Player = 1,
  FormerPlayer,
  Obstacle,
  Goal,
  Sensor,
  Turnstile,
}

export type SensorTarget = {
  // For now all targets disappear while the sensor is triggered, and reappear after.
  objectIndices: number[],
}

export type GameObject = {
  objectType: GameObjectType,
  locationX: number | null,
  locationY: number | null,
  sensorTarget?: SensorTarget,
  formerX?: number | null,
  formerY?: number | null,
}

// This is the game that can be rendered.
export type GameState = {
  // The last object can be mutated for optimistic updates.
  objects: Array<GameObject>,
  // Server-computed true time. Wait until this time to fetch new game state.
  nextTime: number | null,
  completionMessage: string | null,
};

// Not dependent on current time.
export type GameMetadata = {
  rewindsRemaining: number,
  level: number,
  timeFlow: TimeFlow,
};

export enum Operation {
  Up = 1,
  Down,
  Left,
  Right,
  Rewind,
  UseTurnstile,
  Start,
  End,
}

export enum TimeFlow {
  Forward = 1,
  Backward,
  // Could potentially go at different speeds? Or a different dimension :hmm:.
}

export type PlayerMove = {
  _id: Id<"moves">,
  gameId: Id<"games">,
  playerIndex: number,
  millisSinceStart: number,
  operation: Operation,
  realTime: number,
  userAction: boolean,
};

export type Player = {
  _id: Id<"players">,
  gameId: Id<"games">,
  index: number,
  timeFlow: TimeFlow,
  // Temporary, not persisted to db
  formerX?: number,
  formerY?: number,
};

export type InternalGameState = {
  _id: Id<"games">,
  userId: Id<"users">,
  level: number,

  // About the current player:
  // Their index, where they started in real time and relative time, and their time flow.
  currentPlayerIndex: number,
  // From Date.getTime(); Necessary because Convex doesn't support Date.
  latestRealTime: number,
  latestRelativeTime: number,
  timeFlow: TimeFlow,
};

export type GameConfig = {
  // Excluding players
  initialObjects: Array<GameObject>,
  playerStartX: number,
  playerStartY: number,
  maxRewinds: number,
};

const dvorak = true;

const aKey = dvorak ? 65 : 65;
const sKey = dvorak ? 79 : 83;
const dKey = dvorak ? 69 : 68;
const wKey = dvorak ? 188 : 87;
const rKey = dvorak ? 0 : 82;
const tKey = dvorak ? 89 : 84;

export const maxX = 15;
export const maxY = 15;

export const keyCodeToOperation = (keyCode: number): Operation | null => {
  switch (keyCode) {
    case aKey:
      return Operation.Left;
    case sKey:
      return Operation.Down;
    case dKey:
      return Operation.Right;
    case wKey:
      return Operation.Up;
    //case rKey:
    //  return Operation.Rewind;
    case tKey:
      return Operation.UseTurnstile;
    default:
      return null;
  }
};

enum OperationResult {
  Allowed = 1,
  Blocked,
  Win,
}

const navigationResult = (
  x: number | null,
  y: number | null,
  gameState: GameState,
): OperationResult => {
  if (x === null || y === null) {
    return OperationResult.Allowed;
  }
  if (x < 0 || y < 0 || x >= maxX || y >= maxY) {
    return OperationResult.Blocked;
  }
  for (let object of gameState.objects) {
    if (object.locationX === x && object.locationY === y) {
      if (object.objectType === GameObjectType.Obstacle) {
        return OperationResult.Blocked;
      } else if (object.objectType === GameObjectType.Goal) {
        return OperationResult.Win;
      }
    }
  }
  return OperationResult.Allowed;
};

export const navigateInGame = (
  gameState: GameState, 
  playerIndex: number, 
  operation: Operation,
  player: Player | null,  // only required if operation == Start
): GameState => {
  if (gameState.completionMessage !== null) {
    return gameState;
  }
  const playerObject = gameState.objects[playerIndex];
  let newX = playerObject.locationX;
  let newY = playerObject.locationY;
  switch (operation) {
    case Operation.Left:
      if (newX === null) {
        throw Error("cannot move Left");
      }
      newX--;
      break;
    case Operation.Down:
      if (newY === null) {
        throw Error("cannot move Down");
      }
      newY++;
      break;
    case Operation.Right:
      if (newX === null) {
        throw Error("cannot move Right");
      }
      newX++;
      break;
    case Operation.Up:
      if (newY === null) {
        throw Error("cannot move Up");
      }
      newY--;
      break;
    case Operation.End:
      if (newY === null || newX === null || player === null) {
        throw Error("cannot end");
      }
      player.formerX = newX;
      player.formerY = newY;
      newX = null;
      newY = null;
      break;
    case Operation.Start:
      if (player === null || player.formerX === undefined || player.formerY === undefined) {
        throw Error("need player to Start");
      }
      newX = player.formerX!;
      newY = player.formerY!;
      delete player["formerX"];
      delete player["formerY"];
      break;
    default:
      throw Error(`unrecognized operation ${operation}`);
  }
  let completion: string | null = gameState.completionMessage;
  switch (navigationResult(newX, newY, gameState)) {
    case OperationResult.Allowed:
      break;
    case OperationResult.Blocked:
      newX = playerObject.locationX;
      newY = playerObject.locationY;
      break;
    case OperationResult.Win:
      break;
    default:
      throw Error("unexpected result");
  }
  let updatedObjects = gameState.objects.slice();
  updatedObjects[playerIndex] = {
    ...playerObject,
    locationX: newX,
    locationY: newY,
  };
  let triggeredGoals = 0;
  let allGoals = 0;
  updatedObjects.forEach((object) => {
    if (object.objectType === GameObjectType.Sensor || object.objectType === GameObjectType.Goal) {
      let triggered = false;
      if (object.locationX !== null && object.locationY !== null) {
        for(let maybePlayer of updatedObjects) {
          if (maybePlayer.objectType === GameObjectType.Player || maybePlayer.objectType === GameObjectType.FormerPlayer) {
            if (object.locationX === maybePlayer.locationX && object.locationY === maybePlayer.locationY) {
              triggered = true;
            }
          }
        }
      }

      if (object.objectType === GameObjectType.Sensor) {
        for (let targetIndex of object.sensorTarget!.objectIndices) {
          const targetObject = updatedObjects[targetIndex];
          if (triggered) {
            updatedObjects[targetIndex] = {
              ...targetObject,
              locationX: null,
              locationY: null,
              formerX: targetObject.formerX !== undefined ? targetObject.formerX : targetObject.locationX,
              formerY: targetObject.formerY !== undefined ? targetObject.formerY : targetObject.locationY,
            };
          } else if (targetObject.formerX !== undefined && targetObject.formerY !== undefined) {
            updatedObjects[targetIndex] = {
              ...targetObject,
              locationX: targetObject.formerX,
              locationY: targetObject.formerY,
            };
          }
        }
      } else if (object.objectType === GameObjectType.Goal) {
        allGoals++;
        if (triggered) {
          triggeredGoals++;
        }
      }
    }
  });
  if (allGoals > 0 && allGoals === triggeredGoals) {
    completion = "You Win!";
  }
  return {
    ...gameState,
    objects: updatedObjects,
    completionMessage: completion,
  };
};

export const computeGameState = (
  game: InternalGameState, 
  players: Player[], 
  moves: PlayerMove[], 
  nextTime: number | null,
): GameState => {
  const config = getConfig(game.level);
  let objects = config.initialObjects.slice();
  const playerIndexOffset = objects.length;
  for (let playerIndex = 0; playerIndex <= game.currentPlayerIndex; playerIndex++) {
    objects.push({
      objectType: playerIndex === game.currentPlayerIndex ? GameObjectType.Player : GameObjectType.FormerPlayer,
      locationX: null,
      locationY: null,
    });
  }
  let gameState: GameState = {
    objects,
    nextTime,
    completionMessage: null,
  };
  for (let move of moves) {
    console.log(`processing move ${move.operation} of player ${move.playerIndex} at time ${move.millisSinceStart}`);
    const player = players[move.playerIndex];
    //const operation = player.timeFlow === TimeFlow.Forward ? move.operation : reverseOperation(move.operation);
    const operation = move.operation;
    let playerIndex = move.playerIndex + playerIndexOffset;
    if (move.operation === Operation.End && move.userAction) {
      // When player i uses turnstile, that determines the initial location for player i+1.
      const nextPlayer = players[move.playerIndex+1];
      nextPlayer.formerX = gameState.objects[playerIndex].locationX ?? 0;
      nextPlayer.formerY = gameState.objects[playerIndex].locationY ?? 0;
    }
    gameState = navigateInGame(gameState, playerIndex, operation, player);
  }
  return gameState;
}

export const gameConfigForLevel = ((): Map<number, GameConfig> => {
  const obstacle = (x: number, y: number): GameObject => ({
    objectType: GameObjectType.Obstacle,
    locationX: x,
    locationY: y,
  });
  const goal = (x: number, y: number): GameObject => ({
    objectType: GameObjectType.Goal,
    locationX: x,
    locationY: y,
  });
  const sensor = (x: number, y: number, ...targets: number[]): GameObject => ({
    objectType: GameObjectType.Sensor,
    locationX: x,
    locationY: y,
    sensorTarget: {objectIndices: targets},
  });
  const turnstile = (x: number, y: number): GameObject => ({
    objectType: GameObjectType.Turnstile,
    locationX: x,
    locationY: y,
  });
  const vWall = (x: number, y1: number, y2: number): GameObject[] => {
    let wall: GameObject[] = [];
    for (let i = y1; i <= y2; i++) {
      wall.push(obstacle(x, i));
    }
    return wall;
  };
  const hWall = (y: number, x1: number, x2: number): GameObject[] => {
    let wall: GameObject[] = [];
    for (let i = x1; i <= x2; i++) {
      wall.push(obstacle(i, y));
    }
    return wall;
  };

  const partialWall = vWall(3, 0, 13);
  const objects1 = [goal(5, 5), ...partialWall];

  const objects1a = [...objects1, turnstile(2, 9)];

  // Full wall with a sensor that opens a hole.
  const fullWall = vWall(3, 0, 14);
  const objects2 = [goal(5, 5), ...fullWall, sensor(2, 5, 6)];

  // Now the sensor is further away so you have to use a turnstile.
  const objects2a = [goal(5, 5), ...fullWall, sensor(1, 5, 6), turnstile(2, 0)];

  // Partial wall and Two goals
  const objects3 = [goal(5, 5), goal(10, 3), ...partialWall, turnstile(2, 0)];

  // Enclosed goal with multiple doors.
  const objects4: GameObject[] = [
    obstacle(4, 4),
    obstacle(4, 5),
    obstacle(4, 6),
    obstacle(5, 4),
    goal(5, 5),
    obstacle(5, 6), // 5
    obstacle(6, 4),
    obstacle(6, 5),
    obstacle(6, 6),
    obstacle(7, 4),
    obstacle(7, 5), // 10
    obstacle(7, 6),
    obstacle(8, 4),
    obstacle(8, 5),
    obstacle(8, 6),
    sensor(3, 13, 7), // 15
    sensor(7, 13, 10),
    sensor(11, 13, 13),
    turnstile(1, 13),
  ];

  let objects6 = objects2a.slice();
  objects6.push(goal(1, 13));

  const objects8 = [
    ...fullWall, 
    sensor(2, 5, 5), goal(8, 13), goal(6, 2), 
    ...hWall(3, 4, 14), 
    sensor(5, 4, 19), 
    turnstile(7, 5),
    ...hWall(10, 4, 14),
    sensor(5, 9, 32),
  ];

  return new Map<number, GameConfig>([
    [1, {initialObjects: objects1, playerStartX: 0, playerStartY: 0, maxRewinds: 0}],
    [2, {initialObjects: objects1a, playerStartX: 0, playerStartY: 0, maxRewinds: 10}],
    [3, {initialObjects: objects2, playerStartX: 0, playerStartY: 0, maxRewinds: 0}],
    [4, {initialObjects: objects2a, playerStartX: 0, playerStartY: 0, maxRewinds: 1}],
    [5, {initialObjects: objects3, playerStartX: 0, playerStartY: 0, maxRewinds: 1}],
    [6, {initialObjects: objects4, playerStartX: 14, playerStartY: 8, maxRewinds: 1}],
    [7, {initialObjects: objects6, playerStartX: 0, playerStartY: 0, maxRewinds: 1}],
    [8, {initialObjects: objects8, playerStartX: 0, playerStartY: 0, maxRewinds: 1}],
  ]);
})();

export const getConfig = (level: number): GameConfig => {
  const config = gameConfigForLevel.get(level);
  if (config) {
    return config;
  }
  return {playerStartX: 0, playerStartY: 0, initialObjects: [], maxRewinds: 1000};
}

export const getUser = async (db: DatabaseReader, auth: Auth): Promise<Doc<"users">> => {
  const identity = await auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated call to reset");
  }
  const user = (await db
    .query("users")
    .filter(q => q.eq(q.field("tokenIdentifier"), identity.tokenIdentifier))
    .unique())!;
  return user;
};

export const getGame = async (db: DatabaseReader, user: Doc<"users">): Promise<InternalGameState | null> => {
  return await db.query("games").order("desc").filter(
    q => q.eq(q.field("userId"), user._id)
  ).first();
};

export const getMoves = async (
  db: DatabaseReader, 
  gameId: Id<"games">,
  relativeTimeBound: number,
  boundLessThan: boolean,
  boundEqual: boolean,
  orderIncreasing: boolean,
): Promise<PlayerMove[]> => {
  let moves: PlayerMove[] = await db
    .query("moves")
    .filter(q => q.and(
      q.eq(q.field("gameId"), gameId),
      q.eq(q.field("userAction"), true),
      (boundLessThan ? (boundEqual ? q.lte : q.lt) : (boundEqual ? q.gte : q.gt))(
        q.field("millisSinceStart"), relativeTimeBound))
    ).collect();
  // It would be nice to sort in the query, but Convex doesn't support that yet.
  const order = orderIncreasing ? 1 : -1;
  moves.sort((a, b) => (a.millisSinceStart > b.millisSinceStart) ? order : -1*order);
  return moves;
};

export const getMovesRealTime = async (
  db: DatabaseReader, 
  gameId: Id<"games">,
  orderIncreasing: boolean,
): Promise<PlayerMove[]> => {
  let moves: PlayerMove[] = await db
    .query("moves")
    .filter(q =>
      q.eq(q.field("gameId"), gameId)
    ).collect();
  // It would be nice to sort in the query, but Convex doesn't support that yet.
  const order = orderIncreasing ? 1 : -1;
  moves.sort((a, b) => (a.realTime > b.realTime) ? order : -1*order);
  return moves;
};

export const getPlayers = async (db: DatabaseReader, gameId: Id<"games">): Promise<Player[]> => {
  let players: Player[] = await db
    .query("players")
    .filter(
      q => q.eq(q.field("gameId"), gameId)
    ).collect();
  players.sort((a, b) => (a.index > b.index ? 1 : -1));
  return players;
}

export const getRelativeTime = (game: InternalGameState, currentRealTime: number) => {
  const realDuration = currentRealTime - game.latestRealTime;
  const relativeDuration = game.timeFlow === TimeFlow.Forward ? realDuration : -1 * realDuration;
  return game.latestRelativeTime + relativeDuration;
};

export const getRealTime = (game: InternalGameState, relativeTime: number) => {
  const duration = Math.abs(relativeTime - game.latestRelativeTime);
  return game.latestRealTime + duration;
}

const reverseOperation = (op: Operation): Operation => {
  switch (op) {
    case Operation.Up:
      return Operation.Down;
    case Operation.Down:
      return Operation.Up;
    case Operation.Right:
      return Operation.Left;
    case Operation.Left:
      return Operation.Right;
    case Operation.End:
      return Operation.Start;
    case Operation.Start:
      return Operation.End;
    default:
      return op;
  }
}

export const getGameState = async (
  db: DatabaseReader,
  game: InternalGameState,
): Promise<[GameState, number] | null> => {
  const players = await getPlayers(db, game._id);
  const moves = await getMovesRealTime(db, game._id, true);
  if (moves.length === 0) {
    throw Error("game has no moves");
  }
  const maxMoveRealTime = moves[moves.length-1].realTime;
  const config = getConfig(game.level);
  players[0].formerX = config.playerStartX;
  players[0].formerY = config.playerStartY;

  const relativeTime = getRelativeTime(game, maxMoveRealTime);
  const forward = game.timeFlow === TimeFlow.Forward;
  const nextMoves = await getMoves(db, game._id, relativeTime, !forward, false, forward);
  const nextTime = (nextMoves.length === 0 ? null : getRealTime(game, nextMoves[0].millisSinceStart));
  const gameState = computeGameState(game, players, moves, nextTime);
  if (!gameState) {
    return null;
  }
  return [gameState, Math.max((new Date()).getTime(), maxMoveRealTime)];
};

export const bumpGameState = async (
  db: DatabaseWriter,
  game: InternalGameState,
) => {
  const realMoves = await getMovesRealTime(db, game._id, false);
  const maxRealTimeMovePlayed = realMoves.length === 0 ? 0 : realMoves[0].realTime;
  const currentTime = Math.max((new Date()).getTime(), maxRealTimeMovePlayed);
  const relativeTime = getRelativeTime(game, maxRealTimeMovePlayed);
  const forward = game.timeFlow === TimeFlow.Forward;
  const players = await getPlayers(db, game._id);
  const nextMoves = await getMoves(db, game._id, relativeTime, !forward, false, forward);
  for (let nextMove of nextMoves) {
    const expectedRealTime = getRealTime(game, nextMove.millisSinceStart);
    const operation = (players[nextMove.playerIndex].timeFlow === game.timeFlow ?
      nextMove.operation : reverseOperation(nextMove.operation));
    if (expectedRealTime <= currentTime) {
      console.log(`materializing non-user-action move for ${nextMove.playerIndex} operation ${operation} relative time ${nextMove.millisSinceStart}`);
      db.insert("moves", {
        gameId: nextMove.gameId,
        playerIndex: nextMove.playerIndex,
        millisSinceStart: nextMove.millisSinceStart,
        operation,
        realTime: expectedRealTime,
        userAction: false,
      });
    }
  }
};
