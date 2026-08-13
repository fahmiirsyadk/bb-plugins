export interface GroupIconMountState {
  header: HTMLElement;
  mount: HTMLElement;
}

/** Whether the group icon must be disposed/recreated for the next header. */
export function groupIconMountNeedsSync(
  current: GroupIconMountState | null,
  nextHeader: HTMLElement | null,
): boolean {
  if (current === null) return nextHeader !== null;
  if (nextHeader === null) return true;
  return (
    current.header !== nextHeader ||
    !current.mount.isConnected ||
    current.mount.parentElement !== nextHeader
  );
}
