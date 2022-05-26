import {Id} from "convex-dev/values"
import { DatabaseReader, Auth } from "convex-dev/server";

export type User = {
  _id: Id;
  name: string;
  tokenIdentifier: string;
};

export enum GameObjectType {
  Player = 1,
  FormerPlayer,
  Obstacle,
  Goal,
  Sensor,
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
};

export enum Operation {
  Up = 1,
  Down,
  Left,
  Right,
  Rewind,
}

export type PlayerMove = {
  _id: Id,
  gameId: Id,
  playerIndex: number,
  millisSinceStart: number,
  operation: Operation,
};

export type InternalGameState = {
  _id: Id,
  userId: Id,
  level: number,
  // From Date.getTime(); Necessary because Convex doesn't support Date.
  latestRewindTime: number,
  currentPlayerIndex: number,
};

export type GameConfig = {
  // Excluding players
  initialObjects: Array<GameObject>,
  playerStartX: number,
  playerStartY: number,
  maxRewinds: number,
};

const dvorak = false;

const aKey = dvorak ? 65 : 65;
const sKey = dvorak ? 79 : 83;
const dKey = dvorak ? 69 : 68;
const wKey = dvorak ? 188 : 87;
const rKey = dvorak ? 0 : 82;

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
    case rKey:
      return Operation.Rewind;
    default:
      return null;
  }
};

enum OperationResult {
  Allowed = 1,
  Blocked,
  Win,
}

const navigationResult = (x: number | null, y: number | null, gameState: GameState): OperationResult => {
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

export const navigateInGame = (gameState: GameState, playerIndex: number, operation: Operation): GameState => {
  if (gameState.completionMessage !== null) {
    return gameState;
  }
  const player = gameState.objects[playerIndex];
  let newX = player.locationX;
  let newY = player.locationY;
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
    case Operation.Rewind:
      newX = null;
      newY = null;
      break;
    default:
      throw Error("unrecognized operation");
  }
  let completion: string | null = gameState.completionMessage;
  switch (navigationResult(newX, newY, gameState)) {
    case OperationResult.Allowed:
      break;
    case OperationResult.Blocked:
      newX = player.locationX;
      newY = player.locationY;
      break;
    case OperationResult.Win:
      break;
    default:
      throw Error("unexpected result");
  }
  let updatedObjects = gameState.objects.slice();
  updatedObjects[playerIndex] = {
    ...player,
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

export const computeGameState = (game: InternalGameState, moves: PlayerMove[], nextTime: number | null): GameState => {
  const config = getConfig(game.level);
  let objects = config.initialObjects.slice();
  const playerIndexOffset = objects.length;
  for (let playerIndex = 0; playerIndex < game.currentPlayerIndex; playerIndex++) {
    objects.push({
      objectType: GameObjectType.FormerPlayer,
      locationX: config.playerStartX,
      locationY: config.playerStartY,
    });
  }
  objects.push({
    objectType: GameObjectType.Player,
    locationX: config.playerStartX,
    locationY: config.playerStartY,
  })
  let gameState: GameState = {
    objects,
    nextTime,
    completionMessage: null,
  };
  // Moves should already be sorted by time.
  // Sort moves by time.
  // TODO: do this in the database by storing moves in a separate table.
  for (let move of moves) {
    let playerIndex = move.playerIndex + playerIndexOffset;
    gameState = navigateInGame(gameState, playerIndex, move.operation);
  }
  return gameState;
}

export const initialGameState = (level: number, userId: Id): InternalGameState => {
  // NOTE: needs to be "any" because there's no valid value for `_id`
  let state: any = {
    userId,
    level,
    latestRewindTime: (new Date()).getTime(),
    currentPlayerIndex: 0,
  };
  return state;
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

  // Partial wall.
  let objects1: GameObject[] = [];
  objects1.push(goal(5, 5));
  for (let i = 0; i < 14; i++) {
    objects1.push(obstacle(3, i));
  }

  // Full wall with a sensor that opens a hole.
  let objects2: GameObject[] = [];
  objects2.push(goal(5, 5));
  for (let i = 0; i < 15; i++) {
    objects2.push(obstacle(3, i));
  }
  objects2.push(sensor(1, 13, 6));

  // Partial wall and Two goals
  let objects3: GameObject[] = [];
  objects3.push(goal(5, 5), goal(10, 3));
  for (let i = 0; i < 14; i++) {
    objects3.push(obstacle(3, i));
  }

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
  ];

  let objects6 = objects2.slice();
  objects6.push(goal(2, 0));

  return new Map<number, GameConfig>([
    [1, {initialObjects: objects1, playerStartX: 0, playerStartY: 0, maxRewinds: 10}],
    [2, {initialObjects: objects2, playerStartX: 0, playerStartY: 0, maxRewinds: 10}],
    [3, {initialObjects: objects3, playerStartX: 0, playerStartY: 0, maxRewinds: 10}],
    [4, {initialObjects: objects4, playerStartX: 14, playerStartY: 8, maxRewinds: 10}],
    [5, {initialObjects: objects4, playerStartX: 14, playerStartY: 8, maxRewinds: 1}],
    [6, {initialObjects: objects6, playerStartX: 0, playerStartY: 0, maxRewinds: 1}],
  ]);
})();

export const getConfig = (level: number): GameConfig => {
  const config = gameConfigForLevel.get(level);
  if (config) {
    return config;
  }
  return {playerStartX: 0, playerStartY: 0, initialObjects: [], maxRewinds: 1000};
}

export const getUser = async (db: DatabaseReader, auth: Auth): Promise<User> => {
  const identity = await auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated call to reset");
  }
  const user = await db
    .table("users")
    .filter(q => q.eq(q.field("tokenIdentifier"), identity.tokenIdentifier))
    .unique();
  return user;
};

export const getGame = async (db: DatabaseReader, user: User): Promise<InternalGameState | null> => {
  return await db.table("games").order("desc").filter(
    q => q.eq(q.field("userId"), user._id)
  ).first();
}
