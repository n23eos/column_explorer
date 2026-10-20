import { beforeEach, describe, expect, test } from "vitest";
import { TFile, TFolder } from "obsidian";
import { disconnectListObservers, refreshUnreadMarker, renderColumn, renderColumnList } from "../src/column";
import { CALENDAR_PATH, RECENTS_PATH } from "../src/pure";
import { t } from "../src/i18n";
import { makeVault } from "./setup/vault";
import { makeView } from "./setup/view";
import { observerRegistry, resetObservers, triggerIntersection } from "./setup/obsidian-dom";

/** Корневой контейнер, куда рендерятся колонки — новый на каждый тест. */
function container(): HTMLElement {
	const el = document.createElement("div");
	document.body.appendChild(el);
	return el;
}

function folderOf(vault: ReturnType<typeof makeVault>, path: string): TFolder {
	const f = vault.getAbstractFileByPath(path);
	if (!(f instanceof TFolder)) throw new Error(`not a folder: ${path}`);
	return f;
}

function titles(list: HTMLElement): string[] {
	return Array.from(list.querySelectorAll(".column-explorer-item-title")).map((el) => el.textContent ?? "");
}

beforeEach(() => {
	document.body.innerHTML = "";
	resetObservers();
});

describe("renderColumnList", () => {
	test("renders one item per visible child, folders before files", () => {
		// Arrange
		const vault = makeVault(["notes/a.md", "notes/zsub/", "notes/b.md"]);
		const view = makeView(vault);
		const list = container();

		// Act
		renderColumnList(view, list, folderOf(vault, "notes"), 0);

		// Assert
		expect(titles(list)).toEqual(["zsub", "a", "b"]);
	});

	test("shows empty placeholder when folder has no children", () => {
		const vault = makeVault(["empty/"]);
		const list = container();

		renderColumnList(makeView(vault), list, folderOf(vault, "empty"), 0);

		expect(list.querySelector(".column-explorer-empty")).not.toBeNull();
		expect(list.querySelectorAll(".column-explorer-item")).toHaveLength(0);
	});

	test("marks selected item and its ancestors", () => {
		const vault = makeVault(["notes/sub/deep.md"]);
		const view = makeView(vault, { selection: ["notes", "notes/sub", "notes/sub/deep.md"] });
		const list = container();

		renderColumnList(view, list, vault.getRoot(), 0);

		const item = list.querySelector(".column-explorer-item");
		expect(item?.classList.contains("is-selected")).toBe(true);
		// Выделение продолжается глубже — предок цепочки, а не конечный выбор
		expect(item?.classList.contains("is-ancestor")).toBe(true);
		expect(item?.getAttribute("aria-selected")).toBe("true");
	});

	test("writes child count into the column header", () => {
		const vault = makeVault(["notes/a.md", "notes/b.md", "notes/c.md"]);
		const parent = container();

		renderColumn(makeView(vault), parent, folderOf(vault, "notes"), 0);

		expect(parent.querySelector(".column-explorer-column-count")?.textContent).toBe("3");
	});

	test("renders each item with its path in a data attribute", () => {
		const vault = makeVault(["notes/a.md"]);
		const list = container();

		renderColumnList(makeView(vault), list, folderOf(vault, "notes"), 0);

		expect(list.querySelector<HTMLElement>(".column-explorer-item")?.dataset.path).toBe("notes/a.md");
	});
});

