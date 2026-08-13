import { createRoot, type Root } from "react-dom/client";
import { definePluginApp } from "@bb/plugin-sdk/app";
import { ThinkingIndicator } from "./components/thinking-indicator.js";
import {
  findFluidIndicatorSurface,
  findFluidIndicatorSurfaces,
  type FluidIndicatorSurfaceSnapshot,
} from "./dom-bridge.js";
import {
  routeTimelineMutation,
  type TimelineMutationRoutingContext,
} from "./mutation-router.js";
import { groupIconMountNeedsSync } from "./group-icon-state.js";
import "./app.css";

const NATIVE_HIDDEN_CLASS = "fluid-thinking-native-hidden";
const MOUNT_ATTRIBUTE = "data-fluid-thinking-mount";
const HOST_REPLACEMENT_GRACE_MS = 300;

interface MountedSurface {
  list: HTMLElement;
  host: HTMLElement;
  mount: HTMLDivElement;
  root: Root;
  lastMode: FluidIndicatorSurfaceSnapshot["mode"] | null;
  lastShowIcon: boolean | null;
  lastReplaceNativeIndicator: boolean | null;
  missingSince: number | null;
  contentRows: ReadonlySet<HTMLElement>;
  previousNativeClassState: Map<HTMLElement, boolean>;
  update(snapshot: FluidIndicatorSurfaceSnapshot): void;
  dispose(): void;
}

interface GroupIconMount {
  header: HTMLElement;
  mount: HTMLSpanElement;
  root: Root;
}

function createMountedSurface(
  snapshot: FluidIndicatorSurfaceSnapshot,
): MountedSurface | null {
  const mount = document.createElement("div");
  mount.setAttribute(MOUNT_ATTRIBUTE, "");
  mount.className = "fluid-thinking-mount";

  const previousNativeClassState = new Map<HTMLElement, boolean>();
  let groupIcon: GroupIconMount | null = null;
  let disposed = false;

  const syncNativeIndicator = (
    host: HTMLElement,
    replaceNativeIndicator: boolean,
  ) => {
    if (!replaceNativeIndicator) {
      restoreNativeIndicator();
      return;
    }

    const nextElements = new Set(
      Array.from(host.children).filter(
        (child): child is HTMLElement =>
          child instanceof HTMLElement &&
          child !== mount &&
          !child.hasAttribute(MOUNT_ATTRIBUTE),
      ),
    );

    for (const [element, hadClass] of previousNativeClassState) {
      if (nextElements.has(element)) continue;
      if (!hadClass) element.classList.remove(NATIVE_HIDDEN_CLASS);
      previousNativeClassState.delete(element);
    }

    for (const element of nextElements) {
      if (!element.isConnected) continue;
      if (!previousNativeClassState.has(element)) {
        previousNativeClassState.set(
          element,
          element.classList.contains(NATIVE_HIDDEN_CLASS),
        );
      }
      element.classList.add(NATIVE_HIDDEN_CLASS);
    }
  };

  const restoreNativeIndicator = () => {
    for (const [element, hadClass] of previousNativeClassState) {
      if (!hadClass) element.classList.remove(NATIVE_HIDDEN_CLASS);
    }
    previousNativeClassState.clear();
  };

  const disposeGroupIcon = () => {
    if (groupIcon === null) return;
    groupIcon.root.unmount();
    groupIcon.mount.remove();
    groupIcon = null;
  };

  const syncGroupIcon = (header: HTMLElement | null) => {
    if (!groupIconMountNeedsSync(groupIcon, header)) return;
    disposeGroupIcon();
    if (header === null || !header.isConnected) return;

    const iconMount = document.createElement("span");
    iconMount.setAttribute(MOUNT_ATTRIBUTE, "");
    iconMount.className = "fluid-thinking-group-icon-mount";
    header.insertBefore(iconMount, header.firstElementChild);
    const root = createRoot(iconMount);
    groupIcon = { header, mount: iconMount, root };
    root.render(
      <ThinkingIndicator iconOnly announce={false} mode="working" />,
    );
  };

  try {
    snapshot.host.appendChild(mount);
    const root = createRoot(mount);
    let mounted: MountedSurface;

    mounted = {
      list: snapshot.list,
      host: snapshot.host,
      mount,
      root,
      lastMode: null,
      lastShowIcon: null,
      lastReplaceNativeIndicator: null,
      missingSince: null,
      contentRows: snapshot.contentRows,
      previousNativeClassState,
      update(nextSnapshot) {
        if (disposed) return;
        if (
          nextSnapshot.replaceNativeIndicator &&
          mount.parentElement !== nextSnapshot.host
        ) {
          nextSnapshot.host.appendChild(mount);
        } else if (!nextSnapshot.replaceNativeIndicator) {
          mount.remove();
        }
        mounted.host = nextSnapshot.host;
        mounted.missingSince = null;
        mounted.contentRows = nextSnapshot.contentRows;
        syncNativeIndicator(
          nextSnapshot.host,
          nextSnapshot.replaceNativeIndicator,
        );
        syncGroupIcon(
          nextSnapshot.replaceNativeIndicator && nextSnapshot.showIcon
            ? nextSnapshot.activeActivityHeader
            : null,
        );
        if (
          nextSnapshot.mode === mounted.lastMode &&
          nextSnapshot.showIcon === mounted.lastShowIcon &&
          nextSnapshot.replaceNativeIndicator ===
            mounted.lastReplaceNativeIndicator
        ) {
          return;
        }
        mounted.lastMode = nextSnapshot.mode;
        mounted.lastShowIcon = nextSnapshot.showIcon;
        mounted.lastReplaceNativeIndicator = nextSnapshot.replaceNativeIndicator;
        root.render(
          nextSnapshot.replaceNativeIndicator ? (
            <ThinkingIndicator
              key={nextSnapshot.mode}
              mode={nextSnapshot.mode}
              showIcon={nextSnapshot.showIcon}
            />
          ) : null,
        );
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        root.unmount();
        disposeGroupIcon();
        restoreNativeIndicator();
        mount.remove();
      },
    };
    mounted.update(snapshot);
    return mounted;
  } catch {
    for (const [element, hadClass] of previousNativeClassState) {
      if (!hadClass) element.classList.remove(NATIVE_HIDDEN_CLASS);
    }
    disposeGroupIcon();
    mount.remove();
    return null;
  }
}

