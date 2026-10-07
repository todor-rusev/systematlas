# SystemAtlas

Interactive Flow and Sequence diagrams authored by an AI agent over MCP.
Plain JSON documents connect the high-level process to the exact call trace.

[![Live demo](https://img.shields.io/badge/▶-Live%20demo-5e54a8)](https://todor-rusev.github.io/systematlas/)
[![npm](https://img.shields.io/npm/v/systematlas.svg)](https://www.npmjs.com/package/systematlas)
[![license](https://img.shields.io/npm/l/systematlas.svg)](./LICENSE)

### ▶ Try it live: **https://todor-rusev.github.io/systematlas/**

[![SystemAtlas — a Flow with a selected step](https://raw.githubusercontent.com/todor-rusev/systematlas/main/docs/img/screen_1.png)](https://todor-rusev.github.io/systematlas/)

*A **Flow** that reads on its own: each node shows as much text as its step needs, with `code`
where it helps. Select a step for its details — lists, links, code blocks; **Open** drills down
into a sub-flow or a Sequence.*

[![SystemAtlas — a Sequence of calls](https://raw.githubusercontent.com/todor-rusev/systematlas/main/docs/img/screen_2.png)](https://todor-rusev.github.io/systematlas/)

*A **Sequence**: the exact calls, returns and phases, reached from the Flow above.*

[![SystemAtlas — curved lines and a decision with details](https://raw.githubusercontent.com/todor-rusev/systematlas/main/docs/img/screen_3.png)](https://todor-rusev.github.io/systematlas/)

*Lines with rounded corners or smooth curves, top to bottom or left to right — switched from
the toolbar. Shapes, icons and four appearances: Classic, Soft cards, Whiteboard and Technical.*

## Quick start

Requires Node.js 22 or newer and a browser.

```sh
npm install -g systematlas
systematlas serve
```

Run in a folder containing `*.flow.json` or `*.sequence.json` documents.
`serve` opens the browser and reloads diagrams as files change.

```sh
systematlas build . --out site --minify
```

This produces one self-contained HTML file. It works offline and preserves
navigation between linked documents. You can also export from the sidebar.

## Authoring with an agent

Add the following MCP server to your client's configuration:

```json
{
  "mcpServers": {
    "systematlas": {
      "command": "npx",
      "args": ["-y", "-p", "systematlas", "systematlas-mcp"]
    }
  }
}
```

Ask your agent to explain a behavior in your codebase with a Flow, adding a
Sequence where individual calls matter. The server provides `get_docs`,
`list_flows`, `read_flow`, `write_flow`, `patch_flow`, `validate_flow`, and
`manage_flow`. Schemas, the authoring guide, and examples are also available
as MCP resources.

## Two levels of detail

- **Flow:** actors, steps, branches, returns, and links into subflows or Sequences.
- **Sequence:** nested calls, parameters, return values, asynchronous calls, and phases.

A node shows as much text as its step needs, so the diagram reads on its own;
optional details open in the side panel. Both take a little markdown: `code`,
**bold**, links, and in details also lists and code blocks.
A Flow lays out top to bottom or left to right: the document's `layout` sets the
default, and the toolbar switches it for viewing without changing the file.
Linked twins let you switch between both views of the same scenario.
Nested categories organize documents in the sidebar.

Flow offers Classic, Soft cards, Whiteboard, and Technical appearances, with
a shared shape and icon vocabulary. Nodes support built-in Lucide icons,
declarative SVG icons, emoji, and images. Documents can contain multilingual text.

## Updates

Installed npm copies check for a newer stable version when `serve` starts,
at most once every 24 hours. The dialog offers **Update**, **Skip this version**,
and **Close**. Update installs the offered release in the same npm location;
restart afterward. Skipping a version is remembered across projects.
Source checkouts and `npm link` copies keep their development workflow.
Exported HTML does not check for application updates.

## Commands

```text
systematlas serve [dir|file] [--port 4321] [--host 127.0.0.1] [--no-open] [--strict-port]
systematlas build [dir|file] [--out <dir>] [--minify] [--split]
systematlas init [dir] [--location <path>] [--format json|toml]
```

`sysatlas` is an alias for `systematlas`. Running without arguments in a
terminal opens an interactive menu. `init` configures an MCP client.

## Development

```sh
npm ci
npm test
npm run demo:check
npm run build
npm run demo:build
```

The demo includes complete linked processes, all 59 shapes, 50 built-in
icons, line and marker variants, SVG and emoji examples, and a Sequence.
Edit `scripts/generate-visual-demo.mjs` and run `npm run demo:generate` to
regenerate its JSON documents and the development catalogue.

To preview it, run `node dist/cli.js serve examples/visual-demo`.
For GitHub Pages, serve the prebuilt `docs/index.html` on the `main` branch.

## License

[MIT](./LICENSE). Bundled icons and fonts retain their licenses in
[THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).
