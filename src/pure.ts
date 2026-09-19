/**
 * Pure helpers with no Obsidian dependency — unit-testable in isolation.
 */

// Один коллатор на модуль: localeCompare с опциями создаёт его на каждое сравнение
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function naturalCompare(a: string, b: string): number {
	return collator.compare(a, b);
}

/**
 * Совпадение имени с поисковым запросом: диапазоны символов и оценка.
 * Совместимо с результатом `prepareFuzzySearch` из Obsidian — сюда его и
 * передают, а в тестах подставляют простой подстрочный матчер.
 */
export interface NameMatch {
	score: number;
	matches: [number, number][];
}

export type NameMatcher = (text: string) => NameMatch | null;

/**
 * Отфильтровать элементы по матчеру имени. Порядок НЕ меняется: он задан
 * настройками сортировки колонки, а перестановка под курсором во время
 * набора ломала бы навигацию стрелками. `keepAlways` пропускает элементы
 * вне фильтра (папки — иначе не видно пути до вложенных совпадений).
 */
export function filterByMatcher<T>(
	items: readonly T[],
	nameOf: (item: T) => string,
	matcher: NameMatcher | null,
	keepAlways: (item: T) => boolean
): T[] {
	if (!matcher) return [...items];
	return items.filter((item) => keepAlways(item) || matcher(nameOf(item)) !== null);
}

/** Кусок имени для подсветки: совпавший или обычный. */
export interface NameChunk {
	text: string;
	hit: boolean;
}

/**
 * Разложить имя на куски по диапазонам совпадения. Соседние диапазоны
 * склеиваются, выходящие за длину строки игнорируются.
 */
export function matchRanges(name: string, ranges: readonly [number, number][]): NameChunk[] {
	const chunks: NameChunk[] = [];
	let pos = 0;
	for (const [start, end] of [...ranges].sort((a, b) => a[0] - b[0])) {
		const from = Math.max(pos, Math.min(start, name.length));
		const to = Math.max(from, Math.min(end, name.length));
		if (from >= to) continue;
		if (from > pos) chunks.push({ text: name.slice(pos, from), hit: false });
		const last = chunks[chunks.length - 1];
		// Соседние диапазоны — один кусок, иначе подсветка распадётся на span'ы
		if (last?.hit && from === pos) last.text += name.slice(from, to);
		else chunks.push({ text: name.slice(from, to), hit: true });
		pos = to;
	}
	if (pos < name.length) chunks.push({ text: name.slice(pos), hit: false });
	return chunks;
}

export function humanSize(bytes: number): string {
	if (bytes < 1024) return bytes + " B";
	const units = ["KB", "MB", "GB"];
	let value = bytes;
	let unitIndex = -1;
	do {
		value /= 1024;
		unitIndex++;
	} while (value >= 1024 && unitIndex < units.length - 1);
	return value.toFixed(1) + " " + units[unitIndex];
}

/**
 * Backslash-escape shell-special characters in an absolute path, matching what
 * macOS/terminal produces when you drag a file in: spaces, tildes and shell
 * metacharacters get a leading "\". Letters (any script, incl. Cyrillic),
 * digits and the path-safe chars `_ . / -` are left untouched.
 */
export function shellEscapePath(path: string): string {
	return path.replace(/[^\p{L}\p{N}_./-]/gu, "\\$&");
}

export function formatTemplate(template: string, vars: Record<string, string | number>): string {
	let result = template;
	for (const key of Object.keys(vars)) {
		// Функция-замена, а не строка: иначе "$&" и "$'" в имени файла
		// трактуются как спецпаттерны String.replace и портят подстановку
		result = result.replace("{" + key + "}", () => String(vars[key]));
	}
	return result;
}

export function parseExcludePatterns(raw: string): string[] {
	return raw
		.split(",")
		.map((p) => p.trim())
		.filter((p) => p.length > 0);
}

/** Glob to regexp: `*` — любой отрезок имени, `?` — ровно один символ. */
function globToRegExp(glob: string): RegExp {
	const escaped = glob
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		.replace(/\*/g, "[^/]*")
		.replace(/\?/g, "[^/]");
	return new RegExp("^" + escaped + "$");
}

/**
 * Remap path-keyed records (folder colors, view modes) when a file or
 * folder is renamed/moved. Returns a new object — never mutates.
 */
