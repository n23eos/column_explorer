import { App, Component, FuzzyMatch, FuzzySuggestModal, Modal, Platform, TFile, TFolder, getIconIds, setIcon } from "obsidian";
import { t } from "./i18n";
import { renderPreviewContent } from "./preview";
import type { ColumnExplorerView } from "./view";

export class ConfirmModal extends Modal {
	constructor(app: App, private message: string, private onConfirm: () => void) {
		super(app);
	}
	onOpen() {
		this.titleEl.setText(t("confirmDeleteTitle"));
		this.contentEl.createEl("p", { text: this.message });
		const row = this.contentEl.createDiv({ cls: "modal-button-container" });
		const ok = row.createEl("button", { text: t("confirm"), cls: "mod-warning" });
		ok.addEventListener("click", () => { this.close(); this.onConfirm(); });
		const cancel = row.createEl("button", { text: t("cancel") });
		cancel.addEventListener("click", () => this.close());
	}
	onClose() { this.contentEl.empty(); }
}

/** Quick Look (как в Finder): пробел открывает превью, пробел/Esc закрывают. */
export class QuickLookModal extends Modal {
	private owner: Component | null = null;
	private files: TFile[];
	private currentIndex: number;
	private bodyEl: HTMLElement | null = null;
	private previousButton: HTMLButtonElement | null = null;
	private nextButton: HTMLButtonElement | null = null;
	private positionEl: HTMLElement | null = null;
	private renderVersion = 0;

	constructor(
		app: App,
		private view: ColumnExplorerView,
		file: TFile,
		files: TFile[] = [file],
	) {
		super(app);
		const snapshot = files.length > 0 ? [...files] : [file];
		const currentIndex = snapshot.findIndex((candidate) => candidate.path === file.path);
		this.files = currentIndex === -1 ? [file] : snapshot;
		this.currentIndex = currentIndex === -1 ? 0 : currentIndex;
	}
	onOpen() {
		this.modalEl.addClass("column-explorer-quicklook");
		const bar = this.contentEl.createDiv({ cls: "column-explorer-quicklook-bar" });
		this.previousButton = bar.createEl("button", {
			cls: "clickable-icon column-explorer-quicklook-prev",
			attr: { "aria-label": t("quickLookPrevious"), title: t("quickLookPrevious") },
		});
		setIcon(this.previousButton, "chevron-left");
		this.previousButton.addEventListener("click", () => this.navigate(-1));
		this.positionEl = bar.createDiv({
			cls: "column-explorer-quicklook-position",
			attr: { role: "status", "aria-live": "polite" },
		});
		this.nextButton = bar.createEl("button", {
			cls: "clickable-icon column-explorer-quicklook-next",
			attr: { "aria-label": t("quickLookNext"), title: t("quickLookNext") },
		});
		setIcon(this.nextButton, "chevron-right");
		this.nextButton.addEventListener("click", () => this.navigate(1));

		// На телефоне Quick Look остаётся bottom sheet с явной кнопкой закрытия.
		if (Platform.isMobile) {
			const close = bar.createEl("button", { cls: "clickable-icon", attr: { "aria-label": t("close") } });
			setIcon(close, "x");
			close.addEventListener("click", () => this.close());
		}
		this.bodyEl = this.contentEl.createDiv({ cls: "column-explorer-quicklook-body" });
		this.pruneInitialSnapshot();
		this.renderCurrent();

		this.scope.register([], " ", () => {
			if (this.focusOwnsKeyboard(true)) return;
			this.close();
			return false;
		});
		this.scope.register([], "ArrowLeft", () => {
			if (this.focusOwnsKeyboard(false)) return;
			this.navigate(-1);
			return false;
		});
		this.scope.register([], "ArrowRight", () => {
			if (this.focusOwnsKeyboard(false)) return;
			this.navigate(1);
			return false;
		});
	}
	onClose() {
		this.renderVersion++;
		this.owner?.unload();
		this.owner = null;
		this.bodyEl = null;
		this.previousButton = null;
		this.nextButton = null;
		this.positionEl = null;
		this.contentEl.empty();
	}

	private pruneInitialSnapshot(): void {
		const currentPath = this.files[this.currentIndex]?.path;
		this.files = this.files.flatMap((file) => {
			const current = this.app.vault.getAbstractFileByPath(file.path);
			return current instanceof TFile ? [current] : [];
		});
		const currentIndex = currentPath
			? this.files.findIndex((file) => file.path === currentPath)
			: -1;
		this.currentIndex = currentIndex >= 0
			? currentIndex
			: Math.min(this.currentIndex, this.files.length - 1);
	}

