import type { ThinkingIndicatorMode } from "./components/thinking-indicator.js";

export const FLUID_TIMELINE_LIST_SELECTOR =
  '[data-timeline-row-list="top-level"]';
export const FLUID_TIMELINE_HEADER_SELECTOR = ".timeline-row-header";
export const FLUID_ANIMATED_LABEL_SELECTOR = ".animate-shine";
export const FLUID_TIMELINE_SIGNAL_SELECTOR = [
  FLUID_TIMELINE_LIST_SELECTOR,
  FLUID_TIMELINE_HEADER_SELECTOR,
  FLUID_ANIMATED_LABEL_SELECTOR,
].join(",");

const MAX_LABEL_LENGTH = 160;
const MAX_INDICATOR_ANCESTOR_DEPTH = 6;
const GROUPING_STATUS_PATTERN =
  /\b\d+\s+(?:files?|searches?|commands?|lists?)\b/i;
const COMPACTION_STATUS_PATTERN = /\bcompacting context\b/i;

export interface FluidIndicatorSurfaceSnapshot {
  /** Stable anchor across replacements of BB's separate indicator host. */
  list: HTMLElement;
  host: HTMLElement;
  /** Static Thinking/Working mode derived from BB's native indicator. */
  mode: ThinkingIndicatorMode;
  /** Native compaction already has its own progress cue. */
  showIcon: boolean;
  /** Whether the plugin should hide and replace BB's native indicator. */
  replaceNativeIndicator: boolean;
  /** Active aggregate/current row that receives the Fluid animated glyph. */
  activeActivityHeader: HTMLElement | null;
  /** Headerless content rows whose streamed internals cannot affect activity. */
  contentRows: ReadonlySet<HTMLElement>;
}

function normalizeText(value: string, maxLength = MAX_LABEL_LENGTH): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function indicatorMode(label: string): ThinkingIndicatorMode {
  return /\bthinking\b/i.test(label) ? "thinking" : "working";
}

function isCompactionStatus(label: string): boolean {
  return COMPACTION_STATUS_PATTERN.test(label);
}

function isTimelineRow(element: Element): element is HTMLElement {
  return (
    element instanceof HTMLElement &&
    element.hasAttribute("data-timeline-row-id")
  );
}

interface ActivityCandidate {
  active: boolean;
  header: HTMLElement;
  label: string;
}

function inspectActivityRows(list: HTMLElement): {
  activeActivityHeader: HTMLElement | null;
  contentRows: ReadonlySet<HTMLElement>;
} {
  const rows = Array.from(list.children).filter(isTimelineRow);
  const contentRows = new Set<HTMLElement>();
  let latestConversationIndex = -1;

  rows.forEach((row, index) => {
    if (row.querySelector(FLUID_TIMELINE_HEADER_SELECTOR) === null) {
      contentRows.add(row);
      latestConversationIndex = index;
    }
  });

  const candidates: ActivityCandidate[] = [];
  for (const row of rows.slice(latestConversationIndex + 1)) {
    const rowActive = row.getAttribute("aria-busy") === "true";
    const headers = row.querySelectorAll<HTMLElement>(
      FLUID_TIMELINE_HEADER_SELECTOR,
    );
    for (const header of Array.from(headers)) {
      const label = normalizeText(header.textContent ?? "");
      if (label.length === 0) continue;
      candidates.push({
        active:
          rowActive ||
          header.matches(FLUID_ANIMATED_LABEL_SELECTOR) ||
          header.querySelector(FLUID_ANIMATED_LABEL_SELECTOR) !== null,
        header,
        label,
      });
    }
  }

  const activeCandidates = candidates.filter((candidate) => candidate.active);
  const nonCompactionCandidates = activeCandidates.filter(
    (candidate) => !isCompactionStatus(candidate.label),
  );
  const activeAggregate = [...nonCompactionCandidates]
    .reverse()
    .find((candidate) => GROUPING_STATUS_PATTERN.test(candidate.label));
  return {
    activeActivityHeader:
      activeAggregate?.header ?? nonCompactionCandidates.at(-1)?.header ?? null,
    contentRows,
  };
}

function findIndicatorHost(
  list: HTMLElement,
): {
  host: HTMLElement;
  mode: ThinkingIndicatorMode;
  showIcon: boolean;
  replaceNativeIndicator: boolean;
} | null {
  let container = list.parentElement;
  for (
    let depth = 0;
    container !== null && depth < MAX_INDICATOR_ANCESTOR_DEPTH;
    depth += 1, container = container.parentElement
  ) {
    const listBranch = Array.from(container.children).find(
      (child) => child === list || child.contains(list),
    );
    if (listBranch === undefined) continue;

    for (const child of Array.from(container.children)) {
      if (child === listBranch) continue;
      const animatedLabel = child.querySelector<HTMLElement>(
        FLUID_ANIMATED_LABEL_SELECTOR,
      );
      if (animatedLabel === null) continue;

      const host =
        animatedLabel.closest<HTMLElement>('[class~="mt-4"]') ??
        (child instanceof HTMLElement ? child : null);
      if (host === null || !container.contains(host) || list.contains(host)) {
        continue;
      }
      const label = normalizeText(animatedLabel.textContent ?? "");
      return {
        host,
        mode: indicatorMode(label),
        showIcon: !isCompactionStatus(label),
        replaceNativeIndicator: !isCompactionStatus(label),
      };
    }
  }
  return null;
}

/** Read one known top-level timeline without searching the document. */
export function findFluidIndicatorSurface(
  list: HTMLElement,
): FluidIndicatorSurfaceSnapshot | null {
  const indicator = findIndicatorHost(list);
  if (indicator === null) return null;
  const activity = inspectActivityRows(list);
  return {
    list,
    host: indicator.host,
    mode: indicator.mode,
    showIcon: indicator.showIcon,
    replaceNativeIndicator: indicator.replaceNativeIndicator,
    activeActivityHeader: activity.activeActivityHeader,
    contentRows: activity.contentRows,
  };
}

/** Discover BB's native indicator hosts without modifying native activity rows. */
export function findFluidIndicatorSurfaces(
  root: ParentNode = document,
): FluidIndicatorSurfaceSnapshot[] {
  const surfaces: FluidIndicatorSurfaceSnapshot[] = [];
  const seenHosts = new Set<HTMLElement>();
  const lists = root.querySelectorAll<HTMLElement>(FLUID_TIMELINE_LIST_SELECTOR);
  for (const list of Array.from(lists)) {
    const surface = findFluidIndicatorSurface(list);
    if (surface === null || seenHosts.has(surface.host)) continue;
    seenHosts.add(surface.host);
    surfaces.push(surface);
  }
  return surfaces;
}
