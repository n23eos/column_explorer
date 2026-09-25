import { afterEach, expect, test, vi } from "vitest";
import { TFile } from "obsidian";
import type ColumnExplorerPlugin from "../src/main";
import { ColumnExplorerView } from "../src/view";
import type { ColumnExplorerSettings } from "../src/settings";
import { BOOKMARKS_PATH, RECENTS_PATH, STORAGE_PATH, dayKey } from "../src/pure";
import { makeVault } from "./setup/vault";
import { makeApp, makePlugin } from "./setup/app";

const views: ColumnExplorerView[] = [];
async function mount(paths = ["alpha.md", "beta.md"], settings: Partial<ColumnExplorerSettings> = {}) {
	const vault = makeVault(paths);
	const app = makeApp(vault);
	const plugin = makePlugin(app, { showCalendar: false, showStorage: false, showBookmarks: false, ...settings });
	const view = new ColumnExplorerView({ getRoot: () => ({}) } as never, plugin as unknown as ColumnExplorerPlugin);
	(view as unknown as { app: unknown }).app = app;
	document.body.append(view.contentEl);
	views.push(view);
	await view.onOpen();
	return { view, app, vault, plugin };
}
afterEach(async () => {
	for (const view of views.splice(0)) await view.onClose();
	document.body.innerHTML = "";
	vi.restoreAllMocks();
});
function press(view: ColumnExplorerView, key: string) {
	view.columnsEl.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}
function filter(view: ColumnExplorerView, value: string) {
	const input = view.contentEl.querySelector<HTMLInputElement>("input[type=search]")!;
	input.value = value;
	input.dispatchEvent(new Event("input", { bubbles: true }));
}
function pathsAt(view: ColumnExplorerView, path: string) {
	return Array.from(view.columnsEl.querySelectorAll<HTMLElement>(`[data-folder-path="${path}"] .column-explorer-item`)).map(el => el.dataset.path);
}

