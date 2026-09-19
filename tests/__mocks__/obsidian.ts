/**
 * Минимальный рантайм-мок Obsidian.
 *
 * Пакет `obsidian` из npm — это только `.d.ts`, рантайма в нём нет: настоящие
 * классы существуют лишь внутри приложения. Поэтому любой модуль плагина,
 * который делает `instanceof TFile`, в тестах падал бы на импорте. Здесь —
 * ровно те классы, которые нужны, чтобы загрузить `src/utils.ts` и
 * `src/settings.ts` (ради DEFAULT_SETTINGS); всё остальное API сознательно
 * не воспроизводится.
 *
 * Подключается через `resolve.alias` в vitest.config.ts.
 */

export class TAbstractFile {
	path = "";
	name = "";
	parent: TFolder | null = null;
	/**
	 * В настоящем типе Obsidian у файла есть ссылка на Vault. Значение тут
	 * не нужно, но без поля мок-классы не подставляются в функции плагина,
	 * типизированные настоящим TAbstractFile — и tsc валит тесты.
	 */
	vault = {} as never;
}

export interface FileStats {
	ctime: number;
	mtime: number;
	size: number;
}

export class TFile extends TAbstractFile {
	basename = "";
	extension = "";
	stat: FileStats = { ctime: 0, mtime: 0, size: 0 };
}

export class TFolder extends TAbstractFile {
	children: TAbstractFile[] = [];

	isRoot(): boolean {
		return this.path === "/";
	}
}

/* --- заглушки рантайма ------------------------------------------------- */

export class App {
	vault: unknown;
	workspace: unknown = {
		getActiveFile: () => null,
		on: () => ({}),
		getLeftLeaf: () => null,
	};
	fileManager = {
		renameFile: () => Promise.resolve(),
		trashFile: () => Promise.resolve(),
	};
}

/** Все показанные уведомления — для проверок текста и inline-действий. */
export const createdNotices: Notice[] = [];

export function resetNotices() {
	createdNotices.length = 0;
}

export class Notice {
	hidden = false;
	constructor(public message: string | DocumentFragment, public timeout?: number) {
		createdNotices.push(this);
	}
	hide(): void { this.hidden = true; }
}
/**
 * Компоненты Setting: настоящий Obsidian строит DOM, здесь достаточно
 * запомнить значение и колбэк — тесты дёргают onChange напрямую.
 */
class BaseComponent<V> {
	value?: V;
	changeHandler?: (value: V) => unknown;
	setValue(value: V): this { this.value = value; return this; }
	getValue(): V | undefined { return this.value; }
	onChange(cb: (value: V) => unknown): this { this.changeHandler = cb; return this; }
	setDisabled(): this { return this; }
	/** Имитация ввода пользователем. */
	change(value: V): unknown { this.value = value; return this.changeHandler?.(value); }
}

export class ToggleComponent extends BaseComponent<boolean> {}
export class TextComponent extends BaseComponent<string> {
	inputEl: HTMLInputElement = document.createElement("input");
	setPlaceholder(): this { return this; }
}
export class SliderComponent extends BaseComponent<number> {
	sliderEl: HTMLInputElement = document.createElement("input");
	limits?: [number, number, number];
	setLimits(min: number, max: number, step: number): this { this.limits = [min, max, step]; return this; }
	setDynamicTooltip(): this { return this; }
}
export class DropdownComponent extends BaseComponent<string> {
	options: Record<string, string> = {};
	addOption(value: string, label: string): this { this.options[value] = label; return this; }
	addOptions(options: Record<string, string>): this { Object.assign(this.options, options); return this; }
}
export class ButtonComponent {
	text = "";
	clickHandler?: () => unknown;
	setButtonText(text: string): this { this.text = text; return this; }
	setIcon(): this { return this; }
	setWarning(): this { return this; }
	setTooltip(): this { return this; }
	onClick(cb: () => unknown): this { this.clickHandler = cb; return this; }
	click(): unknown { return this.clickHandler?.(); }
}

/**
 * Все созданные строки настроек — вкладка их наружу не отдаёт, а тестам
 * нужно добраться до компонентов. Сбрасывается через resetSettings().
 */
export const createdSettings: Setting[] = [];

export function resetSettings() {
	createdSettings.length = 0;
}

/** Одна строка настроек: имя, описание и набор компонентов. */
export class Setting {
	name = "";
	desc = "";
	heading = false;
	components: unknown[] = [];