export function remapPathKeys<V>(record: Record<string, V>, oldPath: string, newPath: string): Record<string, V> {
	const result: Record<string, V> = {};
	for (const [key, value] of Object.entries(record)) {
		if (key === oldPath) result[newPath] = value;
		else if (key.startsWith(oldPath + "/")) result[newPath + key.slice(oldPath.length)] = value;
		else result[key] = value;
	}
	return result;
}

/** Drop entries for a deleted path and everything inside it. Returns a new object. */
export function prunePathKeys<V>(record: Record<string, V>, deletedPath: string): Record<string, V> {
	const result: Record<string, V> = {};
	for (const [key, value] of Object.entries(record)) {
		if (key === deletedPath || key.startsWith(deletedPath + "/")) continue;
		result[key] = value;
	}
	return result;
}

/**
 * Пути из множества за вычетом удалённого и всего, что внутри него.
 * Мультивыделение хранит пути детей: удаление папки должно уносить и их,
 * иначе мёртвые пути врут в счётчике и молча пропускаются операциями.
 * Returns a new Set — never mutates.
 */
export function prunePathSet(paths: Set<string>, deletedPath: string): Set<string> {
	const result = new Set<string>();
	for (const p of paths) {
		if (p === deletedPath || p.startsWith(deletedPath + "/")) continue;
		result.add(p);
	}
	return result;
}

/**
 * Pinned items (with a defined order) first, sorted by that order;
 * the rest keep their given order. Returns a new array.
 */
export function pinnedFirst<T>(items: T[], orderOf: (item: T) => number | undefined): T[] {
	const pinned: { item: T; order: number }[] = [];
	const rest: T[] = [];
	for (const item of items) {
		const order = orderOf(item);
		if (order === undefined) rest.push(item);
		else pinned.push({ item, order });
	}
	pinned.sort((a, b) => a.order - b.order);
	return [...pinned.map(p => p.item), ...rest];
}

/**
 * Reorder pins: place dragPath immediately before targetPath and renumber
 * all orders from zero. Returns a new record — never mutates.
 */
export function movePinnedBefore(
	pinned: Record<string, number>,
	dragPath: string,
	targetPath: string
): Record<string, number> {
	if (pinned[dragPath] === undefined || pinned[targetPath] === undefined || dragPath === targetPath) {
		return { ...pinned };
	}
	const ordered = Object.keys(pinned).sort((a, b) => pinned[a] - pinned[b]).filter(p => p !== dragPath);
	ordered.splice(ordered.indexOf(targetPath), 0, dragPath);
	const result: Record<string, number> = {};
	ordered.forEach((path, i) => { result[path] = i; });
	return result;
}

/**
 * Whether a folder column is visible when the column count is locked.
 * The first `lockedCount − 1` columns stay frozen in place, the last slot
 * always shows the deepest folder of the chain (navigation happens in it);
 * intermediate columns between them are hidden.
 */
export function lockedColumnVisible(depth: number, folderColumns: number, lockedCount: number | null): boolean {
	if (lockedCount === null) return true;
	return depth < Math.max(1, lockedCount) - 1 || depth === folderColumns - 1;
}

/** Parse a drag payload: JSON array of vault paths, or a single raw path. */
export function parseDragPaths(raw: string): string[] {
	if (!raw) return [];
	try {
		const parsed: unknown = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.map(String) : [raw];
	} catch {
		return [raw];
	}
}

/** Auto panel resize: the panel never grows past this share of the window. */
export const MAX_PANEL_WINDOW_RATIO = 0.6;

/**
 * Panel width that fits `contentWidth` px of columns, capped at
 * MAX_PANEL_WINDOW_RATIO of the window but never below `minWidth`.
 */
export function desiredPanelWidth(contentWidth: number, windowWidth: number, minWidth: number): number {
	const capped = Math.min(contentWidth, windowWidth * MAX_PANEL_WINDOW_RATIO);
	return Math.max(minWidth, capped);
}

/**
 * First free vault path for `fileName` inside `folderPath` ("" = root):
 * "photo.png", then "photo 1.png", "photo 2.png"… `taken` holds occupied paths.
 */
export function availablePath(folderPath: string, fileName: string, taken: ReadonlySet<string>): string {
	const prefix = folderPath ? folderPath + "/" : "";
	if (!taken.has(prefix + fileName)) return prefix + fileName;
	const dot = fileName.lastIndexOf(".");
	const base = dot > 0 ? fileName.slice(0, dot) : fileName;
	const ext = dot > 0 ? fileName.slice(dot) : "";
	let counter = 1;
	while (taken.has(`${prefix}${base} ${counter}${ext}`)) counter++;
	return `${prefix}${base} ${counter}${ext}`;
}

