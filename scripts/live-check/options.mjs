// Beta 0.10.1 options-page checks, driven with trusted CDP input events.
import { connectBrowser, targets, attach, worker, sleep, check, failed, outPath } from "./lib.mjs";

const b = await connectBrowser();
await sleep(1500);

// 1. First install opens the options page.
const all = await targets(b);
const optTarget = all.find((t) => t.type === "page" && t.url.endsWith("/src/options.html"));
check("first install opens the options page", !!optTarget, optTarget?.url);
const p = await attach(b, optTarget.targetId);
await p.send("Page.enable");
await p.send("Emulation.setDeviceMetricsOverride", { width: 1100, height: 1400, deviceScaleFactor: 1, mobile: false });
await p.send("Emulation.setFocusEmulationEnabled", { enabled: true });

const sw = await worker(b);
const stored = () => sw.eval("chrome.storage.sync.get(null)");
const html = () => p.eval("document.documentElement.className");
const revealed = async () => (await html()).includes("dt-subtitles--revealed");

check("version is 0.10.1", (await p.eval("chrome.runtime.getManifest().version")) === "0.10.1");
const fresh = await p.eval(`({ subs: document.querySelector('[name=subtitlesEnabled]').checked, diff: document.querySelector('[name=difficultyEnabled]').checked, subDisabled: document.querySelector('#subtitle-controls').disabled, save: !!document.querySelector('button[type=submit]') })`);
check("both tools off after a fresh install, controls disabled", !fresh.subs && !fresh.diff && fresh.subDisabled, JSON.stringify(fresh));
check("no Save button", !fresh.save);

async function click(selector) {
  const r = await p.eval(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); e.scrollIntoView({ block: "center" }); const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  await p.mouse("mouseMoved", r.x, r.y);
  await p.mouse("mousePressed", r.x, r.y);
  await p.mouse("mouseReleased", r.x, r.y);
  await sleep(300);
  return r;
}
async function choose(name, value) {
  await p.eval(`(() => { const e = document.querySelector('[name=${name}]'); e.focus(); e.value = ${JSON.stringify(String(value))}; e.dispatchEvent(new Event('change', { bubbles: true })); e.blur(); })()`);
  await sleep(300);
}
const status = () => p.eval("document.querySelector('#status').textContent");

// 2. Auto-save.
await click("[name=subtitlesEnabled]");
check("switching on Subtitles auto-saves", (await status()) === "Saved." && (await stored()).subtitlesEnabled === true, await status());
await click("[name=difficultyEnabled]");
check("switching on Difficulty auto-saves", (await stored()).difficultyEnabled === true);
await choose("subtitleStyle", "hidden");
check("changing a select auto-saves", (await stored()).subtitleStyle === "hidden");
await p.send("Page.reload");
await sleep(1500);
check("saved settings survive a page reload", (await p.eval("document.querySelector('[name=subtitleStyle]').value")) === "hidden");

// 3. Theme: every token resolves, and dark mode changes the page and surface.
const theme = async (mode) => {
  await p.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: mode }] });
  await sleep(200);
  return p.eval(`({ page: getComputedStyle(document.body).backgroundColor, panel: getComputedStyle(document.querySelector('.panel')).backgroundColor, text: getComputedStyle(document.body).color })`);
};
const light = await theme("light");
const dark = await theme("dark");
check("dark mode changes page, card, and text colors", light.page !== dark.page && light.panel !== dark.panel && light.text !== dark.text, `light ${JSON.stringify(light)} dark ${JSON.stringify(dark)}`);
await p.send("Page.captureScreenshot", { format: "png" }).then((r) => import("node:fs").then((fs) => fs.writeFileSync(outPath("options-dark.png"), Buffer.from(r.result.data, "base64"))));
await theme("light");
await p.send("Page.captureScreenshot", { format: "png" }).then((r) => import("node:fs").then((fs) => fs.writeFileSync(outPath("options-light.png"), Buffer.from(r.result.data, "base64"))));

// 4. Preview reveal, Hold mode with the S key anywhere on the page.
await choose("subtitleStyle", "blur");
await p.eval("document.activeElement?.blur(); document.body.focus()");
const previewFilter = () => p.eval("getComputedStyle(document.querySelector('#subtitle-preview .shaka-text-container')).filter + ' | ' + getComputedStyle(document.querySelector('#youtube-subtitle-preview .caption-window')).filter");
check("both previews blurred before reveal", (await previewFilter()) === "blur(6px) | blur(6px)", await previewFilter());
await p.key("keyDown", "KeyS", "s");
await sleep(200);
check("Hold: S down reveals both previews", (await revealed()) && (await previewFilter()) === "none | none", await previewFilter());
await p.key("keyDown", "KeyS", "s", { autoRepeat: true });
await p.key("keyUp", "KeyS", "s");
await sleep(200);
check("Hold: S up hides again (repeat ignored)", !(await revealed()));
await click("#subtitle-preview");
// click() presses and releases; test press-and-hold explicitly.
const pt = await p.eval("(() => { const b = document.querySelector('#youtube-subtitle-preview').getBoundingClientRect(); return { x: b.x + 20, y: b.y + 20 }; })()");
await p.mouse("mousePressed", pt.x, pt.y);
await sleep(150);
check("Hold: pressing a preview reveals", await revealed());
await p.mouse("mouseReleased", pt.x, pt.y);
await sleep(150);
check("Hold: releasing the preview hides", !(await revealed()));

