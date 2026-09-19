/**
 * Диаграмма «Использование диска»: кольца-секторы, площадь которых
 * пропорциональна размеру папки, числу слов или числу файлов.
 *
 * Контроллер владеет собственным DOM-узлом и живёт дольше отдельной колонки:
 * колонки Column Explorer перерисовываются часто, а пересканировать хранилище
 * на каждую перерисовку нельзя. Поэтому `mount()` просто переносит готовый
 * элемент в новый контейнер, сохраняя дерево, зум, метрику и кэш словосчёта.
 */
import { Component, Menu, Notice, TFile, debounce, setIcon, setTooltip } from "obsidian";
import { t, tPlural } from "../i18n";
import { humanSize } from "../pure";
import type { ColumnExplorerView } from "../view";
import { REST_COLOR, arcColor } from "./color";
import { makeExclusionFilter } from "./exclude";
import { formatPercent } from "./format";
import { TAU, arcPath, clamp, easeInOutCubic, lerp } from "./geometry";
import { Layout, computeLayout, metricValue, pathDepth } from "./layout";
import { AngleLookup, RenderArc, collectArcs } from "./render";
import { WordCacheEntry, buildTree, countVaultWords, indexTree } from "./scan";
import type { Angle, Metric, TreeNode, ViewWindow } from "./types";

const ANIM_MS = 750;
const INTRO_MS = 900;
const SECTOR_GAP_PX = 1.4;
const CENTER_RADIUS_FRACTION = 0.3;
const RESCAN_DEBOUNCE_MS = 2500;
const CENTER_NAME_MAX_CHARS = 20;
const SVG_NS = "http://www.w3.org/2000/svg";

const ROOT_PATH = "/";
const METRICS: readonly Metric[] = ["size", "words", "files"];

export class SunburstController extends Component {
	/** Корень диаграммы: живёт между перерисовками колонок. */
	readonly el: HTMLElement;

	private tree: TreeNode | null = null;
	private nodeByPath: Map<string, TreeNode> = new Map();
	private layouts: Partial<Record<Metric, Layout>> = {};
	private wordCache: Map<string, WordCacheEntry> = new Map();
	private wordsByPath: Map<string, number> = new Map();
	private wordsReady = false;
	private wordsDirty = true;

	private metric: Metric = "size";
	private rootPath: string = ROOT_PATH;
	private view: ViewWindow = { x0: 0, x1: 1, depth: 0 };

	private radius = 280;
	private animToken = 0;
	private isClosed = false;
	private isMounted = false;
	private dataDirty = true;
	private revision = 0;
	private rescanQueued = false;
	private pendingIntro = true;
	private pendingMetric: Metric | null = null;
	private rescanChain: Promise<void> = Promise.resolve();
	private hoveredKey: string | null = null;
	private arcByKey: Map<string, RenderArc> = new Map();
	private pool: Map<string, SVGPathElement> = new Map();

	private chartWrap: HTMLElement;
	private svg: SVGSVGElement;
	private gArcs: SVGGElement;
	private centerCircle!: SVGCircleElement;
	private centerName!: SVGTextElement;
	private centerValue!: SVGTextElement;
	private centerMeta!: SVGTextElement;
	private tooltipEl: HTMLElement;
	private breadcrumbEl: HTMLElement;
	private metricBtns: Partial<Record<Metric, HTMLButtonElement>> = {};
	private emptyEl: HTMLElement;
	private resizeObserver: ResizeObserver | null = null;
	private lastSettingsKey: string;
	private scheduleRescan = debounce(() => void this.rescan(false), RESCAN_DEBOUNCE_MS, true);

