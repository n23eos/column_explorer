/**
 * Взаимодействие с диаграммой «Использование диска»: зум по клику, крошки,
 * переключение метрик, подсказка при наведении и контекстное меню.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TFile } from "obsidian";
import type { Menu } from "./__mocks__/obsidian";
import { ColumnExplorerView } from "../src/view";
import type ColumnExplorerPlugin from "../src/main";
import { STORAGE_PATH } from "../src/pure";
import { formatPercent } from "../src/storage/format";
import { ColumnExplorerSettings } from "../src/settings";
import { makeVault } from "./setup/vault";
import { makeApp, makePlugin } from "./setup/app";
import { resetObservers } from "./setup/obsidian-dom";

let capturedMenus: Menu[] = [];

/** Пункты меню отдаются только через мок — showAtMouseEvent их не возвращает. */
vi.mock("obsidian", async () => {
	const actual = await vi.importActual<typeof import("./__mocks__/obsidian")>("./__mocks__/obsidian");
	class TrackedMenu extends actual.Menu {
		constructor() {
			super();
			capturedMenus.push(this);
		}
	}
	return { ...actual, Menu: TrackedMenu };
});

async function mountChart(
	paths: string[],
	settings: Partial<ColumnExplorerSettings> = {},
	configure?: (app: ReturnType<typeof makeApp>, vault: ReturnType<typeof makeVault>) => void,
) {
	const vault = makeVault(paths);
	// Файлам нужен ненулевой размер, иначе метрика «Размер» даёт пустой круг
	for (const node of vault.index.values()) {
		if (node instanceof TFile) node.stat = { ...node.stat, size: 1024 };
	}
	const app = makeApp(vault);
	configure?.(app, vault);
	const plugin = makePlugin(app, { showRecents: false, showBookmarks: false, showCalendar: false, ...settings });
	const view = new ColumnExplorerView({ getRoot: () => ({}) } as never, plugin as unknown as ColumnExplorerPlugin);
	(view as unknown as { app: unknown }).app = app;
	document.body.appendChild(view.contentEl);
	await view.onOpen();
	view.selectSpecial(STORAGE_PATH);
	// Первая отрисовка синхронна внутри цепочки скана — до вступительной анимации
	await Promise.resolve();
	return { view, app, vault, plugin };
}

const arcFor = (view: ColumnExplorerView, key: string) =>
	view.contentEl.querySelector<SVGPathElement>(`path[data-key="${key}"]`);

const crumbs = (view: ColumnExplorerView) =>
	Array.from(view.contentEl.querySelectorAll(".column-explorer-du-crumb")).map((c) => c.textContent);

const centerText = (view: ColumnExplorerView) => ({
	name: view.contentEl.querySelector(".column-explorer-du-center-name")?.textContent,
	value: view.contentEl.querySelector(".column-explorer-du-center-value")?.textContent,
});

/** Клавиатура вью слушает колонки, а не корневой элемент. */
function keydown(view: ColumnExplorerView, key: string) {
	view.contentEl.querySelector<HTMLElement>(".column-explorer-columns")
		?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}

const fire = (el: Element, type: string) => el.dispatchEvent(new MouseEvent(type, { bubbles: true }));

beforeEach(() => {
	document.body.innerHTML = "";
	capturedMenus = [];
	resetObservers();
});

describe("formatPercent", () => {
	test("covers the whole, the sliver and the empty cases", () => {
		expect(formatPercent(0, 0)).toBe("0%");
		expect(formatPercent(1, 1)).toBe("100%");
		expect(formatPercent(1, 10000)).toBe("<0.1%");
		expect(formatPercent(1, 8)).toBe("12.5%");
	});
});

describe("zooming", () => {
	test("clicking a folder arc zooms in and adds a breadcrumb", async () => {
		const { view } = await mountChart(["notes/a.md", "notes/b.md", "other/c.md"]);

		const folder = arcFor(view, "notes");
		expect(folder).not.toBeNull();
		fire(folder!, "click");

		expect(crumbs(view)).toEqual(["TestVault", "notes"]);
	});

	test("escape steps back out, then reports nothing left to zoom", async () => {
		const { view } = await mountChart(["notes/a.md", "other/c.md"]);
		fire(arcFor(view, "notes")!, "click");

		keydown(view, "Escape");

		expect(crumbs(view)).toEqual(["TestVault"]);
	});

	test("a breadcrumb click returns to that level", async () => {
		const { view } = await mountChart(["a/b/c.md", "a/b/d.md"]);
		fire(arcFor(view, "a")!, "click");
		fire(arcFor(view, "a/b")!, "click");
		expect(crumbs(view)).toEqual(["TestVault", "a", "b"]);

		const root = view.contentEl.querySelector<HTMLButtonElement>(".column-explorer-du-crumb");
		root!.click();

		expect(crumbs(view)).toEqual(["TestVault"]);
	});

	test("clicking a file arc opens it in a new tab", async () => {
		const { view, app } = await mountChart(["a.md", "b.md"]);

		fire(arcFor(view, "a.md")!, "click");

		expect(app.opened).toEqual(["a.md"]);
	});
});

