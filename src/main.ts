import { Plugin, TFile, WorkspaceLeaf, debounce } from "obsidian";
import { t } from "./i18n";
import {
	DAY_PATH_PREFIX, normalizeMobileSettings, normalizeSettings, prunePathKeys,
	pushRecent, remapPathKeys, remapPathList,
} from "./pure";
import { ColumnExplorerSettings, ColumnExplorerSettingTab, DEFAULT_SETTINGS, MAX_RECENT_FILES } from "./settings";
import { ColumnExplorerView, VIEW_TYPE_COLUMNS } from "./view";

/** Окно склейки отложенных записей настроек. */
const SAVE_DEBOUNCE_MS = 1000;

export default class ColumnExplorerPlugin extends Plugin {
	settings: ColumnExplorerSettings = DEFAULT_SETTINGS;
	private shouldSeedRecents = false;
	/** Плагин ещё ни разу ничего не сохранял — значит, его только что поставили. */
	private isFirstRun = false;
	/**
	 * Отложенная запись настроек для событий, приходящих пачками: открытие
	 * файлов и, главное, rename/delete — при удалении папки на N файлов
	 * немедленная запись означала бы N перезаписей data.json подряд.
	 */
	private saveQueued = debounce(() => void this.saveSettings(), SAVE_DEBOUNCE_MS);

	async onload() {
		await this.loadSettings();

		// Свой трекер недавних: встроенный в Obsidian хранит максимум 25 md.
		// Первый запуск — засев из него, дальше копим сами (кап 50)
		if (this.shouldSeedRecents) {
			this.settings.recentFiles = this.app.workspace.getLastOpenFiles();
		}
		// Отложенная запись не должна теряться при выгрузке плагина
		this.register(() => this.saveQueued.run());
		this.registerEvent(this.app.workspace.on("file-open", (f) => {
			if (!f) return;
			this.settings.recentFiles = pushRecent(this.settings.recentFiles, f.path, MAX_RECENT_FILES);
			this.markSeen(f.path, Date.now());
			this.saveQueued();
			// Открыли — маркер непрочитанного гаснет тут же
			this.getView()?.updateUnreadMarker(f.path);
			this.getView()?.refreshRecentsColumn(f.path);
		}));
		this.registerEvent(this.app.vault.on("rename", (f, oldPath) => {
			this.settings.recentFiles = remapPathList(this.settings.recentFiles, oldPath, f.path);
			this.settings.favorites = remapPathList(this.settings.favorites, oldPath, f.path);
			this.settings.seenAt = remapPathKeys(this.settings.seenAt, oldPath, f.path);
			this.saveQueued();
		}));
		this.registerEvent(this.app.vault.on("delete", (f) => {
			const dropDeleted = (p: string) => p !== f.path && !p.startsWith(f.path + "/");
			this.settings.recentFiles = this.settings.recentFiles.filter(dropDeleted);
			this.settings.favorites = this.settings.favorites.filter(dropDeleted);
			this.settings.seenAt = prunePathKeys(this.settings.seenAt, f.path);
			this.saveQueued();
		}));

		// Правка файла, на который человек сейчас смотрит, — это его
		// собственная правка: двигаем метку прочтения за mtime, иначе файл
		// пометил бы себя «изменён кем-то другим». Правки в неактивных файлах
		// (агент, бот, sync) метку не трогают — из них и растёт маркер
		this.registerEvent(this.app.vault.on("modify", (f) => {
			if (this.app.workspace.getActiveFile()?.path !== f.path) {
				// Чужая правка: метка не двигается, но зажечь точку надо сразу
				this.getView()?.updateUnreadMarker(f.path);
				return;
			}
			this.markSeen(f.path, f instanceof TFile ? f.stat.mtime : Date.now());
			this.saveQueued();
		}));

		this.registerView(VIEW_TYPE_COLUMNS, (leaf) => new ColumnExplorerView(leaf, this));
		this.addSettingTab(new ColumnExplorerSettingTab(this.app, this));

		this.addRibbonIcon("columns-3", "Column Explorer", () => void this.activateView());

		this.addCommand({
			id: "open-view",
			name: t("cmdOpen"),
			callback: () => void this.activateView(),
		});

		this.addCommand({
			id: "reveal-active-file",
			name: t("cmdReveal"),
			callback: async () => {
				const view = await this.activateView();
				view?.revealFile(this.app.workspace.getActiveFile());
			},
		});

		// Условие — существование ЛИСТА, а не загруженной вью: в сайдбаре она
		// остаётся отложенной, пока по вкладке не кликнули, и проверка на
		// загруженную вью прятала бы команды до первого клика
		this.addCommand({
			id: "focus-view",
			name: t("cmdFocus"),
			callback: async () => {
				const view = await this.activateView();
				view?.focusColumns();
			},
		});

		this.addCommand({
			id: "new-note-here",
			name: t("cmdNewNote"),
			checkCallback: (checking) => {
				if (!this.getViewLeaf()) return false;
				if (!checking) void this.withView((view) => void view.createNote(view.currentFolder()));
				return true;
			},
		});

		this.addCommand({
			id: "new-folder-here",
			name: t("cmdNewFolder"),
			checkCallback: (checking) => {
				if (!this.getViewLeaf()) return false;
				if (!checking) void this.withView((view) => void view.createFolder(view.currentFolder()));
				return true;
			},
		});

		// Сразу после установки плагин виден только иконкой в ribbon, которую
		// ещё надо заметить среди прочих. Открываем вью один раз сами —
		// дальше её положение хранит workspace, и мы в него не вмешиваемся
		if (this.isFirstRun) {
			this.app.workspace.onLayoutReady(() => void this.activateView());
		}

		this.registerEvent(this.app.workspace.on("active-leaf-change", () => {
			const view = this.getView();
			if (!view) return;
			view.updateActiveFileHighlight();
			if (this.settings.autoReveal) {
				const active = this.app.workspace.getActiveFile();
				if (active && view.selectedFilePath() !== active.path) view.revealFile(active);
			}
		}));
	}

