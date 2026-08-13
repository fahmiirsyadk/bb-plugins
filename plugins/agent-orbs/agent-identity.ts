const IDENTITY_STORAGE_KEY = "bb-agent-orbs:identities:v1";
const MAX_PERSISTED_IDENTITIES = 256;

const CODENAMES = [
  "Aster",
  "Cinder",
  "Echo",
  "Fable",
  "Halo",
  "Iris",
  "Kite",
  "Lumen",
  "Mica",
  "Nova",
  "Orbit",
  "Pollen",
  "Quill",
  "Rune",
  "Solace",
  "Vela",
  "Wisp",
  "Zephyr",
] as const;

const AVATAR_SHAPES = [
  "bloom",
  "silk",
  "flare",
  "nova",
  "void",
  "jade",
] as const;

// Keep the palette set explicit so the profile stays stable even if the
// avatar package adds new presets in a later release.
const AVATAR_PALETTES = [
  "rose-milk",
  "peach-cream",
  "mint-milk",
  "aurora-pink",
  "lilac-silk",
  "blue-cream",
  "jade-cream",
  "coral-mist",
  "lemon-mint",
  "violet-peach",
  "magenta-void",
  "teal-void",
  "amber-dusk",
  "sky-melon",
  "grapefruit",
  "lavender-lime",
  "aqua-orchid",
  "honeydew",
  "plum-gold",
  "ice-berry",
  "apricot-mint",
  "candy-blue",
  "raspberry-cream",
  "spring-glow",
  "sunset-punch",
  "moon-pearl",
  "seafoam-rose",
  "blueberry-milk",
  "mango-iris",
  "forest-neon",
  "cotton-candy",
  "lime-sorbet",
  "cherry-cola",
  "opal-mint",
  "peach-lilac",
  "cyan-flame",
  "orchid-night",
  "pistachio-blush",
  "lagoon-gold",
  "vanilla-sky",
] as const;

function normalizeKey(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 256);
}

/** Small deterministic hash; it is only used to select a friendly codename. */
export function hashAgentKey(value: string): number {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export interface AgentAvatarProfile {
  shape: (typeof AVATAR_SHAPES)[number];
  palette: (typeof AVATAR_PALETTES)[number];
  drift: number;
  durationMs: number;
  delayMs: number;
  liftPx: number;
  tiltDeg: number;
}

/**
 * Derives both visible avatar geometry and motion from the stable thread key.
 * The package's variantId changes geometry within one shape; changing shape
 * and palette as well keeps neighboring agents visually distinguishable.
 */
export function avatarProfileForKey(threadKey: string): AgentAvatarProfile {
  const key = normalizeKey(threadKey);
  const seed = hashAgentKey(`avatar:${key}`);
  const paletteSeed = hashAgentKey(`palette:${key}`);
  const motionSeed = hashAgentKey(`motion:${key}`);
  const shape = AVATAR_SHAPES[seed % AVATAR_SHAPES.length]!;
  const palette = AVATAR_PALETTES[paletteSeed % AVATAR_PALETTES.length]!;

  return {
    shape,
    palette,
    // Oreo documents drift as a constrained 0–24 geometry adjustment.
    drift: 6 + (seed % 19),
    durationMs: 3600 + (motionSeed % 2600),
    delayMs: -(motionSeed % 1800),
    liftPx: 0.6 + ((motionSeed >>> 8) % 8) / 10,
    tiltDeg: 0.8 + ((motionSeed >>> 16) % 13) / 10,
  };
}

interface IdentityStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function readStoredIdentities(storage: IdentityStorage | null): Map<string, string> {
  if (storage === null) return new Map();
  try {
    const raw = storage.getItem(IDENTITY_STORAGE_KEY);
    if (raw === null) return new Map();
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return new Map();
    }

    const identities = new Map<string, string>();
    for (const [key, value] of Object.entries(parsed)) {
      if (
        key.length > 0 &&
        key.length <= 256 &&
        typeof value === "string" &&
        value.length > 0 &&
        value.length <= 64
      ) {
        identities.set(key, value);
      }
    }
    return identities;
  } catch {
    // localStorage can be unavailable in private or embedded app contexts.
    return new Map();
  }
}

function persistIdentities(
  storage: IdentityStorage | null,
  identities: Map<string, string>,
): void {
  if (storage === null) return;
  try {
    const entries = [...identities.entries()].slice(-MAX_PERSISTED_IDENTITIES);
    storage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // A failed persistence write should never prevent the visual enhancement.
  }
}

export interface AgentIdentityRegistry {
  get(threadKey: string): string;
}

/**
 * Assigns stable, human-readable names and avoids collisions among persisted
 * child-thread identities. A thread id is never shown as the visible name.
 */
export function createAgentIdentityRegistry(
  storage: IdentityStorage | null = null,
): AgentIdentityRegistry {
  const identities = readStoredIdentities(storage);

  return {
    get(threadKey) {
      const key = normalizeKey(threadKey);
      if (key.length === 0) return "Aster";

      const existing = identities.get(key);
      if (existing !== undefined) return existing;

      const codename = CODENAMES[hashAgentKey(key) % CODENAMES.length];
      const usedNames = new Set(identities.values());
      let name: string = codename;
      let suffix = 2;
      while (usedNames.has(name)) {
        name = `${codename} ${suffix}`;
        suffix += 1;
      }

      identities.set(key, name);
      persistIdentities(storage, identities);
      return name;
    },
  };
}

export { CODENAMES, IDENTITY_STORAGE_KEY };
