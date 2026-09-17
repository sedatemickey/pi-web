import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { tsconfigPaths: true });
const { copyText } = await jiti.import("./clipboard.ts");

function replaceGlobal(name, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, value });
  return () => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  };
}

test("uses the async clipboard API when available", { concurrency: false }, async () => {
  let copied = "";
  const restoreNavigator = replaceGlobal("navigator", {
    clipboard: { writeText: async (text) => { copied = text; } },
  });
  try {
    await copyText("table data");
    assert.equal(copied, "table data");
  } finally {
    restoreNavigator();
  }
});

test("rejects a failed legacy copy and always removes its textarea", { concurrency: false }, async () => {
  let removed = false;
  const textarea = {
    value: "",
    style: {},
    select() {},
    remove() { removed = true; },
  };
  const restoreNavigator = replaceGlobal("navigator", {});
  const restoreDocument = replaceGlobal("document", {
    createElement() { return textarea; },
    body: { appendChild() {} },
    execCommand() { return false; },
  });
  try {
    await assert.rejects(copyText("table data"), /rejected/);
    assert.equal(removed, true);
  } finally {
    restoreDocument();
    restoreNavigator();
  }
});
