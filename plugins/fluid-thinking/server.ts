import type { BbPluginApi } from "@bb/plugin-sdk";

/**
 * The visual replacement is intentionally frontend-only. Keeping a load-safe
 * backend entry makes the package a normal BB plugin without granting it
 * thread, filesystem, network, or credential access.
 */
export default function plugin(_bb: BbPluginApi): void {
  // The app entry owns the cleanup-safe content script.
}
