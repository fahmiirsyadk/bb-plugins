import { useCallback, useEffect, useRef, useState } from "react";
import {
  definePluginApp,
  useComposer,
  useRealtime,
  useRpc,
  type PluginContentScriptContext,
  type PluginContentScriptDisposer,
  type PluginNavPanelProps,
  type PluginThreadPanelProps,
} from "@bb/plugin-sdk/app";
import type {
  browserRpcContract,
  BrowserTarget,
  CaptureTargetInput,
  ElementSnapshot,
} from "./server.js";
import {
  BROWSER_PICK_REQUEST_EVENT,
  BROWSER_TARGET_CAPTURED_EVENT,
  browserTargetsChannel,
} from "./shared.js";
import "./app.css";

const MAX_TEXT_LENGTH = 2_000;
const MAX_NOTE_LENGTH = 2_000;

type PickRequest = { threadId: string; note: string };

interface RpcEnvelope {
  ok: boolean;
  error?: { code?: string; message?: string };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePickRequest(value: unknown): PickRequest | null {
  if (!isRecord(value)) return null;
  const { threadId, note } = value;
  if (
    typeof threadId !== "string" ||
    threadId.length === 0 ||
    threadId.length > 200 ||
    typeof note !== "string" ||
    note.length > MAX_NOTE_LENGTH
  ) {
    return null;
  }
  return { threadId, note };
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : value.slice(0, maxLength);
}

function normalizeText(value: string): string {
  return truncate(value.replace(/\s+/g, " ").trim(), MAX_TEXT_LENGTH);
}

function escapeCssIdentifier(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value
    .split("")
    .map((character, index) => {
      const safe = /[A-Za-z0-9_-]/.test(character);
      const startsWithDigit = index === 0 && /[0-9]/.test(character);
      if (safe && !startsWithDigit) return character;
      return `\\${character.codePointAt(0)?.toString(16) ?? "0"} `;
    })
    .join("");
}

function escapeCssString(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\n", "\\a ")
    .replaceAll("\r", "\\d ");
}

function selectorIsUnique(selector: string): boolean {
  try {
    return document.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

export function selectorForElement(element: Element): string {
  if (element.id.length > 0) {
    const selector = `#${escapeCssIdentifier(element.id)}`;
    if (selectorIsUnique(selector)) return selector;
  }

  for (const name of ["data-testid", "data-test", "data-cy"] as const) {
    const value = element.getAttribute(name);
    if (!value) continue;
    const selector = `[${name}="${escapeCssString(value)}"]`;
    if (selectorIsUnique(selector)) return selector;
  }

  const segments: string[] = [];
  let current: Element | null = element;
  while (current !== null && current !== document.documentElement) {
    const tagName = current.tagName.toLowerCase();
    const currentTagName = current.tagName;
    let segment = tagName;
    const parent: Element | null = current.parentElement;
    if (parent !== null) {
      const sameTagSiblings: Element[] = Array.from(parent.children).filter(
        (sibling: Element) => sibling.tagName === currentTagName,
      );
      if (sameTagSiblings.length > 1) {
        segment += `:nth-of-type(${String(sameTagSiblings.indexOf(current) + 1)})`;
      }
    }
    segments.unshift(segment);
    const selector = segments.join(" > ");
    if (selectorIsUnique(selector)) return selector;
    current = parent;
  }

  return truncate(`html > ${segments.join(" > ")}`, 2_048);
}

function inferredRole(element: Element): string | null {
  const explicit = element.getAttribute("role");
  if (explicit) return truncate(explicit, 256);
  const tagName = element.tagName.toLowerCase();
  if (tagName === "button") return "button";
  if (tagName === "a" && element.hasAttribute("href")) return "link";
  if (tagName === "input") return "textbox";
  if (tagName === "textarea") return "textbox";
  if (tagName === "select") return "combobox";
  if (/^h[1-6]$/.test(tagName)) return "heading";
  if (tagName === "img") return "img";
  if (tagName === "nav") return "navigation";
  if (tagName === "main") return "main";
  return null;
}

function textForElement(element: Element): string {
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    return normalizeText(
      element.getAttribute("aria-label") ??
        element.getAttribute("placeholder") ??
        "",
    );
  }
  const visibleText =
    element instanceof HTMLElement && typeof element.innerText === "string"
      ? element.innerText
      : (element.textContent ?? "");
  return normalizeText(visibleText);
}

function accessibleNameForElement(
  element: Element,
  text: string,
): string | null {
  const value =
    element.getAttribute("aria-label") ??
    element.getAttribute("alt") ??
    element.getAttribute("title") ??
    element.getAttribute("placeholder") ??
    text;
  const normalized = normalizeText(value);
  return normalized.length > 0 ? truncate(normalized, 256) : null;
}

function capturedAttributes(element: Element): ElementSnapshot["attributes"] {
  const exactNames = new Set([
    "id",
    "name",
    "type",
    "role",
    "placeholder",
    "title",
    "alt",
    "data-testid",
    "data-test",
    "data-cy",
  ]);
  return Array.from(element.attributes)
    .filter(
      (attribute) =>
        exactNames.has(attribute.name) || attribute.name.startsWith("aria-"),
    )
    .slice(0, 24)
    .map((attribute) => ({
      name: truncate(attribute.name, 128),
      value: truncate(attribute.value, 512),
    }));
}

function finite(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

export function snapshotElement(element: Element): ElementSnapshot {
  const text = textForElement(element);
  const rect = element.getBoundingClientRect();
  const styles = window.getComputedStyle(element);
  return {
    tagName: element.tagName.toLowerCase(),
    selector: selectorForElement(element),
    text,
    role: inferredRole(element),
    accessibleName: accessibleNameForElement(element, text),
    classes: Array.from(element.classList)
      .slice(0, 40)
      .map((className) => truncate(className, 128)),
    attributes: capturedAttributes(element),
    rect: {
      x: finite(rect.x),
      y: finite(rect.y),
      width: Math.max(0, finite(rect.width)),
      height: Math.max(0, finite(rect.height)),
    },
    styles: {
      display: truncate(styles.display, 256),
      position: truncate(styles.position, 256),
      color: truncate(styles.color, 256),
      backgroundColor: truncate(styles.backgroundColor, 256),
      fontFamily: truncate(styles.fontFamily, 512),
      fontSize: truncate(styles.fontSize, 256),
      fontWeight: truncate(styles.fontWeight, 256),
      lineHeight: truncate(styles.lineHeight, 256),
      margin: truncate(styles.margin, 512),
      padding: truncate(styles.padding, 512),
      border: truncate(styles.border, 512),
      borderRadius: truncate(styles.borderRadius, 256),
      overflow: truncate(styles.overflow, 256),
      zIndex: truncate(styles.zIndex, 256),
    },
  };
}

function ownerForElement(
  element: Element,
  route: string,
): { pluginId: string | null; surface: string | null } {
  const owner = element.closest<HTMLElement>("[data-bb-plugin]");
  const pluginId = owner?.getAttribute("data-bb-plugin") ?? null;
  if (pluginId === null) return { pluginId: null, surface: null };
  if (element.closest("[data-bb-portaled-overlay]")) {
    return { pluginId, surface: "overlay" };
  }
  if (route.startsWith(`/plugins/${pluginId}/`)) {
    return { pluginId, surface: "navPanel" };
  }
  return { pluginId, surface: "inline" };
}

function safePageUrl(): string {
  try {
    const url = new URL(window.location.href);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return truncate(url.toString(), 4_096);
  } catch {
    return truncate(window.location.href, 4_096);
  }
}

function captureInput(
  request: PickRequest,
  element: Element,
): CaptureTargetInput {
  const route = window.location.pathname || "/";
  const owner = ownerForElement(element, route);
  return {
    threadId: request.threadId,
    route: truncate(route, 2_048),
    pageUrl: safePageUrl(),
    pageTitle: truncate(document.title, 512),
    pluginId: owner.pluginId,
    surface: owner.surface,
    note: request.note,
    snapshot: snapshotElement(element),
  };
}

function rpcEnvelope(value: unknown): RpcEnvelope | null {
  if (!isRecord(value) || typeof value.ok !== "boolean") return null;
  const error = value.error;
  if (error !== undefined && !isRecord(error)) return null;
  return {
    ok: value.ok,
    ...(isRecord(error)
      ? {
          error: {
            ...(typeof error.code === "string" ? { code: error.code } : {}),
            ...(typeof error.message === "string"
              ? { message: error.message }
              : {}),
          },
        }
      : {}),
  };
}

async function persistCapturedTarget(
  context: PluginContentScriptContext,
  input: CaptureTargetInput,
): Promise<void> {
  const response = await fetch(
    `/api/v1/plugins/${encodeURIComponent(context.pluginId)}/rpc/captureTarget`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal: context.signal,
    },
  );
  const value: unknown = await response.json().catch(() => null);
  const envelope = rpcEnvelope(value);
  if (!response.ok || envelope?.ok !== true) {
    throw new Error(
      envelope?.error?.message ??
        `Could not save the UI target (${String(response.status)}).`,
    );
  }
}

function eventElement(event: Event): Element | null {
  for (const item of event.composedPath()) {
    if (item instanceof Element) return item;
  }
  return event.target instanceof Element ? event.target : null;
}

function isPickerChrome(element: Element): boolean {
  return Boolean(
    element.closest("[data-bb-browser-inspector], [data-bb-browser-panel]"),
  );
}

export function mountBrowserPicker(
  context: PluginContentScriptContext,
): PluginContentScriptDisposer {
  const highlight = document.createElement("div");
  highlight.className = "browser-picker-highlight";
  highlight.setAttribute("data-bb-browser-inspector", "");
  highlight.hidden = true;

  const label = document.createElement("div");
  label.className = "browser-picker-highlight__label";
  label.setAttribute("data-bb-browser-inspector", "");
  highlight.appendChild(label);

  const notice = document.createElement("div");
  notice.className = "browser-picker-notice";
  notice.setAttribute("data-bb-browser-inspector", "");
  notice.hidden = true;

  document.body.append(highlight, notice);

  let request: PickRequest | null = null;
  let hovered: Element | null = null;
  let noticeTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  function clearNoticeTimer(): void {
    if (noticeTimer !== null) clearTimeout(noticeTimer);
    noticeTimer = null;
  }

  function showNotice(
    message: string,
    tone: "active" | "success" | "error",
    hideAfterMs: number | null,
  ): void {
    clearNoticeTimer();
    notice.textContent = message;
    notice.dataset.tone = tone;
    notice.hidden = false;
    if (hideAfterMs !== null) {
      noticeTimer = setTimeout(() => {
        notice.hidden = true;
        noticeTimer = null;
      }, hideAfterMs);
    }
  }

  function hideHighlight(): void {
    highlight.hidden = true;
    hovered = null;
  }

  function stopPicking(hideNotice = true): void {
    request = null;
    hideHighlight();
    document.documentElement.classList.remove("browser-picker-active");
    if (hideNotice) notice.hidden = true;
  }

  function drawHighlight(element: Element): void {
    const rect = element.getBoundingClientRect();
    highlight.style.left = `${String(finite(rect.left))}px`;
    highlight.style.top = `${String(finite(rect.top))}px`;
    highlight.style.width = `${String(Math.max(0, finite(rect.width)))}px`;
    highlight.style.height = `${String(Math.max(0, finite(rect.height)))}px`;
    label.textContent = `${element.tagName.toLowerCase()} · ${selectorForElement(element)}`;
    highlight.hidden = false;
  }

  function onPickRequest(event: Event): void {
    if (!(event instanceof CustomEvent)) return;
    const nextRequest = parsePickRequest(event.detail);
    if (nextRequest === null) return;
    request = nextRequest;
    hovered = null;
    highlight.hidden = true;
    document.documentElement.classList.add("browser-picker-active");
    showNotice("Select a UI element · Esc to cancel", "active", null);
  }

  function onPointerMove(event: Event): void {
    if (request === null) return;
    const element = eventElement(event);
    if (element === null || isPickerChrome(element)) {
      hideHighlight();
      return;
    }
    if (element === hovered) return;
    hovered = element;
    drawHighlight(element);
  }

  function onClick(event: MouseEvent): void {
    if (request === null) return;
    const element = hovered ?? eventElement(event);
    if (element === null || isPickerChrome(element)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const activeRequest = request;
    let input: CaptureTargetInput;
    try {
      input = captureInput(activeRequest, element);
    } catch (error) {
      stopPicking(false);
      showNotice(
        `Could not inspect target: ${errorText(error)}`,
        "error",
        4_000,
      );
      return;
    }

    stopPicking(false);
    showNotice("Saving UI target…", "active", null);
    void persistCapturedTarget(context, input)
      .then(() => {
        if (disposed) return;
        showNotice("UI target captured", "success", 2_000);
        window.dispatchEvent(
          new CustomEvent(BROWSER_TARGET_CAPTURED_EVENT, {
            detail: { threadId: activeRequest.threadId },
          }),
        );
      })
      .catch((error: unknown) => {
        if (disposed || context.signal.aborted) return;
        showNotice(
          `Could not save target: ${errorText(error)}`,
          "error",
          4_000,
        );
        console.warn("[browser] Could not save captured UI target", error);
      });
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (request === null || event.key !== "Escape") return;
    event.preventDefault();
    stopPicking();
  }

  function redraw(): void {
    if (request !== null && hovered !== null) drawHighlight(hovered);
  }

  window.addEventListener(BROWSER_PICK_REQUEST_EVENT, onPickRequest, {
    signal: context.signal,
  });
  document.addEventListener("pointermove", onPointerMove, {
    capture: true,
    signal: context.signal,
  });
  document.addEventListener("click", onClick, {
    capture: true,
    signal: context.signal,
  });
  document.addEventListener("keydown", onKeyDown, {
    capture: true,
    signal: context.signal,
  });
  window.addEventListener("scroll", redraw, {
    capture: true,
    signal: context.signal,
  });
  window.addEventListener("resize", redraw, { signal: context.signal });

  return () => {
    disposed = true;
    clearNoticeTimer();
    document.documentElement.classList.remove("browser-picker-active");
    highlight.remove();
    notice.remove();
  };
}

function capturedEventThreadId(event: Event): string | null {
  if (!(event instanceof CustomEvent) || !isRecord(event.detail)) return null;
  return typeof event.detail.threadId === "string"
    ? event.detail.threadId
    : null;
}

function targetTitle(target: BrowserTarget): string {
  return (
    target.snapshot.accessibleName ||
    target.snapshot.text ||
    target.snapshot.selector
  );
}

function BrowserPanel({ threadId }: { threadId: string | null }) {
  const rpc = useRpc<typeof browserRpcContract>();
  const composer = useComposer();
  const [targets, setTargets] = useState<BrowserTarget[]>([]);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState(
    threadId === null
      ? "Browser targets are thread-scoped. Open this from a thread's Actions list."
      : "Select a rendered BB element and send its context to the agent.",
  );
  const [loading, setLoading] = useState(threadId !== null);
  const [busy, setBusy] = useState<string | null>(null);
  const refreshSequence = useRef(0);

  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    if (threadId === null) {
      setTargets([]);
      setLoading(false);
      return;
    }
    try {
      const result = await rpc.call("listTargets", { threadId });
      if (sequence !== refreshSequence.current) return;
      setTargets(result.targets);
    } catch (error) {
      if (sequence !== refreshSequence.current) return;
      setStatus(errorText(error));
    } finally {
      if (sequence === refreshSequence.current) setLoading(false);
    }
  }, [rpc, threadId]);

  useEffect(() => {
    setLoading(threadId !== null);
    void refresh();
    return () => {
      refreshSequence.current += 1;
    };
  }, [refresh, threadId]);

  useRealtime(
    browserTargetsChannel(threadId ?? "none"),
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    const onCaptured = (event: Event) => {
      if (capturedEventThreadId(event) !== threadId) return;
      setNote("");
      setStatus("UI target captured.");
      void refresh();
    };
    window.addEventListener(BROWSER_TARGET_CAPTURED_EVENT, onCaptured);
    return () =>
      window.removeEventListener(BROWSER_TARGET_CAPTURED_EVENT, onCaptured);
  }, [refresh, threadId]);

