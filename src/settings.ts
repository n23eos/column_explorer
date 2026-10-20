import { App, Notice, PluginSettingTab, Setting, SettingDefinitionItem, SliderComponent, debounce, requireApiVersion } from "obsidian";
import { t } from "./i18n";
import {
	DEFAULT_COLUMN_WIDTH, DEFAULT_MOBILE_ICON, DEFAULT_MOBILE_SCALE, DEFAULT_RECENT_FILES,
	DEFAULT_STORAGE_RINGS,
	MAX_COLUMN_WIDTH, MAX_MOBILE_ICON, MAX_MOBILE_SCALE, MAX_RECENT_FILES, MAX_STORAGE_RINGS,
	MIN_COLUMN_WIDTH, MIN_MOBILE_ICON, MIN_MOBILE_SCALE, MIN_RECENT_FILES, MIN_STORAGE_RINGS,
	COLUMN_VIEW_MODES, FOLDER_COLOR_KEYS, SORT_MODE_VALUES, normalizeMobileSettings,
} from "./pure";
import type ColumnExplorerPlugin from "./main";

// Границы и список режимов живут в pure.ts (их использует normalizeSettings);
// здесь реэкспорт, чтобы остальные модули импортировали их как раньше
export {
	FOLDER_COLOR_KEYS,
	MAX_COLUMN_WIDTH, MAX_RECENT_FILES, MIN_COLUMN_WIDTH, MIN_RECENT_FILES,
	ROOT_COLUMN_EXTRA_WIDTH, SORT_MODE_VALUES,
} from "./pure";

export type SortMode = (typeof SORT_MODE_VALUES)[number];
export type ColumnViewMode = (typeof COLUMN_VIEW_MODES)[number];
export type FolderColorKey = (typeof FOLDER_COLOR_KEYS)[number];

/** Пауза перед сохранением текстового поля настроек — гасит запись на букву. */
const TEXT_INPUT_SAVE_DELAY_MS = 500;

export interface ColumnExplorerSettings {
	foldersFirst: boolean;
	showExtensions: boolean;
	showPreview: boolean;
	showMarkdownPreview: boolean;
	confirmDelete: boolean;
	autoReveal: boolean;
	/** Default column width; individual columns can override it. */
	columnWidth: number;
	/** Per-folder column width overrides (path → px), set by dragging the edge. */
	columnWidths: Record<string, number>;
	/** Auto-resize the sidebar panel to fit all open columns. */
	autoPanelResize: boolean;
	/** Deprecated persisted inverse of autoPanelResize. Kept for downgrade compatibility. */
	lockColumnWidths: boolean;
	sortMode: SortMode;
	excludePatterns: string;
	folderColors: Record<string, FolderColorKey>;
	columnViewModes: Record<string, ColumnViewMode>;
	/** Pinned paths → pin order (0 = topmost). */
	pinnedPaths: Record<string, number>;
	/** Per-folder sort override; folders absent here use the global sortMode. */
	columnSortModes: Record<string, SortMode>;
	/** Custom folder icons (lucide icon ids). */
	folderIcons: Record<string, string>;
	openFolderNote: boolean;
	/** Locked column count: only the last N columns of the chain are shown. */
	lockedColumnCount: number | null;
	/** How many entries the virtual "Recent files" column shows. */
	recentFilesCount: number;
	/** Own recent-files tracker, newest first (Obsidian's stores only 25). */
	recentFiles: string[];
	/** Show the virtual "Recents" row in the root column. */
	showRecents: boolean;
	/** Include core Bookmarks items in the virtual Quick access row. */
	showBookmarks: boolean;
	/** Show the virtual "Calendar" row. */
	showCalendar: boolean;
	/** Show the virtual "Disk usage" row with the sunburst chart. */
	showStorage: boolean;
	/** Comma-separated vault paths the disk-usage scan skips. */
	storageExcluded: string;
	/** How many rings (nesting levels) the disk-usage chart draws at once. */
	storageRingCount: number;
	/** Where the virtual rows sit in the root column. */
	specialItemsPosition: "top" | "bottom";
	/** Where the open command and ribbon icon put the view. */
	openLocation: "sidebar" | "tab";
	/** Own favorite paths (files and folders), shown atop Quick access. */
	favorites: string[];
	/** Show the favorites section in Quick access. */
	showFavorites: boolean;
	/** Mobile UI scale in percent (90–150): rows, controls, text and spacing. */
	mobileUiScale: number;
	/** Icon size in px (22–36) for mobile toolbar, navigation and action bar. */
	mobileIconSize: number;
	/** Mark files the human has not opened yet, and ones edited since they did. */
	showUnreadMarkers: boolean;
	/** When the human last opened a file: path → timestamp (ms). */
	seenAt: Record<string, number>;
	/**
	 * Момент включения фичи. Файлы старше него «новыми» не считаются — иначе
	 * после установки плагина весь vault оказался бы помечен. 0 — ещё не
	 * проставлен, метку ставит первый запуск (main.ts).
	 */
	unreadBaseline: number;
}

