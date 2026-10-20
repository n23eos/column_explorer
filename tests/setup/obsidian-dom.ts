/**
 * Хелперы Obsidian на прототипах DOM-узлов.
 *
 * Obsidian расширяет `HTMLElement`/`DocumentFragment` методами `createDiv`,
 * `addClass`, `empty` и т.д., а также добавляет глобальные `createDiv`,
 * `createEl`, `createSpan`, `createFragment`. В happy-dom их нет, поэтому
 * любой модуль плагина, который рисует DOM, в тестах падал бы.
 *
 * Здесь воспроизведены ровно те методы, что реально используются в src/,
 * с той же семантикой опций (cls / text / attr / prepend).
 *
 * Подключается через `test.setupFiles` в vitest.config.mts.
 */

/** Подмножество Obsidian DomElementInfo, которое использует плагин. */
interface DomElementInfo {
	cls?: string | string[];
	text?: string | DocumentFragment;
	attr?: Record<string, string | number | boolean | null>;
	title?: string;
	value?: string;
	type?: string;
	placeholder?: string;
	href?: string;
	prepend?: boolean;
}

function applyInfo(el: HTMLElement, info?: DomElementInfo) {
	if (!info) return;
	if (info.cls) {
		const classes = Array.isArray(info.cls) ? info.cls : info.cls.split(" ");
		classes.filter(Boolean).forEach((c) => el.classList.add(c));
	}
	if (info.text !== undefined) {
		if (typeof info.text === "string") el.textContent = info.text;
		else el.appendChild(info.text);
	}
	if (info.attr) {
		for (const [key, value] of Object.entries(info.attr)) {
			if (value === null || value === false) continue;
			el.setAttribute(key, String(value));
		}
	}
	if (info.title !== undefined) el.setAttribute("title", info.title);
	if (info.href !== undefined) el.setAttribute("href", info.href);
	// value/type/placeholder — свойства input-элементов, не атрибуты
	if (info.value !== undefined) (el as HTMLInputElement).value = info.value;
	if (info.type !== undefined) (el as HTMLInputElement).type = info.type;
	if (info.placeholder !== undefined) (el as HTMLInputElement).placeholder = info.placeholder;
}

function makeEl(tag: string, info?: DomElementInfo): HTMLElement {
	const el = document.createElement(tag);
	applyInfo(el, info);
	return el;
}

function attach<T extends HTMLElement>(parent: Node, el: T, prepend?: boolean): T {
	if (prepend && parent.firstChild) parent.insertBefore(el, parent.firstChild);
	else parent.appendChild(el);
	return el;
}

/** Методы, общие для HTMLElement и DocumentFragment. */
const creators = {
	createEl(this: Node, tag: string, info?: DomElementInfo): HTMLElement {
		return attach(this, makeEl(tag, info), info?.prepend);
	},
	createDiv(this: Node, info?: DomElementInfo): HTMLDivElement {
		return attach(this, makeEl("div", info) as HTMLDivElement, info?.prepend);
	},
	createSpan(this: Node, info?: DomElementInfo): HTMLSpanElement {
		return attach(this, makeEl("span", info) as HTMLSpanElement, info?.prepend);
	},
	appendText(this: Node, text: string): void {
		this.appendChild(document.createTextNode(text));
	},
};

/** Методы только для элементов. */
const elementMethods = {
	empty(this: HTMLElement): void {
		while (this.firstChild) this.removeChild(this.firstChild);
	},
	detach(this: HTMLElement): void {
		this.parentNode?.removeChild(this);
	},
	addClass(this: HTMLElement, ...classes: string[]): void {
		this.classList.add(...classes);
	},
	removeClass(this: HTMLElement, ...classes: string[]): void {
		this.classList.remove(...classes);
	},
	toggleClass(this: HTMLElement, classes: string | string[], value: boolean): void {
		const list = Array.isArray(classes) ? classes : [classes];
		list.forEach((c) => this.classList.toggle(c, value));
	},
	hasClass(this: HTMLElement, cls: string): boolean {
		return this.classList.contains(cls);
	},
	setText(this: HTMLElement, text: string | DocumentFragment): void {
		if (typeof text === "string") this.textContent = text;
		else { this.textContent = ""; this.appendChild(text); }
	},
	hide(this: HTMLElement): void { this.style.display = "none"; },
	show(this: HTMLElement): void { this.style.display = ""; },
	isShown(this: HTMLElement): boolean { return this.style.display !== "none"; },
	toggle(this: HTMLElement, show: boolean): void { this.style.display = show ? "" : "none"; },
	setAttr(this: HTMLElement, key: string, value: string | number | boolean | null): void {
		if (value === null || value === false) this.removeAttribute(key);
		else this.setAttribute(key, String(value));
	},
};

function define(target: object, methods: Record<string, unknown>) {
	for (const [name, fn] of Object.entries(methods)) {
		Object.defineProperty(target, name, { value: fn, writable: true, configurable: true });
	}
}

define(HTMLElement.prototype, creators);
define(HTMLElement.prototype, elementMethods);
define(DocumentFragment.prototype, creators);

const globals = {
	createEl: (tag: string, info?: DomElementInfo) => makeEl(tag, info),
	createDiv: (info?: DomElementInfo) => makeEl("div", info) as HTMLDivElement,
	createSpan: (info?: DomElementInfo) => makeEl("span", info) as HTMLSpanElement,
	createFragment: (cb?: (frag: DocumentFragment) => void) => {
		const frag = document.createDocumentFragment();
		cb?.(frag);
		return frag;
	},
};
Object.assign(globalThis, globals);

/* ------------------------------- IntersectionObserver ------------------- */

/**
 * happy-dom не реализует IntersectionObserver. Стаб хранит коллбэки в
 * реестре, чтобы тест мог вручную «показать» сентинел и проверить догрузку
 * следующей порции элементов.
 */
export interface ObserverRecord {
	callback: IntersectionObserverCallback;
	targets: Element[];
	disconnected: boolean;
}

export const observerRegistry: ObserverRecord[] = [];

class FakeIntersectionObserver implements IntersectionObserver {
	readonly root: Element | Document | null;
	readonly rootMargin = "";
	readonly thresholds: readonly number[] = [0];
	private record: ObserverRecord;

	constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
		this.root = (options?.root as Element | null) ?? null;
		this.record = { callback, targets: [], disconnected: false };
		observerRegistry.push(this.record);
	}

	observe(target: Element): void { this.record.targets.push(target); }
	unobserve(target: Element): void {
		this.record.targets = this.record.targets.filter((t) => t !== target);
	}
	disconnect(): void {
		this.record.disconnected = true;
		this.record.targets = [];
	}
	takeRecords(): IntersectionObserverEntry[] { return []; }
}

Object.assign(globalThis, { IntersectionObserver: FakeIntersectionObserver });

/** Сообщить всем живым обсерверам, что их цели попали в область видимости. */
export function triggerIntersection() {
	for (const record of observerRegistry) {
		if (record.disconnected || record.targets.length === 0) continue;
		const entries = record.targets.map((target) => ({ target, isIntersecting: true } as IntersectionObserverEntry));
		record.callback(entries, null as unknown as IntersectionObserver);
	}
}

/** Сбросить реестр между тестами. */
export function resetObservers() {
	observerRegistry.length = 0;
}
