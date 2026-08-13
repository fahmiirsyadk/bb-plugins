import type { CSSProperties } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Avatar } from "@oreo-design/avatar/react";
import type {
  PluginContentScriptContext,
  PluginContentScriptDisposer,
} from "@bb/plugin-sdk/app";
import {
  avatarProfileForKey,
  createAgentIdentityRegistry,
  type AgentIdentityRegistry,
} from "./agent-identity.js";

export const CHILD_THREADS_TOGGLE_SELECTOR =
  "button#thread-prompt-banner-child-threads-toggle";
export const PARENT_THREAD_TOGGLE_SELECTOR =
  "button#thread-prompt-banner-parent-thread-toggle";
export const CHILD_THREADS_BODY_SELECTOR =
  '[id="thread-prompt-banner-child-threads-body"]';
export const SIDEBAR_THREAD_LINK_SELECTOR =
  "a[data-sidebar-thread-id][href]";
export const AGENT_ORB_MOUNT_ATTRIBUTE = "data-bb-agent-orb-mount";
export const AGENT_ORB_NAME_ATTRIBUTE = "data-bb-agent-orb-name";
export const AGENT_ORB_SURFACE_ATTRIBUTE = "data-bb-agent-orb-surface";
export const AGENT_ORB_AVATAR_ATTRIBUTE = "data-bb-agent-orb-avatar";
export const AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE =
  "data-bb-agent-orb-native-hidden";
export const AGENT_ORB_PREFIX_HIDDEN_ATTRIBUTE =
  "data-bb-agent-orb-prefix-hidden";

const ACTIVE_CHILD_ICON_NAME = "UserRound";
const ACTIVE_CHILD_PREFIX = "Active child thread:";
const SIDEBAR_ROOT_ROW_PADDING_LEFT_PX = 8;

interface OrbElements {
  mount: HTMLSpanElement;
  name: HTMLSpanElement;
  root: Root;
}

interface MountedBannerAgentOrb extends OrbElements {
  kind: "banner";
  button: HTMLButtonElement;
  threadKey: string;
  avatarKeys: string[];
  nativeIcon: Element;
  nativeLabel: HTMLSpanElement;
  nativePrefix: Element;
  appliedAriaLabel: string;
  originalAriaLabel: string | null;
  sync(): void;
  dispose(): void;
}

interface MountedParentAgentOrb extends OrbElements {
  kind: "parent";
  button: HTMLButtonElement;
  threadKey: string;
  nativeIcon: Element;
  appliedAriaLabel: string;
  originalAriaLabel: string | null;
  sync(): void;
  dispose(): void;
}

interface MountedChildListAgentOrb extends OrbElements {
  kind: "child-list";
  link: HTMLAnchorElement;
  threadKey: string;
  nativeIcon: Element;
  appliedAriaLabel: string;
  originalAriaLabel: string | null;
  sync(): void;
  dispose(): void;
}

interface MountedSidebarAgentOrb extends OrbElements {
  kind: "sidebar";
  link: HTMLAnchorElement;
  content: HTMLSpanElement;
  threadKey: string;
  appliedAriaLabel: string;
  originalAriaLabel: string | null;
  sync(): void;
  dispose(): void;
}

type MountedAgentOrb =
  | MountedBannerAgentOrb
  | MountedParentAgentOrb
  | MountedChildListAgentOrb
  | MountedSidebarAgentOrb;

function isElement(node: Node | null): node is Element {
  return node instanceof Element;
}

function elementHasOwnedMarker(element: Element): boolean {
  return (
    element.hasAttribute(AGENT_ORB_MOUNT_ATTRIBUTE) ||
    element.hasAttribute(AGENT_ORB_NAME_ATTRIBUTE) ||
    element.hasAttribute(AGENT_ORB_SURFACE_ATTRIBUTE) ||
    element.hasAttribute(AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE) ||
    element.hasAttribute(AGENT_ORB_PREFIX_HIDDEN_ATTRIBUTE)
  );
}

