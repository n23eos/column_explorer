import { beforeEach, describe, expect, test, vi } from "vitest";
import { App, Component, TFile, TFolder } from "obsidian";
import { App as MockApp, Modal as MockModal } from "./__mocks__/obsidian";

/** Мок-приложение под сигнатурой настоящего App. */
const fakeApp = (): App => new MockApp() as unknown as App;

/** Внутренности мок-модалки: isOpen и перехваченные горячие клавиши. */
const asMock = (modal: object) => modal as unknown as MockModal;
import { ConfirmModal, FolderSuggestModal, IconSuggestModal, QuickLookModal } from "../src/modals";
import type { ColumnExplorerView } from "../src/view";
import { makeVault } from "./setup/vault";
import { makeView } from "./setup/view";

function appWith(paths: string[]) {
	const vault = makeVault(paths);
	const app = new MockApp();
	app.vault = {
		getRoot: () => vault.getRoot(),
		getAbstractFileByPath: (path: string) => vault.getAbstractFileByPath(path),
	};
	return { app: app as unknown as App, vault };
}

beforeEach(() => {
	document.body.innerHTML = "";
});

describe("ConfirmModal", () => {
	test("shows the message and both buttons", () => {
		const modal = new ConfirmModal(fakeApp(), "Delete 3 items?", () => { /* no-op */ });

		modal.open();

		expect(modal.contentEl.querySelector("p")?.textContent).toBe("Delete 3 items?");
		expect(modal.contentEl.querySelectorAll("button")).toHaveLength(2);
	});

	test("confirming runs the callback and closes", () => {
		const onConfirm = vi.fn();
		const modal = new ConfirmModal(fakeApp(), "sure?", onConfirm);
		modal.open();

		modal.contentEl.querySelectorAll("button")[0].dispatchEvent(new MouseEvent("click"));

		expect(onConfirm).toHaveBeenCalledOnce();
		expect(asMock(modal).isOpen).toBe(false);
	});

	test("cancelling closes without running the callback", () => {
		const onConfirm = vi.fn();
		const modal = new ConfirmModal(fakeApp(), "sure?", onConfirm);
		modal.open();

		modal.contentEl.querySelectorAll("button")[1].dispatchEvent(new MouseEvent("click"));

		expect(onConfirm).not.toHaveBeenCalled();
		expect(asMock(modal).isOpen).toBe(false);
	});

	test("closing empties the content", () => {
		const modal = new ConfirmModal(fakeApp(), "sure?", () => { /* no-op */ });
		modal.open();

		modal.close();

		expect(modal.contentEl.childNodes).toHaveLength(0);
	});
});

describe("QuickLookModal", () => {
	function quickLook(path: string, paths = [path]) {
		const vault = makeVault(paths);
		const view = makeView(vault);
		(view.app.vault as unknown as { cachedRead: () => Promise<string> }).cachedRead = () => Promise.resolve("");
		const file = vault.getAbstractFileByPath(path) as TFile;
		const files = paths.map((candidate) => vault.getAbstractFileByPath(candidate) as TFile);
		return {
			modal: new QuickLookModal(view.app as unknown as App, view as ColumnExplorerView, file, files),
			vault,
			view,
		};
	}

	test("renders the preview body", () => {
		const { modal } = quickLook("a.md");

		modal.open();

		expect(modal.contentEl.querySelector(".column-explorer-preview-inner")).not.toBeNull();
		expect(modal.contentEl.querySelector(".column-explorer-preview-name")?.textContent).toBe("a");
	});

	test("space closes the modal", () => {
		const { modal } = quickLook("a.md");
		modal.open();

		asMock(modal).scope.keys.get(" ")?.();

		expect(asMock(modal).isOpen).toBe(false);
	});

	test("closing unloads the markdown owner and clears the content", () => {
		const { modal } = quickLook("a.md");
		const unload = vi.spyOn(Component.prototype, "unload");
		modal.open();

		modal.close();

		expect(unload).toHaveBeenCalled();
		expect(modal.contentEl.childNodes).toHaveLength(0);
		unload.mockRestore();
	});

	test("moves through the snapshot with buttons and stops at its boundaries", () => {
		const { modal } = quickLook("b.md", ["a.md", "b.md", "c.md"]);
		modal.open();
		const previous = modal.contentEl.querySelector<HTMLButtonElement>(".column-explorer-quicklook-prev");
		const next = modal.contentEl.querySelector<HTMLButtonElement>(".column-explorer-quicklook-next");

		expect(modal.contentEl.querySelector(".column-explorer-preview-name")?.textContent).toBe("b");
		expect(modal.contentEl.querySelector(".column-explorer-quicklook-position")?.textContent).toContain("2");
		next?.click();
		expect(modal.contentEl.querySelector(".column-explorer-preview-name")?.textContent).toBe("c");
		expect(next?.disabled).toBe(true);
		next?.click();
		expect(modal.contentEl.querySelector(".column-explorer-preview-name")?.textContent).toBe("c");
		previous?.click();
		previous?.click();
		expect(modal.contentEl.querySelector(".column-explorer-preview-name")?.textContent).toBe("a");
		expect(previous?.disabled).toBe(true);
	});

	test("uses ArrowLeft and ArrowRight without changing the editor", () => {
		const { modal, view } = quickLook("a.md", ["a.md", "b.md"]);
		const getLeaf = vi.spyOn(view.app.workspace, "getLeaf");
		modal.open();

		asMock(modal).scope.keys.get("ArrowRight")?.();
		expect(modal.contentEl.querySelector(".column-explorer-preview-name")?.textContent).toBe("b");
		asMock(modal).scope.keys.get("ArrowLeft")?.();
		expect(modal.contentEl.querySelector(".column-explorer-preview-name")?.textContent).toBe("a");
		expect(getLeaf).not.toHaveBeenCalled();
	});

	test("does not consume navigation keys while a media control has focus", () => {
		const { modal } = quickLook("song.mp3", ["song.mp3", "next.md"]);
		document.body.appendChild(modal.contentEl);
		modal.open();
		modal.contentEl.querySelector<HTMLAudioElement>("audio")?.focus();

		asMock(modal).scope.keys.get("ArrowRight")?.();
		asMock(modal).scope.keys.get(" ")?.();

		expect(modal.contentEl.querySelector(".column-explorer-preview-name")?.textContent).toBe("song.mp3");
		expect(asMock(modal).isOpen).toBe(true);
	});

	test("prunes deleted files when navigating", () => {
		const { modal, vault } = quickLook("a.md", ["a.md", "b.md", "c.md"]);
		modal.open();
		vault.index.delete("b.md");

		asMock(modal).scope.keys.get("ArrowRight")?.();

		expect(modal.contentEl.querySelector(".column-explorer-preview-name")?.textContent).toBe("c");
		expect(modal.contentEl.querySelector(".column-explorer-quicklook-position")?.textContent).toContain("2");
	});

	test("shows an unavailable state when every snapshotted file was deleted", () => {
		const { modal, vault } = quickLook("a.md", ["a.md", "b.md"]);
		modal.open();
		vault.index.delete("a.md");
		vault.index.delete("b.md");

		asMock(modal).scope.keys.get("ArrowRight")?.();

		expect(modal.contentEl.querySelector(".column-explorer-quicklook-unavailable")).not.toBeNull();
		expect(modal.contentEl.querySelector<HTMLButtonElement>(".column-explorer-quicklook-prev")?.disabled).toBe(true);
		expect(modal.contentEl.querySelector<HTMLButtonElement>(".column-explorer-quicklook-next")?.disabled).toBe(true);
	});

	test("unloads the previous preview owner on every file change", () => {
		const { modal } = quickLook("a.md", ["a.md", "b.md"]);
		const unload = vi.spyOn(Component.prototype, "unload");
		modal.open();

		asMock(modal).scope.keys.get("ArrowRight")?.();

		expect(unload).toHaveBeenCalledOnce();
		unload.mockRestore();
	});
});

