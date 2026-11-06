import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RUNTIME_FILES } from "../scripts/package-extension.js";

const css = readFileSync(new URL("../src/options.css", import.meta.url), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");

function tokensIn(block) {
  return new Set([...block.matchAll(/(--[\w-]+)\s*:/g)].map(([, name]) => name));
}

const lightBlock = css.match(/^:root\s*\{([^}]*)\}/m)?.[1] ?? "";
const darkBlock = css.match(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([^}]*)\}/)?.[1] ?? "";

describe("options page stylesheet", () => {
  it("defines its colors as tokens and redefines every one for dark mode", () => {
    const light = tokensIn(lightBlock);

    expect(light.size).toBeGreaterThan(10);
    expect(tokensIn(darkBlock)).toEqual(light);
    expect(lightBlock).toMatch(/color-scheme:\s*light dark/);
  });

  // Player caption colors imitate the real players, so they are the same in
  // both themes and live in their own fixed :root block.
  it("uses tokens rather than literal colors outside the token blocks", () => {
    const rules = css.replace(/:root\s*\{[^}]*\}/g, "");

    expect(rules.match(/#[0-9a-f]{3,8}\b|rgba?\(/gi) ?? []).toEqual([]);
  });

  it("sizes text in relative units so it follows the browser's default font size", () => {
    expect(css.match(/font-size:\s*[\d.]+px/g) ?? []).toEqual([]);
  });

  it("references only files that ship in the package", () => {
    const urls = [...css.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(([, url]) => `src/${url}`);

    expect(urls).toContain("src/preview-scene.svg");
    for (const url of urls) {
      expect(RUNTIME_FILES).toContain(url);
    }
  });
});
