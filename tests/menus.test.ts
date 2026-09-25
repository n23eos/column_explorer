import { beforeEach, describe, expect, test, vi } from "vitest";
import { FileSystemAdapter, Platform, TAbstractFile, TFile, TFolder } from "obsidian";
// Menu — из мока: тест читает накопленные пункты, которых нет в публичном API
import { Menu, MenuItem, createdNotices, resetNotices } from "./__mocks__/obsidian";
import {
	showColumnHeaderMenu, showFileMenu, showFolderBackgroundMenu,
	showColumnSortMenu, showMobileCreateMenu, showMobileMoreMenu, showRecentsMenu, showSortMenu,
} from "../src/menus";
import { t } from "../src/i18n";
import { FolderSuggestModal, QuickLookModal } from "../src/modals";
import { makeVault } from "./setup/vault";
import { makeView } from "./setup/view";

/**
 * Мок Menu копит пункты; заголовок бывает строкой или фрагментом
 * (у цветов — точка + подпись), поэтому сравниваем по тексту.
 */
function menuTitles(): string[] {
	const titles = (menu: Menu): string[] => menu.items.flatMap((item) => [
		typeof item.title === "string" ? item.title : item.title.textContent ?? "",
		...(item.submenu ? titles(item.submenu) : []),
	]);
	return capturedMenus.flatMap(titles);
}

function clickItem(title: string) {
	const visit = (menu: Menu): boolean => {
		const item = menu.items.find((i) => (typeof i.title === "string" ? i.title : i.title.textContent) === title);
		if (item?.callback) { item.callback(); return true; }
		return menu.items.some((i) => i.submenu ? visit(i.submenu) : false);
	};
	for (const menu of capturedMenus) {
		if (visit(menu)) return;
	}
	throw new Error(`no menu item: ${title}`);
}

function topLevelTitles(menu = capturedMenus[0]): string[] {
	return menu.items.map((item) => typeof item.title === "string" ? item.title : item.title.textContent ?? "");
}

let capturedMenus: Menu[] = [];

function setup(paths: string[], settings = {}) {
	const vault = makeVault(paths);
	const view = makeView(vault, { settings });
	const app = view.app as unknown as Record<string, unknown>;
	app.workspace = {
		...(app.workspace as object),
		trigger: () => { /* пункты ядра в тесте не нужны */ },
		getLeaf: () => ({ openFile: () => Promise.resolve() }),
		getActiveFile: () => null,
	};
	app.metadataCache = { fileToLinktext: (f: TAbstractFile) => f.path };
	app.fileManager = { ...(app.fileManager as object), generateMarkdownLink: (f: TAbstractFile) => `[](${f.path})` };
	(app.vault as Record<string, unknown>).adapter = {};
	(app.vault as Record<string, unknown>).getName = () => "TestVault";
	return { vault, view };
}

const mouse = () => new MouseEvent("contextmenu");

beforeEach(() => {
	document.body.innerHTML = "";
	capturedMenus = [];
});

/**
 * Перехват всех создаваемых меню: пункты складываются в capturedMenus,
 * иначе до колбэков внутри меню не добраться — showAtMouseEvent их не отдаёт.
 */
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