	constructor(private owner: ColumnExplorerView) {
		super();
		this.lastSettingsKey = `${owner.plugin.settings.storageExcluded}|${owner.plugin.settings.storageRingCount}`;
		this.el = createDiv({ cls: "column-explorer-du" });

		const header = this.el.createDiv({ cls: "column-explorer-du-header" });
		this.breadcrumbEl = header.createDiv({ cls: "column-explorer-du-crumbs" });
		const controls = header.createDiv({ cls: "column-explorer-du-controls" });
		const seg = controls.createDiv({ cls: "column-explorer-du-seg" });
		const labels: Record<Metric, string> = {
			size: t("duSize"), words: t("duWords"), files: t("duFiles"),
		};
		for (const metric of METRICS) {
			const btn = seg.createEl("button", {
				text: labels[metric],
				cls: `column-explorer-du-seg-btn${metric === this.metric ? " is-active" : ""}`,
			});
			btn.addEventListener("click", () => this.setMetric(metric));
			this.metricBtns[metric] = btn;
		}
		// До первого лёгкого скана дерево ещё не готово, затем Words можно
		// запросить отдельно без фонового чтения markdown.
		const wordsBtn = this.metricBtns.words;
		if (wordsBtn) wordsBtn.disabled = true;

		const refreshBtn = controls.createEl("button", { cls: "column-explorer-du-icon-btn" });
		setIcon(refreshBtn, "refresh-cw");
		setTooltip(refreshBtn, t("duRescan"));
		refreshBtn.addEventListener("click", () => {
			this.markDirty();
			void this.rescan(false);
		});

		this.chartWrap = this.el.createDiv({ cls: "column-explorer-du-chart" });
		this.svg = document.createElementNS(SVG_NS, "svg");
		this.svg.classList.add("column-explorer-du-svg");
		this.chartWrap.appendChild(this.svg);
		this.gArcs = document.createElementNS(SVG_NS, "g");
		this.svg.appendChild(this.gArcs);
		this.buildCenter();

		this.tooltipEl = this.chartWrap.createDiv({ cls: "column-explorer-du-tooltip" });
		this.emptyEl = this.chartWrap.createDiv({ cls: "column-explorer-du-empty" });
		this.emptyEl.hide();

		const svgEl = this.svg as unknown as HTMLElement;
		this.registerDomEvent(svgEl, "click", (e) => this.onClick(e));
		this.registerDomEvent(svgEl, "contextmenu", (e) => this.onContextMenu(e));
		this.registerDomEvent(svgEl, "mouseover", (e) => this.onOver(e));
		this.registerDomEvent(svgEl, "mouseout", (e) => this.onOut(e));
		this.registerDomEvent(svgEl, "mousemove", (e) => this.onMove(e));

		// Колонку тянут за ручку резайза, панель сворачивают — размеры чарта
		// пересчитываются по фактическому размеру контейнера
		if (typeof ResizeObserver !== "undefined") {
			this.resizeObserver = new ResizeObserver(() => this.handleResize());
			this.resizeObserver.observe(this.chartWrap);
		}
		this.updateGeometry();

		const vault = this.app.vault;
		this.registerEvent(vault.on("create", () => this.onVaultChange()));
		this.registerEvent(vault.on("delete", () => this.onVaultChange()));
		this.registerEvent(vault.on("rename", () => this.onVaultChange()));
		this.registerEvent(vault.on("modify", () => this.onVaultChange()));
	}

	private get app() {
		return this.owner.app;
	}

	/**
	 * Перенос готового элемента в свежую колонку без пересборки диаграммы.
	 * Заодно единственное место, где видно изменение настроек: колонка
	 * перерисовывается после сохранения, а рескан нужен только если поменялись
	 * исключения или число колец.
	 */
	mount(container: HTMLElement) {
		if (this.isClosed) return;
		this.isMounted = true;
		container.appendChild(this.el);
		const key = this.settingsKey();
		if (key !== this.lastSettingsKey) {
			this.lastSettingsKey = key;
			this.markDirty();
		}
		this.handleResize();
		void this.rescan(!this.tree);
	}

	/** Stop background refreshes but keep the tree, cache and active scan. */
	suspend() {
		this.isMounted = false;
		this.scheduleRescan.cancel();
	}

	/** Detach the chart while preserving its state for a later mount. */
	unmount() {
		this.suspend();
		this.el.detach();
	}

	private settingsKey(): string {
		const s = this.owner.plugin.settings;
		return `${s.storageExcluded}|${s.storageRingCount}`;
	}

	onunload() {
		this.isClosed = true;
		this.isMounted = false;
		this.scheduleRescan.cancel();
		this.animToken++;
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		this.el.detach();
	}

