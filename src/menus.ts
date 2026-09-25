import { FileSystemAdapter, Menu, MenuItem, Notice, Platform, TFile, TFolder, TAbstractFile } from "obsidian";
import { t } from "./i18n";
import { SORT_MODE_VALUES, shellEscapePath } from "./pure";
import { duplicateFile, duplicateFolder, moveFiles } from "./fileops";
import { FolderSuggestModal, IconSuggestModal, QuickLookModal } from "./modals";
import { FOLDER_COLOR_KEYS, FolderColorKey, SortMode } from "./settings";
import type { ColumnExplorerView } from "./view";

export function sortLabel(mode: SortMode): string {
	const keys: Record<SortMode, string> = {
		"name-asc": "sortNameAsc", "name-desc": "sortNameDesc",
		"mtime-desc": "sortMtimeDesc", "mtime-asc": "sortMtimeAsc",
		"ctime-desc": "sortCtimeDesc", "ctime-asc": "sortCtimeAsc",
		"size-desc": "sortSizeDesc", "size-asc": "sortSizeAsc",
	};
	return t(keys[mode]);
}

function setFolderSortMode(view: ColumnExplorerView, folder: TFolder, mode: SortMode | null) {
	const rest = { ...view.plugin.settings.columnSortModes };
	if (mode === null) delete rest[folder.path];
	else rest[folder.path] = mode;
	view.plugin.settings.columnSortModes = rest;
	void view.plugin.saveSettings();
	view.render();
}

function fillFolderSortItems(view: ColumnExplorerView, target: Menu, folder: TFolder, afterChange?: () => void) {
	const apply = (mode: SortMode | null) => { setFolderSortMode(view, folder, mode); afterChange?.(); };
	const current = view.plugin.settings.columnSortModes[folder.path];
	target.addItem(i => i.setTitle(t("sortDefault")).setChecked(current === undefined)
		.onClick(() => apply(null)));
	for (const mode of SORT_MODE_VALUES) {
		target.addItem(i => i.setTitle(sortLabel(mode)).setChecked(current === mode)
			.onClick(() => apply(mode)));
	}
}

/** Folder sort menu used by the visible header button. */
export function showColumnSortMenu(
	view: ColumnExplorerView,
	e: MouseEvent | KeyboardEvent,
	folder: TFolder,
	anchor: HTMLElement,
) {
	const menu = new Menu();
	fillFolderSortItems(view, menu, folder, () => {
		view.columnsEl?.querySelector<HTMLElement>(
			`.column-explorer-column[data-folder-path="${CSS.escape(folder.path)}"] .column-explorer-sort-button`
		)?.focus();
	});
	if (e instanceof MouseEvent && e.detail > 0) {
		menu.showAtMouseEvent(e);
	} else {
		const rect = anchor.getBoundingClientRect();
		menu.showAtPosition({ x: rect.left, y: rect.bottom, width: rect.width }, anchor.ownerDocument);
	}
}

function copyToClipboard(text: string, notice: string) {
	// writeText реджектится при потере фокуса окна — без catch юзер уверен,
	// что скопировано, а буфер пуст
	navigator.clipboard.writeText(text).then(
		() => new Notice(notice),
		() => new Notice(t("copyFailed"))
	);
}

function colorMenuTitle(colorKey: FolderColorKey | null, label: string): DocumentFragment {
	return createFragment((frag) => {
		const dot = frag.createSpan({ cls: "column-explorer-color-dot" });
		if (colorKey) dot.style.setProperty("--ce-dot-color", `var(--color-${colorKey})`);
		else dot.addClass("is-default");
		const text = frag.createSpan({ text: label });
		// Красим и сам текст пункта — цвет виден сразу, а не только точкой
		if (colorKey) text.style.color = `var(--color-${colorKey})`;
	});
}

function addSubmenu(menu: Menu, title: string, icon: string, fillItems: (target: Menu) => void) {
	menu.addItem((item: MenuItem) => {
		item.setTitle(title).setIcon(icon);
		// setSubmenu есть в рантайме Obsidian, но отсутствует в публичных типах.
		// На старом или изменённом API сохраняем действия в родительском меню.
		const withSubmenu = item as MenuItem & { setSubmenu?: () => Menu };
		if (typeof withSubmenu.setSubmenu === "function") {
			fillItems(withSubmenu.setSubmenu());
		} else {
			fillItems(menu);
		}
	});
}

