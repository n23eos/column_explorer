import { beforeEach, describe, expect, test, vi } from "vitest";
import { TFile, TFolder } from "obsidian";
import { ColumnExplorerView } from "../src/view";
import type ColumnExplorerPlugin from "../src/main";
import { FolderSuggestModal } from "../src/modals";
import { Menu } from "obsidian";
import { RECENTS_PATH } from "../src/pure";
import { Menu as MockMenu } from "./__mocks__/obsidian";
import { makeVault } from "./setup/vault";
import { makeApp, makePlugin } from "./setup/app";
import { observerRegistry, resetObservers } from "./setup/obsidian-dom";
import { ColumnExplorerSettings } from "../src/settings";

/**
 * Поднимает настоящий view поверх фейкового app: onOpen строит тулбар,
 * поиск, колонки и подписки — то есть тот же путь, что и в Obsidian.
 */
async function mountView(paths: string[], settings: Partial<ColumnExplorerSettings> = {}) {
	const vault = makeVault(paths);
	const app = makeApp(vault);
	// Спецпункты выключены по умолчанию: они добавляются в корневую колонку и
	// сдвигают индексы, а здесь проверяется навигация по обычным файлам.
	// Тесты самих спецпунктов включают их явно.
	const plugin = makePlugin(app, {
		showRecents: false, showBookmarks: false, showCalendar: false, showStorage: false, ...settings,
	});
	// leaf.getRoot() зовёт autoResizePanel — отдаём объект, не равный
	// left/rightSplit, чтобы ширину панели тесты не трогали
	const leaf = { getRoot: () => ({}) };
	const view = new ColumnExplorerView(leaf as never, plugin as unknown as ColumnExplorerPlugin);
	// ItemView создаёт contentEl сам; app подменяем на фейковый до onOpen
	(view as unknown as { app: unknown }).app = app;
	document.body.appendChild(view.contentEl);
	await view.onOpen();
	return { view, app, vault, plugin };
}

function columnPaths(view: ColumnExplorerView): string[] {
	return Array.from(
		view.contentEl.querySelectorAll<HTMLElement>(".column-explorer-column[data-folder-path]")
	).map((col) => col.dataset.folderPath ?? "");
}

function keydown(view: ColumnExplorerView, key: string, mods: Partial<KeyboardEventInit> = {}) {
	const el = view.contentEl.querySelector<HTMLElement>(".column-explorer-columns");
	el?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...mods }));
}

const folderOf = (vault: ReturnType<typeof makeVault>, path: string) => {
	const f = vault.getAbstractFileByPath(path);
	if (!(f instanceof TFolder)) throw new Error(`not a folder: ${path}`);
	return f;
};

beforeEach(() => {
	document.body.innerHTML = "";
	resetObservers();
});

describe("onOpen", () => {
	test("builds toolbar, search input and root column", async () => {
		const { view } = await mountView(["notes/a.md"]);

		expect(view.contentEl.querySelector(".column-explorer-toolbar")).not.toBeNull();
		expect(view.contentEl.querySelector(".column-explorer-search")).not.toBeNull();
		expect(columnPaths(view)).toEqual(["/"]);
	});

	test("toolbar lock fixes the column count and unlock restores all columns", async () => {
		const { view, plugin } = await mountView(["notes/sub/deep.md"]);
		view.selection = ["notes"];
		view.render();
		const save = vi.spyOn(plugin, "saveSettings");
		const button = view.contentEl.querySelector<HTMLButtonElement>('[data-action="lock-columns"]')!;
		expect(button.getAttribute("aria-pressed")).toBe("false");
		button.click();
		expect(plugin.settings.lockedColumnCount).toBe(2);
		expect(button.getAttribute("aria-pressed")).toBe("true");
		expect(button.classList.contains("is-active")).toBe(true);
		expect(save).toHaveBeenCalled();
		view.selection = ["notes", "notes/sub"];
		view.render();
		expect(columnPaths(view)).toHaveLength(2);
		button.click();
		expect(plugin.settings.lockedColumnCount).toBeNull();
		expect(button.getAttribute("aria-pressed")).toBe("false");
		expect(columnPaths(view)).toEqual(["/", "notes", "notes/sub"]);
	});

	test("renders one column per level of the selection", async () => {
		const { view } = await mountView(["notes/sub/deep.md"]);

		view.selection = ["notes", "notes/sub"];
		view.render();

		expect(columnPaths(view)).toEqual(["/", "notes", "notes/sub"]);
	});

	test("drops selection entries that no longer exist", async () => {
		const { view } = await mountView(["notes/a.md"]);

		view.selection = ["notes", "notes/ghost", "notes/ghost/x.md"];
		view.render();

		expect(columnPaths(view)).toEqual(["/", "notes"]);
	});
});

