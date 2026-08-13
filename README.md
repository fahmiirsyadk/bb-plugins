# bb-plugins

Personal plugins for [bb](https://github.com/get-bb/bb), kept in one repository.

## Plugins

| Plugin | Description |
| --- | --- |
| [Agent Orbs](plugins/agent-orbs/) | Give active child threads a unique Oreo avatar and agent codename. |
| [Composer Beam](plugins/composer-beam/) | Restore the animated beam around active BB composers. |
| [Fluid Thinking](plugins/fluid-thinking/) | Show static/cycling Fluid status text and animate the glyph beside BB's active activity grouping. |

## Install from source

```sh
git clone https://github.com/fahmiirsyadk/bb-plugins.git
cd bb-plugins
npm install
npm run build
# Optional composer visual:
bb plugin install ./plugins/composer-beam
# Optional timeline visual replacement:
bb plugin install ./plugins/fluid-thinking
# Optional child-thread identity visual:
bb plugin install ./plugins/agent-orbs
```

BB reads each nested plugin from its local directory, so clone the repository
before installing.

## Develop

```sh
npm run typecheck
bb plugin dev plugins/composer-beam
```

Inspired by the monorepo structure of
[smsunarto/bb-plugins](https://github.com/smsunarto/bb-plugins).

## License

MIT