export const DEFAULT_SETTINGS: ColumnExplorerSettings = {
	foldersFirst: true,
	showExtensions: true,
	showPreview: false,
	showMarkdownPreview: true,
	confirmDelete: true,
	autoReveal: false,
	columnWidth: DEFAULT_COLUMN_WIDTH,
	columnWidths: {},
	autoPanelResize: false,
	lockColumnWidths: true,
	sortMode: "name-asc",
	excludePatterns: "",
	folderColors: {},
	columnViewModes: {},
	pinnedPaths: {},
	columnSortModes: {},
	folderIcons: {},
	openFolderNote: false,
	lockedColumnCount: null,
	recentFilesCount: DEFAULT_RECENT_FILES,
	recentFiles: [],
	showRecents: true,
	showBookmarks: true,
	showCalendar: true,
	showStorage: true,
	storageExcluded: "",
	storageRingCount: DEFAULT_STORAGE_RINGS,
	specialItemsPosition: "top",
	openLocation: "sidebar",
	favorites: [],
	showFavorites: true,
	mobileUiScale: DEFAULT_MOBILE_SCALE,
	mobileIconSize: DEFAULT_MOBILE_ICON,
	showUnreadMarkers: true,
	seenAt: {},
	unreadBaseline: 0,
};

/** Keep the canonical panel mode and its persisted legacy inverse in sync. */
export function setPanelAutoResize(
	settings: Pick<ColumnExplorerSettings, "autoPanelResize" | "lockColumnWidths">,
	enabled: boolean,
): void {
	settings.autoPanelResize = enabled;
	settings.lockColumnWidths = !enabled;
}

export class ColumnExplorerSettingTab extends PluginSettingTab {
	/** Синхронизация мобильных слайдеров и подписей после сброса. */
	private refreshMobileSliders?: () => void;
	/** Отложенное сохранение текстовых полей — флашится при закрытии вкладки. */
	private saveTextInput?: { (): void; cancel(): void; run(): unknown };

	constructor(app: App, private plugin: ColumnExplorerPlugin) {
		super(app, plugin);
	}

