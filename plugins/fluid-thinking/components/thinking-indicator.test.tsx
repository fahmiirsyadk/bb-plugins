import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThinkingIndicator } from "./thinking-indicator.js";

describe("ThinkingIndicator", () => {
  it("renders the original five-stage morph with valid path data", () => {
    const markup = renderToStaticMarkup(
      <ThinkingIndicator announce={false} iconOnly />,
    );
    const container = document.createElement("div");
    container.innerHTML = markup;

    const pathData = container.querySelector("path")?.getAttribute("d");
    const animation = container.querySelector("animate");
    const keyframes = animation?.getAttribute("values")?.split(";");

    expect(pathData).toMatch(/^M\b/);
    expect(pathData).not.toBe("undefined");
    expect(keyframes).toHaveLength(5);
    expect(keyframes?.every((path) => /^M\b/.test(path))).toBe(true);
    expect(animation?.getAttribute("dur")).toBe("6s");
    expect(animation?.getAttribute("repeatCount")).toBe("indefinite");
  });
});