describe("keyboard navigation", () => {
	test("ArrowDown moves the selection to the next sibling", async () => {
		const { view } = await mountView(["a.md", "b.md", "c.md"]);
		view.selection = ["a.md"];
		view.render();

		keydown(view, "ArrowDown");

		expect(view.selection).toEqual(["b.md"]);
	});

	test("ArrowUp stops at the first item instead of wrapping", async () => {
		const { view } = await mountView(["a.md", "b.md"]);
		view.selection = ["a.md"];
		view.render();

		keydown(view, "ArrowUp");

		expect(view.selection).toEqual(["a.md"]);
	});

	test("End jumps to the last sibling, Home back to the first", async () => {
		const { view } = await mountView(["a.md", "b.md", "c.md"]);
		view.selection = ["a.md"];
		view.render();

		keydown(view, "End");
		expect(view.selection).toEqual(["c.md"]);

		keydown(view, "Home");
		expect(view.selection).toEqual(["a.md"]);
	});

	test("ArrowRight descends into a folder, ArrowLeft goes back up", async () => {
		const { view } = await mountView(["notes/a.md"]);
		view.selection = ["notes"];
		view.render();

		keydown(view, "ArrowRight");
		expect(view.selection).toEqual(["notes", "notes/a.md"]);

		keydown(view, "ArrowLeft");
		expect(view.selection).toEqual(["notes"]);
	});

	test("Enter opens the selected file", async () => {
		const { view, app } = await mountView(["a.md"]);
		view.selection = ["a.md"];
		view.render();

		keydown(view, "Enter");

		expect(app.opened).toEqual(["a.md"]);
	});

	test("typeahead jumps to the first name starting with the typed prefix", async () => {
		const { view } = await mountView(["alpha.md", "beta.md", "gamma.md"]);
		view.selection = ["alpha.md"];
		view.render();

		keydown(view, "g");

		expect(view.selection).toEqual(["gamma.md"]);
	});

	test("focusColumns puts keyboard focus on the columns container", async () => {
		const { view } = await mountView(["a.md"]);

		view.focusColumns();

		expect(document.activeElement?.classList.contains("column-explorer-columns")).toBe(true);
	});

	test("typeahead treats Space as part of the prefix instead of Quick Look", async () => {
		// Сортировка по убыванию, чтобы имя с пробелом не было первым совпадением
		const { view } = await mountView(["ab.md", "a c.md"], { sortMode: "name-desc" });
		view.selection = ["ab.md"];
		view.render();

		keydown(view, "a");
		keydown(view, " ");
		keydown(view, "c");

		expect(view.selection).toEqual(["a c.md"]);
	});

	test("Mod+A multi-selects every sibling in the column", async () => {
		const { view } = await mountView(["a.md", "b.md"]);
		view.selection = ["a.md"];
		view.render();

		keydown(view, "a", { metaKey: true });

		expect([...view.multiSel].sort()).toEqual(["a.md", "b.md"]);
	});

	test("Mod+A multi-selects on a non-Latin layout via the physical key", async () => {
		const { view } = await mountView(["a.md", "b.md"]);
		view.selection = ["a.md"];
		view.render();

		// Кириллическая раскладка: e.key = "ф", физическая клавиша — KeyA
		keydown(view, "ф", { metaKey: true, code: "KeyA" });

		expect([...view.multiSel].sort()).toEqual(["a.md", "b.md"]);
	});

	test("Delete without confirmation trashes the selected file", async () => {
		const { view, app } = await mountView(["a.md"], { confirmDelete: false });
		view.selection = ["a.md"];
		view.render();

		keydown(view, "Delete");
		await Promise.resolve();

		expect(app.fileManager.trashed).toEqual(["a.md"]);
	});
});