function mutationBelongsToPlugin(mutation: MutationRecord): boolean {
  // The host owns data-icon. BB can reuse the same native icon element while
  // changing an active child/chevron into a needs-input question mark. That
  // transition must always trigger reconciliation, even after this plugin
  // marked the old icon as hidden.
  if (mutation.type === "attributes" && mutation.attributeName === "data-icon") {
    return false;
  }

  const target = isElement(mutation.target)
    ? mutation.target
    : mutation.target.parentElement;
  if (target?.closest(`[${AGENT_ORB_MOUNT_ATTRIBUTE}]`)) return true;
  if (target?.closest(`[${AGENT_ORB_NAME_ATTRIBUTE}]`)) return true;
  if (target?.closest(`[${AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE}]`)) return true;
  if (target?.closest(`[${AGENT_ORB_PREFIX_HIDDEN_ATTRIBUTE}]`)) return true;
  return Array.from(mutation.addedNodes).some(
    (node) => isElement(node) && elementHasOwnedMarker(node),
  );
}

function findDirectChild(
  button: HTMLButtonElement,
  predicate: (element: Element) => boolean,
): Element | null {
  return (
    Array.from(button.children).find((child) => predicate(child)) ?? null
  );
}

function findDirectIcon(
  button: HTMLButtonElement,
  iconName: string,
): Element | null {
  return findDirectChild(
    button,
    (element) => element.getAttribute("data-icon") === iconName,
  );
}

function findActiveChildIcon(button: HTMLButtonElement): Element | null {
  return findDirectIcon(button, ACTIVE_CHILD_ICON_NAME);
}

function isSpan(element: Element): element is HTMLSpanElement {
  return element.tagName === "SPAN";
}

function findLabel(button: HTMLButtonElement): HTMLSpanElement | null {
  const candidate = findDirectChild(button, (element) => {
    if (!isSpan(element)) return false;
    return element.textContent?.includes(ACTIVE_CHILD_PREFIX) ?? false;
  });
  return candidate instanceof HTMLSpanElement ? candidate : null;
}

function findPrefix(label: HTMLSpanElement): HTMLSpanElement | null {
  const candidate = Array.from(label.children).find(
    (element) =>
      isSpan(element) &&
      (element.textContent?.trim() === ACTIVE_CHILD_PREFIX ||
        element.textContent?.startsWith(ACTIVE_CHILD_PREFIX) === true),
  );
  return candidate instanceof HTMLSpanElement ? candidate : null;
}

function titleFromButton(button: HTMLButtonElement): string {
  const label = findLabel(button);
  if (label !== null) {
    const prefix = findPrefix(label);
    const titleParts: string[] = [];
    for (const element of label.children) {
      if (element !== prefix) titleParts.push(element.textContent ?? "");
    }
    const title = titleParts
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (title.length > 0) return title;
  }

  const ariaLabel = button.getAttribute("aria-label") ?? "";
  const separatorIndex = ariaLabel.indexOf(":");
  if (separatorIndex >= 0) {
    const title = ariaLabel.slice(separatorIndex + 1).trim();
    if (title.length > 0) return title;
  }
  return (label?.textContent ?? button.textContent ?? "")
    .replace(ACTIVE_CHILD_PREFIX, "")
    .replace(/\s+/g, " ")
    .trim();
}

function bodyForButton(button: HTMLButtonElement): HTMLElement | null {
  const card = button.closest<HTMLElement>('[aria-label="Child threads"]');
  const controlsId = button.getAttribute("aria-controls");
  if (card !== null && controlsId !== null) {
    const body = Array.from(card.querySelectorAll<HTMLElement>("[id]")).find(
      (element) => element.id === controlsId,
    );
    if (body !== undefined) return body;
  }

  // Keep the fallback scoped to this card/prompt stack. Duplicate stable ids
  // can exist when BB is rendering split panes.
  return card?.querySelector<HTMLElement>(
    '[id="thread-prompt-banner-child-threads-body"]',
  ) ?? null;
}

function parentBodyForButton(button: HTMLButtonElement): HTMLElement | null {
  const card = button.closest<HTMLElement>(
    '[aria-label="Thread context before sending"]',
  );
  const controlsId = button.getAttribute("aria-controls");
  if (card !== null && controlsId !== null) {
    const body = Array.from(card.querySelectorAll<HTMLElement>("[id]")).find(
      (element) => element.id === controlsId,
    );
    if (body !== undefined) return body;
  }

  return card?.querySelector<HTMLElement>(
    '[id="thread-prompt-banner-parent-thread-body"]',
  ) ?? null;
}

