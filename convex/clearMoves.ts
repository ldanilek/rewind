import { mutation } from "./_generated/server";

export default mutation(async ({ db, auth }) => {
  const moves = await db.query("moves").fullTableScan().collect();
  for (let move of moves) {
    db.delete(move._id);
  }
});
