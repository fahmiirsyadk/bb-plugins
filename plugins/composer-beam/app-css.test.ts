import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "app.css"), "utf8");

describe("composer beam styles", () => {
  it("keeps the beam selectors, keyframes, and custom properties namespaced", () => {
    expect(css).toContain(
      ".bb-composer-beam-form[data-bb-composer-beam-active]::after",
    );
    expect(css).toContain("@keyframes bb-composer-beam-travel-prompt");
    expect(css).toContain("@property --bb-composer-beam-opacity-prompt");
    expect(css).not.toContain('[data-beam="prompt"]');
    expect(css).not.toContain("@keyframes beam-");
    expect(css).not.toMatch(/@property\s+--beam-/);
  });

  it("retains the source motion timings and palette", () => {
    expect(css).toContain("bb-composer-beam-travel-prompt 3.1s linear infinite");
    expect(css).toContain("bb-composer-beam-fade-out-prompt 0.5s ease forwards");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain("box-shadow: inset 0 0 9px 1px rgba(255, 255, 255, 0.1)");
    expect(css).toContain("rgb(255, 50, 100)");
    expect(css).toContain("rgb(40, 180, 220)");
  });
});
