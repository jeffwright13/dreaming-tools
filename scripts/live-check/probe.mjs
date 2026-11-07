// Open a watch page logged out and report what the player exposes.
import fs from "node:fs";
import { connectBrowser, openPage, worker, sleep, outPath } from "./lib.mjs";

const url = process.argv[2];
const b = await connectBrowser();
const sw = await worker(b);
await sw.eval("chrome.storage.sync.set({ subtitlesEnabled: true, subtitleStyle: 'blur', revealMode: 'hold', revealKey: 'KeyS' })");
const p = await openPage(b, url);
await p.send("Page.enable");
await p.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
await sleep(9000);
console.log(JSON.stringify(await p.eval(`({
  url: location.href,
  cls: document.documentElement.className,
  video: !!document.querySelector('video'),
  shaka: !!document.querySelector('.shaka-text-container'),
  iframes: [...document.querySelectorAll('iframe')].map(f => f.src.slice(0, 90)),
  buttons: [...document.querySelectorAll('button')].map(b => (b.getAttribute('aria-label') || b.innerText).trim()).filter(Boolean).slice(0, 40),
  text: document.body.innerText.slice(0, 600),
})`), null, 1));
const shot = await p.send("Page.captureScreenshot", { format: "png" });
fs.writeFileSync(outPath(`probe-${process.argv[3] ?? "page"}.png`), Buffer.from(shot.result.data, "base64"));
b.close();