test("recents filter and keyboard use the same visible rows", async () => {
	const { view } = await mount(undefined, { recentFiles: ["alpha.md", "beta.md"] });
	view.selectSpecial(RECENTS_PATH);
	filter(view, "beta");
	expect(pathsAt(view, RECENTS_PATH)).toEqual(["beta.md"]);
	press(view, "ArrowRight");
	expect(view.selection).toEqual([RECENTS_PATH, "beta.md"]);
});
test("favorites remain reachable without the core bookmarks plugin", async () => {
	const { view } = await mount(undefined, { favorites: ["beta.md"] });
	view.selectSpecial(BOOKMARKS_PATH);
	press(view, "ArrowRight");
	expect(view.selection).toEqual([BOOKMARKS_PATH, "beta.md"]);
});
test("a favorite folder opens through Enter just as through a click", async () => {
	const { view } = await mount(["notes/alpha.md"], { favorites: ["notes"] });
	view.selectSpecial(BOOKMARKS_PATH);
	press(view, "ArrowRight");
	expect(view.selection).toEqual([BOOKMARKS_PATH, "notes"]);
	press(view, "Enter");
	expect(view.selection).toEqual(["notes"]);
	expect(pathsAt(view, "notes")).toEqual(["notes/alpha.md"]);
});
test("favorite filtering includes folders and empty results can be cleared", async () => {
	const { view } = await mount(["notes/alpha.md", "beta.md"], { favorites: ["notes", "beta.md"] });
	view.selectSpecial(BOOKMARKS_PATH);
	filter(view, "zzzz");
	expect(pathsAt(view, BOOKMARKS_PATH)).toEqual([]);
	const clear = view.contentEl.querySelector<HTMLButtonElement>(".column-explorer-clear-filter")!;
	expect(clear.hidden).toBe(false);
	clear.click();
	expect(pathsAt(view, BOOKMARKS_PATH)).toEqual(["notes", "beta.md"]);
});
test("calendar day files obey the same filter", async () => {
	const { view, vault } = await mount(undefined, { showCalendar: true });
	const file = vault.getAbstractFileByPath("alpha.md") as TFile;
	view.selectDay(dayKey(file.stat.ctime));
	filter(view, "beta");
	expect(pathsAt(view, view.selection[1])).toEqual(["beta.md"]);
});
test("desktop toolbar is compact and every action is a native button", async () => {
	const { view } = await mount();
	const buttons = Array.from(view.contentEl.querySelectorAll<HTMLElement>(".column-explorer-toolbar > .column-explorer-toolbar-btn"));
	expect(buttons).toHaveLength(4);
	expect(buttons.every(el => el.tagName === "BUTTON" && el.tabIndex === 0)).toBe(true);
	expect(view.contentEl.querySelector(".column-explorer-fav-btn")?.tagName).toBe("BUTTON");
	expect(view.contentEl.querySelector(".column-explorer-view-toggle")?.tagName).toBe("BUTTON");
});
test("button Space does not also trigger file Quick Look", async () => {
	const { view } = await mount();
	view.selection = ["alpha.md"];
	view.render();
	const event = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
	view.columnsEl.querySelector(".column-explorer-view-toggle")!.dispatchEvent(event);
	expect(event.defaultPrevented).toBe(false);
});
test("storage has a translated breadcrumb", async () => {
	const { view } = await mount(undefined, { showStorage: true });
	vi.spyOn(view, "sunburstController").mockReturnValue({ mount: () => {} } as never);
	view.selectSpecial(STORAGE_PATH);
	expect(view.contentEl.querySelector(".column-explorer-crumb.is-current")?.textContent).not.toContain("::");
});
test("moving between files preserves the folder DOM even with preview enabled", async () => {
	const { view } = await mount(undefined, { showPreview: true, showRecents: false });
	view.selection = ["alpha.md"];
	view.render();
	const column = view.columnsEl.querySelector('[data-folder-path="/"]');
	press(view, "ArrowDown");
	expect(view.selection).toEqual(["beta.md"]);
	expect(view.columnsEl.querySelector('[data-folder-path="/"]')).toBe(column);
	expect(view.columnsEl.querySelector(".column-explorer-preview-name")?.textContent).toBe("beta");
	expect(column?.querySelector('[data-path="beta.md"]')?.getAttribute("aria-selected")).toBe("true");
});
test("modify refreshes a size-sorted folder without replacing other columns", async () => {
	const { view, app, vault } = await mount(["notes/alpha.md", "notes/beta.md"], { sortMode: "size-desc" });
	view.selection = ["notes", "notes/beta.md"];
	view.render();
	const root = view.columnsEl.querySelector('[data-folder-path="/"]');
	const file = vault.getAbstractFileByPath("notes/beta.md") as TFile;
	file.stat.size = 42;
	app.vault.trigger("modify", file);
	expect(pathsAt(view, "notes")).toEqual(["notes/beta.md", "notes/alpha.md"]);
	expect(view.selection).toEqual(["notes", "notes/beta.md"]);
	expect(view.columnsEl.querySelector('[data-folder-path="/"]')).toBe(root);
});
test("modify does not rebuild a name-sorted list", async () => {
	const { view, app, vault } = await mount();
	const row = view.columnsEl.querySelector('[data-path="alpha.md"]');
	app.vault.trigger("modify", vault.getAbstractFileByPath("alpha.md"));
	expect(view.columnsEl.querySelector('[data-path="alpha.md"]')).toBe(row);
});

