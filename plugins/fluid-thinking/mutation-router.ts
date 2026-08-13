import {
  FLUID_ANIMATED_LABEL_SELECTOR,
  FLUID_TIMELINE_HEADER_SELECTOR,
  FLUID_TIMELINE_LIST_SELECTOR,
  FLUID_TIMELINE_SIGNAL_SELECTOR,
} from "./dom-bridge.js";

const TIMELINE_ROW_SELECTOR = "[data-timeline-row-id]";
const TIMELINE_ACTIVITY_SELECTOR =
  `${FLUID_TIMELINE_HEADER_SELECTOR},${FLUID_ANIMATED_LABEL_SELECTOR}`;

export type TimelineMutationRoute = HTMLElement | "full" | null;

export interface TimelineMutationRoutingContext {
  isPluginOwned(mutation: MutationRecord): boolean;
  listForHostTarget(target: Node): HTMLElement | null;
  isContentRow(list: HTMLElement, row: HTMLElement): boolean;
}

function elementForNode(node: Node): Element | null {
  return node instanceof Element ? node : node.parentElement;
}

function nodeMatchesOrContains(node: Node, selector: string): boolean {
  if (!(node instanceof Element)) return false;
  return node.matches(selector) || node.querySelector(selector) !== null;
}

function nodeMatches(node: Node, selector: string): boolean {
  return node instanceof Element && node.matches(selector);
}

/** Route one DOM mutation without scanning known streamed content subtrees. */
export function routeTimelineMutation(
  mutation: MutationRecord,
  context: TimelineMutationRoutingContext,
): TimelineMutationRoute {
  if (context.isPluginOwned(mutation)) return null;
  const target = elementForNode(mutation.target);
  const hostList = context.listForHostTarget(mutation.target);
  if (hostList !== null) return hostList;

  if (mutation.type === "characterData") {
    const activity = target?.closest<HTMLElement>(TIMELINE_ACTIVITY_SELECTOR);
    return activity?.closest<HTMLElement>(FLUID_TIMELINE_LIST_SELECTOR) ?? null;
  }

  if (mutation.type === "attributes") {
    if (target === null) return null;
    if (
      target instanceof HTMLElement &&
      target.matches(FLUID_TIMELINE_LIST_SELECTOR)
    ) {
      return target;
    }
    const activity = target.closest<HTMLElement>(TIMELINE_ACTIVITY_SELECTOR);
    if (activity !== null) {
      return activity.closest<HTMLElement>(FLUID_TIMELINE_LIST_SELECTOR);
    }
    if (mutation.attributeName !== "aria-busy") return null;
    const row = target.closest<HTMLElement>(TIMELINE_ROW_SELECTOR);
    const list = row?.parentElement;
    return list instanceof HTMLElement &&
      list.matches(FLUID_TIMELINE_LIST_SELECTOR)
      ? list
      : null;
  }

  const list =
    target?.closest<HTMLElement>(FLUID_TIMELINE_LIST_SELECTOR) ?? null;
  if (list !== null) {
    if (target === list) return list;
    const row = target?.closest<HTMLElement>(TIMELINE_ROW_SELECTOR) ?? null;
    if (
      row?.parentElement === list &&
      context.isContentRow(list, row)
    ) {
      return null;
    }
    if (target?.closest(TIMELINE_ACTIVITY_SELECTOR) !== null) return list;

    const changedNodes = [...mutation.addedNodes, ...mutation.removedNodes];
    if (row?.parentElement === list && target === row) {
      return changedNodes.some((node) =>
        nodeMatchesOrContains(node, TIMELINE_ACTIVITY_SELECTOR),
      )
        ? list
        : null;
    }
    return changedNodes.some((node) =>
      nodeMatches(node, TIMELINE_ACTIVITY_SELECTOR),
    )
      ? list
      : null;
  }
  return [...mutation.addedNodes, ...mutation.removedNodes].some((node) =>
    nodeMatchesOrContains(node, FLUID_TIMELINE_SIGNAL_SELECTOR),
  )
    ? "full"
    : null;
}
