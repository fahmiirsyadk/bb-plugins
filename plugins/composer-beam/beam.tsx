import { useComposerView } from "@bb/plugin-sdk/app";
import { useEffect, useRef, useState } from "react";
import {
  BEAM_ACTIVE_ATTRIBUTE,
  BEAM_BLOOM_ATTRIBUTE,
  BEAM_BLOOM_CLASS,
  BEAM_FADE_DURATION_MS,
  BEAM_FADING_ATTRIBUTE,
  BEAM_FORM_ATTRIBUTE,
  BEAM_FORM_VALUE,
  BEAM_PAUSED_ATTRIBUTE,
  beamIsRequested,
  transitionBeamPhase,
  type BeamPhase,
} from "./beam-state.js";

export {
  BEAM_ACTIVE_ATTRIBUTE,
  BEAM_BLOOM_ATTRIBUTE,
  BEAM_BLOOM_CLASS,
  BEAM_FADE_DURATION_MS,
  BEAM_FADING_ATTRIBUTE,
  BEAM_FORM_ATTRIBUTE,
  BEAM_FORM_VALUE,
  BEAM_PAUSED_ATTRIBUTE,
  beamIsRequested,
  transitionBeamPhase,
} from "./beam-state.js";
export type { BeamPhase } from "./beam-state.js";

function findComposerForm(anchor: HTMLElement): HTMLElement | null {
  const directForm = anchor.closest<HTMLElement>("[data-promptbox]");
  if (directForm) return directForm;

  const composerShell = anchor.closest<HTMLElement>("[data-app-composer]");
  if (!composerShell) return null;

  // Follow-up composers keep the primary form behind this anchor while their
  // stack may contain queue-editor prompt boxes of its own.
  const followUpForm = composerShell
    .querySelector<HTMLElement>("[data-follow-up-composer-anchor]")
    ?.querySelector<HTMLElement>("[data-promptbox]");
  return followUpForm ?? composerShell.querySelector<HTMLElement>("[data-promptbox]");
}

function attachComposerBeam(form: HTMLElement): HTMLSpanElement {
  const bloom = document.createElement("span");
  bloom.className = BEAM_BLOOM_CLASS;
  bloom.setAttribute(BEAM_BLOOM_ATTRIBUTE, "");
  bloom.setAttribute("aria-hidden", "true");

  form.classList.add("bb-composer-beam-form");
  form.setAttribute(BEAM_FORM_ATTRIBUTE, BEAM_FORM_VALUE);
  form.appendChild(bloom);
  return bloom;
}

function detachComposerBeam(form: HTMLElement, bloom: HTMLSpanElement): void {
  bloom.remove();
  form.classList.remove("bb-composer-beam-form");
  form.removeAttribute(BEAM_FORM_ATTRIBUTE);
  form.removeAttribute(BEAM_ACTIVE_ATTRIBUTE);
  form.removeAttribute(BEAM_FADING_ATTRIBUTE);
  form.removeAttribute(BEAM_PAUSED_ATTRIBUTE);
}

function setBooleanAttribute(
  element: HTMLElement,
  attribute: string,
  enabled: boolean,
): void {
  if (enabled) {
    element.setAttribute(attribute, "");
  } else {
    element.removeAttribute(attribute);
  }
}

export interface ComposerBeamSurfaceProps {
  isRunning: boolean;
  isSubmitting: boolean;
}

/**
 * Owns only the plugin marker and bloom node. The host still owns the form,
 * editor, actions, and all submission behavior.
 */
export function ComposerBeamSurface({
  isRunning,
  isSubmitting,
}: ComposerBeamSurfaceProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [form, setForm] = useState<HTMLElement | null>(null);
  const requested = beamIsRequested(isRunning, isSubmitting);
  const [phase, setPhase] = useState<BeamPhase>(() =>
    requested ? "active" : "idle",
  );
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    let currentForm: HTMLElement | null = null;
    let currentBloom: HTMLSpanElement | null = null;

    const detach = () => {
      if (currentForm !== null && currentBloom !== null) {
        detachComposerBeam(currentForm, currentBloom);
      }
      currentForm = null;
      currentBloom = null;
      setForm(null);
    };

    const reconcile = () => {
      const nextForm = findComposerForm(anchor);
      if (nextForm === currentForm && currentBloom?.isConnected === true) {
        return;
      }

      if (currentForm !== null && currentBloom !== null) {
        detachComposerBeam(currentForm, currentBloom);
      }
      currentForm = nextForm;
      currentBloom = nextForm === null ? null : attachComposerBeam(nextForm);
      setForm(nextForm);
    };

    const observationRoot =
      anchor.closest<HTMLElement>("[data-app-composer]") ??
      document.documentElement;
    const observer = new MutationObserver(reconcile);
    observer.observe(observationRoot, { subtree: true, childList: true });
    const retryTimer = window.setInterval(reconcile, 200);
    reconcile();

    return () => {
      observer.disconnect();
      window.clearInterval(retryTimer);
      if (currentForm !== null && currentBloom !== null) {
        detachComposerBeam(currentForm, currentBloom);
      }
    };
  }, []);

  useEffect(() => {
    setPhase((current) => transitionBeamPhase(current, requested));
  }, [requested]);

  useEffect(() => {
    if (phase !== "fading") return;

    const timeoutId = window.setTimeout(() => {
      setPhase("idle");
    }, BEAM_FADE_DURATION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [phase]);

  useEffect(() => {
    if (!form || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setIsVisible(entry.isIntersecting);
      },
      { rootMargin: "256px" },
    );
    observer.observe(form);
    return () => observer.disconnect();
  }, [form]);

  useEffect(() => {
    if (!form) return;

    setBooleanAttribute(form, BEAM_ACTIVE_ATTRIBUTE, phase === "active");
    setBooleanAttribute(form, BEAM_FADING_ATTRIBUTE, phase === "fading");
    setBooleanAttribute(
      form,
      BEAM_PAUSED_ATTRIBUTE,
      phase === "active" && !isVisible,
    );
  }, [form, isVisible, phase]);

  return (
    <span
      ref={anchorRef}
      className="bb-composer-beam-anchor"
      aria-hidden="true"
    />
  );
}

export function ComposerBeamBanner() {
  const view = useComposerView();
  return (
    <ComposerBeamSurface
      isRunning={view.run.isRunning}
      isSubmitting={view.run.isSubmitting}
    />
  );
}