describe("showFileMenu on a file", () => {
	test("offers open, duplicate, rename and delete", () => {
		const { view, vault } = setup(["a.md"]);

		showFileMenu(view, mouse(), vault.getAbstractFileByPath("a.md") as TAbstractFile, 0);

		const titles = menuTitles();
		expect(titles).toContain(t("openNewTab"));
		expect(titles).toContain(t("duplicate"));
		expect(titles).toContain(t("rename"));
		expect(titles).toContain(t("delete"));
	});

	test("mobile Quick Look receives the visible file order", () => {
		Platform.isMobile = true;
		const open = vi.spyOn(QuickLookModal.prototype, "open").mockImplementation(() => { /* no-op */ });
		try {
			const { view, vault } = setup(["a.md", "b.md"]);
			const file = vault.getAbstractFileByPath("a.md") as TFile;
			const files = [file, vault.getAbstractFileByPath("b.md") as TFile];
			const quickLookFiles = vi.fn(() => files);
			Object.assign(view, { quickLookFiles });

			showFileMenu(view, mouse(), file, 0);
			clickItem(t("preview"));

			expect(quickLookFiles).toHaveBeenCalledWith(file, 0);
			expect(open).toHaveBeenCalledOnce();
		} finally {
			open.mockRestore();
			Platform.isMobile = false;
		}
	});

	test("pin adds the path without mutating the previous settings object", () => {
		const { view, vault } = setup(["a.md", "b.md"], { pinnedPaths: { "b.md": 0 } });
		const before = view.plugin.settings.pinnedPaths;

		showFileMenu(view, mouse(), vault.getAbstractFileByPath("a.md") as TAbstractFile, 0);
		clickItem(t("pin"));

		expect(view.plugin.settings.pinnedPaths).toEqual({ "b.md": 0, "a.md": 1 });
		expect(before).toEqual({ "b.md": 0 });
	});

	test("unpin removes only that path", () => {
		const { view, vault } = setup(["a.md", "b.md"], { pinnedPaths: { "a.md": 0, "b.md": 1 } });

		showFileMenu(view, mouse(), vault.getAbstractFileByPath("a.md") as TAbstractFile, 0);
		clickItem(t("unpin"));

		expect(view.plugin.settings.pinnedPaths).toEqual({ "b.md": 1 });
	});

	test("copies link items are offered for files", () => {
		const { view, vault } = setup(["a.md"]);

		showFileMenu(view, mouse(), vault.getAbstractFileByPath("a.md") as TAbstractFile, 0);

		expect(menuTitles()).toContain(t("copyWikiLink"));
		expect(menuTitles()).toContain(t("copyMdLink"));
	});

	test("groups path and link formats under Copy as", () => {
		const { view, vault } = setup(["a.md"]);

		showFileMenu(view, mouse(), vault.getAbstractFileByPath("a.md") as TAbstractFile, 0);

		const titles = topLevelTitles();
		expect(titles).toContain(t("copyAs"));
		expect(titles).not.toContain(t("copyPath"));
		expect(titles).not.toContain(t("copyWikiLink"));
		const copyAs = capturedMenus[0].items.find((item) => item.title === t("copyAs"));
		expect(copyAs?.submenu?.items.map((item) => item.title)).toEqual([
			t("copyPath"), t("copyWikiLink"), t("copyMdLink"), t("copyObsidianUrl"),
		]);
	});

	test("falls back to flat copy formats when submenus are unavailable", () => {
		const descriptor = Object.getOwnPropertyDescriptor(MenuItem.prototype, "setSubmenu");
		Reflect.deleteProperty(MenuItem.prototype, "setSubmenu");
		try {
			const { view, vault } = setup(["a.md"]);

			showFileMenu(view, mouse(), vault.getAbstractFileByPath("a.md") as TAbstractFile, 0);

			expect(topLevelTitles()).toContain(t("copyPath"));
			expect(topLevelTitles()).toContain(t("copyWikiLink"));
		} finally {
			if (descriptor) Object.defineProperty(MenuItem.prototype, "setSubmenu", descriptor);
		}
	});

	test("puts delete in the final block after file-menu extensions", () => {
		const { view, vault } = setup(["a.md"]);
		Object.assign(view.app.workspace as object, {
			trigger: (_name: string, menu: Menu) => menu.addItem((item) => item.setTitle("Extension action")),
		});

		showFileMenu(view, mouse(), vault.getAbstractFileByPath("a.md") as TAbstractFile, 0);

		const menu = capturedMenus[0];
		const titles = topLevelTitles(menu);
		expect(titles[titles.length - 2]).toBe("Extension action");
		expect(titles[titles.length - 1]).toBe(t("delete"));
		expect(menu.separatorIndices[menu.separatorIndices.length - 1]).toBe(titles.length - 1);
	});

	test("passes the moved path to the folder picker", () => {
		const { view, vault } = setup(["a.md", "folder/b.md"]);
		const opened: FolderSuggestModal[] = [];
		const open = vi.spyOn(FolderSuggestModal.prototype, "open")
			.mockImplementation(function (this: FolderSuggestModal) { opened.push(this); });

		showFileMenu(view, mouse(), vault.getAbstractFileByPath("a.md") as TAbstractFile, 0);
		clickItem(t("moveTo"));

		expect(opened[0].getItems().map((folder) => folder.path)).toEqual(["folder"]);
		open.mockRestore();
	});
});

describe("showFileMenu on a folder", () => {
	test("offers creation items and folder color", () => {
		const { view, vault } = setup(["sub/a.md"]);

		showFileMenu(view, mouse(), vault.getAbstractFileByPath("sub") as TFolder, 0);

		const titles = menuTitles();
		expect(titles).toContain(t("newNote"));
		expect(titles).toContain(t("newFolder"));
		expect(titles).toContain(t("folderColor"));
	});

	test("does not offer file-only link items", () => {
		const { view, vault } = setup(["sub/a.md"]);

		showFileMenu(view, mouse(), vault.getAbstractFileByPath("sub") as TFolder, 0);

		expect(menuTitles()).not.toContain(t("copyWikiLink"));
	});

	test("picking a color stores it without touching other folders", () => {
		const { view, vault } = setup(["sub/a.md", "other/"], { folderColors: { other: "red" } });

		showFileMenu(view, mouse(), vault.getAbstractFileByPath("sub") as TFolder, 0);
		clickItem(t("colorRed"));

		expect(view.plugin.settings.folderColors).toEqual({ other: "red", sub: "red" });
	});
});

