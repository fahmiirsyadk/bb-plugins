import { describe, expect, it } from "vitest";
import {
  beamIsRequested,
  transitionBeamPhase,
  type BeamPhase,
} from "./beam-state.js";

describe("composer beam state", () => {
  it("requests a beam for either running or submitting composers", () => {
    expect(beamIsRequested(false, false)).toBe(false);
    expect(beamIsRequested(true, false)).toBe(true);
    expect(beamIsRequested(false, true)).toBe(true);
  });

  it("keeps active and fading as mutually exclusive phases", () => {
    const transitions: Array<[BeamPhase, boolean, BeamPhase]> = [
      ["idle", false, "idle"],
      ["idle", true, "active"],
      ["active", false, "fading"],
      ["fading", false, "fading"],
      ["fading", true, "active"],
    ];

    for (const [phase, requested, expected] of transitions) {
      expect(transitionBeamPhase(phase, requested)).toBe(expected);
    }
  });
});
