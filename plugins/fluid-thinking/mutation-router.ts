import {
  FLUID_ANIMATED_LABEL_SELECTOR,
  FLUID_TIMELINE_HEADER_SELECTOR,
  FLUID_TIMELINE_LIST_SELECTOR,
  FLUID_TIMELINE_SIGNAL_SELECTOR,
} from "./dom-bridge.js";

const TIMELINE_ROW_SELECTOR = "[data-timeline-row-id]";

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

/** Route one DOM mutation without scanning known streamed content subtrees. */
export function routeTimelineMutation(
  mutation: MutationRecord,
  context: TimelineMutationRoutingContext,
): TimelineMutationRoute {
  if (context.isPluginOwned(mutation)) return null;
  const target = elementForNode(mutation.target);
  const hostList = context.listForHostTarget(mutation.target);
  if (hostList !== null) return hostList;
  const list =
    target?.closest<HTMLElement>(FLUID_TIMELINE_LIST_SELECTOR) ?? null;
  const row = target?.closest<HTMLElement>(TIMELINE_ROW_SELECTOR) ?? null;
  const touchesContentRow =
    list !== null &&
    row?.parentElement === list &&
    context.isContentRow(list, row);

  if (mutation.type === "characterData") {
    if (touchesContentRow) return null;
    return target?.closest(
      `${FLUID_TIMELINE_HEADER_SELECTOR},${FLUID_ANIMATED_LABEL_SELECTOR}`,
    ) !== null
      ? list
      : null;
  }

  if (mutation.type === "attributes") {
    if (target === null) return null;
    if (target.matches(FLUID_TIMELINE_LIST_SELECTOR)) return list;
    if (
      target.closest(
        `${FLUID_TIMELINE_HEADER_SELECTOR},${FLUID_ANIMATED_LABEL_SELECTOR}`,
      ) !== null
    ) {
      return list;
    }
    return mutation.attributeName === "aria-busy" && row?.parentElement === list
      ? list
      : null;
  }

  if (list !== null) return touchesContentRow ? null : list;
  return [...mutation.addedNodes, ...mutation.removedNodes].some((node) =>
    nodeMatchesOrContains(node, FLUID_TIMELINE_SIGNAL_SELECTOR),
  )
    ? "full"
    : null;
}
