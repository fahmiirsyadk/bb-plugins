import { describe, expect, it } from "vitest";
import {
  BEAM_BLOOM_ATTRIBUTE,
  BEAM_FORM_ATTRIBUTE,
} from "./beam-state.js";

import app from "./app.js";

interface ComposerCustomization {
  id: string;
  actions?: unknown;
  banners?: Array<{
    id: string;
    chrome?: string;
    component: unknown;
  }>;
}

const definition = app as unknown as {
  composerCustomizations: ComposerCustomization[];
};

describe("composer beam app registration", () => {
  it("registers one bare banner through app.composer.customize", async () => {
    expect(definition.composerCustomizations).toHaveLength(1);

    const customization = definition.composerCustomizations[0];
    expect(customization?.id).toBe("composer-beam");
    expect(customization?.actions).toBeUndefined();
    expect(customization?.banners).toHaveLength(1);
    expect(customization?.banners?.[0]?.chrome).toBe("bare");
  });

  it("keeps the banner component wired to the beam surface", () => {
    const banner = definition.composerCustomizations[0]?.banners?.[0];
    expect(banner?.component).toBeTypeOf("function");
    expect(BEAM_FORM_ATTRIBUTE).toBe("data-bb-composer-beam");
    expect(BEAM_BLOOM_ATTRIBUTE).toBe("data-bb-composer-beam-bloom");
  });
});