  const pickTarget = () => {
    if (threadId === null) return;
    window.dispatchEvent(
      new CustomEvent(BROWSER_PICK_REQUEST_EVENT, {
        detail: { threadId, note: note.trim() },
      }),
    );
    setStatus(
      "Picker active. Click an element in the BB interface; press Esc to cancel.",
    );
  };

  const addToPrompt = async () => {
    if (threadId === null || targets.length === 0) return;
    setBusy("prompt");
    try {
      const result = await rpc.call("renderTargets", {
        threadId,
        targetIds: null,
      });
      composer.updateText(
        (current) =>
          `${current}${current.trim().length > 0 ? "\n\n" : ""}${result.markdown}`,
      );
      composer.focus();
      setStatus(
        `Added ${String(result.targetCount)} UI target${result.targetCount === 1 ? "" : "s"} to the prompt.`,
      );
    } catch (error) {
      setStatus(errorText(error));
    } finally {
      setBusy(null);
    }
  };

  const sendToAgent = async () => {
    if (threadId === null || targets.length === 0) return;
    setBusy("send");
    try {
      const result = await rpc.call("sendTargets", {
        threadId,
        targetIds: null,
      });
      setStatus(
        `Sent ${String(result.sentCount)} UI target${result.sentCount === 1 ? "" : "s"} to the agent.`,
      );
    } catch (error) {
      setStatus(errorText(error));
    } finally {
      setBusy(null);
    }
  };

