import { FuzzySuggestModal, Keymap, TFile } from "obsidian";
import { t } from "./i18n";
import { matchesExcludePatterns, parseExcludePatterns } from "./pure";
import type { ColumnExplorerView } from "./view";

/** Searches names and paths only when explicitly opened, respecting exclusions. */
export class VaultFileSearchModal extends FuzzySuggestModal<TFile> {
	constructor(private view: ColumnExplorerView, private query: string) {
		super(view.app);
		this.setPlaceholder(t("searchVaultPlaceholder"));
		this.emptyStateText = t("noResults");
	}

	async onOpen() {
		await super.onOpen();
		this.inputEl.value = this.query;
		this.inputEl.dispatchEvent(new Event("input", { bubbles: true }));
	}

	getItems(): TFile[] {
		const patterns = parseExcludePatterns(this.view.plugin.settings.excludePatterns);
		return this.app.vault.getFiles().filter(file => !matchesExcludePatterns(file.path, patterns));
	}

	getItemText(file: TFile): string { return file.path; }

	onChooseItem(file: TFile, event: MouseEvent | KeyboardEvent) {
		if (this.app.vault.getAbstractFileByPath(file.path) !== file) return;
		this.view.revealFile(file);
		void this.app.workspace.getLeaf(Keymap.isModEvent(event)).openFile(file);
	}
}