describe("history", () => {
	test("back and forward walk the visited selections", async () => {
		const { view, vault } = await mountView(["a.md", "notes/b.md"]);
		const file = vault.getAbstractFileByPath("a.md") as TFile;
		const folder = folderOf(vault, "notes");

		view.selectItem(folder, 0, new MouseEvent("click"));
		view.selectItem(file, 0, new MouseEvent("click"));

		expect(view.canGoBack()).toBe(true);
		view.goBack();
		expect(view.selection).toEqual(["notes"]);

		expect(view.canGoForward()).toBe(true);
		view.goForward();
		expect(view.selection).toEqual(["a.md"]);
	});

	test("cannot go back from the initial state", async () => {
		const { view } = await mountView(["a.md"]);

		expect(view.canGoBack()).toBe(false);
		expect(view.canGoForward()).toBe(false);
	});
});

describe("vault events", () => {
	test("deleting the selected file drops it from the selection", async () => {
		const { view, app, vault } = await mountView(["notes/a.md"]);
		view.selection = ["notes", "notes/a.md"];
		view.render();

		const file = vault.getAbstractFileByPath("notes/a.md") as TFile;
		app.vault.trigger("delete", file);

		expect(view.selection).toEqual(["notes"]);
	});

	test("deleting a folder also drops its children from the selection", async () => {
		const { view, app, vault } = await mountView(["notes/sub/deep.md"]);
		view.selection = ["notes", "notes/sub", "notes/sub/deep.md"];
		view.render();

		app.vault.trigger("delete", folderOf(vault, "notes/sub"));

		expect(view.selection).toEqual(["notes"]);
	});

	test("renaming a selected folder remaps the whole selection chain", async () => {
		const { view, app, vault } = await mountView(["notes/sub/deep.md"]);
		view.selection = ["notes", "notes/sub", "notes/sub/deep.md"];
		view.render();

		const folder = vault.rename("notes", "renamed");
		app.vault.trigger("rename", folder, "notes");

		expect(view.selection).toEqual(["renamed", "renamed/sub", "renamed/sub/deep.md"]);
	});
});

describe("selection helpers", () => {
	test("revealFile selects the full path chain down to the file", async () => {
		const { view, vault } = await mountView(["notes/sub/deep.md"]);

		view.revealFile(vault.getAbstractFileByPath("notes/sub/deep.md"));

		expect(view.selection).toEqual(["notes", "notes/sub", "notes/sub/deep.md"]);
	});

	test("collapseToRoot clears the selection back to a single column", async () => {
		const { view } = await mountView(["notes/sub/deep.md"]);
		view.selection = ["notes", "notes/sub"];
		view.render();

		view.collapseToRoot();

		expect(columnPaths(view)).toEqual(["/"]);
	});

	test("goUp leaves the current folder for its parent", async () => {
		const { view } = await mountView(["notes/sub/deep.md"]);
		view.selection = ["notes", "notes/sub", "notes/sub/deep.md"];
		view.render();

		expect(view.canGoUp()).toBe(true);
		view.goUp();

		// Файл живёт в notes/sub, поэтому «вверх» — это notes, а не notes/sub
		expect(view.selection).toEqual(["notes"]);
	});

	test("toggleFavorite adds and then removes a path", async () => {
		const { view, plugin } = await mountView(["a.md"]);

		view.toggleFavorite("a.md");
		expect(plugin.settings.favorites).toEqual(["a.md"]);

		view.toggleFavorite("a.md");
		expect(plugin.settings.favorites).toEqual([]);
	});
});

describe("onClose", () => {
	test("disconnects chunk-loading observers", async () => {
		const { view } = await mountView(
			Array.from({ length: 700 }, (_, i) => `f${String(i).padStart(3, "0")}.md`)
		);
		expect(observerRegistry.some((r) => !r.disconnected)).toBe(true);

		await view.onClose();

		expect(observerRegistry.every((r) => r.disconnected)).toBe(true);
	});

	test("a vault event after close does not throw on the detached view", async () => {
		const { view, app, vault } = await mountView(["notes/a.md"]);
		await view.onClose();

		expect(() =>
			app.vault.trigger("delete", vault.getAbstractFileByPath("notes/a.md") as TFile)
		).not.toThrow();
	});
});

