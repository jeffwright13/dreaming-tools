// Minimal CDP client for driving headless Edge with the beta extension loaded.
import os from "node:os";
import path from "node:path";

export const PORT = Number(process.env.CDP_PORT ?? 9334);
// Screenshots go here, never into the repository.
export const outPath = (name) => path.join(process.env.OUT_DIR ?? os.tmpdir(), name);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function connectBrowser() {
  const { webSocketDebuggerUrl } = await (await fetch(`http://localhost:${PORT}/json/version`)).json();
  const ws = new WebSocket(webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  };
  await new Promise((r) => { ws.onopen = r; });
  const send = (method, params = {}, sessionId) => new Promise((r) => {
    const i = ++id;
    pending.set(i, r);
    ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  return { ws, send, close: () => ws.close() };
}

export async function targets(b) {
  return (await b.send("Target.getTargets")).result.targetInfos;
}

export async function attach(b, targetId) {
  const r = await b.send("Target.attachToTarget", { targetId, flatten: true });
  const sessionId = r.result.sessionId;
  const s = (method, params) => b.send(method, params, sessionId);
  await s("Runtime.enable");
  return {
    send: s,
    async eval(expression) {
      const r = await s("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
      if (r.result?.exceptionDetails) return "EXC: " + (r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text);
      return r.result?.result?.value;
    },
    async key(type, code, key, extra = {}) {
      const vk = { KeyS: 83, KeyJ: 74 }[code] ?? 0;
      await s("Input.dispatchKeyEvent", { type, code, key, windowsVirtualKeyCode: vk, text: type === "keyDown" ? key : undefined, ...extra });
    },
    async mouse(type, x, y) {
      await s("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
    },
  };
}

export async function openPage(b, url) {
  const { result } = await b.send("Target.createTarget", { url });
  return attach(b, result.targetId);
}

export async function worker(b) {
  for (let i = 0; i < 40; i++) {
    const t = (await targets(b)).find((t) => t.type === "service_worker" && t.url.endsWith("/src/background.js"));
    if (t) return attach(b, t.targetId);
    await sleep(250);
  }
  throw new Error("no service worker");
}

let failures = 0;
export function check(name, ok, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}
export const failed = () => failures;
