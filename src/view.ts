import {
	Component,
	ItemView,
	Menu,
	Notice,
	TAbstractFile,
	TFile,
	TFolder,
	Platform,
	ViewStateResult,
	WorkspaceLeaf,
	Keymap,
	EventRef,
	debounce,
	getLanguage,
	normalizePath,
	prepareFuzzySearch,
	setIcon,
} from "obsidian";
import { t } from "./i18n";
import {
	BOOKMARKS_PATH, CALENDAR_PATH, DAY_PATH_PREFIX, RECENTS_PATH, STORAGE_PATH,
	NameMatcher,
	dayKey, desiredPanelWidth, errorMessage, filterByMatcher, lockedColumnVisible, matchesExcludePatterns,
	mobileSelectionMode, parentSelection,
	parseExcludePatterns, prunePathKeys, prunePathSet, remapPathKeys, takeFirstExisting,
} from "./pure";
import {
	applyMobileScale as applyMobileScaleVars,
	buildActionBar, buildMobileToolbar, setupEdgeSwipe, setupViewportTracking,
} from "./mobile";
import { displayName, folderNoteOf, visibleChildren } from "./utils";
import { MIN_COLUMN_WIDTH, setPanelAutoResize } from "./settings";
import { commitActiveResize, disconnectListObservers, refreshUnreadMarker, renderCalendarColumn, renderColumn, renderColumnList, renderFileListColumn, renderStorageColumn } from "./column";
import { renderPreviewColumn } from "./preview";
import { SunburstController } from "./storage/sunburst";
import { showMobileCreateMenu, showSortMenu } from "./menus";
import { ConfirmModal, QuickLookModal } from "./modals";
import { copyFiles, duplicateFile, duplicateFolder, moveFiles, trashFiles } from "./fileops";
import { clearActiveDrag, setupCrumbDropTarget, setupGlobalDnd } from "./dnd";
import type ColumnExplorerPlugin from "./main";

/** Форма пункта core-плагина Bookmarks (приватный API — только чтение). */
interface BookmarkItemLike { type: string; path?: string; items?: BookmarkItemLike[] }

export const VIEW_TYPE_COLUMNS = "column-explorer-view";

const TYPEAHEAD_RESET_MS = 700;
const PAGE_JUMP = 10;
/** Пауза перед инлайн-переименованием: рендер должен успеть создать строку. */
const RENAME_START_DELAY_MS = 100;

interface ColumnViewState {
	selection?: string[];
}

export class ColumnExplorerView extends ItemView {
	plugin: ColumnExplorerPlugin;
	/** Selected path at each depth. */
	selection: string[] = [];
	/** Multi-selection (Ctrl/Cmd or Shift click) within one column. */
	multiSel: Set<string> = new Set();
	multiSelDepth = -1;
	private shiftAnchor: string | null = null;
	private filter = "";
	columnsEl!: HTMLElement;
	private breadcrumbsEl!: HTMLElement;
	private searchInput!: HTMLInputElement;
	private renamingPath: string | null = null;
	private clearFilterBtn!: HTMLButtonElement;
	/** Мобильная строка поиска под toolbar (на desktop поиск живёт в toolbar). */
	private searchRowEl: HTMLElement | null = null;
	private searchOpen = false;
	/** Мобильный режим множественного выделения (включается long-press). */
	private mobileSelActive = false;
	private updateMobileToolbar?: () => void;
	private updateActionBar?: () => void;
	private typeaheadBuffer = "";
	private typeaheadTimer = 0;
	/** Отложенный старт инлайн-переименования после создания файла/папки. */
	private renameTimer = 0;
	/** Показанный месяц календаря; null — от выбранного дня или сегодня. */
	private calendarMonth: { year: number; month: number } | null = null;
	/** Кеш «файлы по дню создания» и отпечаток exclude-паттернов при его сборке. */
	private filesByDayCache: Map<string, TFile[]> | null = null;
	private filesByDayKey = "";
	/** Владелец markdown-превью колонки: живёт до следующего рендера. */
	private previewOwner: Component | null = null;
	/** Диаграмма «Использование диска»; создаётся при первом показе колонки. */
	private sunburst: SunburstController | null = null;
	/**
	 * Внутренний буфер Copy/Cut/Paste. Не системный clipboard: класть файлы
	 * в OS-буфер из Obsidian кроссплатформенно нельзя.
	 */
	private fileClipboard: { paths: string[]; cut: boolean } | null = null;

	/** Стек истории навигации (снимки selection) для кнопок назад/вперёд. */
	private history: string[][] = [];
	private historyIndex = -1;
	/** Флаг: идёт переход по истории — не писать новую запись в стек. */
	private navigatingHistory = false;

	/** Targeted refresh: folders whose columns need re-rendering. */
	private dirtyFolders: Set<string> = new Set();
	private fullRenderPending = false;
	private flushRefresh = debounce(() => this.doRefresh(), 60, true);
	/** Дебаунс поиска: полный render на каждую букву лагает на больших vault */
	private applyFilter = debounce(() => {
		this.filter = this.searchInput.value.trim();
		// Нечёткий поиск Obsidian — тот же, что в Quick Switcher: "col ex"
		// находит "Column Explorer". Регистр матчер учитывает сам
		this.filterMatcher = this.filter ? prepareFuzzySearch(this.filter) : null;
		this.clearMulti();
		const depth = this.selection.length - 1;
		const selected = this.selection[depth];
		if (selected && !selected.startsWith("::") && !this.siblingsAt(depth).some(item => item.path === selected)) {
			this.selection = this.selection.slice(0, depth);
			this.persistState();
		}
		this.render();
	}, 150, true);

	/** Матчер текущего запроса; null — фильтр выключен. */
	private filterMatcher: NameMatcher | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: ColumnExplorerPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() { return VIEW_TYPE_COLUMNS; }
	getDisplayText() { return "Column Explorer"; }
	getIcon() { return "columns-3"; }

	/* --------- state persistence (restores selection on restart) ----- */

	getState(): Record<string, unknown> {
		return { selection: this.selection };
	}

	async setState(state: ColumnViewState, result: ViewStateResult) {
		if (Array.isArray(state?.selection)) {
			// workspace.json тоже переживает откаты версий и правки руками:
			// не-строка в цепочке выбора упала бы на первом же startsWith
			this.selection = (state.selection as unknown[]).filter((p): p is string => typeof p === "string");
			if (this.columnsEl) this.render();
		}
		return super.setState(state, result);
	}

	private persistState() {
		// Записываем состояние в workspace, чтобы выбор пережил перезапуск
		this.app.workspace.requestSaveLayout();
	}

	/* ------------------------------ setup ---------------------------- */

