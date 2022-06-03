import { mutation } from "convex-dev/server";
import { Id } from "convex-dev/values";

export default mutation(async ({ db, auth }) => {
  const moves = await db.table("moves").fullTableScan().collect();
  for (let move of moves) {
    db.delete(move._id);
  }
});
