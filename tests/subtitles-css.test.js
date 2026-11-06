import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../src/subtitles.css", import.meta.url), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");

function selectorsMatching(fragment) {
  return css
    .split("}")
    .map((rule) => rule.split("{")[0])
    .flatMap((selectorList) => selectorList.split(","))
    .map((selector) => selector.trim().replace(/\s+/g, " "))
    .filter((selector) => selector.includes(fragment));
}

describe("subtitles.css on Dreaming's player", () => {
  function declarationsFor(fragment) {
    return css
      .split("}")
      .filter((rule) => rule.split("{")[0].includes(fragment))
      .map((rule) => rule.split("{")[1] ?? "")
      .join(";");
  }

  // Dreaming animates the container's position with its own transition
  // (transition: bottom 0.1s, verified live), which any transition here would
  // replace.
  it("never sets a transition on the container Dreaming animates", () => {
    expect(declarationsFor("shaka-text-container")).not.toMatch(/transition/);
  });

  // Shaka sets an inline opacity on each subtitle line, which would defeat
  // the opacity styles, so they stay on the container.
  it("styles the container, not the subtitle lines Shaka styles inline", () => {
    for (const selector of selectorsMatching("shaka-text-container")) {
      expect(selector).toMatch(/\.shaka-text-container$/);
    }
  });
});

describe("subtitles.css on YouTube captions", () => {
  // YouTube positions each caption window absolutely relative to the player.
  // A filter or transform on the container would make the container their
  // containing block and push the captions out of view in windowed mode.
  it("styles the caption windows, never the positioning container itself", () => {
    const selectors = selectorsMatching("ytp-caption-window-container");

    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      expect(selector).toMatch(/\.ytp-caption-window-container > \*$/);
    }
  });

  it.each(["blur", "small-faint", "hidden"])("covers the %s style for both players while not revealed", (style) => {
    for (const container of [".shaka-text-container", ".ytp-caption-window-container > *"]) {
      expect(selectorsMatching(`:root.dt-subtitles--style-${style}:not(.dt-subtitles--revealed) ${container}`))
        .toHaveLength(1);
    }
  });

  // Revealing must hand control back to the player's own styles, so there is
  // no reset rule, and no rule replaces the player's own transform.
  it("never overrides the player's own styles", () => {
    expect(selectorsMatching("dt-subtitles--revealed ")).toEqual([]);
    expect(css).not.toMatch(/(^|[\s;{])transform\s*:/);
  });
});
