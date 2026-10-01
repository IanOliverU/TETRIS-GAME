import assert from "node:assert/strict";
import test from "node:test";
import { baseAttack, cancelQueuedGarbage } from "../lib/tetris/garbage.ts";

const item = (amount, receivedAt) => ({ amount, receivedAt });

test("a single line generates an attack", () => {
  assert.equal(baseAttack({ lines: 1, tspin: false }), 1);
});

test("clearing cancels visible and delayed incoming garbage before attacking", () => {
  const pending = [item(3, 1)];
  const deferred = [{ item: item(4, 2), at: 1500 }];
  const result = cancelQueuedGarbage(5, pending, deferred);
  assert.equal(result.remaining, 0);
  assert.equal(result.cancelled, 5);
  assert.deepEqual(result.pending, []);
  assert.deepEqual(result.deferred, [{ item: item(2, 2), at: 1500 }]);
  assert.equal(pending[0].amount, 3);
  assert.equal(deferred[0].item.amount, 4);
});

test("only the uncancelled remainder is sent to an opponent", () => {
  const result = cancelQueuedGarbage(6, [item(2, 1)], [],);
  assert.equal(result.remaining, 4);
  assert.deepEqual(result.pending, []);
});