  const removeTarget = async (targetId: string) => {
    if (threadId === null) return;
    setBusy(targetId);
    try {
      await rpc.call("removeTargets", { threadId, targetIds: [targetId] });
      await refresh();
      setStatus("UI target removed.");
    } catch (error) {
      setStatus(errorText(error));
    } finally {
      setBusy(null);
    }
  };

  const clearTargets = async () => {
    if (threadId === null || targets.length === 0) return;
    setBusy("clear");
    try {
      const result = await rpc.call("clearTargets", { threadId });
      await refresh();
      setStatus(
        `Removed ${String(result.removedCount)} UI target${result.removedCount === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      setStatus(errorText(error));
    } finally {
      setBusy(null);
    }
  };

  const disabled = threadId === null || busy !== null;

  return (
    <div className="browser-panel" data-bb-browser-panel="">
      <div className="browser-panel__status" role="status">
        {status}
      </div>

      <section className="browser-panel__section">
        <label className="browser-panel__label" htmlFor="browser-target-note">
          What should the agent know?
        </label>
        <textarea
          id="browser-target-note"
          className="browser-panel__textarea"
          value={note}
          maxLength={MAX_NOTE_LENGTH}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Example: this button is clipped on mobile"
          rows={3}
        />
        <button
          className="browser-panel__button browser-panel__button--primary"
          disabled={disabled}
          onClick={pickTarget}
          type="button"
        >
          Pick UI target
        </button>
        <p className="browser-panel__hint">
          The picker reads rendered DOM metadata only. It never captures input
          values, cookies, storage, or browser credentials.
        </p>
      </section>

      <section className="browser-panel__section browser-panel__section--targets">
        <div className="browser-panel__output-header">
          <span className="browser-panel__label">
            Captured targets{" "}
            {targets.length > 0 ? `(${String(targets.length)})` : ""}
          </span>
          <button
            className="browser-panel__button browser-panel__button--quiet"
            disabled={disabled || targets.length === 0}
            onClick={() => void clearTargets()}
            type="button"
          >
            {busy === "clear" ? "Clearing…" : "Clear all"}
          </button>
        </div>

        {loading ? (
          <p className="browser-panel__empty">Loading captured targets…</p>
        ) : targets.length === 0 ? (
          <p className="browser-panel__empty">No UI targets captured yet.</p>
        ) : (
          <ul className="browser-target-list">
            {targets.map((target) => (
              <li className="browser-target" key={target.id}>
                <div className="browser-target__header">
                  <span className="browser-target__tag">
                    {target.snapshot.tagName}
                  </span>
                  <span
                    className="browser-target__title"
                    title={targetTitle(target)}
                  >
                    {targetTitle(target)}
                  </span>
                  <button
                    aria-label={`Remove ${target.snapshot.tagName} target`}
                    className="browser-target__remove"
                    disabled={busy !== null}
                    onClick={() => void removeTarget(target.id)}
                    type="button"
                  >
                    {busy === target.id ? "…" : "×"}
                  </button>
                </div>
                <code className="browser-target__selector">
                  {target.snapshot.selector}
                </code>
                <div className="browser-target__meta">
                  {target.pluginId
                    ? `plugin:${target.pluginId}`
                    : "BB app shell"}
                  {` · ${target.route}`}
                </div>
                {target.note ? (
                  <p className="browser-target__note">{target.note}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="browser-panel__actions">
        <button
          className="browser-panel__button"
          disabled={disabled || targets.length === 0}
          onClick={() => void addToPrompt()}
          type="button"
        >
          {busy === "prompt" ? "Adding…" : "Add to prompt"}
        </button>
        <button
          className="browser-panel__button browser-panel__button--primary"
          disabled={disabled || targets.length === 0}
          onClick={() => void sendToAgent()}
          type="button"
        >
          {busy === "send" ? "Sending…" : "Send to agent"}
        </button>
      </div>
    </div>
  );
}

function BrowserNavPanel(_props: PluginNavPanelProps) {
  return (
    <div className="browser-panel browser-panel--landing">
      <section className="browser-panel__section">
        <h2 className="browser-panel__heading">UI targets belong to threads</h2>
        <p className="browser-panel__copy">
          Open a thread, choose Browser from the right panel&apos;s Actions
          list, then pick any rendered BB element. Its DOM context can be added
          to the composer or sent directly to that thread&apos;s agent.
        </p>
      </section>
    </div>
  );
}

function BrowserThreadPanel({ threadId }: PluginThreadPanelProps) {
  return <BrowserPanel threadId={threadId} />;
}

export default definePluginApp((app) => {
  app.contentScripts.register({
    id: "ui-target-picker",
    mount: mountBrowserPicker,
  });
  app.slots.navPanel({
    id: "browser",
    title: "Browser",
    icon: "Globe",
    path: "browser",
    component: BrowserNavPanel,
  });
  app.slots.threadPanelAction({
    id: "browser",
    title: "Browser",
    icon: "Globe",
    component: BrowserThreadPanel,
    layout: "flush",
  });
});
