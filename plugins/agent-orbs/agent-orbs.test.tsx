import { act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  AGENT_ORB_AVATAR_ATTRIBUTE,
  AGENT_ORB_MOUNT_ATTRIBUTE,
  AGENT_ORB_NAME_ATTRIBUTE,
  AGENT_ORB_SURFACE_ATTRIBUTE,
  AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE,
  AGENT_ORB_PREFIX_HIDDEN_ATTRIBUTE,
  CHILD_THREADS_BODY_SELECTOR,
  CHILD_THREADS_TOGGLE_SELECTOR,
  PARENT_THREAD_TOGGLE_SELECTOR,
  SIDEBAR_THREAD_LINK_SELECTOR,
  mountAgentOrbs,
  threadKeyFromHref,
} from "./agent-orbs.js";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

function childBannerFixture(
  threadId = "thr_child_1",
  additionalThreadIds: string[] = [],
): HTMLButtonElement {
  const card = document.createElement("div");
  card.setAttribute("aria-label", "Child threads");

  const button = document.createElement("button");
  button.id = "thread-prompt-banner-child-threads-toggle";
  button.setAttribute("aria-controls", "thread-prompt-banner-child-threads-body");
  button.setAttribute("aria-label", `1 active child thread: Macro chat code archaeology`);

  const nativeIcon = document.createElement("span");
  nativeIcon.setAttribute("data-icon", "UserRound");
  const label = document.createElement("span");
  const prefix = document.createElement("span");
  prefix.textContent = "Active child thread: ";
  const title = document.createElement("span");
  title.textContent = "Macro chat code archaeology";
  label.append(prefix, title);
  button.append(nativeIcon, label);

  const body = document.createElement("section");
  body.id = "thread-prompt-banner-child-threads-body";
  for (const [index, childId] of [threadId, ...additionalThreadIds].entries()) {
    const link = document.createElement("a");
    link.href = `/projects/proj_1/threads/${childId}`;
    link.title =
      index === 0 ? "Macro chat code archaeology" : `Child task ${index + 1}`;
    link.textContent = link.title;
    body.append(link);
  }
  card.append(button, body);
  document.body.append(card);
  return button;
}

function sidebarThreadRowFixture({
  threadId,
  title,
  paddingLeft,
}: {
  threadId: string;
  title: string;
  paddingLeft: number;
}): { row: HTMLDivElement; link: HTMLAnchorElement } {
  const row = document.createElement("div");
  row.className = "group/thread-row";
  row.style.paddingLeft = `${paddingLeft}px`;

  const link = document.createElement("a");
  link.href = `/projects/proj_1/threads/${threadId}`;
  link.setAttribute("data-sidebar-thread-id", threadId);
  link.setAttribute("aria-label", `Open ${title}`);
  link.className = "absolute";

  const content = document.createElement("span");
  content.className = "flex min-w-0 flex-1 items-center gap-1.5";
  const titleElement = document.createElement("span");
  titleElement.title = title;
  titleElement.textContent = title;
  content.append(titleElement);

  row.append(link, content);
  document.body.append(row);
  return { row, link };
}

function childListFixture({
  threadId = "thr_child_list",
  pending = false,
}: {
  threadId?: string;
  pending?: boolean;
} = {}): { link: HTMLAnchorElement; nativeIcon: HTMLSpanElement } {
  const card = document.createElement("div");
  card.setAttribute("aria-label", "Child threads");
  const body = document.createElement("section");
  body.id = "thread-prompt-banner-child-threads-body";
  const link = document.createElement("a");
  link.href = `/projects/proj_1/threads/${threadId}`;
  link.title = "Expanded child thread";
  const nativeIcon = document.createElement("span");
  nativeIcon.setAttribute(
    "data-icon",
    pending ? "CircleQuestion" : "ChevronDown",
  );
  link.append(nativeIcon, document.createTextNode("Expanded child thread"));
  body.append(link);
  card.append(body);
  document.body.append(card);
  return { link, nativeIcon };
}