/**
 * Sentinel "path" of the virtual Recents column. Colons are illegal in
 * Obsidian file names, so it can never collide with a real vault path.
 */
export const RECENTS_PATH = "::recents::";
export const BOOKMARKS_PATH = "::bookmarks::";
export const STORAGE_PATH = "::storage::";
export const CALENDAR_PATH = "::calendar::";
/** Префикс сентинела дня календаря: "::day::2026-07-19". */
export const DAY_PATH_PREFIX = "::day::";

/** Local-timezone "YYYY-MM-DD" key for a unix timestamp (ms). */
export function dayKey(ts: number): string {
	const d = new Date(ts);
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * Календарная сетка месяца: массив недель по 7 ячеек (недели с понедельника),
 * в ячейке — dayKey или null вне месяца. `month` — 0-based.
 */
export function monthGrid(year: number, month: number): (string | null)[][] {
	const daysInMonth = new Date(year, month + 1, 0).getDate();
	// getDay(): 0 = воскресенье → сдвигаем к понедельнику
	const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
	const cells = new Array<string | null>(firstWeekday).fill(null);
	for (let day = 1; day <= daysInMonth; day++) {
		cells.push(dayKey(new Date(year, month, day).getTime()));
	}
	while (cells.length % 7 !== 0) cells.push(null);
	const weeks: (string | null)[][] = [];
	for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
	return weeks;
}

/** Prepend `path` to a recents list: dedupe, cap at `limit`. New array. */
export function pushRecent(list: string[], path: string, limit: number): string[] {
	return [path, ...list.filter((p) => p !== path)].slice(0, limit);
}

/** Rename-aware update of a path list (exact match or children). New array. */
export function remapPathList(list: string[], oldPath: string, newPath: string): string[] {
	return list.map((p) => {
		if (p === oldPath) return newPath;
		if (p.startsWith(oldPath + "/")) return newPath + p.slice(oldPath.length);
		return p;
	});
}

/** First `limit` paths that pass the `exists` check, original order kept. */
export function takeFirstExisting(paths: string[], exists: (path: string) => boolean, limit: number): string[] {
	const result: string[] = [];
	for (const path of paths) {
		if (result.length >= limit) break;
		if (exists(path)) result.push(path);
	}
	return result;
}

/* ------------------------------ mobile --------------------------------- */

/** Свайп засчитывается, только если палец начал не дальше этого от края. */
export const EDGE_ZONE_PX = 24;
/** Минимальный горизонтальный путь свайпа. */
export const SWIPE_MIN_DISTANCE_PX = 60;
/** Во сколько раз горизонталь должна превосходить вертикаль. */
export const SWIPE_RATIO = 1.5;

export interface EdgeSwipe {
	startX: number;
	startY: number;
	endX: number;
	endY: number;
	containerWidth: number;
}

/**
 * Edge-swipe навигация: жест от левого края вправо — «назад», от правого
 * края влево — «вперёд». Null, если жест слишком короткий, слишком
 * вертикальный, начался вне краевой зоны или направлен «наружу».
 */
export function detectEdgeSwipe(swipe: EdgeSwipe): "back" | "forward" | null {
	const dx = swipe.endX - swipe.startX;
	const dy = swipe.endY - swipe.startY;
	if (Math.abs(dx) < SWIPE_MIN_DISTANCE_PX) return null;
	if (Math.abs(dx) < SWIPE_RATIO * Math.abs(dy)) return null;
	if (dx > 0 && swipe.startX <= EDGE_ZONE_PX) return "back";
	if (dx < 0 && swipe.startX >= swipe.containerWidth - EDGE_ZONE_PX) return "forward";
	return null;
}

/** Минимальная тач-цель: ниже неё палец промахивается. */
export const MIN_TOUCH_TARGET_PX = 44;

export const MIN_MOBILE_SCALE = 90;
export const MAX_MOBILE_SCALE = 150;
export const DEFAULT_MOBILE_SCALE = 115;
export const MIN_MOBILE_ICON = 22;
export const MAX_MOBILE_ICON = 36;
export const DEFAULT_MOBILE_ICON = 28;

function clampOrDefault(value: unknown, min: number, max: number, fallback: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	return Math.max(min, Math.min(max, Math.round(value)));
}

/**
 * Мобильные размеры из сохранённых настроек: значения вне диапазона
 * подрезаются, отсутствующие и нечисловые заменяются дефолтными.
 */
export function normalizeMobileSettings(raw: { mobileUiScale?: unknown; mobileIconSize?: unknown }): {
	mobileUiScale: number;
	mobileIconSize: number;
} {
	return {
		mobileUiScale: clampOrDefault(raw.mobileUiScale, MIN_MOBILE_SCALE, MAX_MOBILE_SCALE, DEFAULT_MOBILE_SCALE),
		mobileIconSize: clampOrDefault(raw.mobileIconSize, MIN_MOBILE_ICON, MAX_MOBILE_ICON, DEFAULT_MOBILE_ICON),
	};
}

/**
 * Размер кнопки тулбара: масштабированная тач-цель, но не шире, чем
 * позволяет разделить контейнер между кнопками. Ниже 44px не опускается
 * никогда — лучше горизонтальный поджим, чем непопадаемая кнопка.
 * `containerWidth` 0 — контейнер ещё не измерен.
 */
export function mobileControlSize(scale: number, containerWidth: number, buttonCount: number): number {
	const configured = Math.round(MIN_TOUCH_TARGET_PX * scale);
	const available = containerWidth > 0 ? Math.floor(containerWidth / buttonCount) : configured;
	return Math.max(MIN_TOUCH_TARGET_PX, Math.min(configured, available));
}

/** Долгое нажатие: длительность до срабатывания. */
export const LONG_PRESS_MS = 500;
/** Долгое нажатие: смещение пальца, после которого нажатие отменяется. */
export const LONG_PRESS_TOLERANCE_PX = 10;

export function exceedsMoveTolerance(dx: number, dy: number): boolean {
	return Math.hypot(dx, dy) > LONG_PRESS_TOLERANCE_PX;
}

export type PressPhase = "idle" | "pending" | "fired" | "cancelled";

export type PressEvent =
	| { type: "down" }
	| { type: "move"; dx: number; dy: number }
	| { type: "timeout" }
	| { type: "up" }
	| { type: "cancel" }
	| { type: "click" };

/**
 * Состояние жеста нажатия. "fired" переживает отпускание пальца — именно
 * по нему следующий click подавляется, а сам click гасит состояние.
 */
export function nextPressPhase(phase: PressPhase, event: PressEvent): PressPhase {
	switch (event.type) {
		case "down": return "pending";
		case "move": return phase === "pending" && exceedsMoveTolerance(event.dx, event.dy) ? "cancelled" : phase;
		case "timeout": return phase === "pending" ? "fired" : phase;
		case "up": return phase === "pending" ? "cancelled" : phase;
		case "cancel": return "cancelled";
		case "click": return phase === "fired" ? "idle" : phase;
	}
}

/** Что делает обычный тап по элементу на мобильном. */
export function mobileTapAction(state: { selectionMode: boolean; pressPhase: PressPhase }): "suppress" | "toggle" | "activate" {
	if (state.pressPhase === "fired") return "suppress";
	return state.selectionMode ? "toggle" : "activate";
}

/** Режим выделения закрывается, когда снято последнее выделение. */
export function mobileSelectionMode(active: boolean, selectedCount: number): boolean {
	return active && selectedCount > 0;
}

/**
 * Selection для перехода на уровень вверх: обрезаем цепочку до колонки,
 * родительской для самой глубокой видимой. Сентинелы спецпунктов ("::…")
 * считаются такими же «корнями колонки», как папки. Null — уже в корне.
 */
export function parentSelection(selection: string[], isFolder: (path: string) => boolean): string[] | null {
	const isColumnRoot = (path: string) => path.startsWith("::") || isFolder(path);
	for (let i = selection.length - 1; i >= 0; i--) {
		if (isColumnRoot(selection[i])) return selection.slice(0, i);
	}
	return null;
}

/**
 * Pattern semantics:
 * - "folder/"  — the folder itself and everything inside it
 * - "*.tmp"    — glob matched against the file name (not the full path);
 *                `*` is any run of characters, `?` is exactly one
 * - ".trash"   — plain substring matched against the full path
 */
export function matchesExcludePatterns(path: string, patterns: string[]): boolean {
	if (patterns.length === 0) return false;
	const name = path.split("/").pop() ?? path;
	return patterns.some((pattern) => {
		if (pattern.endsWith("/")) {
			const base = pattern.slice(0, -1);
			return path === base || path.startsWith(base + "/");
		}
		if (pattern.includes("*") || pattern.includes("?")) {
			return globToRegExp(pattern).test(name);
		}
		return path.includes(pattern);
	});
}

/* ------------------------------ errors --------------------------------- */

/** Текст ошибки для Notice: у Error берём message, остальное печатаем как есть. */
export function errorMessage(err: unknown): string {
	if (err instanceof Error) return err.message;
	if (typeof err === "string") return err;
	return String(err);
}

/* ---------------------------- settings --------------------------------- */

export const MIN_COLUMN_WIDTH = 140;
export const MAX_COLUMN_WIDTH = 500;
export const DEFAULT_COLUMN_WIDTH = 200;
/** Корневая колонка по умолчанию шире остальных — там самые длинные ярлыки. */
export const ROOT_COLUMN_EXTRA_WIDTH = 60;
/** Колонке с диаграммой нужен квадрат под кольца, а не список строк. */
export const DEFAULT_STORAGE_COLUMN_WIDTH = 420;

export const MIN_RECENT_FILES = 5;
export const MAX_RECENT_FILES = 50;
export const DEFAULT_RECENT_FILES = 10;

/** Единственный список режимов сортировки: меню и настройки берут его. */
export const SORT_MODE_VALUES = [
	"name-asc", "name-desc",
	"mtime-desc", "mtime-asc",
	"ctime-desc", "ctime-asc",
	"size-desc", "size-asc",
] as const;

export const SPECIAL_POSITIONS = ["top", "bottom"] as const;

/** Режимы отображения колонки: список или сетка миниатюр. */
export const COLUMN_VIEW_MODES = ["list", "grid"] as const;

/** Theme color keys — resolve to Obsidian's native `--color-*` CSS variables. */
export const FOLDER_COLOR_KEYS = ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink"] as const;

/** Сколько уровней вложенности показывает диаграмма «Использование диска». */
export const MIN_STORAGE_RINGS = 3;
export const MAX_STORAGE_RINGS = 8;
export const DEFAULT_STORAGE_RINGS = 5;

/** Где команда/ribbon открывают вью: левая панель или вкладка в основной области. */
export const OPEN_LOCATIONS = ["sidebar", "tab"] as const;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	return Math.max(min, Math.min(max, Math.round(value)));
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
	return typeof value === "string" && (allowed as readonly string[]).includes(value)
		? (value as T)
		: fallback;
}

