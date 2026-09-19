# Changelog

## Unreleased

### Changed
- Simplify the desktop toolbar to Create, Sort and More, and group link/path formats under Copy as.
- Rename the shared favorites/bookmarks entry to Quick access and separate Calendar and Disk usage under Tools.
- Replace conflicting panel-width controls with one automatic-sizing option, preserving the previous effective setting and saved column widths.
- Hide dependent settings while their feature is disabled, in both supported settings interfaces.

### Fixed
- Apply the name filter and keyboard navigation consistently to Recents, Quick access and calendar-day files.
- Make toolbar, breadcrumb, view-mode and calendar controls keyboard accessible; show a localized Disk usage breadcrumb.
- Exclude invalid and entirely redundant destinations from Move to folder.
- Refresh modification-time and size sorting when files change.

### Performance
- Keep folder columns alive when moving between files; render a bounded chunk around a far selected file instead of all preceding rows.
- Postpone hidden Disk usage refreshes until the chart is reopened and count words only when the Words metric is requested.

All notable changes to Column Explorer are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.14.0] — 2026-09-01

### Added
- **Disk usage** — a fourth virtual row in the first column, opening an interactive
  sunburst chart of the vault in the spirit of classic disk-usage analyzers. Three
  metrics in one chart (size on disk, word count, file count), animated zoom into
  folders with clickable breadcrumbs, `Esc` or the centre circle to zoom back out,
  hover highlighting of a folder with all its descendants, and a muted "small items"
  arc that absorbs sectors too thin to see. Right-clicking a sector offers zoom,
  open in a new tab, reveal in the columns and copy path. The chart rescans itself
  (debounced) when the vault changes, and word counts are cached by modification time,
  so repeat scans are cheap. Word counting is CJK-aware and runs in the background —
  sizes are on screen immediately. Three new settings in the *Special items* group:
  show the row, excluded folders, and how many rings the chart draws at once.
- **Unread markers** — a file the human has never opened gets a small "New" badge,
  and a file edited by someone else (an agent, a bot, sync, an external editor)
  since it was last opened gets a dot. Opening a file clears both. Only files are
  marked; the baseline is set on first run so an existing vault is not lit up
  wholesale, and the whole thing can be switched off in *Appearance*.

### Fixed
- Inline rename no longer wedges the keyboard: a re-render triggered while the
  rename field was open (vault event, sync, settings change) removed the input
  without a `blur`, leaving the view in renaming state and killing every
  keyboard shortcut until restart.
- "Duplicate N items" in the multi-selection context menu now duplicates folders
  as well as files — previously folders were silently skipped while the counter
  still included them.
- Filenames containing `$&`, `` $` `` or `$'` are printed correctly in notices;
  they used to be mangled by the message templating.
- Exclude patterns: `?` now means exactly one character instead of leaking into
  the regexp as a quantifier, and a pattern containing only `?` is treated as a
  glob rather than a literal substring.
- The disk-usage chart keeps rescanning after a failed scan. One failure used to
  poison the scan queue for the rest of the session and freeze the chart on
  stale data.
- A hand-edited or rolled-back `data.json` can no longer stop the plugin from
  loading: path records (folder colors, view modes, per-folder sort, folder
  icons, pins) and path lists (favorites, recents) are validated on load, and
  entries with unexpected values are dropped instead of throwing.
- Only `true` and a numeric order count as a pin, so a `false` left in
  `data.json` no longer turns an unpinned path into a pinned one.
- A selection restored from `workspace.json` drops entries that are not strings
  instead of throwing during render.

### Changed
- The word-count cache of the disk-usage chart forgets files the scan no longer
  sees, so it stays bounded by vault size instead of growing across rescans.
- Patched transitive dev dependencies flagged by `npm audit` (fast-uri, js-yaml,
  nanoid, postcss, brace-expansion). No runtime dependency changes.

## [1.13.0] — 2026-08-08

### Added
- Copy, cut and paste for files and folders: `Ctrl`/`Cmd`+`C`/`X`/`V` (layout-independent)
  and *Copy* / *Cut* / *Paste* in the context menus. Paste goes into the current folder —
  or the right-clicked one — with numeric suffixes on name clashes; folders are pasted
  with their whole subtree. Cut items are dimmed until pasted and are moved with the
  usual undo notice. The clipboard is internal to the plugin: Obsidian cannot place
  real files on the system clipboard portably.
- The view can open as a full-width tab in the main area — the most requested change.
  A new *Where to open* setting (Behavior group) switches the open command and the
  ribbon icon between the left sidebar (default) and a main-area tab. An already open
  view is never moved: drag its tab anywhere and the plugin respects that.
- Files and folders can now be dropped onto the breadcrumb bar — dropping onto a path
  segment moves them into that folder, the way Finder's path bar works.
