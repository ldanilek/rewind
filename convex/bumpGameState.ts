import { mutation } from "./_generated/server";
import { 
  getUser, 
  getGame,
  bumpGameState,
} from "../common";

export default mutation(async ({ db, auth }) => {
  const user = await getUser(db, auth);
  const game = await getGame(db, user);
  if (!game) {
    return;
  }
  await bumpGameState(db, game);
});