/**
 * Запись «путь → значение из списка»: не-объект даёт {}, значения вне
 * списка выбрасываются вместе со своими ключами.
 */
function cleanEnumRecord<T extends string>(value: unknown, allowed: readonly T[]): Record<string, T> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
	const result: Record<string, T> = {};
	for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
		if (typeof raw === "string" && (allowed as readonly string[]).includes(raw)) result[key] = raw as T;
	}
	return result;
}

/** Запись «путь → строка» (иконки папок): не-объект даёт {}, не-строки выбрасываются. */
function cleanStringRecord(value: unknown): Record<string, string> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
	const result: Record<string, string> = {};
	for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
		if (typeof raw === "string") result[key] = raw;
	}
	return result;
}

/** Список путей: не-массив даёт [], не-строки выбрасываются. */
function cleanPathList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return (value as unknown[]).filter((p): p is string => typeof p === "string");
}

/** Числовые значения записи путь → ширина, вышедшие за пределы, отбрасываются. */
function cleanWidths(value: unknown): Record<string, number> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
	const result: Record<string, number> = {};
	for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
		if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
		if (raw < MIN_COLUMN_WIDTH || raw > MAX_COLUMN_WIDTH) continue;
		result[key] = Math.round(raw);
	}
	return result;
}

/**
 * Запас между открытием файла и его сохранением: правка самого пользователя
 * долетает до диска на секунду-две позже, чем сработал `file-open`, и без
 * допуска файл сразу же помечался бы «изменён кем-то другим».
 */