function elementForNode(node: Node): Element | null {
  return node instanceof Element ? node : node.parentElement;
}

function mountTimelineIndicator(signal: AbortSignal): () => void {
  const mountedSurfaces = new Map<HTMLElement, MountedSurface>();
  let disposed = false;
  let scanScheduled = false;
  let scanFrame: number | null = null;
  let graceTimer: number | null = null;
  let fullScanRequested = false;
  const dirtyLists = new Set<HTMLElement>();

  const scheduleGraceScan = () => {
    if (disposed || graceTimer !== null) return;
    graceTimer = window.setTimeout(() => {
      graceTimer = null;
      for (const [list, mounted] of mountedSurfaces) {
        if (mounted.missingSince !== null) dirtyLists.add(list);
      }
      scan();
    }, HOST_REPLACEMENT_GRACE_MS);
  };

  const markMissing = (
    list: HTMLElement,
    mounted: MountedSurface,
    now: number,
  ) => {
    if (!list.isConnected) {
      mounted.dispose();
      mountedSurfaces.delete(list);
      return;
    }
    if (mounted.missingSince === null) {
      mounted.missingSince = now;
      scheduleGraceScan();
      return;
    }
    if (now - mounted.missingSince >= HOST_REPLACEMENT_GRACE_MS) {
      mounted.dispose();
      mountedSurfaces.delete(list);
    } else {
      scheduleGraceScan();
    }
  };

  const reconcile = (snapshot: FluidIndicatorSurfaceSnapshot) => {
    if (!snapshot.list.isConnected || !snapshot.host.isConnected) return;
    let mounted = mountedSurfaces.get(snapshot.list);
    if (mounted === undefined) {
      mounted = createMountedSurface(snapshot) ?? undefined;
      if (mounted !== undefined) mountedSurfaces.set(snapshot.list, mounted);
    }
    mounted?.update(snapshot);
  };

  const scanAll = () => {
    const seenLists = new Set<HTMLElement>();
    for (const snapshot of findFluidIndicatorSurfaces()) {
      seenLists.add(snapshot.list);
      reconcile(snapshot);
    }
    const now = window.performance.now();
    for (const [list, mounted] of mountedSurfaces) {
      if (seenLists.has(list)) continue;
      markMissing(list, mounted, now);
    }
  };

  const scan = () => {
    if (disposed) return;
    if (fullScanRequested) {
      fullScanRequested = false;
      dirtyLists.clear();
      scanAll();
      return;
    }

    const lists = Array.from(dirtyLists);
    dirtyLists.clear();
    const now = window.performance.now();
    for (const list of lists) {
      const mounted = mountedSurfaces.get(list);
      if (!list.isConnected) {
        mounted?.dispose();
        if (mounted !== undefined) mountedSurfaces.delete(list);
        continue;
      }
      const snapshot = findFluidIndicatorSurface(list);
      if (snapshot !== null) reconcile(snapshot);
      else if (mounted !== undefined) markMissing(list, mounted, now);
    }
  };

  const scheduleScan = (list?: HTMLElement) => {
    if (list === undefined) fullScanRequested = true;
    else dirtyLists.add(list);
    if (disposed || scanScheduled) return;
    scanScheduled = true;
    scanFrame = window.requestAnimationFrame(() => {
      scanFrame = null;
      scanScheduled = false;
      scan();
    });
  };

  const mutationIsPluginOwned = (mutation: MutationRecord): boolean => {
    const mutationElement = elementForNode(mutation.target);
    if (
      mutationElement?.closest(`[${MOUNT_ATTRIBUTE}]`) !== null
    ) {
      return true;
    }
    for (const mounted of mountedSurfaces.values()) {
      if (
        mutation.target === mounted.mount ||
        mounted.mount.contains(mutation.target)
      ) {
        return true;
      }
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "class" &&
        mutation.target instanceof HTMLElement &&
        mounted.previousNativeClassState.has(mutation.target) &&
        mutation.target.classList.contains(NATIVE_HIDDEN_CLASS)
      ) {
        return true;
      }
    }
    return false;
  };

  const mountedListForHostTarget = (target: Node): HTMLElement | null => {
    for (const mounted of mountedSurfaces.values()) {
      if (target === mounted.host || mounted.host.contains(target)) {
        return mounted.list;
      }
    }
    return null;
  };

  const mutationRoutingContext: TimelineMutationRoutingContext = {
    isPluginOwned: mutationIsPluginOwned,
    listForHostTarget: mountedListForHostTarget,
    isContentRow: (list, row) =>
      mountedSurfaces.get(list)?.contentRows.has(row) === true,
  };

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const route = routeTimelineMutation(mutation, mutationRoutingContext);
      if (route === "full") {
        scheduleScan();
        return;
      }
      if (route !== null) scheduleScan(route);
    }
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["aria-busy", "class", "data-state"],
  });

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    if (scanFrame !== null) window.cancelAnimationFrame(scanFrame);
    if (graceTimer !== null) window.clearTimeout(graceTimer);
    scanFrame = null;
    graceTimer = null;
    scanScheduled = false;
    fullScanRequested = false;
    dirtyLists.clear();
    for (const mounted of mountedSurfaces.values()) mounted.dispose();
    mountedSurfaces.clear();
    signal.removeEventListener("abort", dispose);
  };

  signal.addEventListener("abort", dispose, { once: true });
  scanAll();
  return dispose;
}

export default definePluginApp((app) => {
  app.contentScripts.register({
    id: "fluid-thinking-timeline",
    mount({ signal }) {
      return mountTimelineIndicator(signal);
    },
  });
});
