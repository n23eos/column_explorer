import { describe, expect, test, vi } from "vitest";
import { TFile } from "obsidian";
import { VaultFileSearchModal } from "../src/search";
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