	/** Escape и клик по центру: шаг зума наружу. `false` — зумить больше некуда. */
	zoomOut(): boolean {
		if (this.rootPath === ROOT_PATH) return false;
		this.zoomTo(parentPath(this.rootPath));
		return true;
	}

	/* --------------------------------------------------------- сканирование */

	private excluded(): (path: string) => boolean {
		return makeExclusionFilter(this.owner.plugin.settings.storageExcluded.split(","));
	}

	private rings(): number {
		return this.owner.plugin.settings.storageRingCount;
	}

	private markDirty() {
		if (this.isClosed) return;
		this.dataDirty = true;
		this.wordsDirty = true;
		this.revision++;
	}

	private onVaultChange() {
		this.markDirty();
		if (this.isMounted) this.scheduleRescan();
	}

	/**
	 * В каждый момент работает не больше одного скана. Событие во время I/O
	 * оставляет dirty-флаг, поэтому цикл повторится с актуальным снимком.
	 */
	private rescan(intro: boolean): Promise<void> {
		this.pendingIntro ||= intro;
		if (this.isClosed || !this.isMounted || this.rescanQueued) return this.rescanChain;
		if (!this.dataDirty && !(this.wordsDirty && (this.metric === "words" || this.pendingMetric === "words"))) {
			return this.rescanChain;
		}

		this.rescanQueued = true;
		let failed = false;
		this.rescanChain = this.rescanChain
			.then(() => this.drainRescans())
			.catch(() => {
				failed = true;
				this.dataDirty = true;
				this.resetWordsButton();
			})
			.then(() => {
				this.rescanQueued = false;
				if (!failed && this.isMounted && this.needsRescan()) void this.rescan(false);
			});
		return this.rescanChain;
	}

	private needsRescan(): boolean {
		return this.dataDirty || (this.wordsDirty && (this.metric === "words" || this.pendingMetric === "words"));
	}

	private async drainRescans() {
		while (!this.isClosed && this.isMounted && this.needsRescan()) {
			const intro = this.pendingIntro;
			this.pendingIntro = false;
			const countWords = this.wordsDirty && (this.metric === "words" || this.pendingMetric === "words");
			this.dataDirty = false;
			try {
				await this.doRescan(intro, countWords);
			} catch (error) {
				this.dataDirty = true;
				throw error;
			}
		}
	}

	private async doRescan(intro: boolean, countWords: boolean): Promise<void> {
		if (this.isClosed) return;
		const scanRevision = this.revision;
		const isExcluded = this.excluded();
		if (countWords) {
			const wordsBtn = this.metricBtns.words;
			if (wordsBtn) wordsBtn.disabled = true;
			const words = await countVaultWords(
				this.app.vault,
				this.wordCache,
				(done, total) => {
					if (!this.isClosed && wordsBtn) {
						wordsBtn.setText(`${t("duWords")} ${Math.round((done / total) * 100)}%`);
					}
				},
				isExcluded,
			);
			if (this.isClosed) return;
			this.wordsByPath = words;
			this.wordsReady = true;
			if (scanRevision === this.revision) this.wordsDirty = false;
		}

		if (this.isClosed) return;
		const hadTree = this.tree !== null;
		this.rebuild(this.wordsByPath, isExcluded);
		this.resetWordsButton();

		if (this.pendingMetric === "words" && this.wordsReady && !this.wordsDirty) {
			this.pendingMetric = null;
			this.applyMetric("words");
		} else if (!hadTree && intro) {
			this.drawStatic();
			this.playIntro();
		} else {
			this.drawStatic();
		}
	}

	private resetWordsButton() {
		const wordsBtn = this.metricBtns.words;
		if (!wordsBtn) return;
		wordsBtn.setText(t("duWords"));
		wordsBtn.disabled = this.wordsReady && !this.wordsDirty && (this.layouts.words?.total ?? 0) <= 0;
		if (wordsBtn.disabled) setTooltip(wordsBtn, t("duNoWords"));
		else wordsBtn.removeAttribute("aria-label");
	}