	async onOpen() {
		const container = this.contentEl;
		container.empty();
		container.addClass("column-explorer-container");

		const toolbar = container.createDiv({ cls: "column-explorer-toolbar" });
		if (Platform.isMobile) {
			// На телефоне тулбар не вмещает шесть кнопок: назад — поиск — создать — ещё
			this.updateMobileToolbar = buildMobileToolbar(this, toolbar);
		} else {
			this.addToolbarButton(toolbar, "plus", t("create"), (e) => showMobileCreateMenu(this, e));
			this.addToolbarButton(toolbar, "arrow-up-narrow-wide", t("sort"), (e) => showSortMenu(this, e));
			const more = this.addToolbarButton(toolbar, "more-horizontal", t("more"), (e) => this.showMoreMenu(e));
			more.dataset.action = "more";
		}

		// Поиск: на телефоне — отдельная строка под тулбаром, раскрывается кнопкой
		if (Platform.isMobile) {
			this.searchRowEl = container.createDiv({ cls: "column-explorer-search-row" });
			this.searchRowEl.hide();
		}
		const search = (this.searchRowEl ?? toolbar).createDiv({ cls: "column-explorer-search-wrap" });
		this.searchInput = search.createEl("input", {
			type: "search", cls: "column-explorer-search",
			attr: { placeholder: t("filterColumns"), "aria-label": t("filterColumns") },
		});
		this.clearFilterBtn = search.createEl("button", {
			cls: "clickable-icon column-explorer-clear-filter",
			attr: { type: "button", "aria-label": t("clearFilter") },
		});
		setIcon(this.clearFilterBtn, "x");
		this.clearFilterBtn.hidden = true;
		this.registerDomEvent(this.clearFilterBtn, "click", () => { this.clearFilter(); this.searchInput.focus(); });
		this.registerDomEvent(this.searchInput, "input", () => this.applyFilter());
		this.registerDomEvent(this.searchInput, "keydown", (e) => {
			if (e.key !== "Escape") return;
			e.preventDefault();
			// Аппаратная клавиатура есть и на планшете — Escape закрывает строку целиком
			if (this.searchOpen) { this.toggleMobileSearch(); return; }
			this.clearFilter();
			this.columnsEl.focus();
		});

		this.breadcrumbsEl = container.createDiv({
			cls: "column-explorer-breadcrumbs",
			attr: { role: "navigation", "aria-label": "Breadcrumbs" },
		});

		this.columnsEl = container.createDiv({ cls: "column-explorer-columns" });
		this.columnsEl.tabIndex = 0;
		this.registerDomEvent(this.columnsEl, "keydown", (e) => this.onKeyDown(e));
		setupGlobalDnd(this);

		if (Platform.isMobile) {
			this.updateActionBar = buildActionBar(this, container);
			setupEdgeSwipe(this, this.columnsEl);
			setupViewportTracking(this, container);
			this.applyMobileScale();
			// Поворот экрана меняет доступную ширину — пересчитываем размер кнопок
			this.registerDomEvent(window, "resize", debounce(() => this.applyMobileScale(), 150, true));
		}

		// При открытой виртуальной колонке точечный refresh её не найдёт
		// (сентинел — не путь папки), поэтому create/delete → полный рендер
		this.registerEvent(this.app.vault.on("create", (f) => {
			this.invalidateCalendarCache();
			this.markDirty(this.specialKind(this.selection[0]) ? null : f.parent?.path ?? null);
		}));
		this.registerEvent(this.app.vault.on("delete", (f) => {
			this.invalidateCalendarCache();
			const changed = this.pruneSelection(f.path);
			this.prunePathRecords(f.path);
			const fullRender = changed || this.specialKind(this.selection[0]) !== null;
			this.markDirty(fullRender ? null : f.parent?.path ?? null);
		}));
		this.registerEvent(this.app.vault.on("rename", (f, oldPath) => {
			this.invalidateCalendarCache();
			this.remapSelection(oldPath, f.path);
			this.remapPathRecords(oldPath, f.path);
			// Переименование может менять заголовки колонок и две папки сразу — полный рендер
			this.markDirty(null);
		}));

		this.registerEvent(this.app.vault.on("modify", (file) => {
			const folder = file.parent;
			if (!folder) return;
			const sort = this.plugin.settings.columnSortModes[folder.path] ?? this.plugin.settings.sortMode;
			if (sort.startsWith("mtime-") || sort.startsWith("size-")) this.markDirty(folder.path);
		}));

		// Живое обновление колонки «Закладки»: core-плагин триггерит "changed"
		// при каждом изменении. Приватный API — в try; без подписки колонка
		// обновилась бы только при следующем рендере
		try {
			const app = this.app as unknown as {
				internalPlugins?: { getEnabledPluginById?: (id: string) => { on?: (name: "changed", cb: () => void) => EventRef } | null };
			};
			const ref = app.internalPlugins?.getEnabledPluginById?.("bookmarks")?.on?.("changed", () => {
				if (this.selection[0] === BOOKMARKS_PATH) this.render();
			});
			if (ref) this.registerEvent(ref);
		} catch { /* ignore */ }

		this.render();
	}

	/**
	 * Обсерверы и таймеры переживают закрытие вью: отложенный рендер попал бы
	 * в оторванный DOM, а активный IntersectionObserver держит свой список
	 * от сборки мусора. registerDomEvent/registerEvent Obsidian снимает сам.
	 */
	async onClose() {
		this.flushRefresh.cancel();
		this.applyFilter.cancel();
		window.clearTimeout(this.typeaheadTimer);
		window.clearTimeout(this.renameTimer);
		commitActiveResize();
		clearActiveDrag();
		if (this.columnsEl) disconnectListObservers(this.columnsEl);
	}

	private addToolbarButton(parent: HTMLElement, icon: string, tooltip: string, onClick: (e: MouseEvent) => void): HTMLElement {
		const btn = parent.createEl("button", { cls: "clickable-icon column-explorer-toolbar-btn", attr: { type: "button", "aria-label": tooltip } });
		setIcon(btn, icon);
		this.registerDomEvent(btn, "click", (event) => {
			if (event.detail === 0) {
				const rect = btn.getBoundingClientRect();
				onClick(new MouseEvent("click", { clientX: rect.left, clientY: rect.bottom }));
			} else onClick(event);
		});
		return btn;
	}

	private showMoreMenu(event: MouseEvent) {
		const menu = new Menu();
		menu.addItem(item => item.setTitle(t("reveal")).setIcon("locate")
			.onClick(() => this.revealFile(this.app.workspace.getActiveFile())));
		menu.addItem(item => item.setTitle(t("collapse")).setIcon("chevrons-left")
			.onClick(() => this.collapseToRoot()));
		menu.addSeparator();
		const settings = this.plugin.settings;
		menu.addItem(item => item.setTitle(settings.lockedColumnCount === null
			? t("lockColumnCount", { n: this.folderColumnCount() }) : t("unlockColumnCount"))
			.setIcon("columns-3").setChecked(settings.lockedColumnCount !== null)
			.onClick(() => {
				settings.lockedColumnCount = settings.lockedColumnCount === null ? this.folderColumnCount() : null;
				void this.plugin.saveSettings();
				this.render();
			}));
		menu.addItem(item => item.setTitle(t("panelAutoWidth")).setIcon("ruler")
			.setChecked(settings.autoPanelResize).onClick(() => {
				setPanelAutoResize(settings, !settings.autoPanelResize);
				void this.plugin.saveSettings();
				this.autoResizePanel();
			}));
		menu.showAtMouseEvent(event);
	}

	/* ------------------------------ mobile --------------------------- */

	canGoBack(): boolean { return this.historyIndex > 0; }
	canGoForward(): boolean { return this.historyIndex < this.history.length - 1; }
	goBack() { this.navigateHistory(-1); }
	goForward() { this.navigateHistory(1); }
	isSearchOpen(): boolean { return this.searchOpen; }

	/** Команда «Фокус на панель»: клавиатурная навигация без мыши. */
	focusColumns() {
		this.columnsEl.focus();
	}
	isMobileSelecting(): boolean { return this.mobileSelActive; }

	/** Мобильные размеры в CSS-переменных: слайдеры настроек зовут это вместо render(). */
	applyMobileScale() {
		if (!Platform.isMobile) return;
		applyMobileScaleVars(this, this.contentEl);
	}

	collapseToRoot() {
		this.selection = [];
		this.clearMulti();
		this.render();
	}

	/** Мобильная строка поиска: раскрыть или закрыть со сбросом фильтра. */
	toggleMobileSearch() {
		this.searchOpen = !this.searchOpen;
		if (this.searchOpen) {
			this.searchRowEl?.show();
			this.searchInput.focus();
		} else {
			this.searchRowEl?.hide();
			if (this.hasFilter()) this.clearFilter();
			else this.searchInput.value = "";
		}
		this.updateMobileToolbar?.();
	}

	/** Selection родительской колонки, либо null — уже в корне. */
	private parentOfSelection(): string[] | null {
		return parentSelection(this.selection, (p) => this.app.vault.getAbstractFileByPath(p) instanceof TFolder);
	}

	canGoUp(): boolean { return this.parentOfSelection() !== null; }

	/** Стрелка в заголовке колонки: на уровень вверх (не путать с историей). */
	goUp() {
		const parent = this.parentOfSelection();
		if (!parent) return;
		this.selection = parent;
		this.clearMulti();
		this.persistState();
		this.render();
	}

	enterMobileSelection(f: TAbstractFile, depth: number) {
		if (this.multiSelDepth !== depth) this.clearMulti();
		this.multiSelDepth = depth;
		this.multiSel.add(f.path);
		this.mobileSelActive = true;
		this.syncMultiSelDom();
	}

	toggleMobileSelection(f: TAbstractFile, depth: number) {
		this.applyToggleMulti(f, depth);
		this.mobileSelActive = mobileSelectionMode(true, this.multiSel.size);
		this.syncMultiSelDom();
	}

	exitMobileSelection() {
		this.mobileSelActive = false;
		this.clearMulti();
		this.syncMultiSelDom();
	}

