> **⭐ Found this useful? [Star the repo](https://github.com/n23eos/column_explorer)** — that's how other people find it.
> **🐦 I build in public on X — [@Raincoat_talk](https://x.com/Raincoat_talk)** for new plugins and updates.

# Column Explorer

[![Downloads](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json&query=%24%5B%22column-explorer%22%5D.downloads&label=downloads&color=7c3aed&style=flat-square&logo=obsidian)](https://obsidian.md/plugins?id=column-explorer)
[![Release](https://img.shields.io/github/v/release/n23eos/column_explorer?style=flat-square&color=7c3aed)](https://github.com/n23eos/column_explorer/releases/latest)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

**Column Explorer replaces Obsidian's file tree with Finder-style Miller columns.** Clicking a folder opens its contents in a new column to the right, so the path you came through stays on screen instead of scrolling away inside one narrow list. It works as a full file manager: create, rename, move, delete, drag and drop, multi-select, context menus, folder colors and icons, pinned and starred folders. The first column can also carry virtual rows for recent files, core-plugin bookmarks and a month calendar with per-day counts of notes created. A sunburst chart reports vault disk usage by size, word count or file count.

<div align="center">

[![Star on GitHub](https://img.shields.io/github/stars/n23eos/column_explorer?style=for-the-badge&logo=github&label=Star%20this%20repo&color=FFD700&labelColor=1a1a1a)](https://github.com/n23eos/column_explorer)

</div>

![Column Explorer — Miller columns with Recents and Calendar rows, folder colors and breadcrumbs](docs/screenshot-1.jpg)

## Why you might want this

Obsidian's built-in file explorer is a single vertical tree. That works for twenty notes. At two hundred folders it stops working: expanding one branch pushes everything else off-screen, collapsing it loses your place, and you scroll a column one item wide looking for a file you already know the name of.

Miller columns fix this by spending horizontal space instead of vertical. Each level of the hierarchy gets its own column, side by side — you see where you are, where you came from, and what's next, all at once. It's how Finder's column view and NeXTSTEP's file browser have worked for thirty years, because for deep trees it's simply easier to read.

On top of that, Column Explorer lets you **star the folders you actually live in**, so the paths you open twenty times a day are one click away instead of five.

If your vault is flat and small, the default explorer is fine. If you keep a deep folder structure and lose files in it, this is for you.

## Installation

### Community plugins (recommended)

**Settings → Community plugins → Browse**, search for *Column Explorer*, install and enable.

### Manual

1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/n23eos/column_explorer/releases/latest)
2. Copy them into `<vault>/.obsidian/plugins/column-explorer/`
3. Enable the plugin in **Settings → Community plugins**

## Getting started

1. **Open it** — click the columns icon in the left ribbon, or run the command *Open column explorer*. The view opens in the left sidebar.
2. **Click a folder** — its contents appear in a new column to the right. Keep clicking to drill down; the breadcrumb bar above shows the full path and jumps back to any level.
3. **Make it yours** - right-click a folder for colors, icons and *Pin in this folder*; click the star in the breadcrumb bar to add the current folder to Favorites; drag the right edge of a column to resize it.

Worth knowing early: `Space` previews the selected file, right-clicking empty space creates a note or folder there, and **Settings → Column Explorer** has a *Special items* section that turns on the Recents, Quick access, Calendar and Disk usage rows.

## Highlights

- **Miller columns** — Finder-style navigation, each folder opens a new column
- **Recents, Quick access & Calendar** - virtual rows in the first column: recently opened files (up to 50), your core-plugin bookmarks, and a month calendar with per-day created-note badges - click a day to list the notes created then
- **Disk usage** — a sunburst chart of the vault by size, word count or file count, with animated zoom into any folder
- **Import from the OS** — drop files from Finder/Explorer into any column to copy them into the vault
- **Folder colors, icons and pins** — eight theme-aware colors, any lucide icon, pin items to the top
- **List or icon grid per folder** — the grid shows real image thumbnails
- **Quick Look & preview column** — `Space` previews the selected file; optional details column with media previews
- **Resizable everything** — per-column widths, auto-resizing side panel, lockable column count
- **Full file manager** — multi-select, drag & drop with undo, context menus, per-folder sort, excluded files
- **Built for phones too** — one column at a time, a compact toolbar, long-press multi-select, edge-swipe navigation and an adjustable interface scale

## Features

### Navigation

- **Miller columns** — drill down through folders, each level in its own column
- **Sidebar or main area** — a setting opens the view as a full-width tab instead of the left sidebar
- **Breadcrumbs** — clickable path bar for quick jumps to any ancestor folder
- **Folder notes** — optionally open the note named like its folder when selecting the folder
- **Keyboard navigation** — `↑`/`↓` select, `→`/`←` drill in/out, `Home`/`End`/`PageUp`/`PageDown`, type-ahead (start typing to jump, like in Finder), `Enter` open, `Space` Quick Look, `F2` rename, `Delete` trash, `Ctrl`/`Cmd`+`A` select all in the column, `Ctrl`/`Cmd`+`D` duplicate, `Ctrl`/`Cmd`+`C`/`X`/`V` copy, cut and paste
- **Back & forward** — navigation history buttons in the breadcrumbs bar
- **Favorites** - star any file or folder (context menu, or the star button in the breadcrumbs bar); they sit atop the Quick access column
- **Filter** - filters names in open columns, including Recents, Quick access and calendar-day files. It is not a vault-wide search; clear it with the cross button or Escape.
- **Auto-reveal** — optionally follow the active editor tab
- **Persistent state** — selected path survives app restarts

### Special items

The first column can host four virtual rows, each toggleable and positionable in settings.

![Column Explorer — calendar column with per-day created-note counts](docs/screenshot-2.jpg)

- **Recents** — the last files you opened, up to 50
- **Quick access** - Favorites at the top and your core Bookmarks items below, with duplicates removed. It also works with the core Bookmarks plugin disabled.
- **Calendar** — a month grid with a badge per day showing how many notes were created then; click a day to list them
- **Disk usage** — an interactive sunburst chart of the whole vault, in the spirit of classic disk-usage analyzers. Switch between **size** (bytes on disk), **words** and **files**; click a folder to fly inside it, `Esc` or the centre circle to go back out, and click a file to open it. Sectors too thin to see merge into one muted "small items" arc, hovering highlights a folder with all of its descendants, and the chart rescans itself when the vault changes. Excluded folders and the number of visible rings are configurable.

### Appearance

![Column Explorer — icon grid view with special items](docs/screenshot-3.jpg)

- **List or icon view per column** — toggle in the column header, remembered per folder
- **Image thumbnails** — the icon view shows real thumbnails for image files
- **Folder colors & icons** — right-click a folder: eight theme-aware color presets and any lucide icon
- **Pinned items** - right-click → *Pin in this folder*; drag one pin onto another to reorder
- **File preview column** — image, audio, video and PDF previews, note content, size, dates
- **Unread markers** — a small *New* badge on files you have never opened, and a dot on files
  edited since you last opened them (by an agent, a bot, sync or an external editor). Opening a
  file clears both; the whole thing can be switched off in settings
- **Item counts** — each column header shows how many items it lists
- **Resizable columns** — drag the right edge of any column
- **Localized** — English, Chinese (Simplified), German, Japanese, Korean, Brazilian Portuguese, Spanish, French, Italian and Russian, following Obsidian's own language setting

### File management

- **All standard operations** — create notes, canvases and folders (with inline rename), rename, trash, duplicate, move to folder, copy path
- **Multi-select** — `Ctrl`/`Cmd`-click to toggle, `Shift`-click for range; move, duplicate, delete or drag many at once
- **Copy, cut & paste** — `Ctrl`/`Cmd`+`C`/`X`/`V` or the context menu; paste lands in the current folder (or the right-clicked one), name clashes get a numeric suffix, cut items are dimmed until pasted
- **Drag & drop** — move files/folders between columns, straight onto a folder row or onto a breadcrumb segment; drag a file into an editor to insert a link
- **Full Obsidian context menu** — core & community plugin items (bookmarks, "Reveal in Finder", copy link, …) are injected via the `file-menu` event
- **Copy links & paths** - vault path, absolute system path, wikilink, Markdown link or `obsidian://` URL, grouped under *Copy as* in the context menu.
- **Excluded files** — hide files and folders by comma-separated patterns. `*.tmp` matches by file name at any depth (`*` is any run of characters, `?` exactly one); `.trash` matches any path containing it; a trailing slash (`archive/`) is a path prefix **from the vault root**, so nested folders need their full path (`Notes/archive/`)
- **Sort options** - global default plus per-folder overrides (right-click a column header): name, modified, created or size, both directions. Sorting by modification time or size updates when a file changes.

![Column Explorer — special items settings](docs/screenshot-4.jpg)

### Mobile

The plugin works on Android and iOS, with a layout of its own — desktop behaviour is unchanged.

- **One column at a time** — the deepest folder fills the screen; an *up* arrow in the column header walks back out
- **Compact toolbar** — back, forward, search, create and a *more* menu (reveal, collapse, sort)
- **Long-press to select** — hold an item to enter selection mode, then tap to add more; a bottom bar moves, duplicates, deletes or opens the full menu
- **Edge swipe** — swipe in from the left or right edge to go back or forward
- **Quick Look instead of a preview column** — open *Preview* from a file's menu; it slides up as a sheet
- **Adjustable scale** — *Settings → Mobile interface*: interface scale (90–150%) and icon size (22–36px), applied live. Touch targets never drop below 44px
- **No drag & drop** — on touch screens it fights with scrolling; move files through selection mode instead

## Commands

All are bindable to hotkeys in **Settings → Hotkeys**.

| Command | What it does |
|---------|--------------|
| *Open column explorer* | opens (or reveals) the view |
| *Reveal active file in columns* | jumps to the note open in the editor |
| *Focus column explorer* | puts keyboard focus on the columns for arrow-key navigation |
| *New note in current folder* | creates a note in the deepest selected folder |
| *New folder in current folder* | same, for a folder |

## FAQ

**Does it replace the built-in file explorer?**
No — it's a separate view, and both can be open at once. Most people disable the core File Explorer afterwards, but that's your call.

**Can I open it as a full-width tab instead of in the sidebar?**
Yes — **Settings → Column Explorer → Where to open** switches the open command and the ribbon icon to a tab in the main area. An already open view is never moved, so you can also just drag its tab wherever you like.

**Why doesn't drag & drop work on my phone?**
Deliberately disabled: on touch screens a drag gesture competes with scrolling. Long-press an item to enter selection mode, then use the bottom bar to move files.

**How do the exclude patterns work?**
Comma-separated. `*.tmp` matches by file name at any depth — `*` stands for any run of characters and `?` for exactly one, so `draft-?.md` hides `draft-1.md` but not `draft-12.md`. `.trash` matches any path containing that string, and a trailing slash (`archive/`) is a path prefix **from the vault root** — so a nested folder needs its full path, e.g. `Notes/archive/`.

**Does it work with Folder Notes / Iconize / other explorer plugins?**
Column Explorer has its own folder-note and folder-icon support built in, so you don't need those for this view. Plugins that decorate the *core* file explorer won't affect this one — but any plugin that adds items to Obsidian's file context menu shows up here too, because the menu is built from the same `file-menu` event.

**Will renaming or moving files here break my links?**
No. All operations go through Obsidian's own `fileManager`, the same API the core explorer uses, so links and backlinks are updated for you.

**Is my vault too big for it?**
Large folders render in chunks as you scroll, so tens of thousands of files are fine. If a specific vault feels slow, please open an issue with the size and shape of it.

## Feedback

- **Found a bug or have an idea?** [Open an issue](https://github.com/n23eos/column_explorer/issues) — bug reports with a screenshot and your Obsidian version are the most useful thing you can send.
- **Translation correction?** One file, one pull request — see [CONTRIBUTING.md](CONTRIBUTING.md#translations).

## Contributing

Build instructions, the module map, the translation workflow and the release process live in [CONTRIBUTING.md](CONTRIBUTING.md).

See the [changelog](CHANGELOG.md) for what changed in each release.

## License

[MIT](LICENSE)

### Preserve manual widths

The sidebar keeps its manual width by default. Enable **Automatically fit panel width** in settings or the desktop **More** menu to fit the open columns. Existing installations keep the effective behavior of their previous width settings. Individual column widths remain draggable and saved. **More** also lets you limit the number of visible columns independently.

### Compact desktop controls

The desktop toolbar contains **Create**, **Sort** and **More**, followed by the filter. Create offers a note, folder or canvas. More contains reveal-active-file, collapse-to-root, the column-count limit and automatic panel sizing. Navigation and Favorites remain next to the path.

Calendar and Disk usage appear under **Tools** in the root column. Their existing visibility settings are preserved. Dependent options in settings appear only when the corresponding feature is enabled.

Large folders load chunks around the selected file, including after Home or End. Moving between files keeps the existing folder columns alive. A hidden Disk usage chart postpones refreshes until it is reopened; word counting starts only when you choose **Words**.

## More projects

### Obsidian plugins

| Plugin | What it does |
| --- | --- |
| [Graph Insight](https://community.obsidian.md/plugins/graph-insight) | Explore large vaults as an interactive graph. |
| [Always-on-Top Tasks](https://community.obsidian.md/plugins/tasks-for-focus-adhd) | Keep a note and its tasks in a focused floating overlay. |
| [Column Explorer](https://community.obsidian.md/plugins/column-explorer) | Browse a vault with Finder-style Miller columns. |
| [Vault Sunburst](https://community.obsidian.md/plugins/vault-sunburst) | Visualize folder sizes, word counts and file counts. |
| [Vault Telegram Bridge](https://community.obsidian.md/plugins/vault-telegram-bridge) | Capture Telegram messages and media in an Obsidian vault. |

### Browser extensions

| Extension | What it does |
| --- | --- |
| [FloatPlayer - Picture in Picture](https://chromewebstore.google.com/detail/floatplayer-%E2%80%94-picture-in/colaiiadempclbkepfnojfggmpcadadg?authuser=0&hl=ru) | Keep YouTube video in a floating picture-in-picture player. |
| [Eye Rest 20-20-20](https://chromewebstore.google.com/detail/eye-rest-20-20-20/gfffpnlfldimcjnkgleknfheojoncama?authuser=0&hl=ru) | Gentle 20-20-20 reminders for your eyes. |

## Support

If this project was useful to you, feel free to support further development:

[![ETH](https://img.shields.io/badge/ETH-0x7777...88C4-blue?logo=ethereum&style=flat-square)](https://etherscan.io/address/0x77777da54702AC8789D53fc7cC6201C29a1A88C4)[![Donate](https://img.shields.io/badge/donate-crypto-orange?style=flat-square)](https://etherscan.io/address/0x77777da54702AC8789D53fc7cC6201C29a1A88C4)[![Buy me a coffee](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/n23eos)
