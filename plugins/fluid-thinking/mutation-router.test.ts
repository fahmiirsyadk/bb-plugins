import { afterEach, describe, expect, it, vi } from "vitest";
import {
  routeTimelineMutation,
  type TimelineMutationRoutingContext,
} from "./mutation-router.js";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

async function recordMutation(mutate: () => void): Promise<MutationRecord> {
  return await new Promise((resolve) => {
    const observer = new MutationObserver((records) => {
      observer.disconnect();
      resolve(records[0]!);
    });
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["aria-busy", "class", "data-state"],
    });
    mutate();
  });
}

function createTimeline() {
  const list = document.createElement("div");
  list.setAttribute("data-timeline-row-list", "top-level");
  const contentRow = document.createElement("div");
  contentRow.setAttribute("data-timeline-row-id", "assistant-message");
  const prose = document.createElement("article");
  contentRow.append(prose);
  const workRow = document.createElement("div");
  workRow.setAttribute("data-timeline-row-id", "work");
  const header = document.createElement("button");
  header.className = "timeline-row-header";
  header.textContent = "Exploring 1 file";
  workRow.append(header);
  list.append(contentRow, workRow);
  document.body.append(list);
  return { list, contentRow, prose, workRow, header };
}

function routingContext(contentRow: HTMLElement): TimelineMutationRoutingContext {
  return {
    isPluginOwned: () => false,
    listForHostTarget: () => null,
    isContentRow: (_list, row) => row === contentRow,
  };
}

describe("routeTimelineMutation", () => {
  it("does not inspect a streamed subtree inside a known content row", async () => {
    const timeline = createTimeline();
    const subtree = document.createElement("div");
    for (let index = 0; index < 500; index += 1) {
      subtree.append(document.createElement("span"));
    }
    const subtreeSearch = vi.spyOn(subtree, "querySelector");
    const mutation = await recordMutation(() => timeline.prose.append(subtree));

    expect(
      routeTimelineMutation(mutation, routingContext(timeline.contentRow)),
    ).toBeNull();
    expect(subtreeSearch).not.toHaveBeenCalled();
  });

  it("routes activity changes directly to their owning timeline", async () => {
    const timeline = createTimeline();
    const mutation = await recordMutation(() => {
      timeline.workRow.setAttribute("aria-busy", "true");
    });

    expect(
      routeTimelineMutation(mutation, routingContext(timeline.contentRow)),
    ).toBe(timeline.list);
  });

  it("requests discovery when a timeline signal appears outside known lists", async () => {
    const timeline = createTimeline();
    const replacementHost = document.createElement("div");
    const label = document.createElement("span");
    label.className = "animate-shine";
    replacementHost.append(label);
    const mutation = await recordMutation(() =>
      document.body.append(replacementHost),
    );

    expect(
      routeTimelineMutation(mutation, routingContext(timeline.contentRow)),
    ).toBe("full");
  });
});