	/** Выделение меняет только классы элементов — полный render не нужен. */
	private syncMultiSelDom() {
		this.columnsEl.querySelectorAll(".column-explorer-item.is-multi-selected")
			.forEach((el) => el.removeClass("is-multi-selected"));
		for (const path of this.multiSel) {
			this.columnsEl.querySelector<HTMLElement>(
				`.column-explorer-item[data-path="${CSS.escape(path)}"]`
			)?.addClass("is-multi-selected");
		}
		this.updateActionBar?.();
	}

	/* -------------------------- shared accessors --------------------- */

	/** Visible (exclude-filtered, sorted, search-filtered) children of a folder. */
	childrenOf(folder: TFolder): TAbstractFile[] {
		const children = visibleChildren(folder, this.plugin.settings);
		// Папки остаются видны при фильтре — иначе не пройти к совпадениям внутри
		return filterByMatcher(children, displayName, this.filterMatcher, (c) => c instanceof TFolder);
	}

	filteredItems<T extends TAbstractFile>(items: T[]): T[] {
		return filterByMatcher(items, displayName, this.filterMatcher, () => false);
	}

	private quickAccessItems() {
		const favorites = this.plugin.settings.showFavorites ? this.filteredItems(this.favoriteItems()) : [];
		const favoritePaths = new Set(favorites.map(file => file.path));
		const bookmarks = this.plugin.settings.showBookmarks && this.bookmarksAvailable()
			? this.filteredItems(this.bookmarkedItems()).filter(file => !favoritePaths.has(file.path)) : [];
		return { favorites, bookmarks };
	}

	/** Совпадение имени с текущим запросом — для подсветки в списке. */
	matchOf(name: string) {
		return this.filterMatcher?.(name) ?? null;
	}

	hasFilter(): boolean { return this.filter.length > 0; }
	filterQuery(): string { return this.filter; }

	clearFilter() {
		this.applyFilter.cancel();
		this.filterMatcher = null;
		this.filter = "";
		this.searchInput.value = "";
		this.render();
	}
	isRenaming(path: string): boolean { return this.renamingPath === path; }

	selectedFilePath(): string | null {
		const last = this.selection[this.selection.length - 1];
		if (!last) return null;
		const f = this.app.vault.getAbstractFileByPath(last);
		return f instanceof TFile ? f.path : null;
	}

	dragPayload(f: TAbstractFile, depth: number): string[] {
		if (this.multiSelDepth === depth && this.multiSel.has(f.path)) return [...this.multiSel];
		return [f.path];
	}

	clearMulti() {
		this.multiSel.clear();
		this.multiSelDepth = -1;
		this.shiftAnchor = null;
		// Нет выделения — нет и мобильного режима выделения
		this.mobileSelActive = false;
	}

	/** Number of folder columns for the current selection chain (root column included). */
	private folderColumnCount(): number {
		for (let i = this.selection.length - 1; i >= 0; i--) {
			const f = this.app.vault.getAbstractFileByPath(this.selection[i]);
			if (f instanceof TFolder) return i + 2;
		}
		return 1;
	}

	currentFolder(): TFolder {
		for (let i = this.selection.length - 1; i >= 0; i--) {
			const f = this.app.vault.getAbstractFileByPath(this.selection[i]);
			if (f instanceof TFolder) return f;
			if (f instanceof TFile && f.parent) return f.parent;
		}
		return this.app.vault.getRoot();
	}

	private pruneSelection(deletedPath: string): boolean {
		const i = this.selection.findIndex(p => p === deletedPath || p.startsWith(deletedPath + "/"));
		if (i >= 0) this.selection = this.selection.slice(0, i);
		const before = this.multiSel.size;
		this.multiSel = prunePathSet(this.multiSel, deletedPath);
		if (this.multiSel.size !== before) {
			// Удаление часто заканчивается точечным refresh, а не полным
			// рендером — панель действий надо обновить руками, иначе на мобиле
			// она висит со старым «Выбрано N»
			if (this.multiSel.size === 0) this.clearMulti();
			this.updateActionBar?.();
		}
		return i >= 0;
	}

	private remapSelection(oldPath: string, newPath: string) {
		this.selection = this.selection.map(p =>
			p === oldPath ? newPath :
			p.startsWith(oldPath + "/") ? newPath + p.slice(oldPath.length) : p
		);
	}

	/** Keep folder colors and per-folder view modes in sync with renames. */
	private remapPathRecords(oldPath: string, newPath: string) {
		const s = this.plugin.settings;
		s.folderColors = remapPathKeys(s.folderColors, oldPath, newPath);
		s.columnViewModes = remapPathKeys(s.columnViewModes, oldPath, newPath);
		s.pinnedPaths = remapPathKeys(s.pinnedPaths, oldPath, newPath);
		s.columnSortModes = remapPathKeys(s.columnSortModes, oldPath, newPath);
		s.folderIcons = remapPathKeys(s.folderIcons, oldPath, newPath);
		s.columnWidths = remapPathKeys(s.columnWidths, oldPath, newPath);
		// Перемещение пачки файлов даёт событие на каждый — склеиваем записи
		this.plugin.queueSaveSettings();
	}

	private prunePathRecords(deletedPath: string) {
		const s = this.plugin.settings;
		s.folderColors = prunePathKeys(s.folderColors, deletedPath);
		s.columnViewModes = prunePathKeys(s.columnViewModes, deletedPath);
		s.pinnedPaths = prunePathKeys(s.pinnedPaths, deletedPath);
		s.columnSortModes = prunePathKeys(s.columnSortModes, deletedPath);
		s.folderIcons = prunePathKeys(s.folderIcons, deletedPath);
		s.columnWidths = prunePathKeys(s.columnWidths, deletedPath);
		// Удаление папки даёт событие на каждый вложенный файл — склеиваем
		this.plugin.queueSaveSettings();
	}

	/* ------------------------------ render --------------------------- */

	applyColumnWidth() {
		this.columnsEl.style.setProperty("--ce-col-width", this.plugin.settings.columnWidth + "px");
	}

	/**
	 * Свежий владелец markdown-превью колонки. Предыдущий выгружается: без
	 * этого дочерние компоненты MarkdownRenderer копились бы на view до
	 * закрытия вью — вместе с эмбедами, которые они держат.
	 */
	newPreviewOwner(): Component {
		if (this.previewOwner) this.removeChild(this.previewOwner);
		this.previewOwner = this.addChild(new Component());
		return this.previewOwner;
	}

	private markDirty(folderPath: string | null) {
		if (folderPath === null) this.fullRenderPending = true;
		else this.dirtyFolders.add(folderPath);
		this.flushRefresh();
	}

	private doRefresh() {
		if (this.fullRenderPending) {
			this.fullRenderPending = false;
			this.dirtyFolders.clear();
			this.render();
			return;
		}
		for (const path of this.dirtyFolders) {
			const list = this.columnsEl.querySelector<HTMLElement>(
				`.column-explorer-column[data-folder-path="${CSS.escape(path)}"] .column-explorer-list`
			);
			if (!list) continue;
			// getAbstractFileByPath("/") возвращает null в части версий Obsidian
			const folder = path === "/" ? this.app.vault.getRoot() : this.app.vault.getAbstractFileByPath(path);
			const col = list.closest<HTMLElement>(".column-explorer-column");
			const depth = Number(col?.dataset.depth ?? 0);
			if (folder instanceof TFolder) {
				const prevTop = list.scrollTop;
				renderColumnList(this, list, folder, depth);
				list.scrollTop = prevTop;
				list.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
			}
		}
		this.dirtyFolders.clear();
	}

	/** Vertical scroll of each column keyed by folder path — survives re-render. */
	private captureScrollTops(): Map<string, number> {
		const tops = new Map<string, number>();
		this.columnsEl.querySelectorAll<HTMLElement>(".column-explorer-column[data-folder-path]").forEach(col => {
			const list = col.querySelector<HTMLElement>(".column-explorer-list");
			if (list && col.dataset.folderPath !== undefined) tops.set(col.dataset.folderPath, list.scrollTop);
		});
		return tops;
	}

	private restoreScrollTops(tops: Map<string, number>) {
		this.columnsEl.querySelectorAll<HTMLElement>(".column-explorer-column[data-folder-path]").forEach(col => {
			const saved = tops.get(col.dataset.folderPath ?? "");
			const list = col.querySelector<HTMLElement>(".column-explorer-list");
			if (saved !== undefined && list) list.scrollTop = saved;
		});
	}

	/** Identity of the rendered column set — to decide whether to keep horizontal scroll. */
	private columnsKey(): string {
		return Array.from(this.columnsEl.querySelectorAll<HTMLElement>(".column-explorer-column"))
			.map(col => col.dataset.folderPath ?? "").join("\n");
	}

