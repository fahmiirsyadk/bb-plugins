import { afterEach, describe, expect, it } from "vitest";
import { findFluidIndicatorSurface } from "./dom-bridge.js";

afterEach(() => {
  document.body.replaceChildren();
});

function makeSurface(labelText: string) {
  const shell = document.createElement("div");
  const list = document.createElement("div");
  list.setAttribute("data-timeline-row-list", "top-level");
  const nativeHost = document.createElement("div");
  const label = document.createElement("span");
  label.className = "animate-shine";
  label.textContent = labelText;
  nativeHost.className = "mt-4";
  nativeHost.append(label);
  shell.append(list, nativeHost);
  document.body.append(shell);
  return { list, nativeHost };
}

describe("fluid indicator bridge", () => {
  it("does not replace BB's native compaction indicator", () => {
    const { list, nativeHost } = makeSurface("Compacting context");

    const snapshot = findFluidIndicatorSurface(list);

    expect(snapshot?.host).toBe(nativeHost);
    expect(snapshot?.showIcon).toBe(false);
    expect(snapshot?.replaceNativeIndicator).toBe(false);
  });

  it("replaces an ordinary active indicator", () => {
    const { list } = makeSurface("Working");

    expect(findFluidIndicatorSurface(list)?.replaceNativeIndicator).toBe(true);
  });
});
