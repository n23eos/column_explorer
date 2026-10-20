/**
 * Мобильный слой: компактный toolbar, long-press-выделение, нижняя панель
 * действий и edge-swipe навигация. Всё, что здесь, работает только при
 * Platform.isMobile — desktop эти функции не вызывает.
 */
import { setIcon } from "obsidian";
import { t } from "./i18n";
import {
	EDGE_ZONE_PX, LONG_PRESS_MS, MIN_TOUCH_TARGET_PX, PressPhase,
	detectEdgeSwipe, mobileControlSize, mobileTapAction, nextPressPhase, normalizeMobileSettings,
} from "./pure";
import { moveFiles } from "./fileops";
import { FolderSuggestModal } from "./modals";
import { showFileMenu, showMobileCreateMenu, showMobileMoreMenu } from "./menus";
import type { ColumnExplorerView } from "./view";

/** Короткая вибрация при срабатывании long-press; без неё не ломаемся. */
function vibrate() {
	if (typeof navigator.vibrate === "function") navigator.vibrate(20);
}

function toolbarButton(
	view: ColumnExplorerView, parent: HTMLElement,
	icon: string, label: string, onClick: (e: MouseEvent) => void
): HTMLButtonElement {
	const btn = parent.createEl("button", {
		cls: "clickable-icon column-explorer-toolbar-btn",
		attr: { "aria-label": label },
	});
	setIcon(btn, icon);
	view.registerDomEvent(btn, "click", onClick);
	return btn;
}

/** Кнопок в мобильном тулбаре — между ними делится доступная ширина. */
export const MOBILE_TOOLBAR_BUTTONS = 5;

function setEnabled(btn: HTMLButtonElement, enabled: boolean) {
	btn.toggleClass("is-disabled", !enabled);
	btn.setAttribute("aria-disabled", String(!enabled));
	btn.disabled = !enabled;
}

/**
 * Мобильный toolbar: назад — вперёд — поиск — создать — ещё. Возвращает
 * функцию обновления состояния (доступность навигации, состояние поиска).
 */
export function buildMobileToolbar(view: ColumnExplorerView, toolbar: HTMLElement): () => void {
	toolbar.addClass("is-mobile-toolbar");
	const back = toolbarButton(view, toolbar, "arrow-left", t("navBack"), () => view.goBack());
	const forward = toolbarButton(view, toolbar, "arrow-right", t("navForward"), () => view.goForward());
	const search = toolbarButton(view, toolbar, "search", t("search"), () => view.toggleMobileSearch());
	toolbarButton(view, toolbar, "plus", t("create"), (e) => showMobileCreateMenu(view, e));
	toolbarButton(view, toolbar, "more-horizontal", t("more"), (e) => showMobileMoreMenu(view, e));

	return () => {
		setEnabled(back, view.canGoBack());
		setEnabled(forward, view.canGoForward());
		search.setAttribute("aria-pressed", String(view.isSearchOpen()));
		search.toggleClass("is-active", view.isSearchOpen());
	};
}

/**
 * Размеры мобильного интерфейса — в CSS-переменных контейнера: смена
 * настройки перерисовки колонок не требует. Размер кнопки дополнительно
 * ограничен шириной контейнера, чтобы тулбар не переполнялся.
 */
export function applyMobileScale(view: ColumnExplorerView, container: HTMLElement) {
	const { mobileUiScale, mobileIconSize } = normalizeMobileSettings(view.plugin.settings);
	const scale = mobileUiScale / 100;
	const control = mobileControlSize(scale, container.clientWidth, MOBILE_TOOLBAR_BUTTONS);
	const rowHeight = Math.max(MIN_TOUCH_TARGET_PX, Math.round(MIN_TOUCH_TARGET_PX * scale));
	container.style.setProperty("--ce-mobile-scale", String(scale));
	container.style.setProperty("--ce-mobile-icon-size", mobileIconSize + "px");
	container.style.setProperty("--ce-mobile-control-size", control + "px");
	container.style.setProperty("--ce-mobile-row-height", rowHeight + "px");
}