export const MTIME_TOLERANCE_MS = 2000;

/** Маркер непрочитанного: новый файл, изменённый чужой правкой или ничего. */
export type UnreadState = "new" | "modified" | null;

/**
 * Состояние файла для маркера непрочитанного.
 *
 * `seenAt` — когда человек последний раз открывал файл (undefined = никогда),
 * `baseline` — момент включения фичи: файлы старше него «новыми» не считаются,
 * иначе после установки плагина весь vault был бы помечен. `baseline === 0`
 * означает «фича ещё не инициализирована» — маркер «new» не выдаём вовсе.
 */
export function unreadState(
	stat: { ctime: number; mtime: number },
	seenAt: number | undefined,
	baseline: number,
): UnreadState {
	if (seenAt === undefined) {
		return baseline > 0 && stat.ctime > baseline ? "new" : null;
	}
	return stat.mtime > seenAt + MTIME_TOLERANCE_MS ? "modified" : null;
}

/** Записи «путь → время открытия»: всё, что не конечное положительное число, выбрасывается. */
export function cleanSeenAt(value: unknown): Record<string, number> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
	const result: Record<string, number> = {};
	for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
		if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) continue;
		result[key] = Math.round(raw);
	}
	return result;
}

export interface NormalizedSettings {
	autoPanelResize: boolean;
	lockColumnWidths: boolean;
	columnWidth: number;
	columnWidths: Record<string, number>;
	recentFilesCount: number;
	lockedColumnCount: number | null;
	sortMode: (typeof SORT_MODE_VALUES)[number];
	specialItemsPosition: (typeof SPECIAL_POSITIONS)[number];
	openLocation: (typeof OPEN_LOCATIONS)[number];
	storageRingCount: number;
	seenAt: Record<string, number>;
	unreadBaseline: number;
	folderColors: Record<string, (typeof FOLDER_COLOR_KEYS)[number]>;
	columnViewModes: Record<string, (typeof COLUMN_VIEW_MODES)[number]>;
	columnSortModes: Record<string, (typeof SORT_MODE_VALUES)[number]>;
	folderIcons: Record<string, string>;
	favorites: string[];
	recentFiles: string[];
}

