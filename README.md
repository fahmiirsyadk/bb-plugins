# bb-plugins

Personal plugins for [bb](https://github.com/get-bb/bb), kept in one repository.

## Plugins

| Plugin | Description |
| --- | --- |
| [Browser](plugins/browser/) | Pick rendered BB UI elements and send structured DOM context to an agent. |

## Install from source

```sh
git clone https://github.com/fahmiirsyadk/bb-plugins.git
cd bb-plugins
npm install
npm run build
bb plugin install ./plugins/browser
```

BB reads each nested plugin from its local directory, so clone the repository
before installing. A repository-root Git install cannot select
`plugins/browser` directly.

## Develop

```sh
npm run typecheck
bb plugin dev plugins/browser
```

Inspired by the monorepo structure of
[smsunarto/bb-plugins](https://github.com/smsunarto/bb-plugins).

## License

MIT
