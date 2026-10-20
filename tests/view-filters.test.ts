import { beforeEach, describe, expect, test, vi } from "vitest";
import { Platform, TFile } from "obsidian";
import { ColumnExplorerView } from "../src/view";
import type ColumnExplorerPlugin from "../src/main";
import { BOOKMARKS_PATH, CALENDAR_PATH, DAY_PATH_PREFIX, RECENTS_PATH, dayKey } from "../src/pure";
import type { ColumnExplorerSettings } from "../src/settings";
import { FolderNavigationModal } from "../src/search";
import { t } from "../src/i18n";
import { makeApp, makePlugin } from "./setup/app";
import { resetObservers } from "./setup/obsidian-dom";
import { makeVault } from "./setup/vault";

async function mountView(paths: string[], settings: Partial<ColumnExplorerSettings> = {}) {
	const vault = makeVault(paths);
	const app = makeApp(vault);
	const plugin = makePlugin(app, {
		showRecents: false, showBookmarks: false, showCalendar: false, showStorage: false,
		unreadBaseline: 100, ...settings,
	});
	const leaf = { getRoot: () => ({}) };
	const view = new ColumnExplorerView(leaf as never, plugin as unknown as ColumnExplorerPlugin);
	(view as unknown as { app: unknown }).app = app;
	document.body.appendChild(view.contentEl);
	await view.onOpen();
	return { view, app, vault, plugin };
}

function fileAt(vault: ReturnType<typeof makeVault>, path: string, ctime: number, mtime = ctime) {
	const file = vault.getAbstractFileByPath(path);
	if (!(file instanceof TFile)) throw new Error(`not a file: ${path}`);
	file.stat = { ...file.stat, ctime, mtime };
	return file;
}

function stateSelect(view: ColumnExplorerView) {
	const select = view.contentEl.querySelector<HTMLSelectElement>(".column-explorer-state-filter");
	if (!select) throw new Error("state filter missing");
	return select;
}

function chooseState(view: ColumnExplorerView, value: "all" | "new" | "modified" | "unread") {
	const select = stateSelect(view);
	select.value = value;
	select.dispatchEvent(new Event("change", { bubbles: true }));
}

function visiblePaths(view: ColumnExplorerView, folderPath = "/") {
	const column = view.contentEl.querySelector<HTMLElement>(
		`.column-explorer-column[data-folder-path="${CSS.escape(folderPath)}"]`,
	);
	return Array.from(column?.querySelectorAll<HTMLElement>(".column-explorer-item[data-path]") ?? [])
		.map((item) => item.dataset.path ?? "");
}

function keydown(view: ColumnExplorerView, key: string) {
	view.columnsEl.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}

beforeEach(() => {
	document.body.innerHTML = "";
	resetObservers();
	Platform.isMobile = false;
});

