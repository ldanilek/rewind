# Welcome to your functions directory

Write your convex functions in this directory.

A query function (how you read data) looks like this:

```typescript
// getCounter.ts
import { query } from "convex-dev/server";

export default query(async ({ db }): Promise<number> => {
  const counterDoc = await db.table("counter_table").first();
  console.log("Got stuff");
  if (counterDoc === null) {
    return 0;
  }
  return counterDoc.counter;
});
```

A mutation function (how you write data) looks like this:

```typescript
// incrementCounter.ts
import { mutation } from "convex-dev/server";

export default mutation(async ({ db }, increment: number) => {
  let counterDoc = await db.table("counter_table").first();
  if (counterDoc === null) {
    counterDoc = {
      counter: increment,
    };
    await db.insert("counter_table", counterDoc);
  } else {
    counterDoc.counter += increment;
    await db.update(counterDoc._id, counterDoc);
  }
  // Like console.log but relays log messages from the server to client.
  console.log(`Value of counter is now ${counterDoc.counter}`);
});
```

The convex cli is your friend. See everything it can do by running
`npx convex -h` in your project root directory. To learn more, launch the docs
with `npx convex docs`.

