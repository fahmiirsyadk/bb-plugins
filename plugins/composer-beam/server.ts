import type { BbPluginApi } from "@bb/plugin-sdk";

/**
 * The beam is frontend-only. This load-safe entry keeps the package a normal
 * BB plugin without granting it server, filesystem, network, or credential
 * access.
 */
export default function plugin(_bb: BbPluginApi): void {
  // The app entry owns the composer customization.
}
