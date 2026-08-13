import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BEAM_ACTIVE_ATTRIBUTE,
  BEAM_BLOOM_ATTRIBUTE,
  BEAM_FADE_DURATION_MS,
  BEAM_FORM_ATTRIBUTE,
  BEAM_FADING_ATTRIBUTE,
} from "./beam-state.js";
import { ComposerBeamSurface } from "./beam.js";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("composer beam bridge", () => {
  it("keeps the bloom through the 500 ms fade and cleans up its host bridge", async () => {
    vi.useFakeTimers();

    function Harness({ requested }: { requested: boolean }) {
      return (
        <div data-app-composer="">
          <form data-promptbox="">
            <ComposerBeamSurface
              isRunning={requested}
              isSubmitting={false}
            />
          </form>
        </div>
      );
    }

    const view = render(<Harness requested />);
    const form = view.container.querySelector<HTMLElement>("[data-promptbox]");
    expect(form).not.toBeNull();
    expect(form?.getAttribute(BEAM_FORM_ATTRIBUTE)).toBe("prompt");
    expect(form?.hasAttribute(BEAM_ACTIVE_ATTRIBUTE)).toBe(true);
    expect(form?.querySelector(`[${BEAM_BLOOM_ATTRIBUTE}]`)).not.toBeNull();

    view.rerender(<Harness requested={false} />);
    expect(form?.hasAttribute(BEAM_ACTIVE_ATTRIBUTE)).toBe(false);
    expect(form?.hasAttribute(BEAM_FADING_ATTRIBUTE)).toBe(true);
    expect(form?.querySelector(`[${BEAM_BLOOM_ATTRIBUTE}]`)).not.toBeNull();

    act(() => vi.advanceTimersByTime(BEAM_FADE_DURATION_MS - 1));
    expect(form?.hasAttribute(BEAM_FADING_ATTRIBUTE)).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(form?.hasAttribute(BEAM_FADING_ATTRIBUTE)).toBe(false);
    expect(form?.querySelector(`[${BEAM_BLOOM_ATTRIBUTE}]`)).not.toBeNull();

    view.unmount();
    expect(form?.hasAttribute(BEAM_FORM_ATTRIBUTE)).toBe(false);
    expect(form?.querySelector(`[${BEAM_BLOOM_ATTRIBUTE}]`)).toBeNull();
  });
});