/** Стрелка «на уровень вверх» слева от названия колонки. */
export function addUpButton(view: ColumnExplorerView, header: HTMLElement) {
	const enabled = view.canGoUp();
	const btn = header.createEl("button", {
		cls: "clickable-icon column-explorer-up-btn",
		attr: { "aria-label": t("navUp"), "aria-disabled": String(!enabled) },
	});
	setIcon(btn, "arrow-up");
	btn.disabled = !enabled;
	if (enabled) btn.addEventListener("click", () => view.goUp());
	else btn.addClass("is-disabled");
	header.prepend(btn);
}

/**
 * Нижняя панель режима выделения. Создаётся один раз при открытии вью;
 * возвращает функцию, которая показывает/прячет её и обновляет счётчик.
 */
export function buildActionBar(view: ColumnExplorerView, container: HTMLElement): () => void {
	const bar = container.createDiv({ cls: "column-explorer-action-bar", attr: { role: "toolbar" } });
	bar.hide();
	const count = bar.createDiv({ cls: "column-explorer-action-count", attr: { "aria-live": "polite" } });

	const action = (icon: string, label: string, onClick: (e: MouseEvent) => void) => {
		const btn = bar.createEl("button", { cls: "clickable-icon column-explorer-action-btn", attr: { "aria-label": label } });
		setIcon(btn, icon);
		view.registerDomEvent(btn, "click", onClick);
	};

	action("folder-input", t("moveTo"), () => {
		const paths = [...view.multiSel];
		new FolderSuggestModal(view.app, (target) => {
			void moveFiles(view.app, paths, target).then(() => view.exitMobileSelection());
		}, paths).open();
	});
	action("copy", t("duplicate"), () => {
		view.duplicateSelected(view.multiSelDepth);
		view.exitMobileSelection();
	});
	action("trash", t("delete"), () => view.deleteMany([...view.multiSel]));
	action("more-horizontal", t("more"), (e) => {
		// Одиночное выделение — обычное меню файла, несколько — массовые
		// операции: обе ветки уже есть в showFileMenu
		const first = view.app.vault.getAbstractFileByPath([...view.multiSel][0] ?? "");
		if (first) showFileMenu(view, e, first, view.multiSelDepth);
	});
	action("x", t("cancelSelection"), () => view.exitMobileSelection());

	return () => {
		const active = view.isMobileSelecting();
		const label = t("selectedN", { n: view.multiSel.size });
		bar.toggle(active);
		count.setText(label);
		bar.setAttribute("aria-label", label);
	};
}

/**
 * Long-press по элементу списка включает режим выделения, обычный тап в
 * этом режиме переключает элемент. Один делегированный набор слушателей на
 * колонку; click перехватывается в capture-фазе — до обработчика колонки.
 */