describe("more keyboard shortcuts", () => {
	test("PageDown jumps a page down the list", async () => {
		const { view } = await mountView(Array.from({ length: 30 }, (_, i) => `f${String(i).padStart(2, "0")}.md`));
		view.selection = ["f00.md"];
		view.render();

		keydown(view, "PageDown");

		expect(view.selection).toEqual(["f10.md"]);
	});

	test("PageUp stops at the top instead of going negative", async () => {
		const { view } = await mountView(["a.md", "b.md"]);
		view.selection = ["b.md"];
		view.render();

		keydown(view, "PageUp");

		expect(view.selection).toEqual(["a.md"]);
	});

	test("Space opens Quick Look for the selected file", async () => {
		const { view } = await mountView(["a.md"]);
		view.selection = ["a.md"];
		view.render();

		keydown(view, " ");

		// Модалка живёт вне contentEl — проверяем, что вью не упала и выбор цел
		expect(view.selection).toEqual(["a.md"]);
	});

	test("F2 starts an inline rename", async () => {
		const { view } = await mountView(["a.md"]);
		view.selection = ["a.md"];
		view.render();

		keydown(view, "F2");

		expect(view.isRenaming("a.md")).toBe(true);
	});

	test("Mod+D duplicates the selected file", async () => {
		const { view, app } = await mountView(["a.md"]);
		const copied: string[] = [];
		(app.vault as unknown as { copy: (f: TFile, p: string) => Promise<void> })
			.copy = (_f, p) => { copied.push(p); return Promise.resolve(); };
		view.selection = ["a.md"];
		view.render();

		keydown(view, "d", { metaKey: true });
		await vi.waitFor(() => expect(copied).toHaveLength(1));

		expect(copied[0]).toBe("a copy.md");
	});

	test("Mod+D duplicates on a non-Latin layout via the physical key", async () => {
		const { view, app } = await mountView(["a.md"]);
		const copied: string[] = [];
		(app.vault as unknown as { copy: (f: TFile, p: string) => Promise<void> })
			.copy = (_f, p) => { copied.push(p); return Promise.resolve(); };
		view.selection = ["a.md"];
		view.render();

		keydown(view, "в", { metaKey: true, code: "KeyD" });
		await vi.waitFor(() => expect(copied).toHaveLength(1));
	});

	test("Mod+C then Mod+V pastes a copy into the current folder", async () => {
		const { view, app } = await mountView(["a.md", "target/"]);
		const copied: string[] = [];
		Object.assign(app.vault, {
			getAllLoadedFiles: () => [],
			copy: (_f: TFile, p: string) => { copied.push(p); return Promise.resolve(); },
		});
		view.selection = ["a.md"];
		view.render();

		keydown(view, "c", { metaKey: true });
		view.selection = ["target"];
		view.render();
		keydown(view, "v", { metaKey: true });

		await vi.waitFor(() => expect(copied).toEqual(["target/a.md"]));
	});

	test("Mod+C and Mod+V work on a non-Latin layout via the physical key", async () => {
		const { view, app } = await mountView(["a.md", "target/"]);
		const copied: string[] = [];
		Object.assign(app.vault, {
			getAllLoadedFiles: () => [],
			copy: (_f: TFile, p: string) => { copied.push(p); return Promise.resolve(); },
		});
		view.selection = ["a.md"];
		view.render();

		keydown(view, "с", { metaKey: true, code: "KeyC" });
		view.selection = ["target"];
		view.render();
		keydown(view, "м", { metaKey: true, code: "KeyV" });

		await vi.waitFor(() => expect(copied).toEqual(["target/a.md"]));
	});

	test("Mod+X dims the cut item and Mod+V moves it once", async () => {
		const { view, app } = await mountView(["a.md", "target/"]);
		view.selection = ["a.md"];
		view.render();

		keydown(view, "x", { metaKey: true });
		expect(view.contentEl.querySelector('[data-path="a.md"]')?.classList.contains("is-cut")).toBe(true);

		view.selection = ["target"];
		view.render();
		keydown(view, "v", { metaKey: true });
		await vi.waitFor(() => expect(app.fileManager.renamed).toEqual([{ from: "a.md", to: "target/a.md" }]));

		// Буфер очищен — повторная вставка ничего не двигает
		keydown(view, "v", { metaKey: true });
		await Promise.resolve();
		expect(app.fileManager.renamed).toHaveLength(1);
	});

	test("Delete with a multi-selection removes every selected file", async () => {
		const { view, app, vault } = await mountView(["a.md", "b.md"], { confirmDelete: false });
		view.toggleMulti(vault.getAbstractFileByPath("a.md") as TFile, 0);
		view.toggleMulti(vault.getAbstractFileByPath("b.md") as TFile, 0);

		keydown(view, "Delete");
		await vi.waitFor(() => expect(app.fileManager.trashed).toHaveLength(2));

		expect(app.fileManager.trashed.sort()).toEqual(["a.md", "b.md"]);
	});
});