	private navigate(direction: -1 | 1): void {
		const oldFiles = this.files;
		const oldIndex = this.currentIndex;
		const resolved = oldFiles.map((file) => {
			const current = this.app.vault.getAbstractFileByPath(file.path);
			return current instanceof TFile ? current : null;
		});
		const aliveBefore = resolved.slice(0, Math.max(0, oldIndex)).filter((file) => file !== null).length;
		const currentSurvives = oldIndex >= 0 && resolved[oldIndex] !== null;
		this.files = resolved.filter((file): file is TFile => file !== null);

		const targetIndex = currentSurvives
			? aliveBefore + direction
			: direction > 0 ? aliveBefore : aliveBefore - 1;
		if (targetIndex >= 0 && targetIndex < this.files.length) {
			this.currentIndex = targetIndex;
			this.renderCurrent();
			return;
		}
		if (!currentSurvives) {
			this.currentIndex = this.files.length > 0
				? Math.min(aliveBefore, this.files.length - 1)
				: -1;
			this.renderCurrent();
			return;
		}
		this.currentIndex = aliveBefore;
		this.updateControls();
	}

	private renderCurrent(): void {
		if (!this.bodyEl) return;
		this.renderVersion++;
		this.owner?.unload();
		this.owner = null;
		this.bodyEl.empty();
		const file = this.files[this.currentIndex];
		if (!file) {
			this.bodyEl.createDiv({ cls: "column-explorer-quicklook-unavailable", text: t("quickLookUnavailable") });
			this.updateControls();
			return;
		}

		const version = this.renderVersion;
		const owner = new Component();
		owner.load();
		this.owner = owner;
		const inner = this.bodyEl.createDiv({ cls: "column-explorer-preview-inner" });
		renderPreviewContent(
			this.view,
			inner,
			file,
			owner,
			() => this.renderVersion === version && this.owner === owner && inner.isConnected,
		);
		this.updateControls();
	}

	private updateControls(): void {
		const total = this.files.length;
		const current = total > 0 && this.currentIndex >= 0 ? this.currentIndex + 1 : 0;
		if (this.positionEl) this.positionEl.setText(t("quickLookPosition", { current, total }));
		if (this.previousButton) this.previousButton.disabled = current <= 1;
		if (this.nextButton) this.nextButton.disabled = current === 0 || current >= total;
	}

	private focusOwnsKeyboard(includeButtons: boolean): boolean {
		const active = this.contentEl.ownerDocument.activeElement;
		if (!(active instanceof HTMLElement) || !this.contentEl.contains(active)) return false;
		const selector = includeButtons
			? "input, textarea, select, button, a, audio, video, iframe, [contenteditable]"
			: "input, textarea, select, audio, video, iframe, [contenteditable]";
		return active.matches(selector) || active.closest(selector) !== null;
	}
}

/** Fuzzy folder picker used by "Move to folder…". */
export class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
	constructor(
		app: App,
		private onChoose: (folder: TFolder) => void,
		private sourcePaths: readonly string[] = [],
	) {
		super(app);
		this.setPlaceholder(t("moveToPlaceholder"));
	}

	getItems(): TFolder[] {
		const folders: TFolder[] = [this.app.vault.getRoot()];
		const walk = (folder: TFolder) => {
			for (const child of folder.children) {
				if (child instanceof TFolder) {
					folders.push(child);
					walk(child);
				}
			}
		};
		walk(this.app.vault.getRoot());

		const sources = this.sourcePaths
			.map((path) => this.app.vault.getAbstractFileByPath(path))
			.filter((source) => source !== null);
		const isInsideSourceFolder = (target: TFolder, source: TFolder): boolean => {
			let current: TFolder | null = target;
			while (current) {
				if (current.path === source.path) return true;
				current = current.parent;
			}
			return false;
		};

		return folders.filter((target) => {
			if (sources.some((source) => source instanceof TFolder && isInsideSourceFolder(target, source))) {
				return false;
			}
			// Направление является холостым, только если каждый источник уже там.
			// При разных родителях оставляем цель, куда переместится хотя бы один.
			const allSourcesResolved = sources.length > 0 && sources.length === this.sourcePaths.length;
			return !allSourcesResolved || sources.some((source) => {
				if (source.parent?.path === target.path) return false;
				const destination = (target.isRoot() ? "" : target.path + "/") + source.name;
				return !this.app.vault.getAbstractFileByPath(destination);
			});
		});
	}

	getItemText(folder: TFolder): string {
		return folder.isRoot() ? "/" : folder.path;
	}

	onChooseItem(folder: TFolder): void {
		this.onChoose(folder);
	}
}

/** Fuzzy icon picker for "Folder icon" — lists all lucide icon ids with a preview. */
export class IconSuggestModal extends FuzzySuggestModal<string> {
	constructor(app: App, private onChoose: (icon: string) => void) {
		super(app);
		this.setPlaceholder(t("iconPlaceholder"));
	}

	getItems(): string[] {
		return getIconIds();
	}

	getItemText(icon: string): string {
		return icon;
	}

	renderSuggestion(match: FuzzyMatch<string>, el: HTMLElement): void {
		el.addClass("column-explorer-icon-suggestion");
		const preview = el.createSpan({ cls: "column-explorer-icon-suggestion-preview" });
		setIcon(preview, match.item);
		el.createSpan({ text: match.item });
	}

	onChooseItem(icon: string): void {
		this.onChoose(icon);
	}
}