function addFolderColorMenu(view: ColumnExplorerView, menu: Menu, folder: TFolder) {
	const current = view.plugin.settings.folderColors[folder.path];
	const capitalized = (k: string) => "color" + k.charAt(0).toUpperCase() + k.slice(1);

	const fillColorItems = (target: Menu) => {
		for (const key of FOLDER_COLOR_KEYS) {
			target.addItem(i => i
				.setTitle(colorMenuTitle(key, t(capitalized(key))))
				.setChecked(current === key)
				.onClick(async () => {
					view.plugin.settings.folderColors = {
						...view.plugin.settings.folderColors,
						[folder.path]: key,
					};
					await view.plugin.saveSettings();
					view.render();
				}));
		}
		target.addSeparator();
		target.addItem(i => i
			.setTitle(colorMenuTitle(null, t("colorDefault")))
			.setChecked(!current)
			.onClick(async () => {
				// Сбрасываем только эту папку — цвета вложенных папок не трогаем
				const rest = { ...view.plugin.settings.folderColors };
				delete rest[folder.path];
				view.plugin.settings.folderColors = rest;
				await view.plugin.saveSettings();
				view.render();
			}));
	};

	addSubmenu(menu, t("folderColor"), "palette", fillColorItems);
}

export function showFileMenu(view: ColumnExplorerView, e: MouseEvent, f: TAbstractFile, depth: number) {
	const app = view.app;
	const menu = new Menu();
	const multi = view.multiSelDepth === depth && view.multiSel.has(f.path) && view.multiSel.size > 1;

	if (multi) {
		const paths = [...view.multiSel];
		menu.addItem(i => i.setTitle(t("copy")).setIcon("copy")
			.onClick(() => view.copyItems(paths, false)));
		menu.addItem(i => i.setTitle(t("cut")).setIcon("scissors")
			.onClick(() => view.copyItems(paths, true)));
		menu.addItem(i => i.setTitle(t("moveTo")).setIcon("folder-input")
			.onClick(() => new FolderSuggestModal(app, (target) => {
				void moveFiles(app, paths, target).then(() => view.clearMulti());
			}, paths).open()));
		menu.addItem(i => i.setTitle(t("duplicateN", { n: paths.length })).setIcon("copy")
			.onClick(async () => {
				for (const p of paths) {
					const file = app.vault.getAbstractFileByPath(p);
					if (file instanceof TFile) await duplicateFile(app, file);
					else if (file instanceof TFolder) await duplicateFolder(app, file);
				}
			}));
		menu.addSeparator();
		menu.addItem(i => i.setTitle(t("deleteN", { n: paths.length })).setIcon("trash")
			.onClick(() => view.deleteMany(paths)));
		menu.showAtMouseEvent(e);
		return;
	}

	if (f instanceof TFolder) {
		menu.addItem(i => i.setTitle(t("newNote")).setIcon("file-plus")
			.onClick(() => view.createNote(f)));
		menu.addItem(i => i.setTitle(t("newFolder")).setIcon("folder-plus")
			.onClick(() => view.createFolder(f)));
		menu.addItem(i => i.setTitle(t("duplicate")).setIcon("copy")
			.onClick(() => void duplicateFolder(app, f)));
		if (view.hasFileClipboard()) {
			menu.addItem(i => i.setTitle(t("paste")).setIcon("clipboard-paste")
				.onClick(() => view.pasteClipboard(f)));
		}
		addFolderColorMenu(view, menu, f);
		addFolderIconItems(view, menu, f);
		menu.addSeparator();
	}

	if (f instanceof TFile) {
		// На телефоне колонки превью нет — Quick Look открывается из меню
		if (Platform.isMobile) {
			menu.addItem(i => i.setTitle(t("preview")).setIcon("eye")
				.onClick(() => new QuickLookModal(app, view, f, view.quickLookFiles(f, depth)).open()));
		}
		menu.addItem(i => i.setTitle(t("openNewTab")).setIcon("file-plus-2")
			.onClick(() => app.workspace.getLeaf("tab").openFile(f)));
		menu.addItem(i => i.setTitle(t("openRight")).setIcon("separator-vertical")
			.onClick(() => app.workspace.getLeaf("split").openFile(f)));
		menu.addSeparator();
		menu.addItem(i => i.setTitle(t("duplicate")).setIcon("copy")
			.onClick(() => duplicateFile(app, f)));
	}

	menu.addItem(i => i.setTitle(t("copy")).setIcon("copy")
		.onClick(() => view.copyItems([f.path], false)));
	menu.addItem(i => i.setTitle(t("cut")).setIcon("scissors")
		.onClick(() => view.copyItems([f.path], true)));

	const isPinned = view.plugin.settings.pinnedPaths[f.path] !== undefined;
	menu.addItem(i => i.setTitle(isPinned ? t("unpin") : t("pin")).setIcon(isPinned ? "pin-off" : "pin")
		.onClick(async () => {
			const pinned = { ...view.plugin.settings.pinnedPaths };
			if (isPinned) {
				delete pinned[f.path];
			} else {
				const orders = Object.values(pinned);
				pinned[f.path] = orders.length > 0 ? Math.max(...orders) + 1 : 0;
			}
			view.plugin.settings.pinnedPaths = pinned;
			await view.plugin.saveSettings();
			view.render();
		}));
	const isFav = view.isFavorite(f.path);
	menu.addItem(i => i.setTitle(isFav ? t("removeFavorite") : t("addFavorite")).setIcon(isFav ? "star-off" : "star")
		.onClick(() => view.toggleFavorite(f.path)));
	menu.addItem(i => i.setTitle(t("moveTo")).setIcon("folder-input")
		.onClick(() => new FolderSuggestModal(app, (target) => void moveFiles(app, [f.path], target), [f.path]).open()));
	menu.addItem(i => i.setTitle(t("rename")).setIcon("pencil")
		.onClick(() => view.startRename(f)));

	addSubmenu(menu, t("copyAs"), "copy", (target) => {
		target.addItem(i => i.setTitle(t("copyPath")).setIcon("clipboard-copy")
			.onClick(() => copyToClipboard(f.path, t("pathCopied"))));
		// Полный системный путь доступен только у desktop filesystem adapter.
		const adapter = app.vault.adapter;
		if (adapter instanceof FileSystemAdapter) {
			target.addItem(i => i.setTitle(t("copyFullPath")).setIcon("terminal")
				.onClick(() => copyToClipboard(shellEscapePath(adapter.getBasePath() + "/" + f.path), t("pathCopied"))));
		}
		if (f instanceof TFile) {
			target.addItem(i => i.setTitle(t("copyWikiLink")).setIcon("brackets")
				.onClick(() => copyToClipboard("[[" + app.metadataCache.fileToLinktext(f, "", false) + "]]", t("linkCopied"))));
			target.addItem(i => i.setTitle(t("copyMdLink")).setIcon("link")
				.onClick(() => copyToClipboard(app.fileManager.generateMarkdownLink(f, ""), t("linkCopied"))));
			target.addItem(i => i.setTitle(t("copyObsidianUrl")).setIcon("external-link")
				.onClick(() => {
					const url = "obsidian://open?vault=" + encodeURIComponent(app.vault.getName())
						+ "&file=" + encodeURIComponent(f.path);
					copyToClipboard(url, t("linkCopied"));
				}));
		}
	});

	// Стандартное меню Obsidian: пункты ядра и других плагинов
	app.workspace.trigger("file-menu", menu, f, "file-explorer-context-menu", view.leaf);
	menu.addSeparator();
	menu.addItem(i => i.setTitle(t("delete")).setIcon("trash")
		.onClick(() => view.deleteMany([f.path])));

	menu.showAtMouseEvent(e);
}