describe("daily usability", () => {
	test("filter counts matching files across open columns and keeps folders navigable", async () => {
		const { view } = await mountView(["match.md", "folder/match-child.md", "folder/other.md", "elsewhere/unopened-match.md"]);
		view.selection = ["folder"];
		view.render();
		const input = view.contentEl.querySelector<HTMLInputElement>(".column-explorer-search")!;
		input.value = "match";
		input.dispatchEvent(new Event("input"));
		expect(view.contentEl.querySelector(".column-explorer-filter-info [role=status]")?.textContent).toBe("Matching files: 2 · Open columns");
		expect(view.childrenOf(view.app.vault.getRoot()).some(file => file.path === "elsewhere")).toBe(true);
		view.clearFilter();
		expect(view.contentEl.querySelector(".column-explorer-filter-info [role=status]")?.textContent).toBe("Open columns · File names");
	});

	test("desktop selection bar copies the selected paths and Escape clears selection before filter", async () => {
		const { view, vault } = await mountView(["a.md", "ab.md", "b.md"]);
		const input = view.contentEl.querySelector<HTMLInputElement>(".column-explorer-search")!;
		input.value = "a";
		input.dispatchEvent(new Event("input"));
		view.toggleMulti(vault.getAbstractFileByPath("a.md")!, 0);
		view.toggleMulti(vault.getAbstractFileByPath("ab.md")!, 0);
		const bar = view.contentEl.querySelector<HTMLElement>(".column-explorer-selection-bar")!;
		expect(bar.hidden).toBe(false);
		expect(bar.textContent).toContain("2 selected");
		const copy = vi.spyOn(view, "copyItems");
		bar.querySelector<HTMLButtonElement>('button[aria-label="Copy"]')!.click();
		expect(copy).toHaveBeenCalledWith(["a.md", "ab.md"], false);
		keydown(view, "Escape");
		expect(view.multiSel.size).toBe(0);
		expect(bar.hidden).toBe(true);
		expect(view.hasFilter()).toBe(true);
		keydown(view, "Escape");
		expect(view.hasFilter()).toBe(false);
	});

	test("selection bar close returns focus and clearMulti removes row highlights", async () => {
		const { view, vault } = await mountView(["a.md"]);
		view.toggleMulti(vault.getAbstractFileByPath("a.md")!, 0);
		const close = view.contentEl.querySelector<HTMLButtonElement>('.column-explorer-selection-bar button[aria-label="Cancel selection"]')!;
		close.focus(); close.click();
		expect(document.activeElement).toBe(view.columnsEl);
		expect(view.columnsEl.querySelector(".is-multi-selected")).toBeNull();
	});

	test("changing folder context prunes hidden multi-selection", async () => {
		const { view, vault } = await mountView(["one/a.md", "two/b.md"]);
		view.selection = ["one"]; view.render();
		view.toggleMulti(vault.getAbstractFileByPath("one/a.md")!, 1);
		view.selection = ["two"]; view.render();
		expect(view.multiSel.size).toBe(0);
		expect(view.contentEl.querySelector<HTMLElement>(".column-explorer-selection-bar")?.hidden).toBe(true);
	});

	test("Quick Look gets sorted filtered siblings including files beyond the rendered chunk", async () => {
		const { view, vault } = await mountView(["b.md", "a.md", "folder/hidden.md", "c.md"], { sortMode: "name-desc" });
		const file = vault.getAbstractFileByPath("b.md") as TFile;
		expect(view.quickLookFiles(file).map(f => f.path)).toEqual(["c.md", "b.md", "a.md"]);
		const input = view.contentEl.querySelector<HTMLInputElement>(".column-explorer-search")!;
		input.value = "b"; input.dispatchEvent(new Event("input"));
		expect(view.quickLookFiles(file)).toEqual([file]);
	});
});