function childLinksForButton(button: HTMLButtonElement): HTMLAnchorElement[] {
  return Array.from(
    bodyForButton(button)?.querySelectorAll<HTMLAnchorElement>("a[href]") ??
      [],
  );
}

function hrefForParentThread(button: HTMLButtonElement): string | null {
  const href = parentBodyForButton(button)
    ?.querySelector<HTMLAnchorElement>("a[href]")
    ?.getAttribute("href");
  return href && href.trim().length > 0 ? href : null;
}

/** Extracts the stable child-thread id from BB's project or projectless URL. */
export function threadKeyFromHref(href: string): string {
  try {
    const url = new URL(href, document.baseURI);
    const segments = url.pathname.split("/").filter(Boolean);
    const threadsIndex = segments.indexOf("threads");
    if (threadsIndex >= 0 && segments[threadsIndex + 1]) {
      return decodeURIComponent(segments[threadsIndex + 1]!);
    }
    return url.pathname;
  } catch {
    return href;
  }
}

function threadIdFromHref(href: string): string | null {
  try {
    const url = new URL(href, document.baseURI);
    const segments = url.pathname.split("/").filter(Boolean);
    const threadsIndex = segments.indexOf("threads");
    return threadsIndex >= 0 && segments[threadsIndex + 1]
      ? decodeURIComponent(segments[threadsIndex + 1]!)
      : null;
  } catch {
    return null;
  }
}

function childLinkTitle(link: HTMLAnchorElement): string {
  return link.getAttribute("title") ?? link.textContent?.trim() ?? "";
}

function childThreadKeysForButton(button: HTMLButtonElement): string[] {
  const links = childLinksForButton(button);
  const primaryTitle = titleFromButton(button);
  const keys: string[] = [];
  const seenKeys = new Set<string>();
  const appendKey = (link: HTMLAnchorElement) => {
    const key = threadKeyFromHref(link.getAttribute("href") ?? "");
    if (key.length > 0 && !seenKeys.has(key)) {
      seenKeys.add(key);
      keys.push(key);
    }
  };

  // Keep the active child first so the primary orb/profile remains stable,
  // while avoiding repeated filter/map allocations during DOM rescans.
  for (const link of links) {
    if (childLinkTitle(link) === primaryTitle) appendKey(link);
  }
  for (const link of links) {
    if (childLinkTitle(link) !== primaryTitle) appendKey(link);
  }

  return keys.length > 0 ? keys : [`title:${primaryTitle}`];
}

function keyForButton(button: HTMLButtonElement): string {
  return childThreadKeysForButton(button)[0]!;
}