function addFolderIconItems(view: ColumnExplorerView, menu: Menu, folder: TFolder) {
	menu.addItem(i => i.setTitle(t("folderIcon")).setIcon("shapes")
		.onClick(() => new IconSuggestModal(view.app, (icon) => {
			view.plugin.settings.folderIcons = {
				...view.plugin.settings.folderIcons,
				[folder.path]: icon,
			};
			void view.plugin.saveSettings();
			view.render();
		}).open()));
	if (view.plugin.settings.folderIcons[folder.path]) {
		menu.addItem(i => i.setTitle(t("folderIconReset")).setIcon("shapes")
			.onClick(() => {
				const rest = { ...view.plugin.settings.folderIcons };
				delete rest[folder.path];
				view.plugin.settings.folderIcons = rest;
				void view.plugin.saveSettings();
				view.render();
			}));
	}
}

/** Контекстное меню спецстроки «Недавние»: очистка списка. */
export function showRecentsMenu(view: ColumnExplorerView, e: MouseEvent) {
	const menu = new Menu();
	menu.addItem(i => i.setTitle(t("clearRecents")).setIcon("eraser")
		.onClick(() => {
			view.plugin.settings.recentFiles = [];
			void view.plugin.saveSettings();
			view.render();
		}));
	menu.showAtMouseEvent(e);
}