describe("usability integration regressions", () => {
	test("moving via the selection bar uses a snapshot and clears the bar", async () => {
		const { view, vault, app } = await mountView(["a.md", "b.md", "target/existing.md"]);
		view.toggleMulti(vault.getAbstractFileByPath("a.md")!, 0);
		view.toggleMulti(vault.getAbstractFileByPath("b.md")!, 0);
		const open = vi.spyOn(FolderSuggestModal.prototype, "open").mockImplementation(() => { /* capture without opening */ });
		view.contentEl.querySelector<HTMLButtonElement>('.column-explorer-selection-bar button[aria-label="Move to folder…"]')!.click();
		const picker = open.mock.instances[0] as FolderSuggestModal;
		expect(picker).toBeDefined();
		picker.onChooseItem(folderOf(vault, "target"));
		await new Promise(resolve => setTimeout(resolve, 0));
		expect(app.fileManager.renamed).toEqual([{ from: "a.md", to: "target/a.md" }, { from: "b.md", to: "target/b.md" }]);
		expect(view.multiSel.size).toBe(0);
		open.mockRestore();
	});

	test("zero-result filter counts no folders and refreshes after matching-file deletion", async () => {
		const { view, vault, app } = await mountView(["folder/a.md", "match.md"]);
		const input = view.contentEl.querySelector<HTMLInputElement>(".column-explorer-search")!;
		input.value = "match"; input.dispatchEvent(new Event("input"));
		const file = vault.getAbstractFileByPath("match.md")!;
		vault.index.delete(file.path);
		file.parent!.children = file.parent!.children.filter(child => child !== file);
		app.vault.trigger("delete", file);
		expect(view.contentEl.querySelector(".column-explorer-filter-info [role=status]")?.textContent).toBe("Matching files: 0 · Open columns");
	});

	test("selection updates accessibility state and clears when a selected file disappears", async () => {
		const { view, vault, app } = await mountView(["a.md", "b.md"]);
		const file = vault.getAbstractFileByPath("a.md")!;
		view.toggleMulti(file, 0);
		expect(view.columnsEl.querySelector('[data-path="a.md"]')?.getAttribute("aria-selected")).toBe("true");
		expect(view.columnsEl.querySelector('[role="listbox"]')?.getAttribute("aria-multiselectable")).toBe("true");
		vault.index.delete(file.path);
		file.parent!.children = file.parent!.children.filter(child => child !== file);
		app.vault.trigger("delete", file);
		expect(view.multiSel.size).toBe(0);
		expect(view.contentEl.querySelector<HTMLElement>(".column-explorer-selection-bar")?.hidden).toBe(true);
	});

	test("folder sort restores focus to its replacement button", async () => {
		const { view } = await mountView(["a.md", "b.md"]);
		let menu: MockMenu | undefined;
		const show = vi.spyOn(Menu.prototype, "showAtPosition").mockImplementation(function(this: Menu) { menu = this as unknown as MockMenu; return this; });
		view.columnsEl.querySelector<HTMLButtonElement>(".column-explorer-sort-button")!.click();
		menu!.items.find(item => item.title === "Name (Z → A)")!.callback!();
		expect(document.activeElement).toBe(view.columnsEl.querySelector(".column-explorer-sort-button"));
		expect(document.activeElement?.textContent).toBe("Name ↓");
		show.mockRestore();
	});
});


test("Quick Look respects the source column when a root file is also in Recents", async () => {
	const { view, vault } = await mountView(["a.md", "b.md", "c.md"], { showRecents: true, recentFiles: ["c.md", "a.md"] });
	const file = vault.getAbstractFileByPath("a.md") as TFile;
	view.selection = [RECENTS_PATH, "a.md"]; view.render();
	expect(view.quickLookFiles(file).map(f => f.path)).toEqual(["c.md", "a.md"]);
	expect(view.quickLookFiles(file, 1).map(f => f.path)).toEqual(["c.md", "a.md"]);
	expect(view.quickLookFiles(file, 0).map(f => f.path)).toEqual(["a.md", "b.md", "c.md"]);
});
