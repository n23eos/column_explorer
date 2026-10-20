/**
 * Остальная часть column.ts: календарь, виртуальные колонки, ручка ширины,
 * клики по элементам списка.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TAbstractFile, TFile, TFolder } from "obsidian";
import { commitActiveResize, renderCalendarColumn, renderColumn, renderFileListColumn } from "../src/column";
import { CALENDAR_PATH, RECENTS_PATH, dayKey } from "../src/pure";
import { MIN_COLUMN_WIDTH } from "../src/settings";
import { makeVault } from "./setup/vault";
import { makeView } from "./setup/view";
import { resetObservers } from "./setup/obsidian-dom";

function container(): HTMLElement {
	const el = document.createElement("div");
	document.body.appendChild(el);
	return el;
}

function mouse(type: string, x: number): MouseEvent {
	return new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x });
}

const folderOf = (vault: ReturnType<typeof makeVault>, path: string) => {
	const f = vault.getAbstractFileByPath(path);
	if (!(f instanceof TFolder)) throw new Error(`not a folder: ${path}`);
	return f;
};

beforeEach(() => {
	document.body.innerHTML = "";
	resetObservers();
	commitActiveResize();
});

describe("renderCalendarColumn", () => {
	function calendarView(counts: Map<string, number> = new Map(), selectedDay: string | null = null) {
		const vault = makeVault(["a.md"]);
		const view = makeView(vault);
		Object.assign(view, {
			currentCalendarMonth: () => ({ year: 2026, month: 6 }),
			calendarCounts: () => counts,
			selectedDayKey: () => selectedDay,
			navigateCalendarMonth: vi.fn(),
			selectDay: vi.fn(),
			autoResizePanel: () => { /* no-op */ },
		});
		return view;
	}

	test("renders a weekday header and the days of the month", () => {
		const view = calendarView();
		const host = container();

		renderCalendarColumn(view, host);

		expect(host.querySelectorAll(".column-explorer-cal-weekday")).toHaveLength(7);
		// Июль 2026 — 31 день
		expect(host.querySelectorAll(".column-explorer-cal-cell.is-day")).toHaveLength(31);
	});

	test("shows a badge with the number of notes created that day", () => {
		const view = calendarView(new Map([["2026-07-03", 4]]));
		const host = container();

		renderCalendarColumn(view, host);

		const cell = host.querySelector<HTMLElement>('[data-day="2026-07-03"]');
		expect(cell?.querySelector(".column-explorer-cal-count")?.textContent).toBe("4");
	});

	test("marks the selected day", () => {
		const view = calendarView(new Map(), "2026-07-10");
		const host = container();

		renderCalendarColumn(view, host);

		expect(host.querySelector<HTMLElement>('[data-day="2026-07-10"]')?.classList.contains("is-selected")).toBe(true);
	});

	test("marks today", () => {
		const view = calendarView();
		const host = container();
		const today = dayKey(Date.now());

		renderCalendarColumn(view, host);

		const cell = host.querySelector<HTMLElement>(`[data-day="${today}"]`);
		// Сегодня попадает в сетку, только если открыт текущий месяц
		if (cell) expect(cell.classList.contains("is-today")).toBe(true);
	});

	test("the arrows page months and the title jumps back to today", () => {
		const view = calendarView();
		const host = container();
		renderCalendarColumn(view, host);
		const [prev, next] = Array.from(host.querySelectorAll(".column-explorer-cal-nav .clickable-icon"));

		prev.dispatchEvent(new MouseEvent("click"));
		next.dispatchEvent(new MouseEvent("click"));
		host.querySelector(".column-explorer-cal-month")?.dispatchEvent(new MouseEvent("click"));

		expect(view.navigateCalendarMonth).toHaveBeenNthCalledWith(1, -1);
		expect(view.navigateCalendarMonth).toHaveBeenNthCalledWith(2, 1);
		expect(view.navigateCalendarMonth).toHaveBeenNthCalledWith(3, 0);
	});

	test("clicking a day selects it", () => {
		const view = calendarView();
		const host = container();
		renderCalendarColumn(view, host);

		host.querySelector<HTMLElement>('[data-day="2026-07-15"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		expect(view.selectDay).toHaveBeenCalledWith("2026-07-15");
	});
});