test("End and Home keep columns alive and render bounded chunks in a large folder", async () => {
	const names = Array.from({ length: 1000 }, (_, i) => `big/f${String(i).padStart(4, "0")}.md`);
	const { view } = await mount(names);
	view.selection = ["big", names[0]];
	view.render();
	const root = view.columnsEl.querySelector('[data-folder-path="/"]');
	const big = view.columnsEl.querySelector('[data-folder-path="big"]');
	const scroll = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
	press(view, "End");
	expect(view.selection).toEqual(["big", names[999]]);
	expect(view.columnsEl.querySelector('[data-folder-path="/"]')).toBe(root);
	expect(view.columnsEl.querySelector('[data-folder-path="big"]')).toBe(big);
	expect(pathsAt(view, "big").length).toBeLessThanOrEqual(300);
	expect(pathsAt(view, "big")).toContain(names[999]);
	expect(scroll).toHaveBeenCalledWith({ block: "nearest", inline: "nearest" });
	press(view, "Home");
	expect(view.selection).toEqual(["big", names[0]]);
	expect(view.columnsEl.querySelector('[data-folder-path="big"]')).toBe(big);
	expect(pathsAt(view, "big")).toHaveLength(300);
});
test("quick access keyboard follows favorites then deduplicated bookmarks", async () => {
	const { view, app } = await mount(["alpha.md", "beta.md", "gamma.md"], { favorites: ["beta.md"], showBookmarks: true });
	Object.assign(app, { internalPlugins: { getEnabledPluginById: () => ({ items: [
		{ type: "file", path: "alpha.md" }, { type: "file", path: "beta.md" }, { type: "file", path: "gamma.md" },
	] }) } });
	view.selectSpecial(BOOKMARKS_PATH);
	expect(pathsAt(view, BOOKMARKS_PATH)).toEqual(["beta.md", "alpha.md", "gamma.md"]);
	press(view, "ArrowRight");
	expect(view.selection[1]).toBe("beta.md");
	press(view, "ArrowDown");
	expect(view.selection[1]).toBe("alpha.md");
	press(view, "ArrowDown");
	expect(view.selection[1]).toBe("gamma.md");
});
test("special root navigation rebuilds the target list instead of keeping the previous list", async () => {
	const { view } = await mount(undefined, { recentFiles: ["alpha.md"], favorites: ["beta.md"] });
	view.selectSpecial(RECENTS_PATH);
	press(view, "ArrowDown");
	expect(view.selection).toEqual([BOOKMARKS_PATH]);
	expect(pathsAt(view, BOOKMARKS_PATH)).toEqual(["beta.md"]);
	expect(view.columnsEl.querySelector(`[data-folder-path="${RECENTS_PATH}"]`)).toBeNull();
});
test("leaving the storage column suspends its controller", async () => {
	const { view } = await mount(undefined, { showStorage: true });
	view.selectSpecial(STORAGE_PATH);
	const controller = view.sunburstController();
	const suspend = vi.spyOn(controller, "suspend");
	view.collapseToRoot();
	expect(suspend).toHaveBeenCalledOnce();
	expect(view.columnsEl.querySelector(".column-explorer-storage")).toBeNull();
});
test("per-folder sort overrides control modify refreshes", async () => {
	const { view, app, vault } = await mount(["notes/alpha.md", "notes/beta.md"], {
		sortMode: "name-asc", columnSortModes: { notes: "mtime-desc" },
	});
	view.selection = ["notes"];
	view.render();
	const file = vault.getAbstractFileByPath("notes/alpha.md") as TFile;
	file.stat.mtime = 100;
	app.vault.trigger("modify", file);
	expect(pathsAt(view, "notes")).toEqual(["notes/alpha.md", "notes/beta.md"]);
});

test("dynamic sorting keeps the selected file visible after it moves", async () => {
	const { view, app, vault } = await mount(["notes/alpha.md", "notes/beta.md"], { sortMode: "mtime-desc" });
	view.selection = ["notes", "notes/alpha.md"];
	view.render();
	const list = view.columnsEl.querySelector<HTMLElement>('[data-folder-path="notes"] .column-explorer-list')!;
	list.scrollTop = 500;
	const scroll = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
	const file = vault.getAbstractFileByPath("notes/alpha.md") as TFile;
	file.stat.mtime = 100;
	app.vault.trigger("modify", file);
	expect(scroll.mock.instances).toContain(list.querySelector('[aria-selected="true"]'));
});

test("keyboard focus survives switching list/grid and toggling favorites", async () => {
	const { view } = await mount();
	const toggle = view.columnsEl.querySelector<HTMLButtonElement>(".column-explorer-view-toggle")!;
	toggle.focus();
	toggle.click();
	expect(view.columnsEl.querySelector(".column-explorer-list")?.classList.contains("is-grid")).toBe(true);
	expect(document.activeElement).toBe(view.columnsEl.querySelector(".column-explorer-view-toggle"));
	const star = view.contentEl.querySelector<HTMLButtonElement>(".column-explorer-fav-btn")!;
	star.focus();
	star.click();
	expect(document.activeElement).toBe(view.contentEl.querySelector(".column-explorer-fav-btn"));
	expect(document.activeElement?.getAttribute("aria-pressed")).toBe("true");
});

test.each(["folder", "recents", "favorites", "day"])("filter clears an invisible selected file and preview in %s", async (kind) => {
	const { view, vault } = await mount(undefined, { showPreview: true, showCalendar: true, recentFiles: ["alpha.md", "beta.md"], favorites: ["alpha.md", "beta.md"] });
	if (kind === "recents") view.selectSpecial(RECENTS_PATH);
	else if (kind === "favorites") view.selectSpecial(BOOKMARKS_PATH);
	else if (kind === "day") view.selectDay(dayKey((vault.getAbstractFileByPath("alpha.md") as TFile).stat.ctime));
	const prefix = [...view.selection];
	view.selection.push("alpha.md");
	view.render();
	filter(view, "beta");
	expect(view.selection).toEqual(prefix);
	expect(view.columnsEl.querySelector(".column-explorer-preview")).toBeNull();
	expect(view.columnsEl.querySelector('.column-explorer-item.is-selected[data-path="alpha.md"]')).toBeNull();
});