	async loadSettings() {
		const data = (await this.loadData()) as Partial<ColumnExplorerSettings> | null;
		const merged = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
		// data.json правится руками и переживает откаты версий — числа, enum'ы
		// и ширины колонок приводим в допустимые границы, прежде чем на них
		// начнут опираться CSS-переменные и запросы к vault
		this.settings = {
			...merged,
			// Normalize the persisted object itself so migrations can distinguish a
			// missing legacy key from a newly supplied default.
			...normalizeSettings(data ?? {}),
			...normalizeMobileSettings(merged),
		};
		// Сид недавних только при ПЕРВОМ запуске (ключа ещё нет в data.json) —
		// иначе «Очистить недавние» отменялось бы каждым перезапуском
		this.shouldSeedRecents = data?.recentFiles === undefined;
		this.isFirstRun = data === null;
		// Ширины колонок дня раньше писались под ключ с датой — чистим мусор
		const widths = this.settings.columnWidths;
		const staleDayKeys = Object.keys(widths).filter((k) => k.startsWith(DAY_PATH_PREFIX) && k !== DAY_PATH_PREFIX);
		if (staleDayKeys.length > 0) {
			this.settings.columnWidths = Object.fromEntries(
				Object.entries(widths).filter(([k]) => !staleDayKeys.includes(k))
			);
		}
		// Момент отсчёта «новизны» ставится один раз — на первом запуске с
		// фичей. Без него после апдейта новыми были бы все файлы vault
		if (this.settings.unreadBaseline === 0) {
			this.settings.unreadBaseline = Date.now();
		}
		this.migratePinnedPaths();
	}

	/** v1.3.x stored pins as `true`; convert to numeric order once. */
	private migratePinnedPaths() {
		const raw: unknown = this.settings.pinnedPaths;
		// data.json правится руками: строка или null вместо объекта уронили бы
		// загрузку плагина целиком на первом же обращении к ключам
		const entries = typeof raw === "object" && raw !== null && !Array.isArray(raw)
			? Object.entries(raw as Record<string, unknown>)
			: [];
		const isOrder = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
		// Булевым — номера после максимального существующего: смешанные данные
		// (откат версии и обратно) иначе давали бы двум пинам один порядок
		const numeric = entries.map(([, v]) => v).filter(isOrder);
		let next = numeric.length > 0 ? Math.max(...numeric) + 1 : 0;
		const migrated: Record<string, number> = {};
		for (const [path, value] of entries) {
			if (isOrder(value)) migrated[path] = value;
			// v1.3.x писал только `true`; всё прочее пином не считаем
			else if (value === true) migrated[path] = next++;
		}
		this.settings.pinnedPaths = migrated;
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/** Запись настроек со склейкой — для событий, приходящих пачками. */
	queueSaveSettings() {
		this.saveQueued();
	}

	/** Отметить файл прочитанным на момент `at`. Настройки не мутируются. */
	private markSeen(path: string, at: number) {
		this.settings.seenAt = { ...this.settings.seenAt, [path]: at };
	}

	/** Лист вью, даже если она ещё отложена (Obsidian 1.7.2+). */
	private getViewLeaf(): WorkspaceLeaf | null {
		return this.app.workspace.getLeavesOfType(VIEW_TYPE_COLUMNS)[0] ?? null;
	}

	/**
	 * Загруженная вью или null. Отложенную НЕ будит намеренно: подсветке
	 * активного файла и настройкам нечего обновлять в незагруженной вью.
	 */
	getView(): ColumnExplorerView | null {
		const leaf = this.getViewLeaf();
		return leaf?.view instanceof ColumnExplorerView ? leaf.view : null;
	}

	/** Действие пользователя над вью: отложенную сначала догружаем. */
	private async withView(fn: (view: ColumnExplorerView) => void) {
		const leaf = this.getViewLeaf();
		if (!leaf) return;
		await leaf.loadIfDeferred();
		if (leaf.view instanceof ColumnExplorerView) fn(leaf.view);
	}

	async activateView(): Promise<ColumnExplorerView | null> {
		const existing = this.getViewLeaf();
		// Уже открытую вью не переносим — где пользователь её оставил, там и
		// показываем; настройка решает только место для НОВОГО листа
		const leaf = existing ?? (this.settings.openLocation === "tab"
			? this.app.workspace.getLeaf("tab")
			: this.app.workspace.getLeftLeaf(false));
		if (!leaf) return null;
		if (!existing) await leaf.setViewState({ type: VIEW_TYPE_COLUMNS, active: true });
		await this.app.workspace.revealLeaf(leaf);
		await leaf.loadIfDeferred();
		return leaf.view instanceof ColumnExplorerView ? leaf.view : null;
	}
}