	/**
	 * Declarative settings (Obsidian 1.13+): powers the settings search.
	 * Older versions fall back to display() below.
	 */
	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				type: "group", heading: t("headAppearance"), items: [
					{ name: t("setFoldersFirst"), desc: t("setFoldersFirstDesc"), control: { type: "toggle", key: "foldersFirst" } },
					{ name: t("setShowExt"), desc: t("setShowExtDesc"), control: { type: "toggle", key: "showExtensions" } },
					{ name: t("setPreview"), desc: t("setPreviewDesc"), control: { type: "toggle", key: "showPreview" } },
						{
							name: t("setMdPreview"), desc: t("setMdPreviewDesc"),
							visible: () => this.plugin.settings.showPreview,
							control: { type: "toggle", key: "showMarkdownPreview" },
						},
					{ name: t("setShowUnread"), desc: t("setShowUnreadDesc"), control: { type: "toggle", key: "showUnreadMarkers" } },
				],
			},
			{
				type: "group", heading: t("headBehavior"), items: [
					{
						name: t("setOpenLocation"), desc: t("setOpenLocationDesc"),
						control: { type: "dropdown", key: "openLocation", options: { sidebar: t("locSidebar"), tab: t("locTab") } },
					},
					{
						name: t("setSort"),
						control: {
							type: "dropdown", key: "sortMode",
							options: {
								"name-asc": t("sortNameAsc"), "name-desc": t("sortNameDesc"),
								"mtime-desc": t("sortMtimeDesc"), "mtime-asc": t("sortMtimeAsc"),
								"ctime-desc": t("sortCtimeDesc"), "ctime-asc": t("sortCtimeAsc"),
								"size-desc": t("sortSizeDesc"), "size-asc": t("sortSizeAsc"),
							},
						},
					},
					{ name: t("setAutoReveal"), desc: t("setAutoRevealDesc"), control: { type: "toggle", key: "autoReveal" } },
					{ name: t("setFolderNote"), desc: t("setFolderNoteDesc"), control: { type: "toggle", key: "openFolderNote" } },
					{ name: t("setConfirmDelete"), desc: t("setConfirmDeleteDesc"), control: { type: "toggle", key: "confirmDelete" } },
					{ name: t("setExclude"), desc: t("setExcludeDesc"), control: { type: "text", key: "excludePatterns" } },
				],
			},
			{
				type: "group", heading: t("headColumns"), items: [
					{ name: t("setAutoPanel"), desc: t("setAutoPanelDesc"), control: { type: "toggle", key: "autoPanelResize" } },
					{
						name: t("setColWidth"), desc: t("setColWidthDesc"),
						control: { type: "slider", key: "columnWidth", min: MIN_COLUMN_WIDTH, max: MAX_COLUMN_WIDTH, step: 10 },
					},
					{ name: t("resetWidths"), desc: t("resetWidthsDesc"), action: () => void this.resetColumnWidths() },
				],
			},
			{
				type: "group", heading: t("headSpecial"), items: [
					{
						name: t("setSpecialPos"), desc: t("setSpecialPosDesc"),
						control: { type: "dropdown", key: "specialItemsPosition", options: { top: t("posTop"), bottom: t("posBottom") } },
					},
					{ name: t("setShowRecents"), desc: t("setShowRecentsDesc"), control: { type: "toggle", key: "showRecents" } },
					{
						name: t("setRecentCount"), desc: t("setRecentCountDesc"),
						visible: () => this.plugin.settings.showRecents,
						control: { type: "number", key: "recentFilesCount", min: MIN_RECENT_FILES, max: MAX_RECENT_FILES, step: 1 },
					},
					{
						name: t("clearRecents"), desc: t("clearRecentsDesc"),
						visible: () => this.plugin.settings.showRecents,
						action: () => void this.clearRecents(),
					},
					{ name: t("setShowFavorites"), desc: t("setShowFavoritesDesc"), control: { type: "toggle", key: "showFavorites" } },
					{ name: t("setShowBookmarks"), desc: t("setShowBookmarksDesc"), control: { type: "toggle", key: "showBookmarks" } },
					{ name: t("setShowCalendar"), desc: t("setShowCalendarDesc"), control: { type: "toggle", key: "showCalendar" } },
					{ name: t("setShowStorage"), desc: t("setShowStorageDesc"), control: { type: "toggle", key: "showStorage" } },
					{
						name: t("setStorageExclude"), desc: t("setStorageExcludeDesc"),
						visible: () => this.plugin.settings.showStorage,
						control: { type: "text", key: "storageExcluded" },
					},
					{
						name: t("setStorageRings"), desc: t("setStorageRingsDesc"),
						visible: () => this.plugin.settings.showStorage,
						control: { type: "slider", key: "storageRingCount", min: MIN_STORAGE_RINGS, max: MAX_STORAGE_RINGS, step: 1 },
					},
				],
			},
			{
				type: "group", heading: t("headMobile"), items: [
					{
						name: t("setMobileScale"), desc: t("setMobileScaleDesc"),
						control: { type: "slider", key: "mobileUiScale", min: MIN_MOBILE_SCALE, max: MAX_MOBILE_SCALE, step: 5 },
					},
					{
						name: t("setMobileIcon"), desc: t("setMobileIconDesc"),
						control: { type: "slider", key: "mobileIconSize", min: MIN_MOBILE_ICON, max: MAX_MOBILE_ICON, step: 2 },
					},
					{ name: t("resetMobileSizes"), action: () => void this.resetMobileSizes() },
				],
			},
		];
	}

	private async resetColumnWidths() {
		this.plugin.settings.columnWidths = {};
		await this.plugin.saveSettings();
		this.plugin.getView()?.render();
		new Notice(t("widthsReset"));
	}

	private async clearRecents() {
		this.plugin.settings.recentFiles = [];
		await this.plugin.saveSettings();
		this.plugin.getView()?.render();
		new Notice(t("recentsCleared"));
	}

	/** Сброс мобильных размеров к дефолтным, с обновлением открытых слайдеров. */
	private async resetMobileSizes() {
		const s = this.plugin.settings;
		s.mobileUiScale = DEFAULT_MOBILE_SCALE;
		s.mobileIconSize = DEFAULT_MOBILE_ICON;
		await this.plugin.saveSettings();
		this.plugin.getView()?.applyMobileScale();
		this.refreshMobileSliders?.();
		new Notice(t("mobileSizesReset"));
	}

	/** Self-contained override — avoids calling the 1.13-only base implementation. */
	async setControlValue(key: string, value: unknown) {
		if (key === "mobileUiScale" || key === "mobileIconSize") {
			const s = this.plugin.settings;
			const normalized = normalizeMobileSettings({ ...s, [key]: value });
			s.mobileUiScale = normalized.mobileUiScale;
			s.mobileIconSize = normalized.mobileIconSize;
			await this.plugin.saveSettings();
			// Размеры живут в CSS-переменных — полный render не нужен
			this.plugin.getView()?.applyMobileScale();
			return;
		}
		if (key === "recentFilesCount" && typeof value === "number") {
			value = Math.max(MIN_RECENT_FILES, Math.min(MAX_RECENT_FILES, Math.round(value)));
		}
		if (key === "autoPanelResize" && typeof value === "boolean") {
			setPanelAutoResize(this.plugin.settings, value);
		} else {
			(this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
		}
		await this.plugin.saveSettings();
		this.plugin.getView()?.render();
		if (requireApiVersion("1.13.0") && (key === "showPreview" || key === "showRecents" || key === "showStorage")) {
			// Re-evaluate predicates without rebuilding the settings DOM (Obsidian 1.13+).
			// The optional call keeps the legacy 1.8.7 runtime compatible.
			this.refreshDomState?.();
		}
	}

	/** Закрытие вкладки не должно ждать дебаунса — дописываем сразу. */
	hide() {
		this.saveTextInput?.run();
	}

	display() {
		this.renderLegacySettings();
	}

	private renderLegacySettings() {
		const { containerEl } = this;
		containerEl.empty();
		const s = this.plugin.settings;
		const save = async () => {
			await this.plugin.saveSettings();
			this.plugin.getView()?.render();
		};
		const saveAndRedisplay = async () => {
			await save();
			this.renderLegacySettings();
		};
		// Текстовые поля шлют onChange на каждую букву: запись data.json плюс
		// полный рендер всех колонок на нажатие клавиши заметно лагают
		const saveTextInput = debounce(() => void save(), TEXT_INPUT_SAVE_DELAY_MS, true);
		this.saveTextInput = saveTextInput;

		new Setting(containerEl).setName(t("headAppearance")).setHeading();

		new Setting(containerEl).setName(t("setFoldersFirst")).setDesc(t("setFoldersFirstDesc"))
			.addToggle(tg => tg.setValue(s.foldersFirst).onChange(async (v) => { s.foldersFirst = v; await save(); }));

		new Setting(containerEl).setName(t("setShowExt")).setDesc(t("setShowExtDesc"))
			.addToggle(tg => tg.setValue(s.showExtensions).onChange(async (v) => { s.showExtensions = v; await save(); }));

		new Setting(containerEl).setName(t("setPreview")).setDesc(t("setPreviewDesc"))
			.addToggle(tg => tg.setValue(s.showPreview).onChange(async (v) => { s.showPreview = v; await saveAndRedisplay(); }));

		if (s.showPreview) {
			new Setting(containerEl).setName(t("setMdPreview")).setDesc(t("setMdPreviewDesc"))
				.addToggle(tg => tg.setValue(s.showMarkdownPreview).onChange(async (v) => { s.showMarkdownPreview = v; await save(); }));
		}

		new Setting(containerEl).setName(t("setShowUnread")).setDesc(t("setShowUnreadDesc"))
			.addToggle(tg => tg.setValue(s.showUnreadMarkers).onChange(async (v) => { s.showUnreadMarkers = v; await save(); }));

		new Setting(containerEl).setName(t("headBehavior")).setHeading();

		new Setting(containerEl).setName(t("setOpenLocation")).setDesc(t("setOpenLocationDesc"))
			.addDropdown(d => d
				.addOption("sidebar", t("locSidebar"))
				.addOption("tab", t("locTab"))
				.setValue(s.openLocation)
				.onChange(async (v) => { s.openLocation = v === "tab" ? "tab" : "sidebar"; await save(); }));

		new Setting(containerEl).setName(t("setSort"))
			.addDropdown(d => d
				.addOption("name-asc", t("sortNameAsc"))
				.addOption("name-desc", t("sortNameDesc"))
				.addOption("mtime-desc", t("sortMtimeDesc"))
				.addOption("mtime-asc", t("sortMtimeAsc"))
				.addOption("ctime-desc", t("sortCtimeDesc"))
				.addOption("ctime-asc", t("sortCtimeAsc"))
				.addOption("size-desc", t("sortSizeDesc"))
				.addOption("size-asc", t("sortSizeAsc"))
				.setValue(s.sortMode)
				.onChange(async (v) => { s.sortMode = v as SortMode; await save(); }));

		new Setting(containerEl).setName(t("setAutoReveal")).setDesc(t("setAutoRevealDesc"))
			.addToggle(tg => tg.setValue(s.autoReveal).onChange(async (v) => { s.autoReveal = v; await save(); }));

		new Setting(containerEl).setName(t("setFolderNote")).setDesc(t("setFolderNoteDesc"))
			.addToggle(tg => tg.setValue(s.openFolderNote).onChange(async (v) => { s.openFolderNote = v; await save(); }));

		new Setting(containerEl).setName(t("setConfirmDelete")).setDesc(t("setConfirmDeleteDesc"))
			.addToggle(tg => tg.setValue(s.confirmDelete).onChange(async (v) => { s.confirmDelete = v; await save(); }));

		new Setting(containerEl).setName(t("setExclude")).setDesc(t("setExcludeDesc"))
			.addText(txt => txt.setValue(s.excludePatterns)
				.onChange((v) => { s.excludePatterns = v; saveTextInput(); }));

		new Setting(containerEl).setName(t("headColumns")).setHeading();

		new Setting(containerEl).setName(t("setAutoPanel")).setDesc(t("setAutoPanelDesc"))
			.addToggle(tg => tg.setValue(s.autoPanelResize).onChange(async (v) => { setPanelAutoResize(s, v); await save(); }));

		new Setting(containerEl).setName(t("setColWidth")).setDesc(t("setColWidthDesc"))
			.addSlider(sl => sl.setLimits(MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH, 10)
				.setValue(s.columnWidth)
				.onChange(async (v) => { s.columnWidth = v; await save(); }));

		new Setting(containerEl).setName(t("resetWidths")).setDesc(t("resetWidthsDesc"))
			.addButton(b => b.setButtonText(t("reset")).onClick(() => void this.resetColumnWidths()));

		new Setting(containerEl).setName(t("headSpecial")).setHeading();

		new Setting(containerEl).setName(t("setSpecialPos")).setDesc(t("setSpecialPosDesc"))
			.addDropdown(d => d
				.addOption("top", t("posTop"))
				.addOption("bottom", t("posBottom"))
				.setValue(s.specialItemsPosition)
				.onChange(async (v) => { s.specialItemsPosition = v === "bottom" ? "bottom" : "top"; await save(); }));

		new Setting(containerEl).setName(t("setShowRecents")).setDesc(t("setShowRecentsDesc"))
			.addToggle(tg => tg.setValue(s.showRecents).onChange(async (v) => { s.showRecents = v; await saveAndRedisplay(); }));

		if (s.showRecents) {
			new Setting(containerEl).setName(t("setRecentCount")).setDesc(t("setRecentCountDesc"))
				.addText(txt => {
					txt.inputEl.type = "number";
					txt.setValue(String(s.recentFilesCount))
						.onChange(async (v) => {
							const n = Number(v);
							if (!Number.isFinite(n)) return;
							s.recentFilesCount = Math.max(MIN_RECENT_FILES, Math.min(MAX_RECENT_FILES, Math.round(n)));
							await save();
						});
				});

			new Setting(containerEl).setName(t("clearRecents")).setDesc(t("clearRecentsDesc"))
				.addButton(b => b.setButtonText(t("clear")).onClick(() => void this.clearRecents()));
		}

		new Setting(containerEl).setName(t("setShowFavorites")).setDesc(t("setShowFavoritesDesc"))
			.addToggle(tg => tg.setValue(s.showFavorites).onChange(async (v) => { s.showFavorites = v; await save(); }));

		new Setting(containerEl).setName(t("setShowBookmarks")).setDesc(t("setShowBookmarksDesc"))
			.addToggle(tg => tg.setValue(s.showBookmarks).onChange(async (v) => { s.showBookmarks = v; await save(); }));

		new Setting(containerEl).setName(t("setShowCalendar")).setDesc(t("setShowCalendarDesc"))
			.addToggle(tg => tg.setValue(s.showCalendar).onChange(async (v) => { s.showCalendar = v; await save(); }));

		new Setting(containerEl).setName(t("setShowStorage")).setDesc(t("setShowStorageDesc"))
			.addToggle(tg => tg.setValue(s.showStorage).onChange(async (v) => { s.showStorage = v; await saveAndRedisplay(); }));

		if (s.showStorage) {
			new Setting(containerEl).setName(t("setStorageExclude")).setDesc(t("setStorageExcludeDesc"))
				.addText(txt => txt.setValue(s.storageExcluded)
					.onChange((v) => { s.storageExcluded = v; saveTextInput(); }));

			new Setting(containerEl).setName(t("setStorageRings")).setDesc(t("setStorageRingsDesc"))
				.addSlider(sl => sl.setLimits(MIN_STORAGE_RINGS, MAX_STORAGE_RINGS, 1)
					.setValue(s.storageRingCount)
					.onChange(async (v) => { s.storageRingCount = v; await save(); }));
		}

		new Setting(containerEl).setName(t("headMobile")).setHeading();

		// Размеры живут в CSS-переменных — на каждое движение слайдера
		// перерисовывать колонки не нужно
		const saveMobile = async () => {
			await this.plugin.saveSettings();
			this.plugin.getView()?.applyMobileScale();
		};

		// Текущее значение Obsidian показывает рядом со слайдером сам
		let scaleSlider: SliderComponent | null = null;
		new Setting(containerEl).setName(t("setMobileScale")).setDesc(t("setMobileScaleDesc"))
			.addSlider(sl => {
				scaleSlider = sl;
				sl.setLimits(MIN_MOBILE_SCALE, MAX_MOBILE_SCALE, 5)
					.setValue(s.mobileUiScale)
					.onChange(async (v) => { s.mobileUiScale = v; await saveMobile(); });
			});

		let iconSlider: SliderComponent | null = null;
		new Setting(containerEl).setName(t("setMobileIcon")).setDesc(t("setMobileIconDesc"))
			.addSlider(sl => {
				iconSlider = sl;
				sl.setLimits(MIN_MOBILE_ICON, MAX_MOBILE_ICON, 2)
					.setValue(s.mobileIconSize)
					.onChange(async (v) => { s.mobileIconSize = v; await saveMobile(); });
			});

		this.refreshMobileSliders = () => {
			scaleSlider?.setValue(s.mobileUiScale);
			iconSlider?.setValue(s.mobileIconSize);
		};

		new Setting(containerEl).setName(t("resetMobileSizes"))
			.addButton(b => b.setButtonText(t("reset")).onClick(() => void this.resetMobileSizes()));
	}
}