describe("state filter", () => {
	test("exposes an accessible state select and passes the current query to folder navigation", async () => {
		const { view } = await mountView(["folder/a.md"]);
		const select = stateSelect(view);
		expect(select.getAttribute("aria-label")).toBe(t("filterState"));
		const input = view.contentEl.querySelector<HTMLInputElement>(".column-explorer-search")!;
		input.value = "folder";
		const open = vi.spyOn(FolderNavigationModal.prototype, "open").mockImplementation(() => undefined);
		const button = Array.from(view.contentEl.querySelectorAll<HTMLButtonElement>(".column-explorer-filter-info button"))
			.find((candidate) => candidate.textContent === t("goToFolder"));
		button?.click();

		expect(open).toHaveBeenCalledOnce();
		const modal = open.mock.instances[0] as unknown as { query: string };
		expect(modal.query).toBe("folder");
		open.mockRestore();
	});

	test("defaults to all and combines file state with the name filter while folders stay navigable", async () => {
		const { view, vault } = await mountView([
			"folder/inside.md", "new-match.md", "new-other.md", "modified-match.md", "seen-match.md",
		], { seenAt: { "modified-match.md": 1000, "seen-match.md": 5000 } });
		fileAt(vault, "new-match.md", 200);
		fileAt(vault, "new-other.md", 300);
		fileAt(vault, "modified-match.md", 50, 4001);
		fileAt(vault, "seen-match.md", 50, 5000);
		view.render();

		expect(stateSelect(view).value).toBe("all");
		chooseState(view, "unread");
		expect(visiblePaths(view)).toEqual(expect.arrayContaining(["folder", "new-match.md", "new-other.md", "modified-match.md"]));
		expect(visiblePaths(view)).not.toContain("seen-match.md");

		const input = view.contentEl.querySelector<HTMLInputElement>(".column-explorer-search")!;
		input.value = "match";
		input.dispatchEvent(new Event("input", { bubbles: true }));
		expect(visiblePaths(view)).toEqual(expect.arrayContaining(["folder", "new-match.md", "modified-match.md"]));
		expect(visiblePaths(view)).not.toContain("new-other.md");
		expect(view.contentEl.querySelector(".column-explorer-filter-info [role=status]")?.textContent).toContain("2");
		expect(view.getState()).not.toHaveProperty("stateFilter");
	});

	test("clear and Escape reset both filters after clearing multi-selection", async () => {
		const { view, vault } = await mountView(["new.md", "seen.md"], { seenAt: { "seen.md": 5000 } });
		fileAt(vault, "new.md", 200);
		fileAt(vault, "seen.md", 50, 5000);
		view.render();
		chooseState(view, "new");
		const input = view.contentEl.querySelector<HTMLInputElement>(".column-explorer-search")!;
		input.value = "new";
		input.dispatchEvent(new Event("input", { bubbles: true }));
		view.toggleMulti(vault.getAbstractFileByPath("new.md")!, 0);

		keydown(view, "Escape");
		expect(view.multiSel.size).toBe(0);
		expect(view.hasFilter()).toBe(true);
		keydown(view, "Escape");
		expect(view.hasFilter()).toBe(false);
		expect(input.value).toBe("");
		expect(stateSelect(view).value).toBe("all");

		chooseState(view, "new");
		input.value = "new";
		input.dispatchEvent(new Event("input", { bubbles: true }));
		view.contentEl.querySelector<HTMLButtonElement>(".column-explorer-clear-filter")?.click();
		expect(view.hasFilter()).toBe(false);
		expect(input.value).toBe("");
		expect(stateSelect(view).value).toBe("all");
	});

	test("Escape from the state select clears multi-selection before both filters", async () => {
		const { view, vault } = await mountView(["new.md"], { unreadBaseline: 100 });
		const fresh = fileAt(vault, "new.md", 200);
		view.render();
		chooseState(view, "new");
		view.toggleMulti(fresh, 0);
		const select = stateSelect(view);
		select.focus();

		select.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
		expect(view.multiSel.size).toBe(0);
		expect(select.value).toBe("new");
		expect(view.hasFilter()).toBe(true);

		select.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
		expect(view.hasFilter()).toBe(false);
		expect(stateSelect(view).value).toBe("all");
		expect(document.activeElement).toBe(view.columnsEl);
	});

	test("keyboard navigation and Quick Look use the state-filtered order", async () => {
		const { view, vault } = await mountView(["new-a.md", "seen.md", "new-b.md"], {
			seenAt: { "seen.md": 5000 }, sortMode: "name-asc",
		});
		const a = fileAt(vault, "new-a.md", 200);
		fileAt(vault, "seen.md", 50, 5000);
		fileAt(vault, "new-b.md", 300);
		view.selection = ["new-a.md"];
		view.render();
		chooseState(view, "new");

		expect(view.quickLookFiles(a).map((file) => file.path)).toEqual(["new-a.md", "new-b.md"]);
		keydown(view, "ArrowDown");
		expect(view.selection).toEqual(["new-b.md"]);
	});

	test("applies the same state predicate to recents, Quick access and a calendar day", async () => {
		const now = Date.now();
		const day = dayKey(now);
		const { view, vault } = await mountView(["new.md", "seen.md"], {
			unreadBaseline: now - 1000,
			seenAt: { "seen.md": now + 5000 },
			showRecents: true,
			recentFiles: ["new.md", "seen.md"],
			showFavorites: true,
			favorites: ["new.md", "seen.md"],
			showBookmarks: false,
			showCalendar: true,
		});
		fileAt(vault, "new.md", now, now);
		fileAt(vault, "seen.md", now, now + 5000);
		view.render();
		chooseState(view, "new");

		view.selection = [RECENTS_PATH]; view.render();
		expect(visiblePaths(view, RECENTS_PATH)).toEqual(["new.md"]);
		view.selection = [BOOKMARKS_PATH]; view.render();
		expect(visiblePaths(view, BOOKMARKS_PATH)).toEqual(["new.md"]);
		view.selection = [CALENDAR_PATH, DAY_PATH_PREFIX + day]; view.render();
		expect(visiblePaths(view, DAY_PATH_PREFIX + day)).toEqual(["new.md"]);
	});

	test("read and modify events update filtered lists and remove stale preview and multi-selection", async () => {
		const { view, app, vault, plugin } = await mountView(["new.md", "modified.md"], {
			seenAt: { "modified.md": 1000 }, showPreview: true,
		});
		const fresh = fileAt(vault, "new.md", 200);
		const modified = fileAt(vault, "modified.md", 50, 1000);
		view.selection = [fresh.path];
		view.render();
		chooseState(view, "new");
		view.toggleMulti(fresh, 0);

		plugin.settings.seenAt = { ...plugin.settings.seenAt, [fresh.path]: 5000 };
		view.updateUnreadMarker(fresh.path);
		expect(visiblePaths(view)).not.toContain(fresh.path);
		expect(view.selection).toEqual([]);
		expect(view.multiSel.size).toBe(0);
		expect(view.contentEl.querySelector(".column-explorer-preview")).toBeNull();

		chooseState(view, "modified");
		modified.stat = { ...modified.stat, mtime: 4001 };
		app.vault.trigger("modify", modified);
		expect(visiblePaths(view)).toContain(modified.path);
	});
});
