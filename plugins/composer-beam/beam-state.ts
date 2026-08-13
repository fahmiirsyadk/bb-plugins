export const BEAM_FORM_ATTRIBUTE = "data-bb-composer-beam";
export const BEAM_FORM_VALUE = "prompt";
export const BEAM_ACTIVE_ATTRIBUTE = "data-bb-composer-beam-active";
export const BEAM_FADING_ATTRIBUTE = "data-bb-composer-beam-fading";
export const BEAM_PAUSED_ATTRIBUTE = "data-bb-composer-beam-paused";
export const BEAM_BLOOM_ATTRIBUTE = "data-bb-composer-beam-bloom";
export const BEAM_BLOOM_CLASS = "bb-composer-beam-bloom";
export const BEAM_FADE_DURATION_MS = 500;

export type BeamPhase = "idle" | "active" | "fading";

export function beamIsRequested(
  isRunning: boolean,
  isSubmitting: boolean,
): boolean {
  return isRunning || isSubmitting;
}

/**
 * The source implementation represented this state with two booleans. A
 * single phase preserves the same rendered states while making the mutually
 * exclusive active/fading cases explicit.
 */
export function transitionBeamPhase(
  phase: BeamPhase,
  requested: boolean,
): BeamPhase {
  if (requested) return "active";
  return phase === "active" ? "fading" : phase;
}