function parentBannerFixture(
  parentThreadId = "thr_parent_1",
): { button: HTMLButtonElement; nativeIcon: HTMLSpanElement } {
  const card = document.createElement("div");
  card.setAttribute("aria-label", "Thread context before sending");

  const button = document.createElement("button");
  button.id = PARENT_THREAD_TOGGLE_SELECTOR.split("#")[1]!;
  button.setAttribute("aria-controls", "thread-prompt-banner-parent-thread-body");
  button.setAttribute("aria-label", "Parent thread Replace child person icon");
  const nativeIcon = document.createElement("span");
  nativeIcon.setAttribute("data-icon", "UserRound");
  button.append(nativeIcon);

  const body = document.createElement("section");
  body.id = "thread-prompt-banner-parent-thread-body";
  const link = document.createElement("a");
  link.href = `/projects/proj_1/threads/${parentThreadId}`;
  link.textContent = "Replace child person icon";
  body.append(link);
  card.append(button, body);
  document.body.append(card);
  return { button, nativeIcon };
}

async function settleReact(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 30));
  });
}

describe("Agent Orbs content script", () => {
  it("targets the native child banner and keeps the child id stable", () => {
    expect(threadKeyFromHref("/projects/proj_1/threads/thr_child_1")).toBe(
      "thr_child_1",
    );
    expect(threadKeyFromHref("/threads/thr_child_2")).toBe("thr_child_2");
  });

  it("replaces the active child person icon with a named Oreo avatar", async () => {
    const button = childBannerFixture();
    const dispose = mountAgentOrbs({ signal: new AbortController().signal });
    await settleReact();

    expect(document.querySelectorAll(CHILD_THREADS_TOGGLE_SELECTOR)).toHaveLength(1);
    expect(button.querySelector(`[${AGENT_ORB_MOUNT_ATTRIBUTE}] svg`)).not.toBeNull();
    expect(button.querySelector(`[${AGENT_ORB_NAME_ATTRIBUTE}]`)).not.toBeNull();
    expect(
      button.querySelector(`[data-icon="UserRound"]`)?.hasAttribute(
        AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE,
      ),
    ).toBe(true);
    expect(
      button.querySelector(`[${AGENT_ORB_PREFIX_HIDDEN_ATTRIBUTE}]`)?.hasAttribute(
        AGENT_ORB_PREFIX_HIDDEN_ATTRIBUTE,
      ),
    ).toBe(true);
    expect(button.getAttribute("aria-label")).toMatch(/ agent: /);

    await dispose();
    expect(button.querySelector(`[${AGENT_ORB_MOUNT_ATTRIBUTE}]`)).toBeNull();
    expect(button.querySelector(`[${AGENT_ORB_NAME_ATTRIBUTE}]`)).toBeNull();
    expect(
      button.querySelector(`[data-icon="UserRound"]`)?.hasAttribute(
        AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE,
      ),
    ).toBe(false);
    expect(button.getAttribute("aria-label")).toBe(
      "1 active child thread: Macro chat code archaeology",
    );
  });

  it("uses one profile and overlapping avatar cluster for multiple active children", async () => {
    const button = childBannerFixture("thr_child_1", [
      "thr_child_2",
      "thr_child_3",
    ]);
    const dispose = mountAgentOrbs({ signal: new AbortController().signal });
    await settleReact();

    const bannerMount = button.querySelector(
      `[${AGENT_ORB_MOUNT_ATTRIBUTE}][${AGENT_ORB_SURFACE_ATTRIBUTE}="banner"]`,
    )!;
    expect(bannerMount.getAttribute("data-bb-agent-orb-count")).toBe("3");
    expect(
      bannerMount.querySelectorAll(`[${AGENT_ORB_AVATAR_ATTRIBUTE}]`),
    ).toHaveLength(3);
    expect(button.textContent).toContain("Macro chat code archaeology");
    expect(button.querySelectorAll(`[${AGENT_ORB_NAME_ATTRIBUTE}]`)).toHaveLength(1);

    await dispose();
  });

  it("keeps the same child profile across banner, child list, and sidebar", async () => {
    const button = childBannerFixture("thr_shared_child");
    const { link: childListLink } = childListFixture({
      threadId: "thr_shared_child",
    });
    const { row: sidebarRow } = sidebarThreadRowFixture({
      threadId: "thr_shared_child",
      title: "Shared child",
      paddingLeft: 32,
    });
    const dispose = mountAgentOrbs({ signal: new AbortController().signal });
    await settleReact();

    const mounts = [
      button.querySelector(
        `[${AGENT_ORB_MOUNT_ATTRIBUTE}][${AGENT_ORB_SURFACE_ATTRIBUTE}="banner"]`,
      ),
      childListLink.querySelector(
        `[${AGENT_ORB_MOUNT_ATTRIBUTE}][${AGENT_ORB_SURFACE_ATTRIBUTE}="child-list"]`,
      ),
      sidebarRow.querySelector(
        `[${AGENT_ORB_MOUNT_ATTRIBUTE}][${AGENT_ORB_SURFACE_ATTRIBUTE}="sidebar"]`,
      ),
    ];
    expect(mounts.every((mount) => mount !== null)).toBe(true);
    const profile = mounts[0]!;
    for (const mount of mounts.slice(1)) {
      expect(mount?.getAttribute("data-bb-agent-orb-shape")).toBe(
        profile.getAttribute("data-bb-agent-orb-shape"),
      );
      expect(mount?.getAttribute("data-bb-agent-orb-palette")).toBe(
        profile.getAttribute("data-bb-agent-orb-palette"),
      );
    }

    await dispose();
  });

  it("reattaches the same sidebar avatar root after a host row rerender", async () => {
    const { row, link } = sidebarThreadRowFixture({
      threadId: "thr_sidebar_rerender",
      title: "Rerender the sidebar row",
      paddingLeft: 32,
    });
    const dispose = mountAgentOrbs({ signal: new AbortController().signal });
    await settleReact();

    const originalMount = row.querySelector(`[${AGENT_ORB_MOUNT_ATTRIBUTE}]`)!;
    const originalName = row.querySelector(`[${AGENT_ORB_NAME_ATTRIBUTE}]`)!;
    const replacementContent = document.createElement("span");
    replacementContent.className =
      "flex min-w-0 flex-1 items-center gap-1.5";
    const replacementTitle = document.createElement("span");
    replacementTitle.title = "Rerender the sidebar row";
    replacementTitle.textContent = "Rerender the sidebar row";
    replacementContent.append(replacementTitle);
    link.nextElementSibling!.replaceWith(replacementContent);
    await settleReact();

    expect(row.querySelector(`[${AGENT_ORB_MOUNT_ATTRIBUTE}]`)).toBe(
      originalMount,
    );
    expect(row.querySelector(`[${AGENT_ORB_NAME_ATTRIBUTE}]`)).toBe(
      originalName,
    );
    expect(originalMount.parentElement).toBe(replacementContent);
    expect(originalMount.querySelector("svg")).not.toBeNull();

    await dispose();
  });

  it("leaves a needs-input child icon alone", async () => {
    const button = childBannerFixture();
    button.setAttribute("aria-label", "1 child thread needs input: Install tools");
    const icon = button.querySelector("[data-icon=UserRound]")!;
    icon.setAttribute("data-icon", "CircleQuestion");
    const label = button.children[1]!;
    label.querySelector("span")!.textContent = "Needs your input: ";

    const dispose = mountAgentOrbs({ signal: new AbortController().signal });
    await settleReact();

    expect(button.querySelector(`[${AGENT_ORB_MOUNT_ATTRIBUTE}]`)).toBeNull();
    expect(button.querySelector("[data-icon=CircleQuestion]")).not.toBeNull();
    await dispose();
  });

  it("restores a reused child icon when the active thread needs input", async () => {
    const button = childBannerFixture();
    const dispose = mountAgentOrbs({ signal: new AbortController().signal });
    await settleReact();

    const nativeIcon = button.querySelector("[data-icon=UserRound]")!;
    expect(nativeIcon.hasAttribute(AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE)).toBe(true);

    nativeIcon.setAttribute("data-icon", "CircleQuestion");
    await settleReact();

    expect(button.querySelector(`[${AGENT_ORB_MOUNT_ATTRIBUTE}]`)).toBeNull();
    expect(nativeIcon.hasAttribute(AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE)).toBe(false);
    expect(button.querySelector("[data-icon=CircleQuestion]")).toBe(nativeIcon);
    expect(
      button.querySelector(`[${AGENT_ORB_PREFIX_HIDDEN_ATTRIBUTE}]`),
    ).toBeNull();

    await dispose();
  });

  it("reconciles a host rerender without losing the avatar identity", async () => {
    const button = childBannerFixture("thr_child_rerender");
    const dispose = mountAgentOrbs({ signal: new AbortController().signal });
    await settleReact();

    const oldIcon = button.querySelector("[data-icon=UserRound]")!;
    const newIcon = document.createElement("span");
    newIcon.setAttribute("data-icon", "UserRound");
    oldIcon.replaceWith(newIcon);
    const oldPrefix = button.querySelector(
      `[${AGENT_ORB_PREFIX_HIDDEN_ATTRIBUTE}]`,
    )!;
    oldPrefix.replaceWith(
      Object.assign(document.createElement("span"), {
        textContent: "Active child thread: ",
      }),
    );
    await settleReact();

    expect(button.querySelector(`[${AGENT_ORB_MOUNT_ATTRIBUTE}] svg`)).not.toBeNull();
    expect(
      button.querySelector(`[${AGENT_ORB_PREFIX_HIDDEN_ATTRIBUTE}]`),
    ).not.toBeNull();
    await dispose();
  });

  it("replaces the expanded child-thread chevron with the same avatar treatment", async () => {
    const { link, nativeIcon } = childListFixture();
    const dispose = mountAgentOrbs({ signal: new AbortController().signal });
    await settleReact();

    expect(
      link.querySelector(
        `[${AGENT_ORB_MOUNT_ATTRIBUTE}][${AGENT_ORB_SURFACE_ATTRIBUTE}="child-list"] svg`,
      ),
    ).not.toBeNull();
    expect(nativeIcon.hasAttribute(AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE)).toBe(true);
    expect(link.getAttribute("aria-label")).toMatch(
      / agent: Expanded child thread/,
    );

    await dispose();
    expect(link.querySelector(`[${AGENT_ORB_MOUNT_ATTRIBUTE}]`)).toBeNull();
    expect(nativeIcon.hasAttribute(AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE)).toBe(false);
    expect(link.getAttribute("aria-label")).toBeNull();
  });

  it("keeps the expanded child question icon visible when input is needed", async () => {
    const { link, nativeIcon } = childListFixture({ pending: true });
    const dispose = mountAgentOrbs({ signal: new AbortController().signal });
    await settleReact();

    expect(link.querySelector(`[${AGENT_ORB_MOUNT_ATTRIBUTE}]`)).toBeNull();
    expect(nativeIcon.hasAttribute(AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE)).toBe(false);
    await dispose();
  });

  it("restores a reused child-list chevron when input becomes needed", async () => {
    const { link, nativeIcon } = childListFixture();
    const dispose = mountAgentOrbs({ signal: new AbortController().signal });
    await settleReact();

    expect(nativeIcon.hasAttribute(AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE)).toBe(true);
    nativeIcon.setAttribute("data-icon", "CircleQuestion");
    await settleReact();

    expect(link.querySelector(`[${AGENT_ORB_MOUNT_ATTRIBUTE}]`)).toBeNull();
    expect(nativeIcon.hasAttribute(AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE)).toBe(false);
    expect(link.querySelector("[data-icon=CircleQuestion]")).toBe(nativeIcon);

    await dispose();
  });

  it("uses the orb treatment for a child thread's parent link", async () => {
    const { button, nativeIcon } = parentBannerFixture();
    const dispose = mountAgentOrbs({ signal: new AbortController().signal });
    await settleReact();

    expect(
      button.querySelector(
        `[${AGENT_ORB_MOUNT_ATTRIBUTE}][${AGENT_ORB_SURFACE_ATTRIBUTE}="parent"] svg`,
      ),
    ).not.toBeNull();
    expect(nativeIcon.hasAttribute(AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE)).toBe(true);
    expect(button.querySelector(`[${AGENT_ORB_NAME_ATTRIBUTE}]`)).not.toBeNull();
    expect(button.getAttribute("aria-label")).toMatch(
      / agent: Parent thread/,
    );

    await dispose();
    expect(button.querySelector(`[${AGENT_ORB_MOUNT_ATTRIBUTE}]`)).toBeNull();
    expect(nativeIcon.hasAttribute(AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE)).toBe(false);
    expect(button.getAttribute("aria-label")).toBe(
      "Parent thread Replace child person icon",
    );
  });

  it("uses the current child identity for its parent-context orb", async () => {
    const originalPath = window.location.pathname;
    window.history.replaceState(
      {},
      "",
      "/projects/proj_1/threads/thr_current_child",
    );
    const { button } = parentBannerFixture("thr_parent_1");
    const { row } = sidebarThreadRowFixture({
      threadId: "thr_current_child",
      title: "Current child",
      paddingLeft: 32,
    });
    const dispose = mountAgentOrbs({ signal: new AbortController().signal });
    try {
      await settleReact();

      const parentMount = button.querySelector(
        `[${AGENT_ORB_MOUNT_ATTRIBUTE}][${AGENT_ORB_SURFACE_ATTRIBUTE}="parent"]`,
      )!;
      const sidebarMount = row.querySelector(
        `[${AGENT_ORB_MOUNT_ATTRIBUTE}][${AGENT_ORB_SURFACE_ATTRIBUTE}="sidebar"]`,
      )!;
      expect(parentMount.getAttribute("data-bb-agent-orb-shape")).toBe(
        sidebarMount.getAttribute("data-bb-agent-orb-shape"),
      );
      expect(parentMount.getAttribute("data-bb-agent-orb-palette")).toBe(
        sidebarMount.getAttribute("data-bb-agent-orb-palette"),
      );
      expect(button.querySelector(`[${AGENT_ORB_NAME_ATTRIBUTE}]`)).not.toBeNull();
    } finally {
      await dispose();
      window.history.replaceState({}, "", originalPath);
    }
  });

  it("adds the same named orb beside an indented sidebar child row", async () => {
    const { row, link } = sidebarThreadRowFixture({
      threadId: "thr_sidebar_child",
      title: "Inspect the sidebar",
      paddingLeft: 32,
    });
    const dispose = mountAgentOrbs({ signal: new AbortController().signal });
    await settleReact();

    expect(
      document.querySelectorAll(SIDEBAR_THREAD_LINK_SELECTOR),
    ).toHaveLength(1);
    expect(
      row.querySelector(
        `[${AGENT_ORB_MOUNT_ATTRIBUTE}][${AGENT_ORB_SURFACE_ATTRIBUTE}="sidebar"] svg`,
      ),
    ).not.toBeNull();
    expect(row.querySelector(`[${AGENT_ORB_NAME_ATTRIBUTE}]`)).not.toBeNull();
    expect(row.querySelector(`[${AGENT_ORB_NAME_ATTRIBUTE}]`)?.textContent).toMatch(
      / ·$/,
    );
    expect(link.getAttribute("aria-label")).toMatch(/ agent: Open Inspect the sidebar/);

    await dispose();
    expect(row.querySelector(`[${AGENT_ORB_MOUNT_ATTRIBUTE}]`)).toBeNull();
    expect(row.querySelector(`[${AGENT_ORB_NAME_ATTRIBUTE}]`)).toBeNull();
    expect(link.getAttribute("aria-label")).toBe("Open Inspect the sidebar");
  });

  it("does not decorate a top-level sidebar thread row", async () => {
    const { row } = sidebarThreadRowFixture({
      threadId: "thr_sidebar_root",
      title: "Root thread",
      paddingLeft: 8,
    });
    const dispose = mountAgentOrbs({ signal: new AbortController().signal });
    await settleReact();

    expect(row.querySelector(`[${AGENT_ORB_MOUNT_ATTRIBUTE}]`)).toBeNull();
    expect(row.querySelector(`[${AGENT_ORB_NAME_ATTRIBUTE}]`)).toBeNull();
    await dispose();
  });
});