describe("column sort button", () => {
	test("shows the effective global sort and marks it as inherited", () => {
		const vault = makeVault(["notes/a.md"]);
		const parent = container();

		renderColumn(makeView(vault, { settings: { sortMode: "mtime-desc" } }), parent, folderOf(vault, "notes"), 0);

		const button = parent.querySelector<HTMLButtonElement>(".column-explorer-sort-button");
		const description = t("sortInherited", { sort: t("sortMtimeDesc") });
		expect(button?.querySelector(".column-explorer-sort-label")?.textContent).toBe(`${t("modified")} ↓`);
		expect(button?.getAttribute("aria-label")).toBe(description);
		expect(button?.getAttribute("aria-haspopup")).toBe("menu");
		expect(button?.title).toBe(description);
		expect(button?.type).toBe("button");
	});

	test("shows a per-folder override and its direction", () => {
		const vault = makeVault(["notes/a.md"]);
		const parent = container();

		renderColumn(makeView(vault, {
			settings: { sortMode: "mtime-desc", columnSortModes: { notes: "name-asc" } },
		}), parent, folderOf(vault, "notes"), 0);

		const button = parent.querySelector<HTMLButtonElement>(".column-explorer-sort-button");
		expect(button?.querySelector(".column-explorer-sort-label")?.textContent).toBe(`${t("sortFieldName")} ↑`);
		expect(button?.getAttribute("aria-label")).toBe(t("sortFolder", { sort: t("sortNameAsc") }));
	});
});

describe("special items", () => {
	const specials = (path: string) => (path === RECENTS_PATH || path === CALENDAR_PATH ? path : null);

	test("appear only in the root column", () => {
		const vault = makeVault(["notes/a.md"]);
		const view = makeView(vault, { specialKind: specials });
		const rootList = container();
		const nestedList = container();

		renderColumnList(view, rootList, vault.getRoot(), 0);
		renderColumnList(view, nestedList, folderOf(vault, "notes"), 1);

		expect(rootList.querySelectorAll(".column-explorer-special")).toHaveLength(2);
		expect(nestedList.querySelectorAll(".column-explorer-special")).toHaveLength(0);
	});

	test("sit above regular items when configured to top", () => {
		const vault = makeVault(["notes/a.md"]);
		const view = makeView(vault, { specialKind: specials, settings: { specialItemsPosition: "top" } });
		const list = container();

		renderColumnList(view, list, vault.getRoot(), 0);

		const items = Array.from(list.querySelectorAll(".column-explorer-item"));
		expect(items[0].classList.contains("column-explorer-special")).toBe(true);
	});

	test("sit below regular items when configured to bottom", () => {
		const vault = makeVault(["notes/a.md"]);
		const view = makeView(vault, { specialKind: specials, settings: { specialItemsPosition: "bottom" } });
		const list = container();

		renderColumnList(view, list, vault.getRoot(), 0);

		const items = Array.from(list.querySelectorAll(".column-explorer-item"));
		expect(items[items.length - 1].classList.contains("column-explorer-special")).toBe(true);
	});
});