	private rebuild(words: ReadonlyMap<string, number>, isExcluded: (p: string) => boolean) {
		this.tree = buildTree(this.app.vault, words, isExcluded);
		this.nodeByPath = indexTree(this.tree);
		this.layouts = {
			size: computeLayout(this.tree, "size"),
			words: computeLayout(this.tree, "words"),
			files: computeLayout(this.tree, "files"),
		};
		// Папку, в которую был сделан зум, могли удалить или исключить
		if (!this.nodeByPath.has(this.rootPath) || !this.layout().angles.has(this.rootPath)) {
			this.rootPath = ROOT_PATH;
		}
		this.view = this.viewFor(this.rootPath);
		this.updateBreadcrumbs();
		this.updateEmptyState();
	}

	private layout(): Layout {
		const layout = this.layouts[this.metric];
		if (!layout) throw new Error("Column Explorer: disk usage layout is not ready");
		return layout;
	}

	private viewFor(path: string): ViewWindow {
		const angle = this.layout().angles.get(path) ?? { x0: 0, x1: 1 };
		return { x0: angle.x0, x1: angle.x1, depth: pathDepth(path) };
	}

	/* ------------------------------------------------------------ отрисовка */

	private updateGeometry() {
		const w = this.chartWrap.clientWidth || 600;
		const h = this.chartWrap.clientHeight || 500;
		this.radius = Math.max(80, Math.min(w, h) / 2 - 12);
		const pad = this.radius + 6;
		this.svg.setAttribute("viewBox", `${-pad} ${-pad} ${pad * 2} ${pad * 2}`);
		this.centerCircle.setAttribute("r", String(this.centerR()));
		this.scaleCenterText();
	}

	private centerR(): number {
		return this.radius * CENTER_RADIUS_FRACTION;
	}

	private ringT(): number {
		return (this.radius - this.centerR()) / this.rings();
	}

	private staticLookup(): AngleLookup {
		const angles = this.layout().angles;
		return (path) => angles.get(path);
	}

	private drawStatic() {
		this.draw(this.staticLookup(), this.view);
		this.updateCenter(null);
	}

	private draw(angleOf: AngleLookup, view: ViewWindow) {
		if (!this.tree) return;
		const layout = this.layout();
		const metric = this.metric;
		const rings = this.rings();
		const arcs = collectArcs(this.tree, layout.order, angleOf, view, (n) => metricValue(n, metric), rings);
		this.arcByKey = new Map(arcs.map((a) => [a.key, a]));

		const centerRadius = this.centerR();
		const ringThickness = this.ringT();
		const seen = new Set<string>();

		for (const arc of arcs) {
			const r0 = clamp(centerRadius + (arc.ring - 1) * ringThickness, centerRadius, this.radius);
			const r1 = clamp(centerRadius + arc.ring * ringThickness, centerRadius, this.radius);
			if (r1 - r0 < 0.5) continue;
			const a0 = arc.p0 * TAU - Math.PI / 2;
			const a1 = arc.p1 * TAU - Math.PI / 2;
			const d = arcPath(a0, a1, r0, r1, SECTOR_GAP_PX);
			if (!d) continue;

			seen.add(arc.key);
			// Элементы переиспользуются по ключу: анимация трогает только "d"
			let el = this.pool.get(arc.key);
			if (!el) {
				el = document.createElementNS(SVG_NS, "path");
				el.setAttribute("fill-rule", "evenodd");
				el.setAttribute("data-key", arc.key);
				el.classList.add("column-explorer-du-arc");
				this.gArcs.appendChild(el);
				this.pool.set(arc.key, el);
			}
			el.setAttribute("d", d);
			el.classList.toggle("is-rest", arc.isRest);
			el.classList.toggle("is-clickable", arc.isFolder);
			el.setAttribute(
				"fill",
				arc.isRest
					? REST_COLOR
					: arcColor((arc.p0 + arc.p1) / 2, clamp(Math.round(arc.ring), 1, rings), !arc.isFolder),
			);
		}

		for (const [key, el] of this.pool) {
			if (seen.has(key)) continue;
			el.remove();
			this.pool.delete(key);
		}
	}

	/* ------------------------------------------------------------- анимации */