	constructor(public containerEl: HTMLElement) {
		createdSettings.push(this);
		// Настоящий Setting добавляет строку в контейнер — тестам это нужно,
		// чтобы отличить «вкладка отрисована» от «ничего не произошло»
		containerEl.createDiv({ cls: "setting-item" });
	}

	setName(name: string): this { this.name = name; return this; }
	setDesc(desc: string): this { this.desc = desc; return this; }
	setHeading(): this { this.heading = true; return this; }
	setClass(): this { return this; }

	private add<T>(component: T, cb: (c: T) => unknown): this {
		cb(component);
		this.components.push(component);
		return this;
	}

	addToggle(cb: (c: ToggleComponent) => unknown): this { return this.add(new ToggleComponent(), cb); }
	addText(cb: (c: TextComponent) => unknown): this { return this.add(new TextComponent(), cb); }
	addSlider(cb: (c: SliderComponent) => unknown): this { return this.add(new SliderComponent(), cb); }
	addDropdown(cb: (c: DropdownComponent) => unknown): this { return this.add(new DropdownComponent(), cb); }
	addButton(cb: (c: ButtonComponent) => unknown): this { return this.add(new ButtonComponent(), cb); }
}

export class PluginSettingTab {
	constructor(public app: App, public plugin: unknown) {}
}

/** Тесты локалей проверяют таблицы напрямую, язык приложения им не важен. */
export function getLanguage(): string {
	return "en";
}

/**
 * Мутабельный Platform: тесты мобильного слоя переключают `isMobile`,
 * поэтому это объект, а не константа.
 */
export const Platform = {
	isMobile: false,
	isDesktop: true,
	isIosApp: false,
	isAndroidApp: false,
};

/** Иконку рисовать нечем — помечаем элемент, чтобы тесты могли проверить. */
export function setIcon(el: HTMLElement, icon: string): void {
	el.dataset.icon = icon;
}

/** Настоящая реализация вешает всплывающую подсказку; тестам хватает атрибута. */
export function setTooltip(el: HTMLElement, tooltip: string): void {
	el.setAttribute("aria-label", tooltip);
}

export function normalizePath(path: string): string {
	return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
}

export function getIconIds(): string[] {
	return ["folder", "file", "star"];
}

/**
 * Настоящий debounce Obsidian откладывает вызов; в тестах ожидание таймеров
 * только замедляет. Сохраняем сигнатуру (включая `.cancel()`), но выполняем
 * синхронно — все тестируемые сценарии проверяют результат, а не тайминг.
 */
export function debounce<A extends unknown[]>(cb: (...args: A) => unknown, _wait?: number, _resetTimer?: boolean) {
	const fn = (...args: A) => { cb(...args); return fn; };
	fn.cancel = () => fn;
	fn.run = () => fn;
	return fn;
}

export class Component {
	load(): void { /* no-op */ }
	unload(): void { /* no-op */ }
	addChild<T>(child: T): T { return child; }
	removeChild<T extends { unload(): void }>(child: T): T { child.unload(); return child; }
	registerDomEvent(el: HTMLElement, type: string, cb: EventListener): void {
		el.addEventListener(type, cb);
	}
	registerEvent(): void { /* no-op */ }
	register(): void { /* no-op */ }
}

export class ItemView extends Component {
	containerEl: HTMLElement;
	contentEl: HTMLElement;
	app: App = new App();
	constructor(public leaf: unknown) {
		super();
		this.containerEl = document.createElement("div");
		this.contentEl = this.containerEl.appendChild(document.createElement("div"));
	}
	/** Базовая реализация Obsidian сохраняет состояние в лист — тут пусто. */
	getState(): Record<string, unknown> { return {}; }
	setState(_state: unknown, _result: unknown): Promise<void> { return Promise.resolve(); }
}

export class WorkspaceLeaf {}

/** Команда, зарегистрированная плагином — тесты дёргают её колбэк. */
export interface CommandLike {
	id: string;
	name: string;
	callback?: () => unknown;
	checkCallback?: (checking: boolean) => boolean;
}

export class Plugin extends Component {
	app: App = new App();
	/** Всё, что плагин зарегистрировал — для проверок в тестах. */
	commands: CommandLike[] = [];
	views: string[] = [];
	ribbonIcons: string[] = [];
	settingTabs: unknown[] = [];
	savedData: unknown = null;
	loadDataResult: unknown = null;

