/**
 * «Обвязка» вью: хлебные крошки, фиксация колонок, авто-ширина панели,
 * подсветка активного файла и кнопки панели действий.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Platform, TFile } from "obsidian";
import { Menu } from "./__mocks__/obsidian";
import { t } from "../src/i18n";
import { ColumnExplorerView } from "../src/view";
import type ColumnExplorerPlugin from "../src/main";
import { ColumnExplorerSettings } from "../src/settings";
import { CALENDAR_PATH, RECENTS_PATH } from "../src/pure";
import { makeVault } from "./setup/vault";
import { makeApp, makePlugin } from "./setup/app";
import { resetObservers } from "./setup/obsidian-dom";

async function mount(paths: string[], settings: Partial<ColumnExplorerSettings> = {}, leaf?: unknown) {
	const vault = makeVault(paths);
	const app = makeApp(vault);
	const plugin = makePlugin(app, { showRecents: false, showBookmarks: false, showCalendar: false, ...settings });
	const view = new ColumnExplorerView(
		(leaf ?? { getRoot: () => ({}) }) as never,
		plugin as unknown as ColumnExplorerPlugin
	);
	(view as unknown as { app: unknown }).app = app;
	document.body.appendChild(view.contentEl);
	await view.onOpen();
	return { view, app, vault, plugin };
}

const crumbs = (view: ColumnExplorerView) =>
	Array.from(view.contentEl.querySelectorAll(".column-explorer-crumb")).map((el) => el.textContent ?? "");

beforeEach(() => {
	document.body.innerHTML = "";
	resetObservers();
});

afterEach(() => {
	Platform.isMobile = false;
	vi.restoreAllMocks();
});

describe("breadcrumbs", () => {
	test("start at the vault name and follow the selection", async () => {
		const { view } = await mount(["notes/sub/deep.md"]);

		view.selection = ["notes", "notes/sub"];
		view.render();

		expect(crumbs(view)).toEqual(["TestVault", "notes", "sub"]);
	});

	test("the last crumb is marked as current", async () => {
		const { view } = await mount(["notes/a.md"]);
		view.selection = ["notes"];
		view.render();

		const last = view.contentEl.querySelectorAll(".column-explorer-crumb");

		expect(last[last.length - 1].classList.contains("is-current")).toBe(true);
	});

	test("clicking a crumb trims the selection back to it", async () => {
		const { view } = await mount(["notes/sub/deep.md"]);
		view.selection = ["notes", "notes/sub"];
		view.render();

		view.contentEl.querySelectorAll<HTMLElement>(".column-explorer-crumb")[1]
			.dispatchEvent(new MouseEvent("click"));

		expect(view.selection).toEqual(["notes"]);
	});

	test("virtual columns get their own label instead of a raw sentinel", async () => {
		const { view } = await mount(["a.md"], { showRecents: true, recentFiles: ["a.md"] });

		view.selectSpecial(RECENTS_PATH);

		expect(crumbs(view).some((c) => c.includes("::"))).toBe(false);
	});

	test("the star button toggles the current folder as a favorite", async () => {
		const { view, plugin } = await mount(["notes/a.md"]);
		view.selection = ["notes"];
		view.render();

		view.contentEl.querySelector<HTMLElement>(".column-explorer-fav-btn")?.dispatchEvent(new MouseEvent("click"));

		expect(plugin.settings.favorites).toEqual(["notes"]);
	});

	test("navigation buttons are disabled with an empty history", async () => {
		const { view } = await mount(["a.md"]);

		const back = view.contentEl.querySelector(".column-explorer-nav-btn");

		expect(back?.classList.contains("is-disabled")).toBe(true);
	});
});

describe("locked columns", () => {
	test("marks the columns view as locked once the chain outgrows the limit", async () => {
		const { view } = await mount(["a/b/c/d.md"], { lockedColumnCount: 1 });

		view.selection = ["a", "a/b"];
		view.render();

		expect(view.contentEl.querySelector(".column-explorer-columns")?.classList.contains("is-locked")).toBe(true);
	});

	test("stays unlocked while every column fits", async () => {
		const { view } = await mount(["a/b.md"], { lockedColumnCount: null });

		view.selection = ["a"];
		view.render();

		expect(view.contentEl.querySelector(".column-explorer-columns")?.classList.contains("is-locked")).toBe(false);
	});
});

describe("autoResizePanel", () => {
	test("does nothing for a view in the main editor area", async () => {
		const setSize = vi.fn();
		const { view } = await mount(["a.md"], { lockColumnWidths: false, autoPanelResize: true }, { getRoot: () => ({ setSize }) });

		view.autoResizePanel();

		expect(setSize).not.toHaveBeenCalled();
	});

	test("resizes the sidebar the view actually lives in", async () => {
		const vault = makeVault(["a.md"]);
		const app = makeApp(vault);
		const split = { collapsed: false, setSize: vi.fn() };
		Object.assign(app.workspace, { leftSplit: split });
		const plugin = makePlugin(app, { lockColumnWidths: false, autoPanelResize: true, showRecents: false, showBookmarks: false, showCalendar: false });
		const view = new ColumnExplorerView({ getRoot: () => split } as never, plugin as unknown as ColumnExplorerPlugin);
		(view as unknown as { app: unknown }).app = app;
		document.body.appendChild(view.contentEl);
		await view.onOpen();
		// happy-dom не считает лэйаут: ширину колонки задаём сами, иначе
		// autoResizePanel выйдет раньше по contentWidth === 0
		view.contentEl.querySelectorAll(".column-explorer-column").forEach((col) => {
			Object.defineProperty(col, "offsetWidth", { value: 260 });
		});

		view.autoResizePanel();

		expect(split.setSize).toHaveBeenCalled();
	});

	test("leaves a collapsed sidebar alone", async () => {
		const vault = makeVault(["a.md"]);
		const app = makeApp(vault);
		const split = { collapsed: true, setSize: vi.fn() };
		Object.assign(app.workspace, { leftSplit: split });
		const plugin = makePlugin(app, { lockColumnWidths: false, autoPanelResize: true });
		const view = new ColumnExplorerView({ getRoot: () => split } as never, plugin as unknown as ColumnExplorerPlugin);
		(view as unknown as { app: unknown }).app = app;
		document.body.appendChild(view.contentEl);
		await view.onOpen();

		view.autoResizePanel();

		expect(split.setSize).not.toHaveBeenCalled();
	});
});

describe("active file highlight", () => {
	test("moves the highlight without a full re-render", async () => {
		const { view, app, vault } = await mount(["a.md", "b.md"]);
		const b = vault.getAbstractFileByPath("b.md") as TFile;
		Object.assign(app.workspace, { getActiveFile: () => b });

		view.updateActiveFileHighlight();

		const marked = view.contentEl.querySelectorAll<HTMLElement>(".is-active-file");
		expect(Array.from(marked).map((el) => el.dataset.path)).toEqual(["b.md"]);
	});

	test("clears the highlight when nothing is open", async () => {
		const { view, app, vault } = await mount(["a.md"]);
		Object.assign(app.workspace, { getActiveFile: () => vault.getAbstractFileByPath("a.md") as TFile });
		view.updateActiveFileHighlight();

		Object.assign(app.workspace, { getActiveFile: () => null });
		view.updateActiveFileHighlight();

		expect(view.contentEl.querySelector(".is-active-file")).toBeNull();
	});
});

describe("view state", () => {
	test("round-trips the selection through getState/setState", async () => {
		const { view } = await mount(["notes/a.md"]);
		view.selection = ["notes", "notes/a.md"];

		const state = view.getState();
		view.selection = [];
		await view.setState(state as never, {} as never);

		expect(view.selection).toEqual(["notes", "notes/a.md"]);
	});

	// workspace.json тоже правится руками: число в цепочке роняло render
	test("drops non-string entries from a restored selection", async () => {
		const { view } = await mount(["notes/a.md"]);

		await view.setState({ selection: ["notes", 7, null, "notes/a.md"] } as never, {} as never);

		expect(view.selection).toEqual(["notes", "notes/a.md"]);
	});

	test("reports its type, name and icon", async () => {
		const { view } = await mount(["a.md"]);

		expect(view.getViewType()).toBe("column-explorer-view");
		expect(view.getDisplayText()).toBeTruthy();
		expect(view.getIcon()).toBeTruthy();
	});
});

describe("selection helpers", () => {
	test("selectedFilePath reports the deepest selected file", async () => {
		const { view } = await mount(["notes/a.md"]);

		view.selection = ["notes", "notes/a.md"];

		expect(view.selectedFilePath()).toBe("notes/a.md");
	});

	test("selectedFilePath is null while a folder is selected", async () => {
		const { view } = await mount(["notes/a.md"]);

		view.selection = ["notes"];

		expect(view.selectedFilePath()).toBeNull();
	});

	test("currentFolder falls back to the root for a virtual column", async () => {
		const { view } = await mount(["a.md"], { showCalendar: true });

		view.selectSpecial(CALENDAR_PATH);

		expect(view.currentFolder().path).toBe("/");
	});

	test("selectAllAt selects visible files in a virtual column", async () => {
		const { view } = await mount(["a.md"], { showRecents: true, recentFiles: ["a.md"] });
		view.selectSpecial(RECENTS_PATH);

		view.selectAllAt(1);

		expect([...view.multiSel]).toEqual(["a.md"]);
	});
});

describe("column width lock", () => {
	test("preserves dragged width and sidebar size across file navigation by default", async () => {
		const split = { setSize: vi.fn() };
		const { view, app, vault, plugin } = await mount(["a.md", "b.md"], {}, { getRoot: () => split });
		Object.assign(app.workspace, { leftSplit: split });
		const col = view.contentEl.querySelector<HTMLElement>(".column-explorer-column")!;
		Object.defineProperty(col, "offsetWidth", { value: 260 });
		col.querySelector(".column-explorer-resize-handle")!.dispatchEvent(new MouseEvent("mousedown", { clientX: 260 }));
		document.dispatchEvent(new MouseEvent("mousemove", { clientX: 300 }));
		document.dispatchEvent(new MouseEvent("mouseup"));
		expect(plugin.settings.columnWidths["/"]).toBe(300);
		for (const path of ["a.md", "b.md"]) {
			view.selectItem(vault.getAbstractFileByPath(path)!, 0, new MouseEvent("click"));
			await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()));
			view.autoResizePanel();
			expect(view.contentEl.querySelector<HTMLElement>(".column-explorer-column")!.style.getPropertyValue("--ce-col-width")).toBe("300px");
		}
		expect(split.setSize).not.toHaveBeenCalled();
		expect(plugin.settings.autoPanelResize).toBe(false);
		expect(view.contentEl.querySelector('[data-action="lock-column-widths"]')).toBeNull();
		await view.onClose();
	});

	test("More menu toggles automatic panel sizing and preserves manual widths", async () => {
		const split = { setSize: vi.fn() };
		const { view, app, plugin } = await mount(["a.md"], { columnWidths: { "/": 310 } }, { getRoot: () => split });
		Object.assign(app.workspace, { rightSplit: split });
		const save = vi.spyOn(plugin, "saveSettings");
		let menu: Menu | undefined;
		vi.spyOn(Menu.prototype, "showAtMouseEvent").mockImplementation(function (this: Menu) { menu = this; });
		const toggle = () => {
			view.contentEl.querySelector<HTMLButtonElement>('[data-action="more"]')!.click();
			const item = menu?.items.find(item => item.title === t("panelAutoWidth"));
			expect(item?.callback).toBeDefined();
			item!.callback!();
		};
		view.contentEl.querySelectorAll(".column-explorer-column").forEach(col => {
			Object.defineProperty(col, "offsetWidth", { value: 310 });
		});
		toggle();
		expect(plugin.settings.autoPanelResize).toBe(true);
		expect(plugin.settings.lockColumnWidths).toBe(false);
		expect(save).toHaveBeenCalled();
		expect(split.setSize).toHaveBeenCalled();
		split.setSize.mockClear();
		toggle();
		view.autoResizePanel();
		expect(plugin.settings.autoPanelResize).toBe(false);
		expect(plugin.settings.lockColumnWidths).toBe(true);
		expect(plugin.settings.columnWidths).toEqual({ "/": 310 });
		expect(split.setSize).not.toHaveBeenCalled();
		await view.onClose();
	});
});