describe("incremental rendering of big folders", () => {
	/** 700 файлов — больше двух порций по RENDER_CHUNK = 300. */
	const bigVault = () => makeVault(Array.from({ length: 700 }, (_, i) => `big/f${String(i).padStart(3, "0")}.md`));

	test("renders only the first chunk plus a sentinel", () => {
		const vault = bigVault();
		const list = container();

		renderColumnList(makeView(vault), list, folderOf(vault, "big"), 0);

		expect(list.querySelectorAll(".column-explorer-item")).toHaveLength(300);
		expect(list.querySelector(".column-explorer-load-more")).not.toBeNull();
	});

	test("loads the next chunk when the sentinel becomes visible", () => {
		const vault = bigVault();
		const list = container();
		renderColumnList(makeView(vault), list, folderOf(vault, "big"), 0);

		triggerIntersection();

		expect(list.querySelectorAll(".column-explorer-item")).toHaveLength(600);
	});

	test("drops the sentinel and disconnects once everything is rendered", () => {
		const vault = bigVault();
		const list = container();
		renderColumnList(makeView(vault), list, folderOf(vault, "big"), 0);

		triggerIntersection();
		triggerIntersection();

		expect(list.querySelectorAll(".column-explorer-item")).toHaveLength(700);
		expect(list.querySelector(".column-explorer-load-more")).toBeNull();
		expect(observerRegistry.every((r) => r.disconnected)).toBe(true);
	});

	test("renders a bounded chunk around a far selected item", () => {
		const vault = bigVault();
		const view = makeView(vault, { selection: ["big/f450.md"] });
		const list = container();

		renderColumnList(view, list, folderOf(vault, "big"), 0);

		// Выделенный элемент должен быть в DOM сразу, иначе прокрутка к нему
		// после ре-рендера промахнётся
		expect(list.querySelector('[data-path="big/f450.md"]')).not.toBeNull();
		expect(list.querySelectorAll(".column-explorer-item")).toHaveLength(300);
		expect(list.querySelector('[data-path="big/f000.md"]')).toBeNull();
		triggerIntersection();
		expect(list.querySelectorAll(".column-explorer-item")).toHaveLength(700);
		expect(list.querySelector('[data-path="big/f000.md"]')).not.toBeNull();
	});

	test("re-render replaces the previous observer instead of stacking one more", () => {
		const vault = bigVault();
		const view = makeView(vault);
		const list = container();

		renderColumnList(view, list, folderOf(vault, "big"), 0);
		renderColumnList(view, list, folderOf(vault, "big"), 0);

		expect(observerRegistry).toHaveLength(2);
		expect(observerRegistry[0].disconnected).toBe(true);
		expect(observerRegistry[1].disconnected).toBe(false);
	});

	test("disconnectListObservers stops observers of every list in the container", () => {
		const vault = bigVault();
		const parent = container();
		renderColumn(makeView(vault), parent, folderOf(vault, "big"), 0);

		disconnectListObservers(parent);

		expect(observerRegistry.every((r) => r.disconnected)).toBe(true);
	});
});

/* --------------------- маркеры непрочитанного -------------------------- */

describe("unread markers", () => {
	/** Vault с одним файлом и заданными временами; baseline = 1000. */
	function setup(times: { ctime: number; mtime: number }, settings: Record<string, unknown> = {}) {
		const vault = makeVault(["notes/a.md"]);
		const file = vault.getAbstractFileByPath("notes/a.md") as TFile;
		file.stat = { ...file.stat, ...times };
		const view = makeView(vault, { settings: { unreadBaseline: 1000, ...settings } });
		const list = container();
		renderColumnList(view, list, folderOf(vault, "notes"), 0);
		return list.querySelector(".column-explorer-item") as HTMLElement;
	}

	test("файл, созданный после baseline и не открытый, получает бейдж New", () => {
		const item = setup({ ctime: 5000, mtime: 5000 });

		expect(item.hasClass("has-unread-new")).toBe(true);
		expect(item.querySelector(".column-explorer-item-badge")?.textContent).toBe(t("unreadNew"));
	});

	test("файл старше baseline маркера не получает", () => {
		const item = setup({ ctime: 500, mtime: 500 });

		expect(item.querySelector(".column-explorer-item-badge")).toBeNull();
		expect(item.querySelector(".column-explorer-item-dot")).toBeNull();
	});

	test("открытый и позже изменённый файл получает точку, а не бейдж", () => {
		const item = setup({ ctime: 500, mtime: 90_000 }, { seenAt: { "notes/a.md": 2000 } });

		expect(item.hasClass("has-unread-mod")).toBe(true);
		expect(item.querySelector(".column-explorer-item-dot")).not.toBeNull();
		expect(item.querySelector(".column-explorer-item-badge")).toBeNull();
	});

	test("прочитанный и с тех пор нетронутый файл чист", () => {
		const item = setup({ ctime: 500, mtime: 1500 }, { seenAt: { "notes/a.md": 2000 } });

		expect(item.querySelector(".column-explorer-item-dot")).toBeNull();
		expect(item.hasClass("has-unread-mod")).toBe(false);
	});

	test("выключенная настройка убирает маркеры совсем", () => {
		const item = setup({ ctime: 5000, mtime: 5000 }, { showUnreadMarkers: false });

		expect(item.querySelector(".column-explorer-item-badge")).toBeNull();
		expect(item.hasClass("has-unread-new")).toBe(false);
	});

	test("папки маркеров не получают", () => {
		const vault = makeVault(["notes/sub/x.md"]);
		const folder = vault.getAbstractFileByPath("notes/sub") as TFolder;
		// Папка «создана» позже baseline — файл на её месте был бы New
		(folder as unknown as { stat?: unknown }).stat = { ctime: 5000, mtime: 5000, size: 0 };
		const list = container();

		renderColumnList(makeView(vault, { settings: { unreadBaseline: 1000 } }), list, folderOf(vault, "notes"), 0);

		expect(list.querySelector(".column-explorer-item-badge")).toBeNull();
		expect(list.querySelector(".column-explorer-item-dot")).toBeNull();
	});
});

