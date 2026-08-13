import { describe, expect, it } from "vitest";
import {
  avatarProfileForKey,
  createAgentIdentityRegistry,
  hashAgentKey,
} from "./agent-identity.js";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("agent identities", () => {
  it("hashes the same child key deterministically", () => {
    expect(hashAgentKey("thr_child_1")).toBe(hashAgentKey("thr_child_1"));
    expect(hashAgentKey("thr_child_1")).not.toBe(hashAgentKey("thr_child_2"));
  });

  it("keeps names stable across registry instances", () => {
    const storage = new MemoryStorage();
    const first = createAgentIdentityRegistry(storage);
    const firstName = first.get("thr_child_1");

    const second = createAgentIdentityRegistry(storage);
    expect(second.get("thr_child_1")).toBe(firstName);
  });

  it("avoids duplicate names for child agents", () => {
    const registry = createAgentIdentityRegistry();
    const names = new Set(
      Array.from({ length: 64 }, (_, index) =>
        registry.get(`thr_child_${String(index)}`),
      ),
    );
    expect(names.size).toBe(64);
  });

  it("derives a stable, visibly varied avatar profile", () => {
    const first = avatarProfileForKey("thr_child_1");
    const second = avatarProfileForKey("thr_child_2");

    expect(avatarProfileForKey("thr_child_1")).toEqual(first);
    expect(`${first.shape}/${first.palette}`).not.toBe(
      `${second.shape}/${second.palette}`,
    );
    expect(first.drift).toBeGreaterThanOrEqual(6);
    expect(first.drift).toBeLessThanOrEqual(24);
    expect(first.durationMs).toBeGreaterThanOrEqual(3600);
    expect(first.durationMs).toBeLessThan(6200);
  });
});
