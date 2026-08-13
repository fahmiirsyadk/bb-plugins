import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThinkingIndicator } from "./thinking-indicator.js";

describe("ThinkingIndicator", () => {
  it("renders a valid static SVG path", () => {
    const markup = renderToStaticMarkup(
      <ThinkingIndicator announce={false} iconOnly />,
    );
    const container = document.createElement("div");
    container.innerHTML = markup;

    const pathData = container.querySelector("path")?.getAttribute("d");

    expect(pathData).toMatch(/^M\b/);
    expect(pathData).not.toBe("undefined");
  });
});