describe("showFileMenu with a multi-selection", () => {
	test("switches to bulk actions", () => {
		const { view, vault } = setup(["a.md", "b.md"]);
		view.multiSelDepth = 0;
		view.multiSel.add("a.md");
		view.multiSel.add("b.md");

		showFileMenu(view, mouse(), vault.getAbstractFileByPath("a.md") as TAbstractFile, 0);

		const menu = capturedMenus[0];
		const titles = topLevelTitles(menu);
		expect(titles).toContain(t("deleteN", { n: 2 }));
		expect(titles).not.toContain(t("rename"));
		expect(titles[titles.length - 1]).toBe(t("deleteN", { n: 2 }));
		expect(menu.separatorIndices[menu.separatorIndices.length - 1]).toBe(titles.length - 1);
	});

	// «Дублировать N» не должно молча пропускать папки: одиночное меню и
	// мобильная панель действий их дублируют
	test("bulk duplicate covers folders as well as files", async () => {
		const { view, vault } = setup(["docs/note.md", "a.md"]);
		const copied: string[] = [];
		const createdFolders: string[] = [];
		Object.assign(view.app.vault as unknown as Record<string, unknown>, {
			copy: (f: TAbstractFile, path: string) => { copied.push(path); return Promise.resolve(); },
			createFolder: (path: string) => { createdFolders.push(path); return Promise.resolve(); },
		});
		view.multiSelDepth = 0;
		view.multiSel.add("docs");
		view.multiSel.add("a.md");

		showFileMenu(view, mouse(), vault.getAbstractFileByPath("a.md") as TAbstractFile, 0);
		clickItem(t("duplicateN", { n: 2 }));
		await vi.waitFor(() => expect(copied).toContain("a copy.md"));

		expect(createdFolders).toEqual(["docs copy"]);
	});
});

describe("column header menu", () => {
	test("sets a per-folder sort override", () => {
		const { view, vault } = setup(["sub/a.md"]);

		showColumnHeaderMenu(view, mouse(), vault.getAbstractFileByPath("sub") as TFolder);
		clickItem(t("sortNameDesc"));

		expect(view.plugin.settings.columnSortModes).toEqual({ sub: "name-desc" });
	});

	test("the default item clears the override", () => {
		const { view, vault } = setup(["sub/a.md"], { columnSortModes: { sub: "name-desc" } });

		showColumnHeaderMenu(view, mouse(), vault.getAbstractFileByPath("sub") as TFolder);
		clickItem(t("sortDefault"));

		expect(view.plugin.settings.columnSortModes).toEqual({});
	});

	test("the visible control opens the same sort actions from the keyboard", () => {
		const { view, vault } = setup(["sub/a.md"]);
		const anchor = document.body.createEl("button");

		showColumnSortMenu(
			view,
			new KeyboardEvent("keydown", { key: "Enter" }),
			vault.getAbstractFileByPath("sub") as TFolder,
			anchor,
		);

		expect(menuTitles()).toContain(t("sortDefault"));
		expect(menuTitles()).toContain(t("sortNameAsc"));
		clickItem(t("sortSizeDesc"));
		expect(view.plugin.settings.columnSortModes).toEqual({ sub: "size-desc" });
	});
});

describe("other menus", () => {
	test("background menu offers only creation items", () => {
		const { view, vault } = setup(["sub/a.md"]);

		showFolderBackgroundMenu(view, mouse(), vault.getAbstractFileByPath("sub") as TFolder);

		expect(menuTitles()).toEqual([t("newNote"), t("newFolder"), t("newCanvas")]);
	});

	test("sort menu changes the global sort mode", () => {
		const { view } = setup(["a.md"]);

		showSortMenu(view, mouse());
		clickItem(t("sortMtimeDesc"));

		expect(view.plugin.settings.sortMode).toBe("mtime-desc");
	});
});