- Folders can be duplicated: *Duplicate* in the folder context menu, or `Ctrl`/`Cmd`+`D`
  with a folder selected, copies the folder with its whole subtree as `Name copy`.
- Right-clicking the *Recents* row offers *Clear recent files* — previously the list
  could only be cleared from the settings tab.
- New command *Focus column explorer*: puts keyboard focus on the columns so arrow-key
  navigation works without reaching for the mouse. Bindable in **Settings → Hotkeys**.

### Fixed
- `Ctrl`/`Cmd`+`A` (select all) and `Ctrl`/`Cmd`+`D` (duplicate) did not work on
  non-Latin keyboard layouts — Cyrillic, Greek, Hebrew and others — because the check
  looked at the typed character instead of the physical key.
- A failed clipboard write (for example when the window loses focus mid-action) showed
  the usual "copied" flow with an empty clipboard. It now reports the failure.
- Type-ahead could not match names containing spaces: `Space` always opened Quick Look.
  While a prefix is being typed, `Space` now continues the prefix; Quick Look still
  opens on a plain `Space`.
- Migrating pins saved by v1.3.x could assign the same order to two pins when the
  saved data mixed old boolean and new numeric values (a version rollback and back).

### Changed
- Search in the toolbar is now fuzzy, matching the behaviour of Obsidian's Quick Switcher:
  typing `col ex` finds `Column Explorer`. Every matched fragment of the name is highlighted.
  The order of items in a column still follows the sort settings — matches are not re-ranked,
  so keyboard navigation stays predictable.

### Internal
- Test suite extended from pure-logic units to the DOM layer (happy-dom): rendering, keyboard
  navigation, drag & drop, menus, modals, settings and the mobile layer. Coverage is now measured
  across all of `src` — previously only two files were counted — and is enforced by thresholds in CI.
- CI runs a separate type-check step, the coverage thresholds and a bundle-size check, and the
  release workflow runs the same checks as pull requests.

## [1.12.1] — 2026-07-29

Re-release of 1.12.0 with no code changes. The 1.12.0 tag and its GitHub release were published
seconds apart, and the plugin scanner read the repository in between — it saw a manifest pointing
at a release that did not exist yet and recorded the version as invalid. This release republishes
the same build under a version the scanner can pick up cleanly.

## [1.12.0] — 2026-07-29

### Added
- The view now opens by itself once, right after the plugin is installed. Previously a fresh
  install was represented only by a ribbon icon that had to be found first.

### Fixed
- Inline rename could commit twice. Pressing `Enter` starts an asynchronous rename, and clicking
  away during it ran the same commit again — renaming an already-renamed file and reporting a
  rename failure that never happened.
- Dragging a file while something re-rendered the columns left the drag state stuck. The next
  time files were dropped in from Finder or Explorer, the plugin tried to move stale paths
  instead of importing them.
- Resizing a column no longer loses the new width when a vault event redraws the columns
  mid-drag.
- Deleting a folder left the paths of its contents in the multi-selection, so the selection
  count was wrong and later operations silently skipped those items.
- Closing the view left behind pending refreshes, the type-ahead and rename timers, the lazy-load
  observers and, after a column resize, listeners on the document. All are released now.

### Improved
- The calendar column no longer scans the whole vault twice on every render. Files are grouped by
  creation day once and the grouping is reused until the vault changes — a visible difference on
  large vaults, where every click used to pay for the scan.
- The *Excluded files* setting saved `data.json` and re-rendered every column on each keystroke.
  It now waits for a pause in typing, and flushes immediately when the settings tab is closed.

### Documentation
- The README leads with the problem the plugin solves rather than a feature list, and gains
  badges, a getting-started walkthrough and a FAQ. Build instructions, the module map, the
  translation workflow and the release process moved to a new `CONTRIBUTING.md`.

## [1.11.0] — 2026-07-27

### Added
- **Chinese (Simplified), German, Japanese, Korean and Brazilian Portuguese** translations,
  bringing the plugin to ten languages. As before, the UI follows Obsidian's own language setting.
- The locale test now derives its list from the locale registry, so a newly added language is
  checked for missing keys, empty strings and lost placeholders without touching the test.

### Notes
- Right-to-left languages are deliberately absent: the layout is left-to-right throughout, so
  they need CSS work rather than translations.

## [1.10.0] — 2026-07-27

### Added
- **Spanish, French and Italian** translations, picked up from Obsidian's own language setting.
  Locales now live one per file in `src/locales/`, typed against English so a missing key breaks
  the build. Corrections from native speakers are welcome.

### Fixed
- The commands *New note in current folder* and *New folder in current folder* were missing from
  the command palette until the Column Explorer tab had been clicked at least once. Views in
  unfocused sidebar tabs are deferred on startup, and the availability check required a fully
  loaded view.
- Failed file operations said nothing at all. Creating, moving, duplicating and deleting now
  report the reason, and one failed item no longer aborts the rest of a batch.