describe("metrics", () => {
	test("does not read markdown until Words is selected", async () => {
		let reads = 0;
		const { view } = await mountChart(["a.md", "b.md"], {}, (app) => {
			app.vault.cachedRead = () => {
				reads++;
				return Promise.resolve("one two");
			};
		});
		const buttons = view.contentEl.querySelectorAll<HTMLButtonElement>(".column-explorer-du-seg-btn");

		expect(reads).toBe(0);
		buttons[2].click();
		expect(reads).toBe(0);

		buttons[1].click();
		await vi.waitFor(() => expect(reads).toBe(2));
		await vi.waitFor(() => expect(buttons[1].classList.contains("is-active")).toBe(true));
		expect(centerText(view).value).toBe("4 words");
	});

	test("switching to files moves the active button and redraws", async () => {
		const { view } = await mountChart(["notes/a.md", "notes/b.md"]);
		const buttons = view.contentEl.querySelectorAll<HTMLButtonElement>(".column-explorer-du-seg-btn");

		buttons[2].click();

		expect(buttons[0].classList.contains("is-active")).toBe(false);
		expect(buttons[2].classList.contains("is-active")).toBe(true);
		expect(centerText(view).value).toBe("2 files");
	});

	test("the centre shows the vault total in the current metric", async () => {
		const { view } = await mountChart(["a.md", "b.md"]);

		expect(centerText(view)).toEqual({ name: "TestVault", value: "2.0 KB" });
	});
});

describe("scan lifecycle", () => {
	test("a failed refresh does not block the next refresh", async () => {
		const { view, app } = await mountChart(["a.md"]);
		const refresh = view.contentEl.querySelector<HTMLButtonElement>(".column-explorer-du-icon-btn")!;
		const workingRoot = app.vault.getRoot;
		app.vault.getRoot = () => { throw new Error("scan boom"); };

		refresh.click();
		await Promise.resolve();
		await Promise.resolve();

		let roots = 0;
		app.vault.getRoot = () => { roots++; return workingRoot(); };
		refresh.click();
		await vi.waitFor(() => expect(roots).toBe(1));
	});

	test("keeps hidden changes dirty and refreshes them on the next mount", async () => {
		let reads = 0;
		const { view, app, vault } = await mountChart(["a.md"], {}, (fakeApp) => {
			fakeApp.vault.cachedRead = () => {
				reads++;
				return Promise.resolve("words must stay lazy");
			};
		});
		const controller = view.sunburstController();
		const file = vault.getAbstractFileByPath("a.md") as TFile;
		expect(centerText(view).value).toBe("1.0 KB");

		controller.unmount();
		file.stat = { ...file.stat, size: 4096, mtime: file.stat.mtime + 1 };
		app.vault.trigger("modify", file);
		await Promise.resolve();

		expect(controller.el.querySelector(".column-explorer-du-center-value")?.textContent).toBe("1.0 KB");
		expect(reads).toBe(0);

		const host = document.body.createDiv();
		controller.mount(host);
		await vi.waitFor(() => {
			expect(controller.el.querySelector(".column-explorer-du-center-value")?.textContent).toBe("4.0 KB");
		});
		expect(reads).toBe(0);
	});

	test("an event during a word scan cannot leave a stale count", async () => {
		let reads = 0;
		let finishFirstRead: ((content: string) => void) | undefined;
		const { view, app, vault } = await mountChart(["a.md"], {}, (fakeApp) => {
			fakeApp.vault.cachedRead = () => {
				reads++;
				if (reads === 1) {
					return new Promise<string>((resolve) => { finishFirstRead = resolve; });
				}
				return Promise.resolve("new words");
			};
		});
		const words = view.contentEl.querySelectorAll<HTMLButtonElement>(".column-explorer-du-seg-btn")[1];
		const file = vault.getAbstractFileByPath("a.md") as TFile;

		words.click();
		await vi.waitFor(() => expect(reads).toBe(1));
		file.stat = { ...file.stat, mtime: file.stat.mtime + 1 };
		app.vault.trigger("modify", file);
		finishFirstRead?.("old");

		await vi.waitFor(() => expect(reads).toBe(2));
		await vi.waitFor(() => expect(centerText(view).value).toBe("2 words"));
	});

	test("mounting the same chart does not restart an active word scan", async () => {
		let reads = 0;
		let finishRead: ((content: string) => void) | undefined;
		const { view } = await mountChart(["a.md"], {}, (fakeApp) => {
			fakeApp.vault.cachedRead = () => {
				reads++;
				return new Promise<string>((resolve) => { finishRead = resolve; });
			};
		});
		const controller = view.sunburstController();
		const words = view.contentEl.querySelectorAll<HTMLButtonElement>(".column-explorer-du-seg-btn")[1];

		words.click();
		await vi.waitFor(() => expect(reads).toBe(1));
		controller.mount(document.body.createDiv());
		finishRead?.("one");

		await vi.waitFor(() => {
			expect(controller.el.querySelector(".column-explorer-du-center-value")?.textContent).toBe("1 word");
		});
		expect(reads).toBe(1);
	});

	test("destroyed controller ignores later vault events", async () => {
		let reads = 0;
		const { view, app, vault } = await mountChart(["a.md"], {}, (fakeApp) => {
			fakeApp.vault.cachedRead = () => {
				reads++;
				return Promise.resolve("one");
			};
		});
		const controller = view.sunburstController();
		controller.onunload();

		app.vault.trigger("modify", vault.getAbstractFileByPath("a.md") as TFile);
		await Promise.resolve();

		expect(reads).toBe(0);
		expect(controller.el.isConnected).toBe(false);
	});
});