	loadData(): Promise<unknown> { return Promise.resolve(this.loadDataResult); }
	saveData(data: unknown): Promise<void> { this.savedData = data; return Promise.resolve(); }
	addCommand(cmd: CommandLike): CommandLike { this.commands.push(cmd); return cmd; }
	registerView(type: string): void { this.views.push(type); }
	addRibbonIcon(icon: string): HTMLElement { this.ribbonIcons.push(icon); return document.createElement("div"); }
	addSettingTab(tab: unknown): void { this.settingTabs.push(tab); }
}

export class Modal extends Component {
	titleEl: HTMLElement = document.createElement("div");
	contentEl: HTMLElement = document.createElement("div");
	modalEl: HTMLElement = document.createElement("div");
	isOpen = false;
	/** Горячие клавиши модалки: ключ — символ, значение — обработчик. */
	scope = {
		keys: new Map<string, () => unknown>(),
		register(_mods: string[], key: string, cb: () => unknown) { this.keys.set(key, cb); },
	};
	constructor(public app: App) { super(); }
	open(): void { this.isOpen = true; (this as unknown as { onOpen?: () => void }).onOpen?.(); }
	close(): void { this.isOpen = false; (this as unknown as { onClose?: () => void }).onClose?.(); }
}

export class FuzzySuggestModal<T> extends Modal {
	getItems(): T[] { return []; }
	getItemText(_item: T): string { return ""; }
	onChooseItem(_item: T): void { /* no-op */ }
	setPlaceholder(_text: string): void { /* no-op */ }
}

export interface FuzzyMatch<T> { item: T; match: SearchResult }

export class Menu {
	items: { title: string | DocumentFragment; callback?: () => void; submenu?: Menu }[] = [];
	separatorIndices: number[] = [];
	addItem(cb: (item: MenuItem) => void): this {
		const item = new MenuItem();
		cb(item);
		this.items.push({ title: item.titleValue, callback: item.callbackValue, submenu: item.submenuValue });
		return this;
	}
	addSeparator(): this { this.separatorIndices.push(this.items.length); return this; }
	showAtMouseEvent(): void { /* no-op */ }
	showAtPosition(): void { /* no-op */ }
}

export class MenuItem {
	titleValue: string | DocumentFragment = "";
	callbackValue?: () => void;
	submenuValue?: Menu;
	setTitle(title: string | DocumentFragment): this { this.titleValue = title; return this; }
	setIcon(): this { return this; }
	setChecked(): this { return this; }
	setDisabled(): this { return this; }
	onClick(cb: () => void): this { this.callbackValue = cb; return this; }
	setSubmenu(): Menu { this.submenuValue = new Menu(); return this.submenuValue; }
}

export class FileSystemAdapter {
	getBasePath(): string { return "/vault"; }
}

export const Keymap = {
	isModEvent: () => false,
	isModifier: () => false,
};

export const MarkdownRenderer = {
	render: () => Promise.resolve(),
};

/* --- поиск -------------------------------------------------------------- */

export interface SearchResult {
	score: number;
	matches: [number, number][];
}

/**
 * Упрощённый аналог prepareFuzzySearch: символы запроса ищутся по порядку,
 * подряд идущие совпадения склеиваются в диапазоны. Скоринг грубее, чем в
 * Obsidian (штраф за разрывы), но достаточен для проверок «нашлось /
 * не нашлось» и «какие диапазоны подсвечены».
 */
export function prepareFuzzySearch(query: string): (text: string) => SearchResult | null {
	const needle = query.toLowerCase();
	return (text: string) => {
		if (needle.length === 0) return { score: 0, matches: [] };
		const haystack = text.toLowerCase();
		const matches: [number, number][] = [];
		let score = 0;
		let pos = 0;
		for (const char of needle) {
			const found = haystack.indexOf(char, pos);
			if (found === -1) return null;
			const last = matches[matches.length - 1];
			if (last && last[1] === found) last[1] = found + 1;
			else matches.push([found, found + 1]);
			score -= found - pos; // разрыв между символами удешевляет совпадение
			pos = found + 1;
		}
		return { score, matches };
	};
}

export function sortSearchResults(results: { match: SearchResult }[]): void {
	results.sort((a, b) => b.match.score - a.match.score);
}

export const requireApiVersion = (_version: string): boolean => true;