describe("mobile menus", () => {
	test("the create menu offers note, folder and canvas", () => {
		const { view } = setup(["a.md"]);

		showMobileCreateMenu(view, mouse());

		expect(menuTitles()).toEqual([t("newNote"), t("newFolder"), t("newCanvas")]);
	});

	test("the more menu offers reveal, collapse and sorting", () => {
		const { view } = setup(["a.md"]);
		Object.assign(view, { revealFile: vi.fn(), collapseToRoot: vi.fn() });

		showMobileMoreMenu(view, mouse());

		const titles = menuTitles();
		expect(titles).toContain(t("reveal"));
		expect(titles).toContain(t("collapse"));
		expect(titles).toContain(t("sort"));
	});

	test("sort items fall back into the parent menu when submenus are unavailable", () => {
		const descriptor = Object.getOwnPropertyDescriptor(MenuItem.prototype, "setSubmenu");
		Reflect.deleteProperty(MenuItem.prototype, "setSubmenu");
		try {
			const { view } = setup(["a.md"]);

			showMobileMoreMenu(view, mouse());

			// Без setSubmenu пункты сортировки лежат плоско рядом с остальными
			expect(topLevelTitles()).toContain(t("sortNameAsc"));
		} finally {
			if (descriptor) Object.defineProperty(MenuItem.prototype, "setSubmenu", descriptor);
		}
	});

	test("collapse from the more menu calls the view", () => {
		const { view } = setup(["a.md"]);
		const collapse = vi.fn();
		Object.assign(view, { revealFile: vi.fn(), collapseToRoot: collapse });

		showMobileMoreMenu(view, mouse());
		clickItem(t("collapse"));

		expect(collapse).toHaveBeenCalled();
	});
});

describe("folder icon items", () => {
	test("a folder without a custom icon offers only the picker", () => {
		const { view, vault } = setup(["sub/a.md"]);

		showFileMenu(view, mouse(), vault.getAbstractFileByPath("sub") as TFolder, 0);

		expect(menuTitles()).toContain(t("folderIcon"));
		expect(menuTitles()).not.toContain(t("folderIconReset"));
	});

	test("a folder with a custom icon also offers the reset", () => {
		const { view, vault } = setup(["sub/a.md"], { folderIcons: { sub: "star" } });

		showFileMenu(view, mouse(), vault.getAbstractFileByPath("sub") as TFolder, 0);

		expect(menuTitles()).toContain(t("folderIconReset"));
	});

	test("resetting the icon drops only that folder key", () => {
		const { view, vault } = setup(["sub/a.md", "other/"], { folderIcons: { sub: "star", other: "folder" } });

		showFileMenu(view, mouse(), vault.getAbstractFileByPath("sub") as TFolder, 0);
		clickItem(t("folderIconReset"));

		expect(view.plugin.settings.folderIcons).toEqual({ other: "folder" });
	});

	test("clearing a folder colour leaves other folders coloured", () => {
		const { view, vault } = setup(["sub/a.md", "other/"], { folderColors: { sub: "red", other: "blue" } });

		showFileMenu(view, mouse(), vault.getAbstractFileByPath("sub") as TFolder, 0);
		clickItem(t("colorDefault"));

		expect(view.plugin.settings.folderColors).toEqual({ other: "blue" });
	});
});

describe("favorites in the file menu", () => {
	test("offers to add a file that is not a favorite yet", () => {
		const { view, vault } = setup(["a.md"], { favorites: [] });

		showFileMenu(view, mouse(), vault.getAbstractFileByPath("a.md") as TAbstractFile, 0);
		clickItem(t("addFavorite"));

		expect(view.plugin.settings.favorites).toEqual(["a.md"]);
	});

	test("offers to remove one that already is", () => {
		const { view, vault } = setup(["a.md"], { favorites: ["a.md"] });

		showFileMenu(view, mouse(), vault.getAbstractFileByPath("a.md") as TAbstractFile, 0);
		clickItem(t("removeFavorite"));

		expect(view.plugin.settings.favorites).toEqual([]);
	});
});

