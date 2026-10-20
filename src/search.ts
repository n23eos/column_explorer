import { FuzzySuggestModal, Keymap, TFile, TFolder } from "obsidian";
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

/** Finds folders by their full vault path without changing the active editor. */
export class FolderNavigationModal extends FuzzySuggestModal<TFolder> {
	constructor(private view: ColumnExplorerView, private query = "") {
		super(view.app);
		this.setPlaceholder(t("folderSearchPlaceholder"));
		this.emptyStateText = t("noResults");
	}

	async onOpen() {
		await super.onOpen();
		this.inputEl.value = this.query;
		this.inputEl.dispatchEvent(new Event("input", { bubbles: true }));
	}

	getItems(): TFolder[] {
		const patterns = parseExcludePatterns(this.view.plugin.settings.excludePatterns);
		const folders: TFolder[] = [];
		const seen = new Set<string>();
		const walk = (folder: TFolder) => {
			if (seen.has(folder.path)) return;
			if (!folder.isRoot() && matchesExcludePatterns(folder.path, patterns)) return;
			seen.add(folder.path);
			folders.push(folder);
			for (const child of folder.children) {
				if (child instanceof TFolder) walk(child);
			}
		};
		walk(this.app.vault.getRoot());
		return folders;
	}

	getItemText(folder: TFolder): string {
		return folder.isRoot() ? "/" : folder.path;
	}

	onChooseItem(folder: TFolder): void {
		const current = folder.isRoot()
			? this.app.vault.getRoot()
			: this.app.vault.getAbstractFileByPath(folder.path);
		if (current !== folder) return;
		this.view.revealFile(folder);
		this.view.focusColumns();
	}
}