	private animate(frame: (t: number) => void, durationMs: number, onDone?: () => void) {
		const token = ++this.animToken;
		this.svg.classList.add("is-animating");
		const start = performance.now();
		const tick = (now: number) => {
			// Новая анимация (или выгрузка) забирает токен и гасит предыдущую
			if (token !== this.animToken) return;
			const progress = clamp((now - start) / durationMs, 0, 1);
			frame(easeInOutCubic(progress));
			if (progress < 1) {
				window.requestAnimationFrame(tick);
				return;
			}
			this.svg.classList.remove("is-animating");
			onDone?.();
		};
		window.requestAnimationFrame(tick);
	}

	private playIntro() {
		const angles = this.layout().angles;
		const view = this.view;
		this.animate(
			(t) => {
				const sweep: AngleLookup = (path) => {
					const a = angles.get(path);
					return a ? { x0: a.x0 * t, x1: a.x1 * t } : undefined;
				};
				this.draw(sweep, view);
			},
			INTRO_MS,
			() => this.drawStatic(),
		);
	}

	private zoomTo(path: string) {
		if (path === this.rootPath || !this.layout().angles.has(path)) return;
		const from = { ...this.view };
		const to = this.viewFor(path);
		this.rootPath = path;
		this.view = to;
		this.clearHover();
		this.updateBreadcrumbs();
		const look = this.staticLookup();
		this.animate(
			(t) => {
				this.draw(look, {
					x0: lerp(from.x0, to.x0, t),
					x1: lerp(from.x1, to.x1, t),
					depth: lerp(from.depth, to.depth, t),
				});
			},
			ANIM_MS,
			() => this.drawStatic(),
		);
		this.updateCenter(null);
	}

	private setMetric(metric: Metric) {
		if (metric === "words" && this.wordsDirty) {
			this.pendingMetric = "words";
			void this.rescan(false);
			return;
		}
		this.pendingMetric = null;
		this.applyMetric(metric);
	}

	private applyMetric(metric: Metric) {
		if (metric === this.metric || !this.tree) return;
		const oldLayout = this.layout();
		const oldView = { ...this.view };
		this.metric = metric;
		for (const m of METRICS) {
			this.metricBtns[m]?.classList.toggle("is-active", m === metric);
		}

		const newLayout = this.layout();
		if (!newLayout.angles.has(this.rootPath)) this.rootPath = ROOT_PATH;
		const newView = this.viewFor(this.rootPath);
		this.view = newView;
		this.clearHover();
		this.updateBreadcrumbs();
		this.updateEmptyState();

		// Сектора, которых в новой метрике нет, вырастают из своей середины
		const collapsedAt = (b: Angle): Angle => {
			const mid = (b.x0 + b.x1) / 2;
			return { x0: mid, x1: mid };
		};
		this.animate(
			(t) => {
				const morph: AngleLookup = (path) => {
					const to = newLayout.angles.get(path);
					if (!to) return undefined;
					const from = oldLayout.angles.get(path) ?? collapsedAt(to);
					return { x0: lerp(from.x0, to.x0, t), x1: lerp(from.x1, to.x1, t) };
				};
				this.draw(morph, {
					x0: lerp(oldView.x0, newView.x0, t),
					x1: lerp(oldView.x1, newView.x1, t),
					depth: lerp(oldView.depth, newView.depth, t),
				});
			},
			ANIM_MS,
			() => this.drawStatic(),
		);
		this.updateCenter(null);
	}

	/* --------------------------------------------------------- взаимодействие */

	private arcFromEvent(e: Event): RenderArc | null {
		const target = e.target as Element | null;
		const pathEl = target?.closest?.("path[data-key]");
		const key = pathEl?.getAttribute("data-key");
		return key ? (this.arcByKey.get(key) ?? null) : null;
	}

	private onClick(e: MouseEvent) {
		const target = e.target as Element | null;
		if (target?.closest?.(".column-explorer-du-center")) {
			this.zoomOut();
			return;
		}
		const arc = this.arcFromEvent(e);
		if (!arc || arc.isRest) return;
		if (arc.isFolder) {
			this.zoomTo(arc.path);
			return;
		}
		this.openInNewTab(arc.path);
	}