describe("hover", () => {
	test("shows a tooltip with the node name and hides it on mouseout", async () => {
		const { view } = await mountChart(["notes/a.md", "other/b.md"]);
		const arc = arcFor(view, "notes")!;

		fire(arc, "mouseover");
		const tooltip = view.contentEl.querySelector(".column-explorer-du-tooltip");
		expect(tooltip?.classList.contains("is-visible")).toBe(true);
		expect(tooltip?.querySelector(".column-explorer-du-tip-name")?.textContent).toBe("notes");
		expect(centerText(view).name).toBe("notes");

		fire(arc, "mouseout");
		expect(tooltip?.classList.contains("is-visible")).toBe(false);
		expect(centerText(view).name).toBe("TestVault");
	});

	test("highlights the hovered folder together with its descendants", async () => {
		const { view } = await mountChart(["notes/a.md", "other/b.md"]);

		fire(arcFor(view, "notes")!, "mouseover");

		expect(arcFor(view, "notes/a.md")?.classList.contains("is-highlighted")).toBe(true);
		expect(arcFor(view, "other")?.classList.contains("is-highlighted")).toBe(false);
	});
});

describe("context menu", () => {
	test("a folder offers zoom, reveal and copy path", async () => {
		const { view } = await mountChart(["notes/a.md", "other/b.md"]);

		fire(arcFor(view, "notes")!, "contextmenu");

		const titles = capturedMenus.flatMap((m) => m.items.map((i) => i.title));
		expect(titles).toEqual(["Zoom in", "Reveal in columns", "Copy path"]);
	});

	test("a file offers opening in a new tab, and the item works", async () => {
		const { view, app } = await mountChart(["a.md"]);

		fire(arcFor(view, "a.md")!, "contextmenu");
		const open = capturedMenus[0].items.find((i) => i.title === "Open in new tab");
		open?.callback?.();

		expect(app.opened).toEqual(["a.md"]);
	});

	test("zooming from the menu moves the breadcrumbs", async () => {
		const { view } = await mountChart(["notes/a.md", "other/b.md"]);

		fire(arcFor(view, "notes")!, "contextmenu");
		capturedMenus[0].items.find((i) => i.title === "Zoom in")?.callback?.();

		expect(crumbs(view)).toEqual(["TestVault", "notes"]);
	});
});

describe("excluded folders", () => {
	test("skip the listed paths when scanning", async () => {
		const { view } = await mountChart(["notes/a.md", "attachments/big.png"], {
			storageExcluded: "attachments",
		});

		expect(arcFor(view, "notes")).not.toBeNull();
		expect(arcFor(view, "attachments")).toBeNull();
	});
});