/** Right-click on a column header: create items + per-folder sort override. */
export function showColumnHeaderMenu(view: ColumnExplorerView, e: MouseEvent, folder: TFolder) {
	const menu = new Menu();
	menu.addItem(i => i.setTitle(t("newNote")).setIcon("file-plus")
		.onClick(() => void view.createNote(folder)));
	menu.addItem(i => i.setTitle(t("newFolder")).setIcon("folder-plus")
		.onClick(() => void view.createFolder(folder)));
	menu.addItem(i => i.setTitle(t("newCanvas")).setIcon("layout-dashboard")
		.onClick(() => void view.createNote(folder, "canvas", "{}")));
	menu.addSeparator();

	fillFolderSortItems(view, menu, folder);
	menu.showAtMouseEvent(e);
}

export function showFolderBackgroundMenu(view: ColumnExplorerView, e: MouseEvent, folder: TFolder) {
	const menu = new Menu();
	menu.addItem(i => i.setTitle(t("newNote")).setIcon("file-plus")
		.onClick(() => void view.createNote(folder)));
	menu.addItem(i => i.setTitle(t("newFolder")).setIcon("folder-plus")
		.onClick(() => void view.createFolder(folder)));
	menu.addItem(i => i.setTitle(t("newCanvas")).setIcon("layout-dashboard")
		.onClick(() => void view.createNote(folder, "canvas", "{}")));
	if (view.hasFileClipboard()) {
		menu.addItem(i => i.setTitle(t("paste")).setIcon("clipboard-paste")
			.onClick(() => view.pasteClipboard(folder)));
	}
	menu.showAtMouseEvent(e);
}

function fillSortItems(view: ColumnExplorerView, target: Menu) {
	for (const m of SORT_MODE_VALUES) {
		target.addItem(i => i.setTitle(sortLabel(m)).setChecked(view.plugin.settings.sortMode === m)
			.onClick(async () => {
				view.plugin.settings.sortMode = m;
				await view.plugin.saveSettings();
				view.render();
			}));
	}
}

export function showSortMenu(view: ColumnExplorerView, e: MouseEvent) {
	const menu = new Menu();
	fillSortItems(view, menu);
	menu.showAtMouseEvent(e);
}

/** Мобильный toolbar, кнопка «Создать»: пункты создания в текущей папке. */
export function showMobileCreateMenu(view: ColumnExplorerView, e: MouseEvent) {
	const folder = view.currentFolder();
	const menu = new Menu();
	menu.addItem(i => i.setTitle(t("newNote")).setIcon("file-plus")
		.onClick(() => void view.createNote(folder)));
	menu.addItem(i => i.setTitle(t("newFolder")).setIcon("folder-plus")
		.onClick(() => void view.createFolder(folder)));
	menu.addItem(i => i.setTitle(t("newCanvas")).setIcon("layout-dashboard")
		.onClick(() => void view.createNote(folder, "canvas", "{}")));
	menu.showAtMouseEvent(e);
}

/** Мобильный toolbar, кнопка «Ещё»: действия, не поместившиеся в тулбар. */
export function showMobileMoreMenu(view: ColumnExplorerView, e: MouseEvent) {
	const menu = new Menu();
	menu.addItem(i => i.setTitle(t("reveal")).setIcon("locate")
		.onClick(() => view.revealFile(view.app.workspace.getActiveFile())));
	menu.addItem(i => i.setTitle(t("collapse")).setIcon("chevrons-left")
		.onClick(() => view.collapseToRoot()));
	menu.addSeparator();
	menu.addItem((item: MenuItem) => {
		item.setTitle(t("sort")).setIcon("arrow-up-narrow-wide");
		// setSubmenu есть в рантайме, но отсутствует в публичных типах;
		// при его пропаже пункты лягут плоско в родительское меню
		const withSubmenu = item as MenuItem & { setSubmenu?: () => Menu };
		if (typeof withSubmenu.setSubmenu === "function") fillSortItems(view, withSubmenu.setSubmenu());
		else fillSortItems(view, menu);
	});
	menu.showAtMouseEvent(e);
}
