import assert from "node:assert/strict";
import test from "node:test";
import { acceptsAttack, baseAttack, cancelQueuedGarbage, takeReadyGarbage } from "../lib/tetris/garbage.ts";
import { readFileSync } from "node:fs";
import ts from "typescript";

function compileModule(file, dependencies = {}) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)((name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}
const constants = compileModule("../lib/tetris/constants.ts");
const { TetrisEngine } = compileModule("../lib/tetris/engine.ts", { "./constants": constants });

test("a two-line clear removes both rows and sends garbage only to the target board", () => {
  const sender = new TetrisEngine(1);
  const target = new TetrisEngine(2);
  const spectator = new TetrisEngine(3);
  for (const engine of [sender, target, spectator]) engine.start();
  for (let y = 20; y < 22; y++) {
    sender.board[y] = Array(10).fill("J");
    sender.board[y][4] = 0;
    sender.board[y][5] = 0;
  }
  sender.active = { type: "O", rotation: 0, x: 4, y: 20 };
  const clear = sender.lockPiece();
  assert.equal(clear.lines, 2);
  assert.ok(sender.board.every((row) => row.every((cell) => cell === 0)), "both cleared rows must disappear");
  const attack = { fromId: "sender", toId: "target", amount: baseAttack({ lines: clear.lines, tspin: false }) };
  for (const [id, engine] of [["sender", sender], ["target", target], ["spectator", spectator]]) {
    if (acceptsAttack(id, attack)) engine.addGarbageRows(Array(attack.amount).fill(4));
  }
  assert.equal(sender.board.flat().filter((cell) => cell === "G").length, 0);
  assert.equal(target.board.flat().filter((cell) => cell === "G").length, 9);
  assert.equal(spectator.board.flat().filter((cell) => cell === "G").length, 0);
  assert.equal(acceptsAttack("sender", { ...attack, toId: "sender" }), false);
});

test("delayed batches cannot repeatedly insert rows that were never consumed", () => {
  const queue = [{ amount: 3, receivedAt: 1900 }, { amount: 4, receivedAt: 0 }];
  const first = takeReadyGarbage(queue, 2000, 1000);
  assert.equal(first.amount, 4);
  assert.deepEqual(first.pending, [queue[0]]);
  assert.equal(takeReadyGarbage(first.pending, 2200, 1000).amount, 0);
  const last = takeReadyGarbage(first.pending, 3000, 1000);
  assert.equal(last.amount, 3);
  assert.deepEqual(last.pending, []);
});

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