	render() {
		this.clearFilterBtn.hidden = !this.hasFilter();
		const filterApplies = this.specialKind(this.selection[0]) !== "storage"
			&& !(this.specialKind(this.selection[0]) === "calendar" && this.selection.length === 1);
		this.searchInput.disabled = !filterApplies;
		this.searchInput.parentElement?.toggleClass("is-inactive", !filterApplies);
		// Перерисовка убивает список с dragend и колонку с resize-ручкой —
		// снимаем оба «висящих» состояния сами
		clearActiveDrag();
		commitActiveResize();
		const scrollTops = this.captureScrollTops();
		const prevKey = this.columnsKey();
		const prevScrollLeft = this.columnsEl.scrollLeft;

		// Обсерверы догрузки живут на списках — снимаем их до удаления колонок
		disconnectListObservers(this.columnsEl);
		this.columnsEl.empty();
		// Поле инлайн-переименования умирает вместе с колонкой и blur уже не
		// пришлёт: без сброса флаг завис бы навсегда, а с ним и вся
		// клавиатурная навигация (onKeyDown выходит на первой строке)
		this.renamingPath = null;
		this.applyColumnWidth();

		const validSel: string[] = [];
		const special = this.specialKind(this.selection[0]);
		if (!this.plugin.settings.showStorage) this.dropSunburst();
		else if (special !== "storage") this.sunburst?.suspend();
		if (special === "calendar") {
			// Календарь: сентинел + опционально день + опционально файл дня
			validSel.push(CALENDAR_PATH);
			const day = this.selection[1];
			if (day?.startsWith(DAY_PATH_PREFIX)) {
				validSel.push(day);
				const filePath = this.selection[2];
				if (filePath && this.app.vault.getAbstractFileByPath(filePath) instanceof TFile) validSel.push(filePath);
			}
		} else if (special) {
			// «Недавние»/«Закладки»: сентинел + опционально выбранный файл
			validSel.push(this.selection[0]);
			const filePath = this.selection[1];
			if (filePath && this.app.vault.getAbstractFileByPath(filePath)) validSel.push(filePath);
		} else {
			let parent: TFolder = this.app.vault.getRoot();
			for (const path of this.selection) {
				const f = this.app.vault.getAbstractFileByPath(path);
				if (!f || f.parent !== parent) break;
				validSel.push(path);
				if (f instanceof TFolder) parent = f; else break;
			}
		}
		this.selection = validSel;
		this.recordHistory();

		// Фиксация числа колонок: первые N−1 колонок заморожены на месте,
		// последняя всегда показывает самую глубокую папку цепочки —
		// переходы вглубь происходят внутри неё, промежуточные колонки скрыты
		// На телефоне экран узкий — всегда показываем только самую глубокую колонку
		const lockedCount = Platform.isMobile ? 1 : this.plugin.settings.lockedColumnCount;
		const folderCols = this.folderColumnCount();
		const hasGap = lockedCount !== null && folderCols > lockedCount;
		this.columnsEl.toggleClass("is-locked", hasGap);

		// На телефоне спецколонка занимает весь экран — корневую рядом не рисуем
		if (!(Platform.isMobile && special) && lockedColumnVisible(0, folderCols, lockedCount)) {
			renderColumn(this, this.columnsEl, this.app.vault.getRoot(), 0);
		}
		// Превью-колонки на телефоне нет вовсе: там превью — Quick Look из меню файла
		const previewOf = (path: string | undefined) => {
			if (Platform.isMobile) return;
			const f = path ? this.app.vault.getAbstractFileByPath(path) : null;
			if (f instanceof TFile && this.plugin.settings.showPreview) renderPreviewColumn(this, this.columnsEl, f);
		};
		if (special === "recents") {
			renderFileListColumn(this, this.columnsEl, t("recents"), this.filteredItems(this.recentFiles()), RECENTS_PATH, 1);
			previewOf(this.selection[1]);
		} else if (special === "bookmarks") {
			const { favorites, bookmarks } = this.quickAccessItems();
			renderFileListColumn(this, this.columnsEl, t("bookmarks"), bookmarks, BOOKMARKS_PATH, 1, favorites);
			previewOf(this.selection[1]);
		} else if (special === "storage") {
			renderStorageColumn(this, this.columnsEl);
		} else if (special === "calendar") {
			const daySentinel = this.selection[1];
			// На телефоне колонка одна: открытый день заменяет сетку месяца
			if (!Platform.isMobile || !daySentinel) renderCalendarColumn(this, this.columnsEl);
			if (daySentinel) {
				const day = daySentinel.slice(DAY_PATH_PREFIX.length);
				const title = new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8)))
					.toLocaleDateString(getLanguage(), { day: "numeric", month: "long", year: "numeric" });
				renderFileListColumn(this, this.columnsEl, title, this.filteredItems(this.filesCreatedOn(day)), daySentinel, 2);
				previewOf(this.selection[2]);
			}
		} else {
			for (let depth = 0; depth < this.selection.length; depth++) {
				const f = this.app.vault.getAbstractFileByPath(this.selection[depth]);
				if (f instanceof TFolder) {
					if (!lockedColumnVisible(depth + 1, folderCols, lockedCount)) continue;
					renderColumn(this, this.columnsEl, f, depth + 1);
				} else if (f instanceof TFile && this.plugin.settings.showPreview && !Platform.isMobile) {
					renderPreviewColumn(this, this.columnsEl, f);
				}
			}
		}
		if (hasGap && !Platform.isMobile) this.markLockedColumn();

		this.renderBreadcrumbs();
		this.applyMobileScale();
		this.updateMobileToolbar?.();
		this.updateActionBar?.();
		this.restoreScrollTops(scrollTops);
		// Вправо прокручиваем только когда набор колонок изменился (открыли новую);
		// при клике внутри тех же колонок скролл остаётся на месте
		const sameColumns = this.columnsKey() === prevKey;
		window.requestAnimationFrame(() => {
			// Лист могли отсоединить в этом же кадре: autoResizePanel полезет
			// в getRoot() уже мёртвого листа
			if (!this.columnsEl.isConnected) return;
			this.autoResizePanel();
			this.columnsEl.scrollLeft = sameColumns ? prevScrollLeft : this.columnsEl.scrollWidth;
		});
	}

	/** Авто-ширина панели: подгоняет ширину сайдбара под суммарную ширину колонок. */
	autoResizePanel() {
		if (!this.plugin.settings.autoPanelResize || Platform.isMobile) return;
		const ws = this.app.workspace;
		const root: unknown = this.leaf.getRoot();
		// Вью в центральной области — ширину не трогаем
		if (root !== ws.leftSplit && root !== ws.rightSplit) return;
		// setSize — приватный API сайдбара; при его отсутствии тихо выходим
		const split = root as { collapsed?: boolean; setSize?: (size: number) => void };
		if (split.collapsed || typeof split.setSize !== "function") return;
		const cols = Array.from(this.columnsEl.querySelectorAll<HTMLElement>(".column-explorer-column"));
		const contentWidth = cols.reduce((sum, col) => sum + col.offsetWidth, 0);
		if (contentWidth === 0) return;
		split.setSize(desiredPanelWidth(contentWidth, window.innerWidth, MIN_COLUMN_WIDTH));
	}

	/** Lock badge in the header of the deepest (in-place navigating) column. */
	private markLockedColumn() {
		const cols = this.columnsEl.querySelectorAll<HTMLElement>(".column-explorer-column[data-folder-path]");
		const col = cols[cols.length - 1];
		const header = col?.querySelector<HTMLElement>(".column-explorer-column-header");
		if (!col || !header) return;
		col.addClass("is-locked-root");
		const badge = createDiv({ cls: "column-explorer-lock-badge" });
		setIcon(badge, "lock");
		header.prepend(badge);
	}

	/** Записать текущий выбор в стек истории (если не идём по истории и он изменился). */
	private recordHistory() {
		if (this.navigatingHistory) return;
		const HISTORY_CAP = 100;
		const last = this.history[this.historyIndex];
		if (last && last.length === this.selection.length && last.every((p, i) => p === this.selection[i])) return;
		// Новая навигация обрезает forward-хвост (браузерная семантика)
		this.history = this.history.slice(0, this.historyIndex + 1);
		this.history.push([...this.selection]);
		if (this.history.length > HISTORY_CAP) this.history.shift();
		this.historyIndex = this.history.length - 1;
	}

	private navigateHistory(delta: number) {
		const next = this.historyIndex + delta;
		if (next < 0 || next >= this.history.length) return;
		this.historyIndex = next;
		this.navigatingHistory = true;
		this.selection = [...this.history[next]];
		this.clearMulti();
		this.persistState();
		this.render();
		this.navigatingHistory = false;
	}

	private renderBreadcrumbs() {
		this.breadcrumbsEl.empty();

		// Кнопки назад/вперёд слева — история навигации по папкам
		const nav = this.breadcrumbsEl.createDiv({ cls: "column-explorer-nav-buttons" });
		const navBtn = (icon: string, label: string, enabled: boolean, onClick: () => void) => {
			const btn = nav.createEl("button", {
				cls: "clickable-icon column-explorer-nav-btn" + (enabled ? "" : " is-disabled"),
				attr: { type: "button", "aria-label": label },
			});
			setIcon(btn, icon);
			btn.disabled = !enabled;
			if (enabled) btn.addEventListener("click", () => {
				const restoreFocus = btn.ownerDocument.activeElement === btn;
				onClick();
				if (restoreFocus) {
					const next = Array.from(this.breadcrumbsEl.querySelectorAll<HTMLButtonElement>(".column-explorer-nav-btn"))
						.find(candidate => candidate.getAttribute("aria-label") === label && !candidate.disabled);
					(next ?? this.columnsEl).focus();
				}
			});
		};
		// На телефоне «назад» живёт в тулбаре — здесь дублировать его незачем
		if (!Platform.isMobile) {
			navBtn("arrow-left", t("navBack"), this.canGoBack(), () => this.goBack());
			navBtn("arrow-right", t("navForward"), this.canGoForward(), () => this.goForward());
		}

		// Звёздочка: быстро добавить/убрать текущую папку в избранное
		const current = this.currentFolder();
		const isFav = this.isFavorite(current.path);
		const star = nav.createEl("button", {
			cls: "clickable-icon column-explorer-fav-btn" + (isFav ? " is-active" : ""),
			attr: { type: "button", "aria-label": isFav ? t("removeFavorite") : t("addFavorite"), "aria-pressed": String(isFav) },
		});
		setIcon(star, "star");
		star.addEventListener("click", () => {
			const restoreFocus = star.ownerDocument.activeElement === star;
			this.toggleFavorite(current.path);
			if (restoreFocus) this.breadcrumbsEl.querySelector<HTMLElement>(".column-explorer-fav-btn")?.focus();
		});

		const addSegment = (label: string, targetDepth: number, isLast: boolean, dropFolder?: TFolder) => {
			const seg = this.breadcrumbsEl.createEl(isLast ? "span" : "button", {
				cls: "column-explorer-crumb" + (isLast ? " is-current" : ""),
				text: label,
				attr: isLast ? { "aria-current": "page" } : { type: "button" },
			});
			// Бросить файл на сегмент пути — переместить в эту папку (как в Finder)
			if (dropFolder) setupCrumbDropTarget(this, seg, dropFolder);
			if (!isLast) {
				seg.addEventListener("click", () => {
					const restoreFocus = seg.ownerDocument.activeElement === seg;
					this.selection = this.selection.slice(0, targetDepth);
					this.clearMulti();
					this.persistState();
					this.render();
					if (restoreFocus) this.columnsEl.focus();
				});
				this.breadcrumbsEl.createSpan({ cls: "column-explorer-crumb-sep", text: "›" });
			}
		};
		addSegment(this.app.vault.getName(), 0, this.selection.length === 0, this.app.vault.getRoot());
		this.selection.forEach((path, i) => {
			const f = this.app.vault.getAbstractFileByPath(path);
			const label = f ? displayName(f)
				: path === RECENTS_PATH ? t("recents")
				: path === BOOKMARKS_PATH ? t("bookmarks")
				: path === CALENDAR_PATH ? t("calendar")
				: path === STORAGE_PATH ? t("diskUsage")
				: path.startsWith(DAY_PATH_PREFIX) ? path.slice(DAY_PATH_PREFIX.length)
				: path.split("/").pop() ?? path;
			addSegment(label, i + 1, i === this.selection.length - 1, f instanceof TFolder ? f : undefined);
		});

		// Длинный путь на узком экране: держим в виду текущий, последний сегмент
		if (Platform.isMobile) {
			window.requestAnimationFrame(() => {
				if (!this.breadcrumbsEl.isConnected) return;
				this.breadcrumbsEl.scrollLeft = this.breadcrumbsEl.scrollWidth;
			});
		}
	}

	/** Cheap highlight update on active-leaf-change — no full re-render. */
	updateActiveFileHighlight() {
		const active = this.app.workspace.getActiveFile();
		this.columnsEl.querySelectorAll(".column-explorer-item.is-active-file")
			.forEach(el => el.removeClass("is-active-file"));
		if (!active) return;
		const item = this.columnsEl.querySelector<HTMLElement>(
			`.column-explorer-item[data-path="${CSS.escape(active.path)}"]`
		);
		item?.addClass("is-active-file");
	}

	/** Точечно обновить маркер непрочитанного — без ре-рендера колонки. */
	updateUnreadMarker(path: string) {
		if (!this.columnsEl) return;
		refreshUnreadMarker(this, this.columnsEl, path);
	}

	/* ----------------------------- actions --------------------------- */

	/** Паттерны исключений — виртуальные колонки фильтруются как обычные. */
	private excludePatternsList(): string[] {
		return parseExcludePatterns(this.plugin.settings.excludePatterns);
	}

	/** Последние открытые файлы из собственного трекера (main.ts). */
	recentFiles(): TFile[] {
		const s = this.plugin.settings;
		const patterns = this.excludePatternsList();
		const isVisibleFile = (p: string) =>
			!matchesExcludePatterns(p, patterns) && this.app.vault.getAbstractFileByPath(p) instanceof TFile;
		return takeFirstExisting(s.recentFiles, isVisibleFile, s.recentFilesCount).flatMap((p) => {
			const f = this.app.vault.getAbstractFileByPath(p);
			return f instanceof TFile ? [f] : [];
		});
	}

	/**
	 * Перерисовать открытую колонку «Недавние» (файл открыли где-то ещё).
	 * Если открыт как раз выбранный в ней файл — не дёргаем список под
	 * курсором, он и так показан.
	 */
	refreshRecentsColumn(openedPath?: string) {
		if (this.selection[0] !== RECENTS_PATH) return;
		if (openedPath && this.selection[1] === openedPath) return;
		this.render();
	}

	/** Тип спецпункта по сентинел-пути с учётом настроек и доступности. */
	specialKind(path: string | undefined): "recents" | "bookmarks" | "calendar" | "storage" | null {
		const s = this.plugin.settings;
		if (path === RECENTS_PATH && s.showRecents) return "recents";
		if (path === BOOKMARKS_PATH && ((s.showBookmarks && this.bookmarksAvailable()) || (s.showFavorites && s.favorites.length > 0))) return "bookmarks";
		if (path === CALENDAR_PATH && s.showCalendar) return "calendar";
		if (path === STORAGE_PATH && s.showStorage) return "storage";
		return null;
	}

	/**
	 * Контроллер диаграммы «Использование диска». Создаётся при первом
	 * открытии колонки: скан хранилища слишком дорог, чтобы делать его на
	 * загрузке плагина. Дальше живёт до закрытия вью — колонки
	 * перерисовываются часто, а дерево и кэш словосчёта переживают рендер.
	 */
	sunburstController(): SunburstController {
		if (!this.sunburst) {
			this.sunburst = new SunburstController(this);
			this.addChild(this.sunburst);
		}
		return this.sunburst;
	}

	/** Спецстроку выключили в настройках — диаграмма и её подписки не нужны. */
	private dropSunburst() {
		if (!this.sunburst) return;
		this.removeChild(this.sunburst);
		this.sunburst = null;
	}

	selectSpecial(path: string) {
		this.selection = [path];
		this.clearMulti();
		this.persistState();
		this.render();
	}

	selectDay(day: string) {
		this.selection = [CALENDAR_PATH, DAY_PATH_PREFIX + day];
		this.clearMulti();
		this.persistState();
		this.render();
	}

	/** Выбранный день календаря ("YYYY-MM-DD") или null. */
	selectedDayKey(): string | null {
		const sentinel = this.selection[0] === CALENDAR_PATH ? this.selection[1] : undefined;
		return sentinel?.startsWith(DAY_PATH_PREFIX) ? sentinel.slice(DAY_PATH_PREFIX.length) : null;
	}

	currentCalendarMonth(): { year: number; month: number } {
		if (this.calendarMonth) return this.calendarMonth;
		const day = this.selectedDayKey();
		if (day) return { year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)) - 1 };
		const now = new Date();
		return { year: now.getFullYear(), month: now.getMonth() };
	}

	/** Листание месяца: ±1, а 0 — вернуться к сегодняшнему. */
	navigateCalendarMonth(delta: number) {
		if (delta === 0) {
			const now = new Date();
			this.calendarMonth = { year: now.getFullYear(), month: now.getMonth() };
		} else {
			const cur = this.currentCalendarMonth();
			const d = new Date(cur.year, cur.month + delta, 1);
			this.calendarMonth = { year: d.getFullYear(), month: d.getMonth() };
		}
		this.render();
	}

	/**
	 * Файлы vault, разложенные по дню создания. Полный скан на vault в десятки
	 * тысяч файлов заметен, а рендер календаря случается на каждый клик —
	 * поэтому считаем один раз и сбрасываем по событиям vault и смене настроек.
	 */
	private filesByDay(): Map<string, TFile[]> {
		const patterns = this.excludePatternsList();
		const key = patterns.join("\n");
		if (this.filesByDayCache && this.filesByDayKey === key) return this.filesByDayCache;
		const byDay = new Map<string, TFile[]>();
		for (const f of this.app.vault.getFiles()) {
			if (matchesExcludePatterns(f.path, patterns)) continue;
			const day = dayKey(f.stat.ctime);
			const bucket = byDay.get(day);
			if (bucket) bucket.push(f); else byDay.set(day, [f]);
		}
		this.filesByDayCache = byDay;
		this.filesByDayKey = key;
		return byDay;
	}

	/** Сбросить кеш дней: файл создан, удалён или переименован. */
	invalidateCalendarCache() {
		this.filesByDayCache = null;
	}

	/** Число созданных файлов по дням (ключ — dayKey) для бейджей календаря. */
	calendarCounts(): Map<string, number> {
		const counts = new Map<string, number>();
		for (const [day, files] of this.filesByDay()) counts.set(day, files.length);
		return counts;
	}

	/** Файлы, созданные в день `day` ("YYYY-MM-DD"), новые сверху. */
	filesCreatedOn(day: string): TFile[] {
		return [...(this.filesByDay().get(day) ?? [])].sort((a, b) => b.stat.ctime - a.stat.ctime);
	}

	bookmarksAvailable(): boolean {
		return this.bookmarkItems() !== null;
	}

	/**
	 * Пункты core-плагина Bookmarks. Приватный API (internalPlugins) —
	 * в try, при поломке или выключенном плагине возвращаем null
	 * и спецпункт «Закладки» просто не показывается.
	 */
	private bookmarkItems(): BookmarkItemLike[] | null {
		try {
			const app = this.app as unknown as {
				internalPlugins?: { getEnabledPluginById?: (id: string) => { items?: BookmarkItemLike[] } | null };
			};
			return app.internalPlugins?.getEnabledPluginById?.("bookmarks")?.items ?? null;
		} catch {
			return null;
		}
	}

	/**
	 * Файлы и папки из закладок; группы разворачиваются плоско, дубли
	 * (закладки на заголовки/блоки одной заметки) схлопываются.
	 */
	bookmarkedItems(): TAbstractFile[] {
		const flatten = (items: BookmarkItemLike[]): string[] => items.flatMap((it) =>
			it.type === "group" ? flatten(it.items ?? [])
				: (it.type === "file" || it.type === "folder") && it.path ? [it.path] : []
		);
		const patterns = this.excludePatternsList();
		return [...new Set(flatten(this.bookmarkItems() ?? []))].flatMap((p) => {
			if (matchesExcludePatterns(p, patterns)) return [];
			const f = this.app.vault.getAbstractFileByPath(p);
			return f ? [f] : [];
		});
	}

	/** Saved favorite files/folders, invalid and excluded paths dropped, add-order kept. */
	favoriteItems(): TAbstractFile[] {
		const patterns = this.excludePatternsList();
		return this.plugin.settings.favorites.flatMap((p) => {
			if (matchesExcludePatterns(p, patterns)) return [];
			const f = this.app.vault.getAbstractFileByPath(p);
			return f ? [f] : [];
		});
	}

	isFavorite(path: string): boolean {
		return this.plugin.settings.favorites.includes(path);
	}

	/** Add or remove a path from favorites, with a notice. */
	toggleFavorite(path: string) {
		const s = this.plugin.settings;
		const has = s.favorites.includes(path);
		s.favorites = has ? s.favorites.filter((p) => p !== path) : [...s.favorites, path];
		void this.plugin.saveSettings();
		new Notice(t(has ? "favoriteRemoved" : "favoriteAdded"));
		this.render();
	}

	private renderSelection(previous: string[], scroll = false) {
		const depth = this.selection.length - 1;
		const path = this.selection[depth];
		const file = path ? this.app.vault.getAbstractFileByPath(path) : null;
		const previousFile = previous[depth] ? this.app.vault.getAbstractFileByPath(previous[depth]) : null;
		const sameParents = previous.slice(0, depth).join("\n") === this.selection.slice(0, depth).join("\n");
		const virtualList = depth === 1 && this.selection[0] === BOOKMARKS_PATH && previous[0] === BOOKMARKS_PATH;
		const unchangedColumns = sameParents && previous.length === this.selection.length
			&& (virtualList || (file instanceof TFile && previousFile instanceof TFile));
		let row = path ? this.columnsEl.querySelector<HTMLElement>(
			`.column-explorer-column[data-depth="${depth}"] .column-explorer-item[data-path="${CSS.escape(path)}"]`
		) : null;
		if (unchangedColumns && !row) {
			const folder = this.folderAtDepth(depth);
			const list = this.columnsEl.querySelector<HTMLElement>(`.column-explorer-column[data-depth="${depth}"] .column-explorer-list`);
			if (folder && list) {
				renderColumnList(this, list, folder, depth);
				row = list.querySelector<HTMLElement>(`.column-explorer-item[data-path="${CSS.escape(path)}"]`);
			}
		}
		if (!unchangedColumns || !row) {
			this.render();
			row = path ? this.columnsEl.querySelector<HTMLElement>(
				`.column-explorer-column[data-depth="${depth}"] .column-explorer-item[data-path="${CSS.escape(path)}"]`
			) : null;
		} else {
			this.columnsEl.querySelectorAll<HTMLElement>(`.column-explorer-column[data-depth="${depth}"] .column-explorer-item`).forEach(item => {
				const selected = item.dataset.path === path;
				item.toggleClass("is-selected", selected);
				item.setAttribute("aria-selected", String(selected));
			});
			this.syncMultiSelDom();
			this.updateActiveFileHighlight();
			this.columnsEl.querySelector(".column-explorer-preview")?.remove();
			if (file instanceof TFile && this.plugin.settings.showPreview && !Platform.isMobile) {
				renderPreviewColumn(this, this.columnsEl, file);
			}
			this.recordHistory();
			this.renderBreadcrumbs();
			this.updateMobileToolbar?.();
		}
		if (scroll && row) row.scrollIntoView({ block: "nearest", inline: "nearest" });
	}

	selectItem(f: TAbstractFile, depth: number, e: MouseEvent) {
		const previous = [...this.selection];
		// Фиксация снимается только вручную кнопкой в тулбаре —
		// навигация (включая клики в первой колонке) замок не трогает
		this.selection = this.selection.slice(0, depth);
		this.selection.push(f.path);
		this.shiftAnchor = f.path;
		if (f instanceof TFile) {
			void this.app.workspace.getLeaf(Keymap.isModEvent(e)).openFile(f);
		} else if (f instanceof TFolder && this.plugin.settings.openFolderNote) {
			const note = folderNoteOf(f);
			if (note) void this.app.workspace.getLeaf(Keymap.isModEvent(e)).openFile(note);
		}
		this.persistState();
		this.renderSelection(previous);
	}

	toggleMulti(f: TAbstractFile, depth: number) {
		this.applyToggleMulti(f, depth);
		this.syncMultiSelDom();
	}

	/** Мутация мультивыделения без перерисовки — общая с мобильным режимом. */
	private applyToggleMulti(f: TAbstractFile, depth: number) {
		if (this.multiSelDepth !== depth) this.clearMulti();
		this.multiSelDepth = depth;
		if (this.multiSel.has(f.path)) this.multiSel.delete(f.path);
		else this.multiSel.add(f.path);
		this.shiftAnchor = f.path;
		if (this.multiSel.size === 0) this.multiSelDepth = -1;
	}

	rangeMulti(f: TAbstractFile, depth: number, siblings: TAbstractFile[]) {
		if (this.multiSelDepth !== depth) { this.clearMulti(); this.multiSelDepth = depth; }
		const anchor = this.shiftAnchor ?? this.selection[depth] ?? f.path;
		const ai = siblings.findIndex(s => s.path === anchor);
		const bi = siblings.findIndex(s => s.path === f.path);
		if (ai === -1 || bi === -1) { this.toggleMulti(f, depth); return; }
		const [from, to] = ai < bi ? [ai, bi] : [bi, ai];
		for (let i = from; i <= to; i++) this.multiSel.add(siblings[i].path);
		this.syncMultiSelDom();
	}

	/** Cmd/Ctrl+A — multi-select every item in the active folder column. */
	selectAllAt(depth: number) {
		const children = this.siblingsAt(depth).flatMap(({ path }) => {
			const file = this.app.vault.getAbstractFileByPath(path);
			return file ? [file] : [];
		});
		if (children.length === 0) return;
		this.clearMulti();
		this.multiSelDepth = depth;
		for (const child of children) this.multiSel.add(child.path);
		this.syncMultiSelDom();
	}

	/* ------------------------- copy / cut / paste -------------------- */

	/** Положить пути в буфер; cut-режим затемняет исходники до вставки. */
	copyItems(paths: string[], cut: boolean) {
		// Сентинелы спецпунктов ("::…") — не файлы, копировать нечего
		const real = paths.filter((p) => !p.startsWith("::"));
		if (real.length === 0) return;
		this.fileClipboard = { paths: real, cut };
		this.render();
	}

	hasFileClipboard(): boolean {
		return this.fileClipboard !== null;
	}

	/** Затемнение вырезанных строк — читается из buildItem при рендере. */
	isCutPath(path: string): boolean {
		return this.fileClipboard?.cut === true && this.fileClipboard.paths.includes(path);
	}

	/**
	 * Вставить буфер в папку (по умолчанию — текущую). Copy-буфер живёт
	 * дальше для повторных вставок, cut-буфер очищается после перемещения.
	 */
	pasteClipboard(target: TFolder = this.currentFolder()) {
		const clip = this.fileClipboard;
		if (!clip) return;
		if (clip.cut) {
			this.fileClipboard = null;
			void moveFiles(this.app, clip.paths, target).then(() => this.render());
		} else {
			void copyFiles(this.app, clip.paths, target);
		}
	}

	/** Cmd/Ctrl+C или X: мультивыделение либо текущий элемент. */
	private copySelectionAt(depth: number, cut: boolean) {
		const paths = this.multiSel.size > 0 && this.multiSelDepth === depth
			? [...this.multiSel]
			: [this.selection[depth]].filter((p): p is string => Boolean(p));
		this.copyItems(paths, cut);
	}

	/** Cmd/Ctrl+D — duplicate the multi-selection, or the single selected item. */
	duplicateSelected(depth: number) {
		const paths = this.multiSel.size > 0 && this.multiSelDepth === depth
			? [...this.multiSel]
			: [this.selection[depth]].filter(Boolean);
		void (async () => {
			for (const p of paths) {
				const f = this.app.vault.getAbstractFileByPath(p);
				if (f instanceof TFile) await duplicateFile(this.app, f);
				else if (f instanceof TFolder) await duplicateFolder(this.app, f);
			}
		})();
	}

	revealFile(file: TAbstractFile | null) {
		if (!file) return;
		if (this.hasFilter()) { this.filter = ""; this.filterMatcher = null; this.searchInput.value = ""; }
		const chain: string[] = [];
		let cur: TAbstractFile | null = file;
		while (cur && cur.parent) {
			chain.unshift(cur.path);
			cur = cur.parent;
		}
		this.selection = chain;
		this.clearMulti();
		this.persistState();
		this.render();
	}

	deleteMany(paths: string[]) {
		const doDelete = async () => {
			await trashFiles(this.app, paths);
			// Снимает и мультивыделение, и мобильный режим выделения
			this.exitMobileSelection();
		};
		if (!this.plugin.settings.confirmDelete) { void doDelete(); return; }
		const first = this.app.vault.getAbstractFileByPath(paths[0]);
		const msg = paths.length === 1
			? t("confirmDeleteOne", { name: first ? displayName(first) : paths[0] })
			: t("confirmDeleteMany", { n: paths.length });
		new ConfirmModal(this.app, msg, () => void doDelete()).open();
	}

	async createNote(folder: TFolder, extension = "md", initialContent = "") {
		const base = (folder.isRoot() ? "" : folder.path + "/") + t("untitled");
		let path = normalizePath(base + "." + extension);
		let n = 1;
		while (this.app.vault.getAbstractFileByPath(path)) {
			path = normalizePath(base + " " + n++ + "." + extension);
		}
		try {
			const file = await this.app.vault.create(path, initialContent);
			this.revealFile(file);
			await this.app.workspace.getLeaf(false).openFile(file);
			this.queueRename(file.path);
		} catch (err) {
			new Notice(t("createFailed", { name: path, error: errorMessage(err) }));
		}
	}

	async createFolder(folder: TFolder) {
		const base = (folder.isRoot() ? "" : folder.path + "/") + t("newFolderName");
		let path = normalizePath(base);
		let n = 1;
		while (this.app.vault.getAbstractFileByPath(path)) {
			path = normalizePath(base + " " + n++);
		}
		try {
			await this.app.vault.createFolder(path);
			this.queueRename(path);
		} catch (err) {
			new Notice(t("createFailed", { name: path, error: errorMessage(err) }));
		}
	}

	/** Инлайн-переименование после того, как рендер догонит создание файла. */
	private queueRename(path: string) {
		window.clearTimeout(this.renameTimer);
		this.renameTimer = window.setTimeout(() => this.startRenameByPath(path), RENAME_START_DELAY_MS);
	}

	private startRenameByPath(path: string) {
		const f = this.app.vault.getAbstractFileByPath(path);
		if (f) this.startRename(f);
	}

	startRename(f: TAbstractFile) {
		this.render();
		const item = this.columnsEl.querySelector<HTMLElement>(
			`.column-explorer-item[data-path="${CSS.escape(f.path)}"]`
		);
		if (!item) return;
		const titleEl = item.querySelector<HTMLElement>(".column-explorer-item-title");
		if (!titleEl) return;

		this.renamingPath = f.path;
		const isMdFile = f instanceof TFile && f.extension === "md";
		const original = f instanceof TFile && f.extension === "md" ? f.basename : f.name;

		const input = createEl("input", { type: "text", cls: "column-explorer-rename-input", value: original });
		titleEl.replaceWith(input);
		input.focus();
		const dot = input.value.lastIndexOf(".");
		input.setSelectionRange(0, isMdFile || dot <= 0 ? input.value.length : dot);

		// Enter запускает async finish; blur во время await вызвал бы его
		// второй раз — переименование уже несуществующего пути и ложная ошибка
		let finished = false;
		const finish = async (commit: boolean) => {
			if (finished) return;
			finished = true;
			this.renamingPath = null;
			const newName = input.value.trim();
			if (commit && newName && newName !== original) {
				const dir = f.parent && !f.parent.isRoot() ? f.parent.path + "/" : "";
				const finalName = isMdFile ? newName + ".md" : newName;
				try {
					await this.app.fileManager.renameFile(f, normalizePath(dir + finalName));
				} catch (err) {
					new Notice(t("renameFailed") + errorMessage(err));
				}
			}
			this.render();
		};

		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") { e.preventDefault(); void finish(true); }
			if (e.key === "Escape") { e.preventDefault(); void finish(false); }
		});
		input.addEventListener("blur", () => void finish(true));
		input.addEventListener("click", (e) => e.stopPropagation());
	}

	/* ---------------------------- keyboard --------------------------- */

	private onKeyDown(e: KeyboardEvent) {
		if (this.renamingPath || (e.target instanceof HTMLElement && e.target !== this.columnsEl
			&& e.target.closest("button, input, select, textarea, [contenteditable=true]"))) return;
		// В режиме выделения Escape сначала закрывает сам режим
		if (this.mobileSelActive && e.key === "Escape") {
			e.preventDefault();
			this.exitMobileSelection();
			return;
		}
		const depth = Math.max(0, this.selection.length - 1);
		const selectedPath = this.selection[depth];
		const children = this.siblingsAt(depth);
		const currentIdx = children.findIndex(c => c.path === selectedPath);

		const jumpTo = (idx: number) => {
			if (children.length === 0) return;
			const next = children[Math.min(children.length - 1, Math.max(0, idx))];
			const previous = [...this.selection];
			this.selection = this.selection.slice(0, depth);
			this.selection.push(next.path);
			this.clearMulti();
			this.persistState();
			this.renderSelection(previous, true);
		};

		if (e.key === "ArrowUp" || e.key === "ArrowDown") {
			e.preventDefault();
			jumpTo(e.key === "ArrowDown"
				? Math.min(children.length - 1, currentIdx + 1)
				: Math.max(0, currentIdx === -1 ? 0 : currentIdx - 1));
		} else if (e.key === "Home") {
			e.preventDefault();
			jumpTo(0);
		} else if (e.key === "End") {
			e.preventDefault();
			jumpTo(children.length - 1);
		} else if (e.key === "PageUp" || e.key === "PageDown") {
			e.preventDefault();
			const base = currentIdx === -1 ? 0 : currentIdx;
			jumpTo(e.key === "PageDown" ? base + PAGE_JUMP : base - PAGE_JUMP);
		} else if (e.key === "ArrowLeft") {
			e.preventDefault();
			if (this.selection.length > 0) {
				this.selection.pop();
				this.persistState();
				this.render();
			}
		} else if (e.key === "ArrowRight" || e.key === "Enter") {
			e.preventDefault();
			if (this.enterVirtual(selectedPath, depth)) return;
			const f = selectedPath ? this.app.vault.getAbstractFileByPath(selectedPath) : null;
			if (f instanceof TFolder) {
				if (this.specialKind(this.selection[0]) === "bookmarks") { this.revealFile(f); return; }
				const inner = this.childrenOf(f);
				if (inner.length > 0) {
					this.selection.push(inner[0].path);
					this.persistState();
					this.render();
				}
			} else if (f instanceof TFile && e.key === "Enter") {
				void this.app.workspace.getLeaf(false).openFile(f);
			}
		} else if (e.key === " " && !this.typeaheadBuffer) {
			// Quick Look: как в Finder — пробел открывает превью выделенного файла.
			// Во время type-ahead пробел — часть набираемого имени, не превью
			e.preventDefault();
			const f = selectedPath ? this.app.vault.getAbstractFileByPath(selectedPath) : null;
			if (f instanceof TFile) new QuickLookModal(this.app, this, f).open();
		} else if (e.key === "Escape") {
			// В диаграмме «Использование диска» Escape — шаг зума наружу
			if (this.specialKind(this.selection[0]) === "storage" && this.sunburst?.zoomOut()) {
				e.preventDefault();
			} else if (this.hasFilter()) {
				e.preventDefault();
				this.clearFilter();
			}
		} else if (e.key === "F2") {
			e.preventDefault();
			const f = selectedPath ? this.app.vault.getAbstractFileByPath(selectedPath) : null;
			if (f) this.startRename(f);
		} else if (e.key === "Delete" || (e.key === "Backspace" && (e.metaKey || e.ctrlKey))) {
			e.preventDefault();
			if (this.multiSel.size > 0) { this.deleteMany([...this.multiSel]); return; }
			// Сентинелы спецпунктов ("::…") — не файлы, удалять нечего
			if (selectedPath && !selectedPath.startsWith("::")) this.deleteMany([selectedPath]);
		} else if ((e.metaKey || e.ctrlKey) && (e.key === "a" || e.key === "A" || e.code === "KeyA")) {
			// e.code — физическая клавиша: на кириллице и прочих не-латинских
			// раскладках e.key даёт другую букву, и хоткей иначе не срабатывает
			e.preventDefault();
			this.selectAllAt(depth);
		} else if ((e.metaKey || e.ctrlKey) && (e.key === "d" || e.key === "D" || e.code === "KeyD")) {
			e.preventDefault();
			this.duplicateSelected(depth);
		} else if ((e.metaKey || e.ctrlKey) && (e.key === "c" || e.key === "C" || e.code === "KeyC")) {
			e.preventDefault();
			this.copySelectionAt(depth, false);
		} else if ((e.metaKey || e.ctrlKey) && (e.key === "x" || e.key === "X" || e.code === "KeyX")) {
			e.preventDefault();
			this.copySelectionAt(depth, true);
		} else if ((e.metaKey || e.ctrlKey) && (e.key === "v" || e.key === "V" || e.code === "KeyV")) {
			e.preventDefault();
			this.pasteClipboard();
		} else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
			// Type-ahead: как в Finder — набор букв прыгает к совпадению
			if (e.key === " ") e.preventDefault(); // пробел иначе прокручивает список
			this.onTypeahead(e.key, children, depth);
		}
	}

	private onTypeahead(char: string, children: { path: string; name: string }[], depth: number) {
		window.clearTimeout(this.typeaheadTimer);
		this.typeaheadBuffer += char.toLowerCase();
		this.typeaheadTimer = window.setTimeout(() => { this.typeaheadBuffer = ""; }, TYPEAHEAD_RESET_MS);
		const match = children.find(c => c.name.toLowerCase().startsWith(this.typeaheadBuffer));
		if (!match) return;
		const previous = [...this.selection];
		this.selection = this.selection.slice(0, depth);
		this.selection.push(match.path);
		this.clearMulti();
		this.persistState();
		this.renderSelection(previous, true);
	}

	/**
	 * «Соседи» для клавиатурной навигации на данной глубине: в виртуальных
	 * колонках — их файлы, в первой колонке — дети корня плюс спецпункты
	 * (на той же позиции, что и на экране).
	 */
	private siblingsAt(depth: number): { path: string; name: string }[] {
		const toEntry = (f: TAbstractFile) => ({ path: f.path, name: displayName(f) });
		const special = this.specialKind(this.selection[0]);
		if (special && depth >= 1) {
			if (special === "recents") return this.filteredItems(this.recentFiles()).map(toEntry);
			if (special === "bookmarks") {
				const { favorites, bookmarks } = this.quickAccessItems();
				return [...favorites, ...bookmarks].map(toEntry);
			}
			// Диаграмма — не список: стрелками внутрь неё ходить некуда
			if (special === "storage") return [];
			// Календарь: глубина 1 — сетка дней (не список), глубина 2 — файлы дня
			const day = this.selectedDayKey();
			return depth === 2 && day ? this.filteredItems(this.filesCreatedOn(day)).map(toEntry) : [];
		}
		const parentFolder = this.folderAtDepth(depth);
		const entries = (parentFolder ? this.childrenOf(parentFolder) : []).map(toEntry);
		if (depth !== 0) return entries;
		const specials: { path: string; name: string }[] = [];
		if (this.specialKind(RECENTS_PATH)) specials.push({ path: RECENTS_PATH, name: t("recents") });
		if (this.specialKind(BOOKMARKS_PATH)) specials.push({ path: BOOKMARKS_PATH, name: t("bookmarks") });
		if (this.specialKind(CALENDAR_PATH)) specials.push({ path: CALENDAR_PATH, name: t("calendar") });
		if (this.specialKind(STORAGE_PATH)) specials.push({ path: STORAGE_PATH, name: t("diskUsage") });
		return this.plugin.settings.specialItemsPosition === "top" ? [...specials, ...entries] : [...entries, ...specials];
	}

	/** ArrowRight/Enter на спецпункте или дне календаря — вход в его колонку. */
	private enterVirtual(selectedPath: string | undefined, depth: number): boolean {
		if (!selectedPath) return false;
		if (this.specialKind(selectedPath) === "calendar") {
			this.selectDay(dayKey(Date.now()));
			return true;
		}
		if (this.specialKind(selectedPath) || selectedPath.startsWith(DAY_PATH_PREFIX)) {
			const inner = this.siblingsAt(depth + 1);
			if (inner.length > 0) {
				this.selection.push(inner[0].path);
				this.persistState();
				this.render();
			}
			return true;
		}
		return false;
	}

	private folderAtDepth(depth: number): TFolder | null {
		if (depth === 0) return this.app.vault.getRoot();
		const f = this.app.vault.getAbstractFileByPath(this.selection[depth - 1]);
		return f instanceof TFolder ? f : null;
	}
}
