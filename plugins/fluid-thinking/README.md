# Fluid Thinking plugin

Fluid Thinking replaces only BB's visible `Thinking...` / `Working...`
indicator with the morphing
[ThinkingIndicator](https://www.fluidfunctionalism.com/docs/thinking-indicator).
`Thinking` becomes `Thinking harder` after 10 seconds; `Working` transitions
through `Moonwalking`, `Dreamwalking`, `Starwalking`, `Skywalking`,
`Cloudwalking`, `Nightwalking`, `Wandering`, `Roaming`, `Drifting`, `Gliding`,
`Cruising`, `Grooving`, `Orbiting`, `Waltzing`, and `Shuffling`. The morphing
glyph also appears beside BB's active aggregate/current activity row.

Compaction keeps BB's native clock/progress cue: the Fluid glyph is omitted
from both the compaction row and replacement indicator while `Compacting
context` is active.

BB continues to render every native timeline row, tool call, activity summary,
icon, and disclosure. The plugin does not provide a second activity list or
replace BB's aggregate labels.

The bridge:

- reads only the newest visible native row headers after the latest conversation;
- identifies an active aggregate such as `Exploring 3 files` (or the current
  leaf when no aggregate is active) and places the animated glyph beside that
  native header;
- uses BB's native `animate-shine` text treatment with a fixed longest-word
  measurement and separate enter/exit timings so status transitions do not
  clip at the end of their animation;
- ignores streamed subtrees inside known content rows before inspecting their
  descendants, and reconciles only the affected timeline at most once per
  animation frame;
- preserves its mounted roots while BB replaces its native indicator host; and
- restores the original indicator completely on reload, disable, or removal.

## Install

From the repository root:

```sh
npm install
bb plugin install ./plugins/fluid-thinking
```

Disable or remove it with the normal BB plugin controls:

```sh
bb plugin disable fluid-thinking
bb plugin remove fluid-thinking
```

## Safety and compatibility

BB 0.37 does not currently provide a supported plugin slot for replacing the
native timeline indicator. This plugin therefore uses BB's trusted frontend
content-script API, narrowed to the stable
`data-timeline-row-list="top-level"` marker and native animated indicator
shape. If that shape is absent, the plugin does nothing.

It makes no network requests, opens no files, calls no backend thread APIs,
and stores no data. As with every BB plugin, installation is full-trust code;
install only from a source you trust.

## Development

```sh
npm run typecheck
npm run build
bb plugin dev ./plugins/fluid-thinking
```