describe("refreshUnreadMarker", () => {
	test("фоновая правка зажигает точку без полного ре-рендера", () => {
		// Arrange: файл прочитан и чист
		const vault = makeVault(["notes/a.md"]);
		const file = vault.getAbstractFileByPath("notes/a.md") as TFile;
		file.stat = { ...file.stat, ctime: 500, mtime: 1500 };
		const view = makeView(vault, { settings: { unreadBaseline: 1000, seenAt: { "notes/a.md": 2000 } } });
		const list = container();
		renderColumnList(view, list, folderOf(vault, "notes"), 0);
		const item = list.querySelector(".column-explorer-item") as HTMLElement;
		expect(item.querySelector(".column-explorer-item-dot")).toBeNull();

		// Act: кто-то правит файл в фоне
		file.stat = { ...file.stat, mtime: 90_000 };
		refreshUnreadMarker(view, list, "notes/a.md");

		// Assert: тот же элемент, но с точкой
		expect(list.querySelector(".column-explorer-item")).toBe(item);
		expect(item.querySelector(".column-explorer-item-dot")).not.toBeNull();
	});

	test("прочтение гасит маркер и не плодит дублей", () => {
		const vault = makeVault(["notes/a.md"]);
		const file = vault.getAbstractFileByPath("notes/a.md") as TFile;
		file.stat = { ...file.stat, ctime: 5000, mtime: 5000 };
		const view = makeView(vault, { settings: { unreadBaseline: 1000 } });
		const list = container();
		renderColumnList(view, list, folderOf(vault, "notes"), 0);
		const item = list.querySelector(".column-explorer-item") as HTMLElement;
		expect(item.querySelector(".column-explorer-item-badge")).not.toBeNull();

		view.plugin.settings.seenAt = { "notes/a.md": 9000 };
		refreshUnreadMarker(view, list, "notes/a.md");

		expect(item.querySelectorAll(".column-explorer-item-badge")).toHaveLength(0);
		expect(item.hasClass("has-unread-new")).toBe(false);
	});

	test("путь, которого нет в DOM, ничего не ломает", () => {
		const vault = makeVault(["notes/a.md"]);
		const list = container();
		const view = makeView(vault);
		renderColumnList(view, list, folderOf(vault, "notes"), 0);

		expect(() => refreshUnreadMarker(view, list, "notes/gone.md")).not.toThrow();
	});
});

test("маркер стоит слева от названия и после точечного обновления тоже", () => {
	const vault = makeVault(["notes/a.md"]);
	const file = vault.getAbstractFileByPath("notes/a.md") as TFile;
	file.stat = { ...file.stat, ctime: 5000, mtime: 5000 };
	const view = makeView(vault, { settings: { unreadBaseline: 1000 } });
	const list = container();

	renderColumnList(view, list, folderOf(vault, "notes"), 0);
	const item = list.querySelector(".column-explorer-item") as HTMLElement;
	const positionOf = (sel: string) =>
		Array.from(item.children).findIndex((el) => el.matches(sel));
	expect(positionOf(".column-explorer-item-badge")).toBeLessThan(positionOf(".column-explorer-item-title"));

	refreshUnreadMarker(view, list, "notes/a.md");

	expect(positionOf(".column-explorer-item-badge")).toBeLessThan(positionOf(".column-explorer-item-title"));
});