function sameStringArray(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function titleForAccessibleLabel(button: HTMLButtonElement): string {
  return titleFromButton(button) || "active child thread";
}

function parentTitleFromButton(button: HTMLButtonElement): string {
  const ariaLabel = button.getAttribute("aria-label") ?? "";
  const labelWithoutAgent = ariaLabel.includes(":")
    ? ariaLabel.slice(ariaLabel.indexOf(":") + 1).trim()
    : ariaLabel;
  return (
    labelWithoutAgent.replace(/^Parent thread\s*/i, "").trim() ||
    "parent thread"
  );
}

function keyForParentButton(button: HTMLButtonElement): string {
  // The parent-context control is rendered inside the current child thread.
  // Identify that child consistently with its sidebar row so the circled
  // avatar and codename describe the agent the user is currently viewing.
  const currentThreadId = threadIdFromHref(window.location.href);
  if (currentThreadId !== null) return currentThreadId;

  const href = hrefForParentThread(button);
  return href === null
    ? `parent-title:${parentTitleFromButton(button)}`
    : threadKeyFromHref(href);
}

function getLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function motionStyleForProfile(profile: ReturnType<typeof avatarProfileForKey>) {
  return {
    "--bb-agent-orb-duration": `${profile.durationMs}ms`,
    "--bb-agent-orb-delay": `${profile.delayMs}ms`,
    "--bb-agent-orb-lift": `${profile.liftPx}px`,
    "--bb-agent-orb-tilt": `${profile.tiltDeg}deg`,
  } as CSSProperties;
}

function createOrbElements(
  threadKeys: readonly string[],
  agentName: string,
  surface: "banner" | "parent" | "child-list" | "sidebar",
): OrbElements {
  const uniqueThreadKeys = Array.from(new Set(threadKeys));
  const profiles = uniqueThreadKeys.map((threadKey) => ({
    threadKey,
    profile: avatarProfileForKey(threadKey),
  }));
  const primary = profiles[0]!;
  const mount = document.createElement("span");
  mount.setAttribute(AGENT_ORB_MOUNT_ATTRIBUTE, "");
  mount.setAttribute(AGENT_ORB_SURFACE_ATTRIBUTE, surface);
  mount.setAttribute("data-bb-agent-orb-count", String(profiles.length));
  mount.setAttribute("data-bb-agent-orb-shape", primary.profile.shape);
  mount.setAttribute("data-bb-agent-orb-palette", primary.profile.palette);
  mount.setAttribute("aria-hidden", "true");
  mount.className = "bb-agent-orb-mount";
  mount.title = `${agentName} agent`;

  const name = document.createElement("span");
  name.setAttribute(AGENT_ORB_NAME_ATTRIBUTE, "");
  name.setAttribute(AGENT_ORB_SURFACE_ATTRIBUTE, surface);
  name.className = "bb-agent-orb-name";
  name.textContent = `${agentName} ·`;
  name.title = `${agentName} agent`;

  const root = createRoot(mount);
  root.render(
    <>
      {profiles.map(({ threadKey, profile }) => (
        <span
          key={threadKey}
          data-bb-agent-orb-avatar=""
          data-bb-agent-orb-shape={profile.shape}
          data-bb-agent-orb-palette={profile.palette}
          style={motionStyleForProfile(profile)}
        >
          <Avatar
            shape={profile.shape}
            palette={profile.palette}
            appearance="dark"
            variantId={threadKey}
            drift={profile.drift}
            // The stylesheet scales the vector down to the native 16px row icon.
            size={64}
          />
        </span>
      ))}
    </>,
  );

  return { mount, name, root };
}

function sidebarRowForLink(link: HTMLAnchorElement): HTMLElement | null {
  let current = link.parentElement;
  while (current !== null) {
    if (
      current.classList.contains("group/thread-row") ||
      (current.style.paddingLeft.length > 0 &&
        Array.from(current.children).some((child) => child === link))
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

/**
 * BB encodes the thread-tree depth in the row's inline padding. A depth-zero
 * row starts at 8px; indented rows are child entries. This keeps the content
 * script scoped to child rows without replacing the host's sidebar list.
 */
function isSidebarChildRow(link: HTMLAnchorElement): boolean {
  const row = sidebarRowForLink(link);
  if (row === null) return false;
  const paddingLeft = Number.parseFloat(row.style.paddingLeft);
  return (
    Number.isFinite(paddingLeft) &&
    paddingLeft > SIDEBAR_ROOT_ROW_PADDING_LEFT_PX
  );
}

function sidebarContentForLink(
  link: HTMLAnchorElement,
): HTMLSpanElement | null {
  const row = sidebarRowForLink(link);
  if (row === null) return null;

  // ThreadRow renders the content span immediately after its absolute NavLink.
  // Keep a structural fallback for small host markup changes, but do not rely
  // on Tailwind class names beyond the stable row marker above.
  const nextSibling = link.nextElementSibling;
  if (nextSibling instanceof HTMLSpanElement) return nextSibling;

  const candidate = Array.from(row.children).find(
    (element) =>
      element !== link &&
      element instanceof HTMLSpanElement &&
      element.querySelector("span") !== null,
  );
  return candidate instanceof HTMLSpanElement ? candidate : null;
}

function keyForSidebarLink(link: HTMLAnchorElement): string {
  const threadId = link.getAttribute("data-sidebar-thread-id")?.trim();
  const href = link.getAttribute("href") ?? "";
  // Use the same URL-derived identity as the prompt banner and expanded
  // child list whenever BB exposes a normal thread link. This keeps the
  // geometry/palette identical across all three child surfaces.
  const hrefThreadId = threadIdFromHref(href);
  if (hrefThreadId) return hrefThreadId;
  if (threadId) return threadId;
  return threadKeyFromHref(href);
}

function sidebarTitleForAccessibleLabel(link: HTMLAnchorElement): string {
  const ariaLabel = link.getAttribute("aria-label") ?? "";
  if (ariaLabel.length > 0) return ariaLabel;

  const content = sidebarContentForLink(link);
  return content?.textContent?.replace(/\s+/g, " ").trim() || "child thread";
}

function mountOneAgentOrb(
  button: HTMLButtonElement,
  threadKey: string,
  avatarKeys: readonly string[],
  identities: AgentIdentityRegistry,
): MountedAgentOrb | null {
  const nativeIcon = findActiveChildIcon(button);
  const label = findLabel(button);
  const nativePrefix = label === null ? null : findPrefix(label);
  if (nativeIcon === null || label === null || nativePrefix === null) {
    return null;
  }

  const agentName = identities.get(threadKey);
  const elements = createOrbElements(avatarKeys, agentName, "banner");

  const originalAriaLabel = button.getAttribute("aria-label");
  const appliedAriaLabel = `${agentName} agent: ${titleForAccessibleLabel(button)}`;

  nativeIcon.classList.add(AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE);
  nativeIcon.setAttribute(AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE, "");
  nativePrefix.classList.add(AGENT_ORB_PREFIX_HIDDEN_ATTRIBUTE);
  nativePrefix.setAttribute(AGENT_ORB_PREFIX_HIDDEN_ATTRIBUTE, "");

  button.insertBefore(elements.mount, nativeIcon);
  button.insertBefore(elements.name, label);
  button.setAttribute("aria-label", appliedAriaLabel);

  let disposed = false;
  const mounted: MountedBannerAgentOrb = {
    kind: "banner",
    button,
    threadKey,
    avatarKeys: [...avatarKeys],
    nativeIcon,
    nativeLabel: label,
    nativePrefix,
    ...elements,
    appliedAriaLabel,
    originalAriaLabel,
    sync() {
      if (disposed) return;

      const currentLabel = findLabel(button);
      const currentPrefix =
        currentLabel === null ? null : findPrefix(currentLabel);
      if (currentLabel === null || currentPrefix === null) {
        mounted.dispose();
        return;
      }
      if (mounted.nativePrefix !== currentPrefix) {
        mounted.nativePrefix.classList.remove(AGENT_ORB_PREFIX_HIDDEN_ATTRIBUTE);
        mounted.nativePrefix.removeAttribute(AGENT_ORB_PREFIX_HIDDEN_ATTRIBUTE);
        mounted.nativePrefix = currentPrefix;
      }
      mounted.nativeLabel = currentLabel;
      if (!mounted.mount.isConnected) return;
      if (!mounted.name.isConnected) {
        button.insertBefore(mounted.name, currentLabel);
      }
      nativeIcon.classList.add(AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE);
      nativeIcon.setAttribute(AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE, "");
      mounted.nativePrefix.classList.add(AGENT_ORB_PREFIX_HIDDEN_ATTRIBUTE);
      mounted.nativePrefix.setAttribute(AGENT_ORB_PREFIX_HIDDEN_ATTRIBUTE, "");
      if (button.getAttribute("aria-label") !== mounted.appliedAriaLabel) {
        mounted.originalAriaLabel = button.getAttribute("aria-label");
        mounted.appliedAriaLabel = `${agentName} agent: ${titleForAccessibleLabel(button)}`;
        button.setAttribute("aria-label", mounted.appliedAriaLabel);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      mounted.root.unmount();
      mounted.mount.remove();
      mounted.name.remove();
      nativeIcon.classList.remove(AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE);
      nativeIcon.removeAttribute(AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE);
      mounted.nativePrefix.classList.remove(AGENT_ORB_PREFIX_HIDDEN_ATTRIBUTE);
      mounted.nativePrefix.removeAttribute(AGENT_ORB_PREFIX_HIDDEN_ATTRIBUTE);
      if (button.getAttribute("aria-label") === mounted.appliedAriaLabel) {
        if (mounted.originalAriaLabel === null) {
          button.removeAttribute("aria-label");
        } else {
          button.setAttribute("aria-label", mounted.originalAriaLabel);
        }
      }
    },
  };
  return mounted;
}

function mountOneParentAgentOrb(
  button: HTMLButtonElement,
  threadKey: string,
  identities: AgentIdentityRegistry,
): MountedParentAgentOrb | null {
  const nativeIcon = findDirectIcon(button, ACTIVE_CHILD_ICON_NAME);
  if (nativeIcon === null) return null;

  const agentName = identities.get(threadKey);
  const elements = createOrbElements([threadKey], agentName, "parent");
  const originalAriaLabel = button.getAttribute("aria-label");
  const appliedAriaLabel = `${agentName} agent: ${
    originalAriaLabel ?? parentTitleFromButton(button)
  }`;

  nativeIcon.classList.add(AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE);
  nativeIcon.setAttribute(AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE, "");
  button.insertBefore(elements.mount, nativeIcon);
  button.insertBefore(elements.name, nativeIcon);
  button.setAttribute("aria-label", appliedAriaLabel);

  let disposed = false;
  const mounted: MountedParentAgentOrb = {
    kind: "parent",
    button,
    threadKey,
    nativeIcon,
    ...elements,
    appliedAriaLabel,
    originalAriaLabel,
    sync() {
      if (disposed) return;
      if (
        mounted.mount.parentElement !== button ||
        mounted.mount.nextSibling !== mounted.name
      ) {
        button.insertBefore(
          mounted.mount,
          mounted.name.parentElement === button ? mounted.name : nativeIcon,
        );
      }
      if (
        mounted.name.parentElement !== button ||
        mounted.name.nextSibling !== nativeIcon
      ) {
        button.insertBefore(mounted.name, nativeIcon);
      }
      nativeIcon.classList.add(AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE);
      nativeIcon.setAttribute(AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE, "");
      if (button.getAttribute("aria-label") !== mounted.appliedAriaLabel) {
        mounted.originalAriaLabel = button.getAttribute("aria-label");
        mounted.appliedAriaLabel = `${agentName} agent: ${
          button.getAttribute("aria-label") ?? parentTitleFromButton(button)
        }`;
        button.setAttribute("aria-label", mounted.appliedAriaLabel);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      mounted.root.unmount();
      mounted.mount.remove();
      mounted.name.remove();
      nativeIcon.classList.remove(AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE);
      nativeIcon.removeAttribute(AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE);
      if (button.getAttribute("aria-label") === mounted.appliedAriaLabel) {
        if (mounted.originalAriaLabel === null) {
          button.removeAttribute("aria-label");
        } else {
          button.setAttribute("aria-label", mounted.originalAriaLabel);
        }
      }
    },
  };
  return mounted;
}

function childListIconForLink(link: HTMLAnchorElement): Element | null {
  if (link.querySelector('[data-icon="CircleQuestion"]') !== null) {
    return null;
  }
  return link.querySelector('[data-icon="ChevronDown"]');
}

function childListTitleForLink(link: HTMLAnchorElement): string {
  return link.getAttribute("title") ?? link.textContent?.trim() ?? "child thread";
}

function mountOneChildListAgentOrb(
  link: HTMLAnchorElement,
  nativeIcon: Element,
  threadKey: string,
  identities: AgentIdentityRegistry,
): MountedChildListAgentOrb {
  const agentName = identities.get(threadKey);
  const elements = createOrbElements([threadKey], agentName, "child-list");
  const originalAriaLabel = link.getAttribute("aria-label");
  const appliedAriaLabel = `${agentName} agent: ${childListTitleForLink(link)}`;

  nativeIcon.classList.add(AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE);
  nativeIcon.setAttribute(AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE, "");
  link.insertBefore(elements.mount, nativeIcon);
  link.setAttribute("aria-label", appliedAriaLabel);

  let disposed = false;
  const mounted: MountedChildListAgentOrb = {
    kind: "child-list",
    link,
    threadKey,
    nativeIcon,
    ...elements,
    appliedAriaLabel,
    originalAriaLabel,
    sync() {
      if (disposed) return;
      if (!mounted.mount.isConnected) {
        link.insertBefore(mounted.mount, nativeIcon);
      }
      nativeIcon.classList.add(AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE);
      nativeIcon.setAttribute(AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE, "");
      if (link.getAttribute("aria-label") !== mounted.appliedAriaLabel) {
        mounted.originalAriaLabel = link.getAttribute("aria-label");
        mounted.appliedAriaLabel = `${agentName} agent: ${childListTitleForLink(link)}`;
        link.setAttribute("aria-label", mounted.appliedAriaLabel);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      mounted.root.unmount();
      mounted.mount.remove();
      mounted.name.remove();
      nativeIcon.classList.remove(AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE);
      nativeIcon.removeAttribute(AGENT_ORB_NATIVE_HIDDEN_ATTRIBUTE);
      if (link.getAttribute("aria-label") === mounted.appliedAriaLabel) {
        if (mounted.originalAriaLabel === null) {
          link.removeAttribute("aria-label");
        } else {
          link.setAttribute("aria-label", mounted.originalAriaLabel);
        }
      }
    },
  };
  return mounted;
}

function mountOneSidebarAgentOrb(
  link: HTMLAnchorElement,
  content: HTMLSpanElement,
  threadKey: string,
  identities: AgentIdentityRegistry,
): MountedSidebarAgentOrb {
  const agentName = identities.get(threadKey);
  const elements = createOrbElements([threadKey], agentName, "sidebar");
  const originalAriaLabel = link.getAttribute("aria-label");
  const appliedAriaLabel = `${agentName} agent: ${sidebarTitleForAccessibleLabel(link)}`;
  const firstChild = content.firstChild;

  content.insertBefore(elements.mount, firstChild);
  content.insertBefore(elements.name, firstChild);
  link.setAttribute("aria-label", appliedAriaLabel);

  let disposed = false;
  const mounted: MountedSidebarAgentOrb = {
    kind: "sidebar",
    link,
    content,
    threadKey,
    ...elements,
    appliedAriaLabel,
    originalAriaLabel,
    sync() {
      if (disposed) return;

      const currentContent = sidebarContentForLink(link);
      if (currentContent === null) {
        mounted.dispose();
        return;
      }
      // ThreadRow owns this wrapper and may replace it during a normal row
      // rerender. Keep the React Avatar root alive and move its DOM mount into
      // the replacement instead of unmounting/remounting on every update.
      mounted.content = currentContent;

      if (
        mounted.mount.parentElement !== currentContent ||
        currentContent.firstChild !== mounted.mount
      ) {
        currentContent.insertBefore(mounted.mount, currentContent.firstChild);
      }
      if (
        mounted.name.parentElement !== currentContent ||
        mounted.mount.nextSibling !== mounted.name
      ) {
        currentContent.insertBefore(mounted.name, mounted.mount.nextSibling);
      }
      if (link.getAttribute("aria-label") !== mounted.appliedAriaLabel) {
        mounted.originalAriaLabel = link.getAttribute("aria-label");
        mounted.appliedAriaLabel = `${agentName} agent: ${sidebarTitleForAccessibleLabel(link)}`;
        link.setAttribute("aria-label", mounted.appliedAriaLabel);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      mounted.root.unmount();
      mounted.mount.remove();
      mounted.name.remove();
      if (link.getAttribute("aria-label") === mounted.appliedAriaLabel) {
        if (mounted.originalAriaLabel === null) {
          link.removeAttribute("aria-label");
        } else {
          link.setAttribute("aria-label", mounted.originalAriaLabel);
        }
      }
    },
  };
  return mounted;
}

export function mountAgentOrbs(
  context: Pick<PluginContentScriptContext, "signal">,
): PluginContentScriptDisposer {
  const identities = createAgentIdentityRegistry(getLocalStorage());
  const mounted = new Map<Element, MountedAgentOrb>();
  let disposed = false;
  let scanQueued = false;
  let scanFrame: number | null = null;
  let scanTimer: number | null = null;

  const cancelScheduledScan = () => {
    if (scanFrame !== null) window.cancelAnimationFrame(scanFrame);
    if (scanTimer !== null) window.clearTimeout(scanTimer);
    scanFrame = null;
    scanTimer = null;
    scanQueued = false;
  };

  const scan = () => {
    if (disposed) return;
    scanQueued = false;
    scanFrame = null;
    scanTimer = null;

    const seen = new Set<Element>();
    for (const button of Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        CHILD_THREADS_TOGGLE_SELECTOR,
      ),
    )) {
      seen.add(button);
      const nativeIcon = findActiveChildIcon(button);
      const avatarKeys = childThreadKeysForButton(button);
      const threadKey = avatarKeys[0] ?? keyForButton(button);
      const current = mounted.get(button);

      if (
        current?.kind === "banner" &&
        current.threadKey === threadKey &&
        sameStringArray(current.avatarKeys, avatarKeys) &&
        current.nativeIcon === nativeIcon &&
        current.mount.isConnected
      ) {
        current.sync();
        continue;
      }

      current?.dispose();
      mounted.delete(button);
      if (nativeIcon === null) continue;

      const next = mountOneAgentOrb(button, threadKey, avatarKeys, identities);
      if (next !== null) mounted.set(button, next);
    }

    for (const button of Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        PARENT_THREAD_TOGGLE_SELECTOR,
      ),
    )) {
      seen.add(button);
      const nativeIcon = findDirectIcon(button, ACTIVE_CHILD_ICON_NAME);
      const threadKey = keyForParentButton(button);
      const current = mounted.get(button);

      if (
        current?.kind === "parent" &&
        current.threadKey === threadKey &&
        current.nativeIcon === nativeIcon
      ) {
        current.sync();
        continue;
      }

      current?.dispose();
      mounted.delete(button);
      if (nativeIcon === null) continue;

      const next = mountOneParentAgentOrb(button, threadKey, identities);
      if (next !== null) mounted.set(button, next);
    }

    for (const body of Array.from(
      document.querySelectorAll<HTMLElement>(CHILD_THREADS_BODY_SELECTOR),
    )) {
      for (const link of Array.from(
        body.querySelectorAll<HTMLAnchorElement>("a[href]"),
      )) {
        seen.add(link);
        const nativeIcon = childListIconForLink(link);
        const threadKey = threadKeyFromHref(link.getAttribute("href") ?? "");
        const current = mounted.get(link);

        if (nativeIcon === null) {
          current?.dispose();
          mounted.delete(link);
          continue;
        }

        if (
          current?.kind === "child-list" &&
          current.threadKey === threadKey &&
          current.nativeIcon === nativeIcon &&
          current.mount.isConnected
        ) {
          current.sync();
          continue;
        }

        current?.dispose();
        mounted.delete(link);
        mounted.set(
          link,
          mountOneChildListAgentOrb(link, nativeIcon, threadKey, identities),
        );
      }
    }

    for (const link of Array.from(
      document.querySelectorAll<HTMLAnchorElement>(SIDEBAR_THREAD_LINK_SELECTOR),
    )) {
      seen.add(link);
      const content = sidebarContentForLink(link);
      const threadKey = keyForSidebarLink(link);
      const current = mounted.get(link);

      if (!isSidebarChildRow(link) || content === null) {
        current?.dispose();
        mounted.delete(link);
        continue;
      }

      if (
        current?.kind === "sidebar" &&
        current.threadKey === threadKey
      ) {
        current.sync();
        continue;
      }

      current?.dispose();
      mounted.delete(link);
      mounted.set(
        link,
        mountOneSidebarAgentOrb(link, content, threadKey, identities),
      );
    }

    for (const [target, orb] of mounted) {
      if (seen.has(target) && target.isConnected) continue;
      orb.dispose();
      mounted.delete(target);
    }
  };

  const requestScan = () => {
    if (disposed || scanQueued) return;
    scanQueued = true;
    if (typeof window.requestAnimationFrame === "function") {
      scanFrame = window.requestAnimationFrame(scan);
    } else {
      scanTimer = window.setTimeout(scan, 0);
    }
  };

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => !mutationBelongsToPlugin(mutation))) {
      requestScan();
    }
  });
  const root = document.body ?? document.documentElement;
  if (root !== null) {
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        "aria-label",
        "aria-controls",
        "class",
        "data-icon",
        "data-sidebar-thread-id",
        "href",
        "style",
      ],
    });
  }

  const abort = () => {
    disposed = true;
    cancelScheduledScan();
    observer.disconnect();
    for (const orb of mounted.values()) orb.dispose();
    mounted.clear();
  };
  context.signal.addEventListener("abort", abort, { once: true });
  scan();

  return () => {
    context.signal.removeEventListener("abort", abort);
    abort();
  };
}