// 5. Toggle mode with auto-hide 3.
await choose("revealMode", "toggle");
await choose("revealAutoHide", 3);
await p.eval("document.activeElement?.blur()");
await p.key("keyDown", "KeyS", "s"); await p.key("keyUp", "KeyS", "s");
await sleep(200);
check("Toggle: a press reveals and stays after release", await revealed());
await p.key("keyDown", "KeyS", "s"); await p.key("keyUp", "KeyS", "s");
await sleep(200);
check("Toggle: a second press hides", !(await revealed()));
await p.key("keyDown", "KeyS", "s"); await p.key("keyUp", "KeyS", "s");
await sleep(2500);
const stillShown = await revealed();
await sleep(1000);
check("Toggle: auto-hide at 3 s", stillShown && !(await revealed()));
await click("#subtitle-preview");
check("Toggle: clicking a preview reveals", await revealed());
await p.mouse("mouseMoved", 5, 5);
await sleep(150);
check("Toggle: leaving the preview does not hide", await revealed());
await choose("revealMode", "hold");
check("changing the reveal mode while revealed hides", !(await revealed()));

// 6. Re-binding the key to J.
await click("#reveal-key-button");
const prompt = await p.eval("document.querySelector('#reveal-key-button').textContent");
await p.key("keyDown", "KeyS", "s");
await sleep(150);
check("while choosing a key, S is recorded and does not reveal", !(await revealed()) && prompt === "Press a key…", `prompt=${prompt}`);
await p.key("keyUp", "KeyS", "s");
await click("#reveal-key-button");
await p.key("keyDown", "KeyJ", "j"); await p.key("keyUp", "KeyJ", "j");
await sleep(300);
check("reveal key saved as J", (await stored()).revealKey === "KeyJ", await p.eval("document.querySelector('#reveal-key-button').textContent"));
await p.eval("document.activeElement?.blur()");
await p.key("keyDown", "KeyS", "s");
await sleep(150);
check("after re-binding, S no longer reveals", !(await revealed()));
await p.key("keyUp", "KeyS", "s");
await p.key("keyDown", "KeyJ", "j");
await sleep(150);
check("after re-binding, J reveals", await revealed());
await p.key("keyUp", "KeyJ", "j");
await click("#reveal-key-button");
await p.send("Input.dispatchKeyEvent", { type: "keyDown", code: "Space", key: " ", windowsVirtualKeyCode: 32 });
await sleep(200);
check("Space is rejected as the reveal key", (await status()).includes("can't be used") && (await stored()).revealKey === "KeyJ", await status());
await p.send("Input.dispatchKeyEvent", { type: "keyUp", code: "Space", key: " ", windowsVirtualKeyCode: 32 });
await p.send("Input.dispatchKeyEvent", { type: "keyDown", code: "Escape", key: "Escape", windowsVirtualKeyCode: 27 });
await sleep(200);
check("Escape cancels capture and keeps J", (await p.eval("document.querySelector('#reveal-key-button').textContent")) !== "Press a key…" && (await stored()).revealKey === "KeyJ");

// 7. Key ignored with Ctrl, and while a select is focused.
await p.eval("document.activeElement?.blur()");
await p.key("keyDown", "KeyJ", "j", { modifiers: 2 });
await sleep(150);
check("Ctrl+J does not reveal", !(await revealed()));
await p.key("keyUp", "KeyJ", "j", { modifiers: 2 });
await p.eval("document.querySelector('[name=subtitleStyle]').focus()");
await p.key("keyDown", "KeyJ", "j");
await sleep(150);
check("J does not reveal while a select is focused", !(await revealed()));
await p.key("keyUp", "KeyJ", "j");

// 8. Difficulty preview follows settings.
await p.eval("document.activeElement?.blur()");
const badge = () => p.eval("(() => { const e = document.querySelector('#preview-badge'); return { cls: e.className, hidden: e.hidden, disabledPill: !document.querySelector('#preview-disabled').hidden }; })()");
const before = await badge();
await choose("size", "large");
await choose("position", "lower-left");
await choose("style", "enhanced");
const after = await badge();
check("difficulty preview restyles with size, position, style", before.cls !== after.cls && !after.hidden, `${before.cls} -> ${after.cls}`);
await click("[name=difficultyEnabled]");
const off = await badge();
check("difficulty off shows the disabled pill", off.disabledPill && off.hidden, JSON.stringify(off));
await click("[name=difficultyEnabled]");

// 9. Restore defaults.
await click("#reset-options");
await sleep(300);
const s = await stored();
check("Restore defaults writes the defaults", s.subtitlesEnabled === false && s.difficultyEnabled === false && s.revealKey === "KeyS" && s.subtitleStyle === "blur" && s.size === "small", JSON.stringify(s));
check("Restore defaults updates the form", (await p.eval("document.querySelector('#reveal-key-button').textContent")) === "S" && !(await p.eval("document.querySelector('[name=subtitlesEnabled]').checked")));

console.log(`\n${failed()} failed`);
process.exitCode = failed() ? 1 : 0;
b.close();