/**
 * Приводит в чувство поля, приехавшие из data.json: файл правится руками,
 * переживает откаты версий и может содержать что угодно. Возвращает только
 * исправленные ключи — вызывающий накладывает их поверх своих настроек.
 */
export function normalizeSettings(raw: Record<string, unknown>): NormalizedSettings {
	const locked = raw.lockedColumnCount;
	// `lockColumnWidths` used to override `autoPanelResize`. Collapse both saved
	// flags into one runtime mode, while keeping the inverse legacy mirror so a
	// downgrade and the next reload preserve the same effective behaviour.
	const autoPanelResize = raw.autoPanelResize === true && raw.lockColumnWidths === false;
	return {
		columnWidth: clampInt(raw.columnWidth, MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH, DEFAULT_COLUMN_WIDTH),
		columnWidths: cleanWidths(raw.columnWidths),
		autoPanelResize,
		lockColumnWidths: !autoPanelResize,
		recentFilesCount: clampInt(raw.recentFilesCount, MIN_RECENT_FILES, MAX_RECENT_FILES, DEFAULT_RECENT_FILES),
		// null — режим «показывать все колонки», это валидное значение
		lockedColumnCount: typeof locked === "number" && Number.isFinite(locked)
			? Math.max(1, Math.round(locked))
			: null,
		sortMode: oneOf(raw.sortMode, SORT_MODE_VALUES, "name-asc"),
		specialItemsPosition: oneOf(raw.specialItemsPosition, SPECIAL_POSITIONS, "top"),
		openLocation: oneOf(raw.openLocation, OPEN_LOCATIONS, "sidebar"),
		storageRingCount: clampInt(raw.storageRingCount, MIN_STORAGE_RINGS, MAX_STORAGE_RINGS, DEFAULT_STORAGE_RINGS),
		seenAt: cleanSeenAt(raw.seenAt),
		// 0 — «фича ещё не включалась»; момент включения проставит main.ts
		unreadBaseline: clampInt(raw.unreadBaseline, 0, Number.MAX_SAFE_INTEGER, 0),
		// Записи путь → значение и списки путей: без этого строка или null
		// вместо объекта роняли бы загрузку плагина на первом же Object.keys
		folderColors: cleanEnumRecord(raw.folderColors, FOLDER_COLOR_KEYS),
		columnViewModes: cleanEnumRecord(raw.columnViewModes, COLUMN_VIEW_MODES),
		columnSortModes: cleanEnumRecord(raw.columnSortModes, SORT_MODE_VALUES),
		folderIcons: cleanStringRecord(raw.folderIcons),
		favorites: cleanPathList(raw.favorites),
		recentFiles: cleanPathList(raw.recentFiles),
	};
}
