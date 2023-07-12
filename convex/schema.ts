import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { TimeFlow } from "../common";

export default defineSchema({
  moves: defineTable({
    gameId: v.id("games"),
    playerIndex: v.number(),
    millisSinceStart: v.number(),
    operation: v.number(), // enum Operation
    realTime: v.number(),
    userAction: v.boolean(),
  })
    .index("user_action_by_millis_since_start", [
      "gameId",
      "userAction",
      "millisSinceStart",
    ])
    .index("by_game_real_time", ["gameId", "realTime"]),
  players: defineTable({
    gameId: v.id("games"),
    index: v.number(),
    timeFlow: v.union(
      v.literal(TimeFlow.Forward),
      v.literal(TimeFlow.Backward)
    ),
    // Temporary, not persisted to db
    formerX: v.optional(v.number()),
    formerY: v.optional(v.number()),
    startX: v.union(v.number(), v.null()),
    startY: v.union(v.number(), v.null()),
    endX: v.optional(v.union(v.number(), v.null())),
    endY: v.optional(v.union(v.number(), v.null())),
  }).index("by_index", ["gameId", "index"]),
  games: defineTable({
    userId: v.id("users"),
    level: v.number(),

    // About the current player:
    // Their index, where they started in real time and relative time, and their time flow.
    currentPlayerIndex: v.number(),
    // From Date.getTime(); Necessary because Convex doesn't support Date.
    latestRealTime: v.number(),
    latestRelativeTime: v.number(),
    timeFlow: v.union(
      v.literal(TimeFlow.Forward),
      v.literal(TimeFlow.Backward)
    ),
  }).index("by_user", ["userId"]),
  users: defineTable({
    name: v.string(),
    tokenIdentifier: v.string(),
  }).index("by_token", ["tokenIdentifier"]),
});
