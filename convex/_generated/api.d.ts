/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * Generated by convex@0.19.0.
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as bumpGameState from "../bumpGameState";
import type * as clearMoves from "../clearMoves";
import type * as getGame from "../getGame";
import type * as getGameMetadata from "../getGameMetadata";
import type * as navigate from "../navigate";
import type * as reset from "../reset";
import type * as storeUser from "../storeUser";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  bumpGameState: typeof bumpGameState;
  clearMoves: typeof clearMoves;
  getGame: typeof getGame;
  getGameMetadata: typeof getGameMetadata;
  navigate: typeof navigate;
  reset: typeof reset;
  storeUser: typeof storeUser;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;