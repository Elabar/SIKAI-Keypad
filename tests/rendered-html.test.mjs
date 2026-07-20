import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the keypad configurator", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Keypad Lab/);
  assert.match(html, /Assignments and lighting/);
  assert.match(html, /Configure layer 1/);
  assert.match(html, /RGB settings/);
  assert.match(html, /Debug information/);
});

test("keeps protocol and presentation concerns separated", async () => {
  const [page, store, keypadClass] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../stores/keypad-store.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../lib/sikai-keypad/sikai-keypad.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(page, /<Hero \/>/);
  assert.match(page, /<KeyAssignmentEditor \/>/);
  assert.match(page, /<RgbEditor \/>/);
  assert.doesNotMatch(page, /sendReport|requestDevice|inputreport/);
  assert.match(store, /create<KeypadState>/);
  assert.match(store, /actions:\s*\{/);
  assert.match(store, /useKeypadActions/);
  assert.match(store, /connect:\s*async/);
  assert.match(store, /applyAssignments:\s*async/);
  assert.match(store, /applyRgb:\s*async/);
  assert.match(keypadClass, /export class SikaiKeypad/);
  assert.match(keypadClass, /readAssignments/);
  assert.match(keypadClass, /writeAssignments/);
  assert.match(keypadClass, /readCurrentRgb/);
  assert.match(keypadClass, /writeRgb/);
});