export function setupLongPress(view: ColumnExplorerView, listEl: HTMLElement, depth: number) {
	let phase: PressPhase = "idle";
	let timer = 0;
	let startX = 0;
	let startY = 0;
	let pressedPath: string | null = null;

	const stopTimer = () => {
		window.clearTimeout(timer);
		timer = 0;
	};

	const itemPath = (e: Event): string | null => {
		const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(".column-explorer-item");
		return el?.dataset.path ?? null;
	};

	listEl.addEventListener("pointerdown", (e: PointerEvent) => {
		if (!e.isPrimary || e.pointerType === "mouse") return;
		pressedPath = itemPath(e);
		if (!pressedPath) return;
		startX = e.clientX;
		startY = e.clientY;
		phase = nextPressPhase(phase, { type: "down" });
		timer = window.setTimeout(() => {
			phase = nextPressPhase(phase, { type: "timeout" });
			if (phase !== "fired") return;
			// Спецпункты («Недавние» и т.п.) — не файлы, выделять нечего
			const f = pressedPath ? view.app.vault.getAbstractFileByPath(pressedPath) : null;
			if (!f) { phase = "cancelled"; return; }
			vibrate();
			view.enterMobileSelection(f, depth);
		}, LONG_PRESS_MS);
	});

	listEl.addEventListener("pointermove", (e: PointerEvent) => {
		if (phase !== "pending") return;
		phase = nextPressPhase(phase, { type: "move", dx: e.clientX - startX, dy: e.clientY - startY });
		if (phase === "cancelled") stopTimer();
	});

	listEl.addEventListener("pointerup", () => {
		stopTimer();
		phase = nextPressPhase(phase, { type: "up" });
	});

	listEl.addEventListener("pointercancel", () => {
		stopTimer();
		phase = nextPressPhase(phase, { type: "cancel" });
	});

	// Системное контекстное меню на телефоне дублировало бы long-press
	listEl.addEventListener("contextmenu", (e) => {
		e.preventDefault();
		e.stopPropagation();
	}, true);

	listEl.addEventListener("click", (e) => {
		const action = mobileTapAction({ selectionMode: view.isMobileSelecting(), pressPhase: phase });
		phase = nextPressPhase(phase, { type: "click" });
		if (action === "activate") return;
		e.preventDefault();
		e.stopPropagation();
		if (action !== "toggle") return;
		const path = itemPath(e);
		const f = path ? view.app.vault.getAbstractFileByPath(path) : null;
		if (f) view.toggleMobileSelection(f, depth);
	}, true);
}

/** Интерактивные элементы, на которых edge-swipe не начинается. */
const SWIPE_IGNORE_SELECTOR = "input, textarea, button, a, [role='button'], .clickable-icon";

/**
 * Свайп от левого края — назад по истории, от правого — вперёд.
 * preventDefault не вызывается нигде: вертикальный скролл списка
 * не должен страдать от жеста, который может и не подтвердиться.
 */
export function setupEdgeSwipe(view: ColumnExplorerView, el: HTMLElement) {
	let start: { x: number; y: number; width: number } | null = null;

	view.registerDomEvent(el, "touchstart", (e: TouchEvent) => {
		start = null;
		if (e.touches.length !== 1) return;
		if (view.isMobileSelecting()) return;
		if (el.ownerDocument.querySelector(".modal-container")) return;
		if ((e.target as HTMLElement | null)?.closest(SWIPE_IGNORE_SELECTOR)) return;
		const rect = el.getBoundingClientRect();
		const x = e.touches[0].clientX - rect.left;
		if (x > EDGE_ZONE_PX && x < rect.width - EDGE_ZONE_PX) return;
		start = { x, y: e.touches[0].clientY, width: rect.width };
	}, { passive: true });

	view.registerDomEvent(el, "touchend", (e: TouchEvent) => {
		const from = start;
		start = null;
		if (!from || e.changedTouches.length !== 1) return;
		const rect = el.getBoundingClientRect();
		const direction = detectEdgeSwipe({
			startX: from.x, startY: from.y,
			endX: e.changedTouches[0].clientX - rect.left,
			endY: e.changedTouches[0].clientY,
			containerWidth: from.width,
		});
		if (direction === "back") view.goBack();
		else if (direction === "forward") view.goForward();
	});

	view.registerDomEvent(el, "touchcancel", () => { start = null; });
}

/**
 * Высота, съеденная экранной клавиатурой, в CSS-переменной — нижняя панель
 * и список поднимаются над клавиатурой вместо того, чтобы уехать под неё.
 */
export function setupViewportTracking(view: ColumnExplorerView, container: HTMLElement) {
	const viewport = window.visualViewport;
	if (!viewport) return;
	const apply = () => {
		const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
		container.style.setProperty("--ce-keyboard-inset", inset + "px");
	};
	viewport.addEventListener("resize", apply);
	viewport.addEventListener("scroll", apply);
	view.register(() => {
		viewport.removeEventListener("resize", apply);
		viewport.removeEventListener("scroll", apply);
	});
	apply();
}