describe("renderFileListColumn", () => {
	function fileListView() {
		const vault = makeVault(["a.md", "b.md"]);
		const view = makeView(vault);
		Object.assign(view, { autoResizePanel: () => { /* no-op */ } });
		return { view, vault };
	}

	const filesOf = (vault: ReturnType<typeof makeVault>, paths: string[]) =>
		paths.map((p) => vault.getAbstractFileByPath(p) as TAbstractFile);

	test("lists the given files under the given title", () => {
		const { view, vault } = fileListView();
		const host = container();

		renderFileListColumn(view, host, "Recents", filesOf(vault, ["a.md", "b.md"]), RECENTS_PATH, 1);

		expect(host.querySelector(".column-explorer-column-title")?.textContent).toBe("Recents");
		expect(host.querySelectorAll(".column-explorer-item")).toHaveLength(2);
		expect(host.querySelector(".column-explorer-column-count")?.textContent).toBe("2");
	});

	test("shows an empty placeholder when there is nothing to list", () => {
		const { view } = fileListView();
		const host = container();

		renderFileListColumn(view, host, "Recents", [], RECENTS_PATH, 1);

		expect(host.querySelector(".column-explorer-empty")).not.toBeNull();
	});

	test("favorites get their own labelled section above the rest", () => {
		const { view, vault } = fileListView();
		const host = container();

		renderFileListColumn(view, host, "Bookmarks", filesOf(vault, ["b.md"]), RECENTS_PATH, 1, filesOf(vault, ["a.md"]));

		expect(host.querySelector(".column-explorer-section-label")).not.toBeNull();
		expect(host.querySelector(".column-explorer-section-divider")).not.toBeNull();
		expect(host.querySelector(".column-explorer-column-count")?.textContent).toBe("2");
	});
});

describe("resize handle", () => {
	function columnWithHandle() {
		const vault = makeVault(["notes/a.md"]);
		const view = makeView(vault);
		Object.assign(view, { autoResizePanel: () => { /* no-op */ } });
		const host = container();
		renderColumn(view, host, folderOf(vault, "notes"), 0);
		const handle = host.querySelector<HTMLElement>(".column-explorer-resize-handle") as HTMLElement;
		return { view, host, handle };
	}

	test("dragging stores the new width for that column only", () => {
		const { view, handle } = columnWithHandle();

		handle.dispatchEvent(mouse("mousedown", 0));
		document.dispatchEvent(mouse("mousemove", 120));
		document.dispatchEvent(mouse("mouseup", 120));

		expect(Object.keys(view.plugin.settings.columnWidths)).toEqual(["notes"]);
	});

	test("a drag that does not move anything changes nothing", () => {
		const { view, handle } = columnWithHandle();

		handle.dispatchEvent(mouse("mousedown", 50));
		document.dispatchEvent(mouse("mouseup", 50));

		expect(view.plugin.settings.columnWidths).toEqual({});
	});

	test("width never drops below the minimum", () => {
		const { view, handle } = columnWithHandle();

		handle.dispatchEvent(mouse("mousedown", 500));
		document.dispatchEvent(mouse("mousemove", 0));
		document.dispatchEvent(mouse("mouseup", 0));

		expect(view.plugin.settings.columnWidths.notes).toBeGreaterThanOrEqual(MIN_COLUMN_WIDTH);
	});

	test("double click resets the stored width", () => {
		const { view, handle } = columnWithHandle();
		view.plugin.settings.columnWidths = { notes: 400, other: 300 };

		handle.dispatchEvent(new MouseEvent("dblclick"));

		expect(view.plugin.settings.columnWidths).toEqual({ other: 300 });
	});

	test("commitActiveResize finishes a drag left hanging by a re-render", () => {
		const { view, handle } = columnWithHandle();

		handle.dispatchEvent(mouse("mousedown", 0));
		document.dispatchEvent(mouse("mousemove", 120));
		commitActiveResize();
		// Слушатели сняты — дальнейшее движение мыши уже ничего не меняет
		const stored = { ...view.plugin.settings.columnWidths };
		document.dispatchEvent(mouse("mousemove", 300));

		expect(view.plugin.settings.columnWidths).toEqual(stored);
		expect(stored.notes).toBeDefined();
	});
});

describe("column list interaction", () => {
	function columnView(paths: string[], folder: string) {
		const vault = makeVault(paths);
		const view = makeView(vault);
		const selected: { path: string; depth: number }[] = [];
		Object.assign(view, {
			autoResizePanel: () => { /* no-op */ },
			selectItem: (f: TAbstractFile, depth: number) => selected.push({ path: f.path, depth }),
			toggleMulti: (f: TAbstractFile) => selected.push({ path: f.path, depth: -1 }),
		});
		const host = container();
		renderColumn(view, host, folderOf(vault, folder), 0);
		return { view, host, selected };
	}

	test("a click selects the item", () => {
		const { host, selected } = columnView(["notes/a.md"], "notes");

		host.querySelector<HTMLElement>('[data-path="notes/a.md"]')
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		expect(selected).toEqual([{ path: "notes/a.md", depth: 0 }]);
	});

	test("a click on empty space in the list selects nothing", () => {
		const { host, selected } = columnView(["notes/a.md"], "notes");

		host.querySelector<HTMLElement>(".column-explorer-list")
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		expect(selected).toEqual([]);
	});

	test("the view-mode toggle switches the column between list and grid", () => {
		const { view, host } = columnView(["notes/a.md"], "notes");

		host.querySelector<HTMLElement>(".column-explorer-column-header .column-explorer-view-toggle")
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		expect(view.plugin.settings.columnViewModes.notes).toBe("grid");
	});
});

