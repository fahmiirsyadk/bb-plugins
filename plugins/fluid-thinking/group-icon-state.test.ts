import { afterEach, describe, expect, it } from "vitest";
import { groupIconMountNeedsSync } from "./group-icon-state.js";

afterEach(() => {
  document.body.replaceChildren();
});

describe("group icon mount lifecycle", () => {
  it("detects a host rerender that removed the plugin mount", () => {
    const header = document.createElement("div");
    const mount = document.createElement("span");
    header.append(mount);
    document.body.append(header);
    const current = { header, mount };

    expect(groupIconMountNeedsSync(current, header)).toBe(false);

    mount.remove();

    expect(groupIconMountNeedsSync(current, header)).toBe(true);
  });

  it("syncs creation and disposal when the target header changes", () => {
    const firstHeader = document.createElement("div");
    const secondHeader = document.createElement("div");
    const mount = document.createElement("span");
    firstHeader.append(mount);
    const current = { header: firstHeader, mount };

    expect(groupIconMountNeedsSync(null, secondHeader)).toBe(true);
    expect(groupIconMountNeedsSync(current, secondHeader)).toBe(true);
    expect(groupIconMountNeedsSync(current, null)).toBe(true);
  });
});
