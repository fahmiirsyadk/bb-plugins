# BB Browser plugin

The Browser plugin lets a human point at rendered BB UI instead of describing
it from memory. It is a bundled BB frontend plugin—there is no global npm
package, browser daemon, MCP server, Cloudflare bypass, or localhost CORS setup.

From a thread, open **Actions → Browser**:

1. Optionally describe what the agent should notice.
2. Choose **Pick UI target** and click an element anywhere in BB, including UI
   rendered by another plugin.
3. Add the structured target context to the composer, or send it directly to
   the thread's agent.

Each target records the BB route, owning plugin when detectable, a CSS
selector, visible text, accessible name, safe attributes, geometry, and a
focused set of computed styles. The picker deliberately excludes form values,
cookies, browser storage, credentials, and arbitrary JavaScript execution.

## Install

From this checkout:

```sh
bb plugin install ./plugins/browser
```

No other installation is required.

## Agent and CLI surfaces

Agents receive two native tools:

- `browser_get_targets` reads the UI targets captured for the current thread.
- `browser_clear_targets` removes targets after they are no longer needed.

The equivalent shell workflow is:

```text
bb browser targets [--json]
bb browser show <targetId> [--json]
bb browser send [targetId...]
bb browser clear [targetId...]
```

## Scope

This version inspects the rendered **BB interface** in the browser tab where BB
is open. It does not automate arbitrary external websites or launch a separate
browser on an enrolled host. Supporting arbitrary tabs without a global CLI
would require a separately installed browser extension and an explicit trust
protocol; that is intentionally outside this first slice.

The interaction model is similar to Agentation's point-and-comment workflow,
but this plugin uses its own small DOM picker and does not bundle Agentation's
PolyForm Shield runtime.