describe("FolderSuggestModal", () => {
	test("lists the root and every nested folder", () => {
		const { app } = appWith(["a.md", "one/x.md", "one/two/y.md"]);

		const items = new FolderSuggestModal(app, () => { /* no-op */ }).getItems();

		expect(items.map((f) => f.path)).toEqual(["/", "one", "one/two"]);
	});

	test("shows the root as a slash and others by path", () => {
		const { app, vault } = appWith(["one/x.md"]);
		const modal = new FolderSuggestModal(app, () => { /* no-op */ });

		expect(modal.getItemText(vault.getRoot())).toBe("/");
		expect(modal.getItemText(vault.getAbstractFileByPath("one") as TFolder)).toBe("one");
	});

	test("choosing a folder hands it to the callback", () => {
		const { app, vault } = appWith(["one/x.md"]);
		const chosen: string[] = [];
		const modal = new FolderSuggestModal(app, (f) => chosen.push(f.path));

		modal.onChooseItem(vault.getAbstractFileByPath("one") as TFolder);

		expect(chosen).toEqual(["one"]);
	});

	test("excludes a moved folder, its descendants and its current parent", () => {
		const { app } = appWith(["project/sub/note.md", "other/note.md"]);

		const items = new FolderSuggestModal(app, () => { /* no-op */ }, ["project"]).getItems();

		expect(items.map((folder) => folder.path)).toEqual(["other"]);
	});

	test("excludes a no-op parent shared by all source files", () => {
		const { app } = appWith(["one/a.md", "one/b.md", "two/c.md"]);

		const items = new FolderSuggestModal(app, () => { /* no-op */ }, ["one/a.md", "one/b.md"]).getItems();

		expect(items.map((folder) => folder.path)).not.toContain("one");
	});

	test("excludes targets where every remaining source collides", () => {
		const { app } = appWith(["one/a.md", "two/a.md"]);
		const items = new FolderSuggestModal(app, () => { /* no-op */ }, ["one/a.md", "two/a.md"]).getItems();
		expect(items.map((folder) => folder.path)).toEqual(["/"]);
	});

	test("keeps a parent that moves at least one source from another folder", () => {
		const { app } = appWith(["one/a.md", "two/b.md"]);

		const items = new FolderSuggestModal(app, () => { /* no-op */ }, ["one/a.md", "two/b.md"]).getItems();

		expect(items.map((folder) => folder.path)).toEqual(["/", "one", "two"]);
	});
});

describe("IconSuggestModal", () => {
	test("lists the available icon ids", () => {
		const modal = new IconSuggestModal(fakeApp(), () => { /* no-op */ });

		expect(modal.getItems()).toContain("folder");
		expect(modal.getItemText("folder")).toBe("folder");
	});

	test("a suggestion shows the icon next to its name", () => {
		const modal = new IconSuggestModal(fakeApp(), () => { /* no-op */ });
		const el = document.createElement("div");

		modal.renderSuggestion({ item: "star", match: { score: 0, matches: [] } }, el);

		expect(el.querySelector<HTMLElement>(".column-explorer-icon-suggestion-preview")?.dataset.icon).toBe("star");
		expect(el.textContent).toContain("star");
	});

	test("choosing an icon hands it to the callback", () => {
		const chosen: string[] = [];
		const modal = new IconSuggestModal(fakeApp(), (icon) => chosen.push(icon));

		modal.onChooseItem("star");

		expect(chosen).toEqual(["star"]);
	});
});
