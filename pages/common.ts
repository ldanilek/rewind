import {Id} from "convex-dev/values"

export enum GameObjectType {
  Player = 1,
  FormerPlayer,
  Obstacle,
  Goal,
  Sensor,
}

export type SensorTarget = {
  objectIndex: number,
  // For now all targets disappear while the sensor is triggered, and reappear after.
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

export enum Operation {
  Up = 1,
  Down,
  Left,
  Right,
  Rewind,
}

export type PlayerMove = {
  millisSinceStart: number,
  operation: Operation,
};

export type PlayerSequence = {
  moves: Array<PlayerMove>,
};

export type InternalGameState = {
  _id: Id,
  // From Date.getTime(); Necessary because Convex doesn't support Date.
  latestRewindTime: number,
  // Excluding players
  initialObjects: Array<GameObject>,
  playerStartX: number,
  playerStartY: number,
  playerMoves: Array<PlayerSequence>,
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
      completion = "You Win!";
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
  updatedObjects.forEach((object, index) => {
    if (object.objectType === GameObjectType.Sensor) {
      let sensorTriggered = false;
      for(let maybePlayer of updatedObjects) {
        if (maybePlayer.objectType === GameObjectType.Player || maybePlayer.objectType === GameObjectType.FormerPlayer) {
          if (object.locationX === maybePlayer.locationX && object.locationY === maybePlayer.locationY) {
            sensorTriggered = true;
          }
        }
      }
      const targetIndex = object.sensorTarget!.objectIndex;
      const targetObject = updatedObjects[targetIndex];
      if (sensorTriggered) {
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
  });
  return {
    ...gameState,
    objects: updatedObjects,
    completionMessage: completion,
  };
};

export const computeGameState = (game: InternalGameState, atTime: number): GameState => {
  const currentMillisSinceStart = atTime - game.latestRewindTime;
  let objects = game.initialObjects.slice();
  const playerIndexOffset = objects.length;
  for (let playerIndex = 0; playerIndex < game.playerMoves.length-1; playerIndex++) {
    objects.push({
      objectType: GameObjectType.FormerPlayer,
      locationX: game.playerStartX,
      locationY: game.playerStartY,
    });
  }
  objects.push({
    objectType: GameObjectType.Player,
    locationX: game.playerStartX,
    locationY: game.playerStartY,
  })
  let gameState: GameState = {
    objects,
    nextTime: null,
    completionMessage: null,
  };
  // Sort moves by time.
  // TODO: do this in the database by storing moves in a separate table.
  const allMoves = game.playerMoves.flatMap((sequence, playerIndex) => sequence.moves.map((move) => ({
    ...move,
    playerIndex: playerIndex+playerIndexOffset,
  })));
  allMoves.sort((a, b) => (a.millisSinceStart > b.millisSinceStart) ? 1 : -1);

  for (let move of allMoves) {
    if (move.millisSinceStart <= currentMillisSinceStart) {
      gameState = navigateInGame(gameState, move.playerIndex, move.operation);
    } else {
      gameState.nextTime = game.latestRewindTime + move.millisSinceStart;
      break;
    }
  }
  return gameState;
}

export const initialGameState = (level: number): InternalGameState => {
  let initialObjects: GameObject[] = [];
  // NOTE: needs to be "any" because there's no valid value for `_id`
  let state: any = {
    latestRewindTime: (new Date()).getTime(),
    initialObjects,
    playerStartX: 0,
    playerStartY: 0,
    playerMoves: [{moves: []}],
  };

  switch (level) {
    case 1:
      initialObjects.push({
        objectType: GameObjectType.Goal,
        locationX: 5,
        locationY: 5,
      });
      for (let i = 0; i < 14; i++) {
        initialObjects.push({
          objectType: GameObjectType.Obstacle,
          locationX: 3,
          locationY: i,
        });
      }
      break;

    case 2:
      initialObjects.push({
        objectType: GameObjectType.Goal,
        locationX: 5,
        locationY: 5,
      });
      for (let i = 0; i < 15; i++) {
        initialObjects.push({
          objectType: GameObjectType.Obstacle,
          locationX: 3,
          locationY: i,
        });
      }
      initialObjects.push({
        objectType: GameObjectType.Sensor,
        locationX: 1,
        locationY: 13,
        sensorTarget: {objectIndex: 6},
      });
      break;
  }
  return state;
};