- Deleting or moving many files rewrote `data.json` once per file — twice, in fact, since two
  handlers saved independently. Those writes are now coalesced.
- Values loaded from `data.json` are validated: out-of-range column widths, unknown sort modes and
  non-numeric settings fall back to their defaults instead of reaching the UI.

## [1.9.0] — 2026-07-25

### Added
- **Mobile file manager.** Android and iOS get a layout of their own; desktop behaviour is unchanged.
  - One column at a time, with an *up* arrow in the column header
  - Compact toolbar: back, forward, search, create, and a *more* menu (reveal, collapse, sort)
  - Long-press to enter selection mode, with a bottom action bar (move, duplicate, delete, more, cancel)
  - Edge swipe from the left or right screen edge for back and forward
  - Quick Look as a bottom sheet, opened from a file's menu, in place of the preview column
  - HTML5 drag & drop disabled on touch screens — it conflicted with scrolling
- **Adjustable mobile scale** — *Settings → Mobile interface*: interface scale (90–150%) and icon
  size (22–36px), applied live through CSS variables. Touch targets never drop below 44px.

### Fixed
- Column `IntersectionObserver`s were not disconnected before the columns were removed from the
  DOM; an active observer keeps its detached target alive.
- Markdown previews added a child component to the view on every render and never released it,
  keeping every rendered embed alive until the view was closed.
- Quick Look on mobile showed no note content: the staleness guard compared the file against the
  current selection, but the mobile Quick Look is opened from the file menu, where it often is not.
- The debounced recent-files write is now flushed on unload, so files opened in the last two
  seconds still make the list.
- Grid tiles clipped file names on narrow screens.

## [1.8.0] — 2026-07-23

### Added
- Sort by created date and by size, both directions, in the sort menu and in settings
- *Copy wikilink* and *Copy full path* (absolute, shell-escaped; desktop only)
- `Ctrl`/`Cmd`+`A` selects every item in the active column, `Ctrl`/`Cmd`+`D` duplicates
- Commands *New note in current folder* and *New folder in current folder*
- **Favorites** — star files and folders from the context menu or the breadcrumbs bar; they sit
  atop the Bookmarks column and have their own toggle in settings
- Back and forward navigation buttons in the breadcrumbs bar

## [1.7.0] — 2026-07-19

### Added
- Virtual rows in the first column: **Recents**, **Bookmarks** and **Calendar**, positioned at the
  top or the bottom by a setting
- Own recent-files tracker holding up to 50 entries (Obsidian's own stops at 25)
- Bookmarks read from the core Bookmarks plugin, refreshed live
- Calendar column: month grid with per-day created-note badges; click a day to list its notes
- Settings reorganised into groups, with declarative settings on Obsidian 1.13+

### Changed
- The column lock is now released only by its toolbar button, never by navigation

## [1.6.0] — 2026-07-19

### Added
- Import from the OS: drop files from Finder or Explorer into a column to copy them into the vault,
  with numeric suffixes on name clashes

### Changed
- The root column is 60px wider than the rest by default

### Fixed
- The view overflowed its panel by 24px — Obsidian's own `.view-content` padding rule outweighed
  the plugin's selector

## [1.5.0] — 2026-07-15

### Added
- Auto-resizing side panel that follows the total width of the open columns
- Per-column widths by dragging a column's right edge; double-click resets one
- Quick Look on `Space`, as in Finder
- Undo for moves, offered inline in the notice
- Incremental rendering for large folders

### Fixed
- Drag & drop between columns lost its payload when Obsidian's drag manager overwrote `text/plain`

## [1.4.0] — 2026-07-12

### Added
- Per-folder sort overrides
- Custom folder icons (any lucide icon)
- Image thumbnails in the icon grid
- Folder notes — optionally open the note named like its folder
- Media previews (image, audio, video, PDF) in the preview column
- Reorderable pins

## [1.3.3] — 2026-07-12

Accepted into the Obsidian community plugin directory.

[1.11.0]: https://github.com/n23eos/column_explorer/releases/tag/1.11.0
[1.10.0]: https://github.com/n23eos/column_explorer/releases/tag/1.10.0
[1.9.0]: https://github.com/n23eos/column_explorer/releases/tag/1.9.0
[1.8.0]: https://github.com/n23eos/column_explorer/releases/tag/1.8.0
[1.7.0]: https://github.com/n23eos/column_explorer/releases/tag/1.7.0
[1.6.0]: https://github.com/n23eos/column_explorer/releases/tag/1.6.0
[1.5.0]: https://github.com/n23eos/column_explorer/releases/tag/1.5.0
[1.4.0]: https://github.com/n23eos/column_explorer/releases/tag/1.4.0
[1.3.3]: https://github.com/n23eos/column_explorer/releases/tag/1.3.3