	private onContextMenu(e: MouseEvent) {
		const arc = this.arcFromEvent(e);
		if (!arc || arc.isRest) return;
		e.preventDefault();
		const menu = new Menu();
		if (arc.isFolder) {
			menu.addItem(item => item.setTitle(t("duZoomIn")).setIcon("zoom-in")
				.onClick(() => this.zoomTo(arc.path)));
		} else {
			menu.addItem(item => item.setTitle(t("openNewTab")).setIcon("file-plus")
				.onClick(() => this.openInNewTab(arc.path)));
		}
		menu.addItem(item => item.setTitle(t("duReveal")).setIcon("locate")
			.onClick(() => this.owner.revealFile(this.app.vault.getAbstractFileByPath(arc.path))));
		menu.addItem(item => item.setTitle(t("copyPath")).setIcon("copy")
			.onClick(() => void this.copyPath(arc.path)));
		menu.showAtMouseEvent(e);
	}

	/** writeText реджектится при потере фокуса окна — молчать нельзя. */
	private async copyPath(path: string) {
		try {
			await navigator.clipboard.writeText(path);
			new Notice(t("pathCopied"));
		} catch {
			new Notice(t("copyFailed"));
		}
	}

	private openInNewTab(path: string) {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) void this.app.workspace.getLeaf("tab").openFile(file);
	}

	private onOver(e: MouseEvent) {
		const arc = this.arcFromEvent(e);
		if (!arc || arc.key === this.hoveredKey) return;
		this.hoveredKey = arc.key;
		this.applyHover(arc);
	}

	private onOut(e: MouseEvent) {
		const arc = this.arcFromEvent(e);
		if (arc && arc.key === this.hoveredKey) this.clearHover();
	}

	private onMove(e: MouseEvent) {
		if (!this.hoveredKey) return;
		const rect = this.chartWrap.getBoundingClientRect();
		const x = clamp(e.clientX - rect.left + 14, 0, rect.width - this.tooltipEl.offsetWidth - 4);
		const y = clamp(e.clientY - rect.top + 16, 0, rect.height - this.tooltipEl.offsetHeight - 4);
		this.tooltipEl.style.transform = `translate(${x}px, ${y}px)`;
	}

	private applyHover(arc: RenderArc) {
		this.svg.classList.add("has-hover");
		const prefix = `${arc.path}/`;
		for (const [key, el] of this.pool) {
			const hit = arc.isRest ? key === arc.key : key === arc.key || key.startsWith(prefix);
			el.classList.toggle("is-highlighted", hit);
		}
		this.showTooltip(arc);
		this.updateCenter(arc);
	}

	private clearHover() {
		this.hoveredKey = null;
		this.svg.classList.remove("has-hover");
		for (const el of this.pool.values()) el.classList.remove("is-highlighted");
		this.tooltipEl.removeClass("is-visible");
		this.updateCenter(null);
	}

	/* ------------------------------------------------------------------- UI */

	private buildCenter() {
		const g = document.createElementNS(SVG_NS, "g");
		g.classList.add("column-explorer-du-center");
		this.centerCircle = document.createElementNS(SVG_NS, "circle");
		this.centerCircle.classList.add("column-explorer-du-center-circle");
		g.appendChild(this.centerCircle);
		this.centerName = document.createElementNS(SVG_NS, "text");
		this.centerName.classList.add("column-explorer-du-center-name");
		this.centerValue = document.createElementNS(SVG_NS, "text");
		this.centerValue.classList.add("column-explorer-du-center-value");
		this.centerMeta = document.createElementNS(SVG_NS, "text");
		this.centerMeta.classList.add("column-explorer-du-center-meta");
		g.appendChild(this.centerName);
		g.appendChild(this.centerValue);
		g.appendChild(this.centerMeta);
		this.svg.appendChild(g);
	}

	/** Текст в центре кегль в кегль под текущий радиус круга. */
	private scaleCenterText() {
		const base = this.centerR();
		this.centerName.setAttribute("y", String(-base * 0.28));
		this.centerName.style.fontSize = `${Math.max(11, base * 0.16)}px`;
		this.centerValue.setAttribute("y", String(base * 0.08));
		this.centerValue.style.fontSize = `${Math.max(13, base * 0.22)}px`;
		this.centerMeta.setAttribute("y", String(base * 0.38));
		this.centerMeta.style.fontSize = `${Math.max(10, base * 0.13)}px`;
	}

	private formatValue(value: number): string {
		if (this.metric === "size") return humanSize(value);
		if (this.metric === "words") return tPlural("duWordCount", value);
		return tPlural("duFileCount", value);
	}

	/** Вторая строка: число файлов, а если метрика уже файлы — размер. */
	private formatMeta(node: TreeNode): string {
		return this.metric === "files" ? humanSize(node.size) : tPlural("duFileCount", node.files);
	}

	private updateCenter(hovered: RenderArc | null) {
		const rootNode = this.nodeByPath.get(this.rootPath);
		if (!rootNode) return;
		const rootValue = metricValue(rootNode, this.metric);

		if (hovered?.isRest) {
			this.centerName.textContent = tPlural("duSmallItem", hovered.restCount);
			this.centerValue.textContent = this.formatValue(hovered.restValue);
			this.centerMeta.textContent = formatPercent(hovered.restValue, rootValue);
			return;
		}
		const node = hovered ? this.nodeByPath.get(hovered.path) : rootNode;
		if (!node) return;
		const value = metricValue(node, this.metric);
		this.centerName.textContent = truncate(node.name, CENTER_NAME_MAX_CHARS);
		this.centerValue.textContent = this.formatValue(value);
		this.centerMeta.textContent = hovered
			? `${formatPercent(value, rootValue)} · ${this.formatMeta(node)}`
			: this.formatMeta(node);
	}

	private showTooltip(arc: RenderArc) {
		this.tooltipEl.empty();
		const rootNode = this.nodeByPath.get(this.rootPath);
		const rootValue = rootNode ? metricValue(rootNode, this.metric) : 0;
		if (arc.isRest) {
			this.tooltipEl.createDiv({ cls: "column-explorer-du-tip-name", text: tPlural("duSmallItem", arc.restCount) });
			this.tooltipEl.createDiv({
				cls: "column-explorer-du-tip-meta",
				text: `${this.formatValue(arc.restValue)} · ${formatPercent(arc.restValue, rootValue)}`,
			});
		} else {
			const node = this.nodeByPath.get(arc.path);
			if (!node) return;
			const value = metricValue(node, this.metric);
			this.tooltipEl.createDiv({ cls: "column-explorer-du-tip-name", text: node.name });
			this.tooltipEl.createDiv({
				cls: "column-explorer-du-tip-meta",
				text: `${this.formatValue(value)} · ${formatPercent(value, rootValue)} · ${this.formatMeta(node)}`,
			});
		}
		this.tooltipEl.addClass("is-visible");
	}

	private updateBreadcrumbs() {
		this.breadcrumbEl.empty();
		const vaultName = this.tree?.name ?? this.app.vault.getName();
		const segments = this.rootPath === ROOT_PATH ? [] : this.rootPath.split("/");
		const addCrumb = (label: string, path: string, isLast: boolean) => {
			const btn = this.breadcrumbEl.createEl("button", {
				cls: `column-explorer-du-crumb${isLast ? " is-current" : ""}`,
				text: label,
			});
			if (!isLast) btn.addEventListener("click", () => this.zoomTo(path));
		};
		addCrumb(vaultName, ROOT_PATH, segments.length === 0);
		segments.forEach((segment, i) => {
			this.breadcrumbEl.createSpan({ cls: "column-explorer-du-crumb-sep", text: "›" });
			addCrumb(segment, segments.slice(0, i + 1).join("/"), i === segments.length - 1);
		});
	}

	private updateEmptyState() {
		const total = this.layouts[this.metric]?.total ?? 0;
		if (total > 0) {
			this.emptyEl.hide();
			return;
		}
		this.emptyEl.setText(this.metric === "words" ? t("duNoWords") : t("duEmpty"));
		this.emptyEl.show();
	}

	private handleResize() {
		this.updateGeometry();
		if (this.tree) this.drawStatic();
	}
}

function parentPath(path: string): string {
	const idx = path.lastIndexOf("/");
	return idx === -1 ? ROOT_PATH : path.slice(0, idx);
}

function truncate(text: string, max: number): string {
	return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
