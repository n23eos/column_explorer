# Contributing

Bug reports, translation fixes and pull requests are all welcome. Issues live at
[github.com/n23eos/column_explorer/issues](https://github.com/n23eos/column_explorer/issues).

## Development

```bash
npm install
npm run dev     # watch mode
npm run build   # typecheck + production build
npm test        # unit tests (vitest)
npm run lint    # eslint
```

Feature work happens on `dev`; `main` only moves on a release.

## Module map

The code lives in `src/`:

| Module | Responsibility |
|--------|----------------|
| `main.ts` | plugin entry, commands, view registration |
| `view.ts` | columns view: state, rendering orchestration, keyboard |
| `column.ts` | single column rendering with delegated events |
| `mobile.ts` | mobile-only layer: toolbar, long-press selection, edge swipe, scale |
| `preview.ts` | file preview column |
| `dnd.ts` | drag & drop |
| `menus.ts` | context menus |
| `fileops.ts` | move/duplicate/trash operations |
| `modals.ts` | confirm, Quick Look, folder- and icon-picker modals |
| `settings.ts` | settings tab |
| `i18n.ts` | locale lookup; the strings live in `src/locales/` |
| `pure.ts` | pure helpers (unit-tested) |

## Tests

Tests cover all of `src` (locales aside — `tests/i18n.test.ts` checks their completeness
directly). `npm run test:coverage` enforces the thresholds set in `vitest.config.mts`, and CI
runs it on every pull request.

The npm `obsidian` package ships types only, so `tests/__mocks__/obsidian.ts` provides the
runtime classes, wired up through `resolve.alias` in `vitest.config.mts`. DOM-level tests need
two more pieces, both in `tests/setup/`:

- `obsidian-dom.ts` — Obsidian's helpers on `HTMLElement.prototype` (`createDiv`, `addClass`,
  `empty`, …), which happy-dom does not provide, plus an `IntersectionObserver` stub that keeps
  its callbacks so a test can bring a sentinel into view and assert the next chunk was rendered.
- `vault.ts`, `app.ts`, `view.ts` — a fake vault built from a list of paths, a fake app with
  event triggers and a call log, and a stand-in view for the render functions.

Import types from `obsidian`, not from the mock: the mock classes are not assignable to the real
types that `src` is written against, and `tsc --noEmit` will reject the test file. The alias
swaps in the mock at runtime. The exceptions are the mock's own test hooks (`createdSettings`,
`createdNotices`, the settings components with `.change()` / `.click()`), which come from
`tests/__mocks__/obsidian`.

## Translations

Each locale is one file in `src/locales/`, named with Obsidian's own language code. English is
the source of truth: the others are typed against it, so a missing key fails the build, and
`tests/i18n.test.ts` additionally checks for extra keys, empty strings and placeholders (`{n}`,
`{name}`) lost in translation — for every locale registered in `src/i18n.ts`, automatically.

**None of the translations except Russian were reviewed by a native speaker.** Corrections are
very welcome and are a one-file change: edit `src/locales/<code>.ts` and open a pull request.

To add a language, copy `src/locales/en.ts`, translate the values, and register it in
`src/i18n.ts` under its
[Obsidian language code](https://github.com/obsidianmd/obsidian-translations#existing-languages).

Right-to-left languages (Arabic, Hebrew, Persian) are not offered yet: the layout is
left-to-right throughout — columns grow rightwards, breadcrumbs are separated by `›`, and the
mobile edge swipe maps the left edge to "back". That needs CSS work, not just strings.

## Releasing

Tags carry no `v` prefix, so the version is set explicitly rather than through `npm version`:

```bash
npm pkg set version=X.Y.Z
npm_package_version=X.Y.Z node version-bump.mjs   # manifest.json + versions.json
npm run build
git commit -am "chore: bump version to X.Y.Z"
git push origin dev
git checkout main && git merge --no-ff dev -m "Release X.Y.Z"
git push origin main
```

Wait for CI on `main` to go green, then push the tag on its own:

```bash
git tag X.Y.Z && git push origin X.Y.Z
```

### Beta releases

A tag containing a hyphen (`1.13.0-beta.1`) is published as a GitHub pre-release: it never
becomes "Latest", and the release ships `manifest-beta.json` under the name `manifest.json`.
The root `manifest.json` stays on the last stable version, which is what keeps Obsidian's
updater from offering the beta to everyone — it reads the version from the default branch, not
from the release flag.

Testers install it with [BRAT](https://github.com/TfTHacker/obsidian42-brat): *Add beta plugin*
→ `n23eos/column_explorer` → enable *beta versions*. BRAT reads `manifest-beta.json` and
installs the matching pre-release.

```bash
# bump manifest-beta.json to X.Y.Z-beta.N by hand, leaving manifest.json alone
git commit -am "chore: beta X.Y.Z-beta.N"
git push origin dev
git tag X.Y.Z-beta.N && git push origin X.Y.Z-beta.N
```

The release workflow refuses to publish if the tag and the manifest version disagree.

Pushing the branch and the tag together (`git push origin main --tags`) leaves a window in which
the manifest already names a version whose release does not exist yet. Obsidian's plugin scanner
reads the repository on its own schedule, and a scan landing in that window records the version
as invalid.

The GitHub Action lints, tests, builds, and attaches `main.js`, `manifest.json`, `styles.css`
to the release with a build attestation. The release notes it generates are a commit list —
replace them with a summary of what changed:

```bash
gh release edit X.Y.Z --notes-file notes.md
```
