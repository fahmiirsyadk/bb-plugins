import type { BbPluginApi } from "@bb/plugin-sdk";

/**
 * Agent Orbs is a frontend-only customization. The empty backend entry keeps
 * the package installable through BB's normal plugin lifecycle.
 */
export default function plugin(_bb: BbPluginApi): void {}
