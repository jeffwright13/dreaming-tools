// Switch badges on (Enhanced everywhere) and count badges on each URL given.
import { connectBrowser, openPage, worker, sleep } from "./lib.mjs";
const b = await connectBrowser(); const sw = await worker(b);
await sw.eval("chrome.storage.sync.set({ difficultyEnabled: true, behavior: 'enhanced-everywhere' })");
for (const url of process.argv.slice(2)) {
  const p = await openPage(b, url); await sleep(9000);
  console.log(url, JSON.stringify(await p.eval(`({ cards: document.querySelectorAll('a[href*="watch?id="]').length, badges: document.querySelectorAll('.ds-difficulty-extension-badge').length, gated: /Create a free account|Log in to/i.test(document.body.innerText) })`)));
}
b.close();
