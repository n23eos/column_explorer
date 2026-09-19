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
	/** Владелец отрисованного markdown — выгружается вместе с модалкой. */
	private owner = new Component();

	constructor(app: App, private view: ColumnExplorerView, private file: TFile) {
		super(app);
	}
	onOpen() {
		this.owner.load();
		this.modalEl.addClass("column-explorer-quicklook");
		// На телефоне окно раскрывается снизу как bottom sheet — клавиатуры,
		// чтобы закрыть его пробелом, там нет, нужна явная кнопка
		if (Platform.isMobile) {
			const bar = this.contentEl.createDiv({ cls: "column-explorer-quicklook-bar" });
			const close = bar.createEl("button", { cls: "clickable-icon", attr: { "aria-label": t("close") } });
			setIcon(close, "x");
			close.addEventListener("click", () => this.close());
		}
		const inner = this.contentEl.createDiv({ cls: "column-explorer-preview-inner" });
		renderPreviewContent(this.view, inner, this.file, this.owner);
		this.scope.register([], " ", () => { this.close(); return false; });
	}
	onClose() {
		this.owner.unload();
		this.contentEl.empty();
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
