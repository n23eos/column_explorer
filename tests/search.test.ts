import { describe, expect, test, vi } from "vitest";
import { TFile, TFolder } from "obsidian";
import { FolderNavigationModal, VaultFileSearchModal } from "../src/search";
import { makeVault } from "./setup/vault";
import { makeApp, makePlugin } from "./setup/app";
import type { ColumnExplorerView } from "../src/view";

function setup() {
	const vault = makeVault(["notes/a.md", "hidden/b.md", "image.png"]);
	const app = makeApp(vault);
	const revealFile = vi.fn();
	const view = { app, plugin: makePlugin(app, { excludePatterns: "hidden/" }), revealFile } as unknown as ColumnExplorerView;
	return { vault, app, revealFile, modal: new VaultFileSearchModal(view, "notes") };
}

describe("vault file search", () => {
	test("prefills query and lists all file types respecting exclusions", async () => {
		const { modal } = setup();
		await modal.onOpen();
		expect(modal.inputEl.value).toBe("notes");
		expect(modal.getItems().map(f => f.path)).toEqual(["notes/a.md", "image.png"]);
		expect(modal.getItemText(modal.getItems()[0])).toBe("notes/a.md");
	});
	test("choosing a result reveals and opens it; vanished results are ignored", () => {
		const { modal, vault, app, revealFile } = setup();
		const file = vault.getAbstractFileByPath("notes/a.md") as TFile;
		modal.onChooseItem(file, new KeyboardEvent("keydown", { key: "Enter" }));
		expect(revealFile).toHaveBeenCalledWith(file);
		expect(app.opened).toEqual([file.path]);
		vault.index.delete(file.path);
		modal.onChooseItem(file, new MouseEvent("click"));
		expect(app.opened).toHaveLength(1);
	});
});

describe("folder navigation search", () => {
	function setupFolders() {
		const vault = makeVault([
			"projects/client/note.md",
			"archive/hidden/deep.md",
			"projects/archive/also-hidden.md",
			"empty/",
		]);
		const app = makeApp(vault);
		const revealFile = vi.fn();
		const focusColumns = vi.fn();
		const view = {
			app,
			plugin: makePlugin(app, { excludePatterns: "archive/, projects/archive/" }),
			revealFile,
			focusColumns,
		} as unknown as ColumnExplorerView;
		return { vault, app, revealFile, focusColumns, modal: new FolderNavigationModal(view, "client") };
	}

	test("prefills the query and exposes unique full folder paths only", async () => {
		const { modal, vault } = setupFolders();
		const client = vault.getAbstractFileByPath("projects/client") as TFolder;
		(vault.getAbstractFileByPath("projects") as TFolder).children.push(client);

		await modal.onOpen();

		expect(modal.inputEl.value).toBe("client");
		expect(modal.getItems().map((folder) => modal.getItemText(folder))).toEqual([
			"/", "projects", "projects/client", "empty",
		]);
	});

	test("skips excluded folders and all descendants", () => {
		const { modal } = setupFolders();

		expect(modal.getItems().map((folder) => folder.path)).not.toContain("archive");
		expect(modal.getItems().map((folder) => folder.path)).not.toContain("archive/hidden");
		expect(modal.getItems().map((folder) => folder.path)).not.toContain("projects/archive");
	});

	test("reveals a current folder and focuses columns without opening an editor", () => {
		const { modal, vault, app, revealFile, focusColumns } = setupFolders();
		const folder = vault.getAbstractFileByPath("projects/client") as TFolder;

		modal.onChooseItem(folder);

		expect(revealFile).toHaveBeenCalledWith(folder);
		expect(focusColumns).toHaveBeenCalledOnce();
		expect(app.opened).toEqual([]);
	});

	test("ignores a folder removed after results were collected", () => {
		const { modal, vault, revealFile, focusColumns } = setupFolders();
		const folder = vault.getAbstractFileByPath("projects/client") as TFolder;
		vault.index.delete(folder.path);

		modal.onChooseItem(folder);

		expect(revealFile).not.toHaveBeenCalled();
		expect(focusColumns).not.toHaveBeenCalled();
	});
});
