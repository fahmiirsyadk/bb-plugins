# Agent Orbs

Agent Orbs gives BB child threads a stable identity: a compact [Oreo avatar](https://github.com/BIAsia/oreo-design-avatar) and a friendly agent codename. It is a frontend-only BB plugin; it does not create, rename, or control threads.

## What it changes

Agent Orbs decorates the child-thread surfaces BB already renders while leaving BB's links, controls, titles, statuses, and accessibility labels in place.

| BB surface | Agent Orbs treatment |
| --- | --- |
| Active-child banner | Animated orb, codename, and an overlapping orb cluster when several children are active. |
| Child thread's parent-context badge | The same orb and codename as the child being viewed, so it matches the sidebar identity. |
| Expanded child list | The matching orb replaces the chevron; the task title stays unchanged and the codename is intentionally hidden to keep the list compact. |
| Indented sidebar child row | Static matching orb plus codename before the existing thread title. Top-level sidebar rows are not decorated. |
| Needs-input state | BB's native question icon remains visible; the plugin never disguises a waiting child as active work. |

When three or four children are active, their small avatars overlap slightly into one compact cluster. BB's child names and task titles remain the source of truth and are not rewritten.

## Install

From the repository root:

```sh
git clone https://github.com/fahmiirsyadk/bb-plugins.git
cd bb-plugins
npm install
bb plugin install ./plugins/agent-orbs
```

The path install registers the local plugin with BB. The package declares the Oreo avatar package as a runtime dependency, so the root `npm install` must complete before installing the plugin.

Confirm that BB loaded it:

```sh
bb plugin list --json
```

Look for `agent-orbs` with `enabled: true`, `status: "running"`, and a compatible app bundle. If the plugin was already installed and the source changed, rebuild and reload it:

```sh
cd plugins/agent-orbs
npm run build
bb plugin reload agent-orbs
```

Normal lifecycle commands are also available:

```sh
bb plugin enable agent-orbs
bb plugin disable agent-orbs
bb plugin remove agent-orbs
```

## Usage tutorial

### 1. Start a child thread

In BB, delegate a child thread from a parent thread. When the child appears in the active-child context card, the native person icon becomes the child's named Oreo orb.

The name is intentionally short—for example, `Lumen ·`—so the original child task title remains readable beside it.

### 2. Open the child

Open the child thread from the card or sidebar. The parent-context badge near the child thread's context/git information uses the current child's identity. Its shape, palette, and codename should match the selected child row in the sidebar.

### 3. Expand the child list

Expand the child-thread list when BB exposes the chevron rows. Each child chevron is replaced by that child’s matching orb. The codename is omitted on these rows by design; the existing task title remains unchanged and the list does not become wider.

### 4. Compare the sidebar

Indented child rows in the sidebar show the same profile and codename as the banner/list treatment. Sidebar avatars are deliberately static to keep the navigation surface calm and inexpensive to render. Top-level threads keep their native icons.

### 5. Try several children

Delegate three or four simple children. The active-child banner combines their avatars with a small overlap:

```text
orb orb orb orb
```

The cluster represents the active set, while BB's existing names and task titles continue to identify each child.

### 6. Trigger a waiting state

If a child needs user input, BB changes its native marker to a question icon. Agent Orbs removes its active orb for that surface and restores the question icon, including when BB reuses the same DOM node during the transition.

## Identity and visual behavior

- Codenames are assigned from a small friendly registry and are keyed by the stable BB thread id.
- Assignments persist in browser `localStorage`, so a reload does not normally rename an agent.
- If two persisted threads would receive the same codename, the later one receives a suffix such as `Vela 2`.
- The thread id deterministically selects the Oreo shape, palette, drift, and motion values. The same child therefore looks the same across the banner, parent-context badge, expanded list, and sidebar.
- Banner and context/list avatars animate with a subtle breathe motion. Sidebar avatars do not animate.
- `prefers-reduced-motion: reduce` disables the animation everywhere.

To intentionally reset locally stored names, run this in BB's browser developer console and reload the app:

```js
localStorage.removeItem("bb-agent-orbs:identities:v1");
```

This only resets the local codename mapping; it does not change any BB thread.

## Compatibility and safety

Agent Orbs uses BB's trusted frontend content-script API and targets stable native markers for the child banner, parent context, expanded child list, and sidebar thread rows. It does not call backend thread APIs, make network requests, write workspace files, or replace BB's sidebar implementation.

The script owns only namespaced `data-bb-agent-orb-*` nodes and CSS. It preserves native links and buttons, hides the native active glyph only while the matching orb is mounted, updates accessible labels with the codename, and restores native DOM markers on reload, disable, or removal.

BB owns the sidebar row wrapper and may recreate it during ordinary React renders. The plugin reattaches the existing avatar root instead of remounting the SVG, which avoids repeated avatar work and keeps rerenders smooth. If BB changes these DOM markers in a future release, the plugin may stop decorating that surface until its selectors are updated.

As with all BB plugins, this is trusted local code. Install it only from a source you trust.

## Development

From this directory:

```sh
cd plugins/agent-orbs
npm test
npm run typecheck
npm run build
npx react-doctor@latest --verbose --scope changed
```

The current test suite covers deterministic identity profiles, persistence and collision suffixes, active and pending states, multi-child clusters, matching banner/list/sidebar profiles, parent-context identity, sidebar rerenders, cleanup, and top-level-row exclusion.

For a live edit loop from the repository root:

```sh
bb plugin dev ./plugins/agent-orbs
```

`bb plugin dev` rebuilds the frontend and reloads the plugin as source files change. The generated `dist/` artifacts are build output and are ignored by Git.

## Source map

- `app.tsx` registers the content script and stylesheet.
- `agent-orbs.tsx` discovers BB surfaces, mounts shared Oreo elements, preserves native behavior, observes host rerenders, and performs cleanup.
- `agent-identity.ts` provides deterministic profiles, stable names, local persistence, and collision handling.
- `app.css` controls compact sizing, overlap, sidebar spacing, static sidebar motion, reduced motion, and native-marker hiding.
- `agent-orbs.test.tsx` and `agent-identity.test.ts` provide DOM and identity regression coverage.

## Release checklist

Before publishing a change:

```sh
npm test
npm run typecheck
npx react-doctor@latest --verbose --scope changed
npm run build
bb plugin reload agent-orbs
bb plugin list --json
```

The plugin is ready when the tests/typecheck/build pass, React Doctor reports no issues, and BB reports the plugin as enabled, compatible, and running without handler errors.

## License

MIT