describe("clipboard menu items", () => {
	test("copy and cut hand the file to the view clipboard", () => {
		const { view, vault } = setup(["a.md"]);
		const copyItems = vi.fn();
		Object.assign(view, { copyItems });

		showFileMenu(view, mouse(), vault.getAbstractFileByPath("a.md") as TAbstractFile, 0);
		clickItem(t("copy"));
		clickItem(t("cut"));

		expect(copyItems).toHaveBeenNthCalledWith(1, ["a.md"], false);
		expect(copyItems).toHaveBeenNthCalledWith(2, ["a.md"], true);
	});

	test("paste on a folder pastes into that folder", () => {
		const { view, vault } = setup(["sub/a.md"]);
		const pasteClipboard = vi.fn();
		Object.assign(view, { pasteClipboard, hasFileClipboard: () => true });

		showFileMenu(view, mouse(), vault.getAbstractFileByPath("sub") as TFolder, 0);
		clickItem(t("paste"));

		expect(pasteClipboard).toHaveBeenCalledWith(vault.getAbstractFileByPath("sub"));
	});

	test("paste is absent while the clipboard is empty", () => {
		const { view, vault } = setup(["sub/a.md"]);

		showFileMenu(view, mouse(), vault.getAbstractFileByPath("sub") as TFolder, 0);

		expect(menuTitles()).not.toContain(t("paste"));
	});

	test("the column background menu offers paste into the column folder", () => {
		const { view, vault } = setup(["sub/a.md"]);
		const pasteClipboard = vi.fn();
		Object.assign(view, { pasteClipboard, hasFileClipboard: () => true });

		showFolderBackgroundMenu(view, mouse(), vault.getAbstractFileByPath("sub") as TFolder);
		clickItem(t("paste"));

		expect(pasteClipboard).toHaveBeenCalledWith(vault.getAbstractFileByPath("sub"));
	});
});

describe("recents menu", () => {
	test("clear recents empties the tracked list", () => {
		const { view } = setup(["a.md"]);
		view.plugin.settings.recentFiles = ["a.md"];

		showRecentsMenu(view, mouse());
		clickItem(t("clearRecents"));

		expect(view.plugin.settings.recentFiles).toEqual([]);
	});
});

describe("copy items", () => {
	/** Перехват записи в буфер обмена — navigator.clipboard в happy-dom нет. */
	function stubClipboard(): string[] {
		const written: string[] = [];
		Object.defineProperty(globalThis.navigator, "clipboard", {
			configurable: true,
			value: { writeText: (text: string) => { written.push(text); return Promise.resolve(); } },
		});
		return written;
	}

	test("failed clipboard write shows an error notice", async () => {
		resetNotices();
		Object.defineProperty(globalThis.navigator, "clipboard", {
			configurable: true,
			value: { writeText: () => Promise.reject(new Error("denied")) },
		});
		const { view, vault } = setup(["a.md"]);

		showFileMenu(view, mouse(), vault.getAbstractFileByPath("a.md") as TAbstractFile, 0);
		clickItem(t("copyPath"));

		await vi.waitFor(() => expect(createdNotices).toHaveLength(1));
		expect(createdNotices[0].message).toBe(t("copyFailed"));
	});

	test("copy path writes the vault-relative path", () => {
		const written = stubClipboard();
		const { view, vault } = setup(["sub/a.md"]);

		showFileMenu(view, mouse(), vault.getAbstractFileByPath("sub/a.md") as TAbstractFile, 0);
		clickItem(t("copyPath"));

		expect(written).toEqual(["sub/a.md"]);
	});

	test("copy wiki link wraps the link text in brackets", () => {
		const written = stubClipboard();
		const { view, vault } = setup(["a.md"]);

		showFileMenu(view, mouse(), vault.getAbstractFileByPath("a.md") as TAbstractFile, 0);
		clickItem(t("copyWikiLink"));

		expect(written).toEqual(["[[a.md]]"]);
	});

	test("copy markdown link uses the app generator", () => {
		const written = stubClipboard();
		const { view, vault } = setup(["a.md"]);

		showFileMenu(view, mouse(), vault.getAbstractFileByPath("a.md") as TAbstractFile, 0);
		clickItem(t("copyMdLink"));

		expect(written).toEqual(["[](a.md)"]);
	});

	test("copy obsidian url encodes vault and file", () => {
		const written = stubClipboard();
		const { view, vault } = setup(["sub/a b.md"]);

		showFileMenu(view, mouse(), vault.getAbstractFileByPath("sub/a b.md") as TAbstractFile, 0);
		clickItem(t("copyObsidianUrl"));

		expect(written[0]).toBe("obsidian://open?vault=TestVault&file=sub%2Fa%20b.md");
	});

	test("copy full path remains available inside Copy as on desktop", () => {
		const written = stubClipboard();
		const { view, vault } = setup(["sub/a b.md"]);
		(view.app.vault as unknown as Record<string, unknown>).adapter = new FileSystemAdapter();

		showFileMenu(view, mouse(), vault.getAbstractFileByPath("sub/a b.md") as TAbstractFile, 0);
		clickItem(t("copyFullPath"));

		expect(written).toEqual(["/vault/sub/a\\ b.md"]);
	});

	test("the absolute-path item is absent without a filesystem adapter", () => {
		const { view, vault } = setup(["a.md"]);

		showFileMenu(view, mouse(), vault.getAbstractFileByPath("a.md") as TAbstractFile, 0);

		expect(menuTitles()).not.toContain(t("copyFullPath"));
	});
});