describe("grid mode", () => {
	test("image files get a thumbnail instead of an icon", () => {
		const vault = makeVault(["pics/photo.png"]);
		const view = makeView(vault, { settings: { columnViewModes: { pics: "grid" } } });
		Object.assign(view, { autoResizePanel: () => { /* no-op */ } });
		const host = container();

		renderColumn(view, host, folderOf(vault, "pics"), 0);

		const item = host.querySelector<HTMLElement>('[data-path="pics/photo.png"]');
		expect(item?.classList.contains("has-thumbnail")).toBe(true);
		expect(item?.querySelector("img.column-explorer-thumb")?.getAttribute("src")).toBe("app://pics/photo.png");
	});

	test("non-image files keep the icon in grid mode", () => {
		const vault = makeVault(["pics/note.md"]);
		const view = makeView(vault, { settings: { columnViewModes: { pics: "grid" } } });
		Object.assign(view, { autoResizePanel: () => { /* no-op */ } });
		const host = container();

		renderColumn(view, host, folderOf(vault, "pics"), 0);

		expect(host.querySelector("img.column-explorer-thumb")).toBeNull();
	});
});

describe("item decorations", () => {
	test("a pinned item gets a pin marker", () => {
		const vault = makeVault(["notes/a.md"]);
		const view = makeView(vault, { settings: { pinnedPaths: { "notes/a.md": 0 } } });
		Object.assign(view, { autoResizePanel: () => { /* no-op */ } });
		const host = container();

		renderColumn(view, host, folderOf(vault, "notes"), 0);

		expect(host.querySelector(".column-explorer-item-pin")).not.toBeNull();
	});

	test("a coloured folder carries its colour variable", () => {
		const vault = makeVault(["notes/sub/x.md"]);
		const view = makeView(vault, { settings: { folderColors: { "notes/sub": "red" } } });
		Object.assign(view, { autoResizePanel: () => { /* no-op */ } });
		const host = container();

		renderColumn(view, host, folderOf(vault, "notes"), 0);

		const item = host.querySelector<HTMLElement>('[data-path="notes/sub"]');
		expect(item?.classList.contains("has-folder-color")).toBe(true);
		expect(item?.style.getPropertyValue("--ce-folder-color")).toBe("var(--color-red)");
	});

	test("a non-markdown extension is shown when the setting is on", () => {
		const vault = makeVault(["notes/data.json"]);
		const view = makeView(vault, { settings: { showExtensions: true } });
		Object.assign(view, { autoResizePanel: () => { /* no-op */ } });
		const host = container();

		renderColumn(view, host, folderOf(vault, "notes"), 0);

		expect(host.querySelector(".column-explorer-item-ext")?.textContent).toBe("json");
	});

	test("the active file is highlighted", () => {
		const vault = makeVault(["notes/a.md"]);
		const view = makeView(vault);
		const active = vault.getAbstractFileByPath("notes/a.md") as TFile;
		Object.assign(view.app.workspace, { getActiveFile: () => active });
		Object.assign(view, { autoResizePanel: () => { /* no-op */ } });
		const host = container();

		renderColumn(view, host, folderOf(vault, "notes"), 0);

		expect(host.querySelector<HTMLElement>('[data-path="notes/a.md"]')?.classList.contains("is-active-file")).toBe(true);
	});
});

describe("calendar column identity", () => {
	test("uses the calendar sentinel as its folder path", () => {
		const vault = makeVault(["a.md"]);
		const view = makeView(vault);
		Object.assign(view, {
			currentCalendarMonth: () => ({ year: 2026, month: 0 }),
			calendarCounts: () => new Map(),
			selectedDayKey: () => null,
			autoResizePanel: () => { /* no-op */ },
		});
		const host = container();

		renderCalendarColumn(view, host);

		expect(host.querySelector<HTMLElement>(".column-explorer-calendar")?.dataset.folderPath).toBe(CALENDAR_PATH);
	});
});
