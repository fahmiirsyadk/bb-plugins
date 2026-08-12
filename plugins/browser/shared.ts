export const BROWSER_PICK_REQUEST_EVENT = "bb-browser:pick-request";
export const BROWSER_TARGET_CAPTURED_EVENT = "bb-browser:target-captured";

export function browserTargetsChannel(threadId: string): string {
  return `browser-targets:${threadId}`;
}
