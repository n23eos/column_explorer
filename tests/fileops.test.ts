import { beforeEach, describe, expect, test, vi } from "vitest";
import { App, TFile, TFolder } from "obsidian";
import { createdNotices, resetNotices } from "./__mocks__/obsidian";
import { copyFiles, duplicateFile, duplicateFolder, importExternalFiles, moveFiles, trashFiles } from "../src/fileops";
import { t } from "../src/i18n";
import { makeVault } from "./setup/vault";
import { makeApp } from "./setup/app";

/**
 * fileops работает через App, а не через view — собираем минимальный app
 * поверх фейкового vault и дописываем методы, нужные только здесь
 * (getAllLoadedFiles, createBinary, copy).
 */
function makeFileOpsApp(paths: string[]) {
	const vault = makeVault(paths);
	const base = makeApp(vault);
	const created: string[] = [];
	const copied: { from: string; to: string }[] = [];
	const createdFolders: string[] = [];

	const app = {
		...base,
		vault: {
			...base.vault,
			getAllLoadedFiles: () => [...vault.index.values()],
			createBinary: (path: string) => { created.push(path); return Promise.resolve(); },
			copy: (f: TFile, path: string) => { copied.push({ from: f.path, to: path }); return Promise.resolve(); },
			createFolder: (path: string) => { createdFolders.push(path); return Promise.resolve(); },
		},
	};
	return { app: app as unknown as App, vault, created, copied, createdFolders, fileManager: base.fileManager };
}

const folderOf = (vault: ReturnType<typeof makeVault>, path: string) => {
	const f = vault.getAbstractFileByPath(path);
	if (!(f instanceof TFolder)) throw new Error(`not a folder: ${path}`);
	return f;
};

beforeEach(() => {
	document.body.innerHTML = "";
	resetNotices();
});

describe("moveFiles", () => {
	test("moves each path into the target folder", async () => {
		const { app, vault, fileManager } = makeFileOpsApp(["a.md", "b.md", "target/"]);

		const moved = await moveFiles(app, ["a.md", "b.md"], folderOf(vault, "target"));

		expect(moved).toBe(2);
		expect(fileManager.renamed).toEqual([
			{ from: "a.md", to: "target/a.md" },
			{ from: "b.md", to: "target/b.md" },
		]);
	});

	test("skips a file that already sits in the target folder", async () => {
		const { app, vault, fileManager } = makeFileOpsApp(["target/a.md"]);

		const moved = await moveFiles(app, ["target/a.md"], folderOf(vault, "target"));

		expect(moved).toBe(0);
		expect(fileManager.renamed).toEqual([]);
	});

	test("refuses to move a folder into its own descendant", async () => {
		const { app, vault, fileManager } = makeFileOpsApp(["parent/child/x.md"]);

		const moved = await moveFiles(app, ["parent"], folderOf(vault, "parent/child"));

		expect(moved).toBe(0);
		expect(fileManager.renamed).toEqual([]);
	});

	test("skips a move that would overwrite an existing name", async () => {
		const { app, vault, fileManager } = makeFileOpsApp(["a.md", "target/a.md"]);

		const moved = await moveFiles(app, ["a.md"], folderOf(vault, "target"));

		expect(moved).toBe(0);
		expect(fileManager.renamed).toEqual([]);
	});

	test("keeps going when one file fails and reports the rest as moved", async () => {
		const { app, vault } = makeFileOpsApp(["bad.md", "good.md", "target/"]);
		const failing = app as unknown as { fileManager: { renameFile: (f: TFile, p: string) => Promise<void> } };
		const done: string[] = [];
		failing.fileManager.renameFile = (f, path) => {
			if (f.path === "bad.md") return Promise.reject(new Error("locked"));
			done.push(path);
			return Promise.resolve();
		};

		const moved = await moveFiles(app, ["bad.md", "good.md"], folderOf(vault, "target"));

		expect(moved).toBe(1);
		expect(done).toEqual(["target/good.md"]);
	});

	test("moving into the root drops the folder prefix", async () => {
		const { app, vault, fileManager } = makeFileOpsApp(["sub/a.md"]);

		await moveFiles(app, ["sub/a.md"], vault.getRoot());

		expect(fileManager.renamed).toEqual([{ from: "sub/a.md", to: "a.md" }]);
	});
});

describe("duplicateFile", () => {
	test('appends " copy" to the basename, keeping the extension', async () => {
		const { app, vault, copied } = makeFileOpsApp(["notes/a.md"]);

		await duplicateFile(app, vault.getAbstractFileByPath("notes/a.md") as TFile);

		expect(copied).toEqual([{ from: "notes/a.md", to: "notes/a copy.md" }]);
	});

	test("numbers the copy when the plain copy name is taken", async () => {
		const { app, vault, copied } = makeFileOpsApp(["a.md", "a copy.md", "a copy 1.md"]);

		await duplicateFile(app, vault.getAbstractFileByPath("a.md") as TFile);

		expect(copied).toEqual([{ from: "a.md", to: "a copy 2.md" }]);
	});
});

describe("copyFiles", () => {
	test("copies files into the target folder", async () => {
		const { app, vault, copied } = makeFileOpsApp(["a.md", "target/"]);

		await copyFiles(app, ["a.md"], folderOf(vault, "target"));

		expect(copied).toEqual([{ from: "a.md", to: "target/a.md" }]);
	});

	test("suffixes the name when it is already taken", async () => {
		const { app, vault, copied } = makeFileOpsApp(["a.md", "target/a.md"]);

		await copyFiles(app, ["a.md"], folderOf(vault, "target"));

		expect(copied).toEqual([{ from: "a.md", to: "target/a 1.md" }]);
	});

	test("copies a folder with its whole subtree", async () => {
		const { app, vault, copied, createdFolders } = makeFileOpsApp(["dir/x.md", "dir/sub/y.md", "target/"]);

		await copyFiles(app, ["dir"], folderOf(vault, "target"));

		expect(createdFolders).toEqual(["target/dir", "target/dir/sub"]);
		expect(copied).toEqual([
			{ from: "dir/x.md", to: "target/dir/x.md" },
			{ from: "dir/sub/y.md", to: "target/dir/sub/y.md" },
		]);
	});

	test("refuses to paste a folder into itself or a descendant", async () => {
		const { app, vault, createdFolders } = makeFileOpsApp(["dir/sub/"]);

		await copyFiles(app, ["dir"], folderOf(vault, "dir/sub"));

		expect(createdFolders).toEqual([]);
		expect(createdNotices.map((n) => n.message)).toContain(t("cantMoveIntoSelf"));
	});
});

describe("duplicateFolder", () => {
	test("recreates the folder tree under a ' copy' name", async () => {
		const { app, vault, copied, createdFolders } = makeFileOpsApp(["dir/a.md", "dir/sub/b.md"]);

		await duplicateFolder(app, folderOf(vault, "dir"));

		expect(createdFolders).toEqual(["dir copy", "dir copy/sub"]);
		expect(copied).toEqual([
			{ from: "dir/a.md", to: "dir copy/a.md" },
			{ from: "dir/sub/b.md", to: "dir copy/sub/b.md" },
		]);
	});

	test("numbers the copy when the plain copy name is taken", async () => {
		const { app, vault, createdFolders } = makeFileOpsApp(["dir/", "dir copy/"]);

		await duplicateFolder(app, folderOf(vault, "dir"));

		expect(createdFolders).toEqual(["dir copy 1"]);
	});
});

describe("trashFiles", () => {
	test("trashes every existing path and ignores missing ones", async () => {
		const { app, fileManager } = makeFileOpsApp(["a.md", "b.md"]);

		await trashFiles(app, ["a.md", "ghost.md", "b.md"]);

		expect(fileManager.trashed).toEqual(["a.md", "b.md"]);
	});
});

describe("importExternalFiles", () => {
	const fakeFile = (name: string) => ({
		name,
		arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
	}) as unknown as File;

	test("writes dropped files into the target folder", async () => {
		const { app, vault, created } = makeFileOpsApp(["target/"]);

		const imported = await importExternalFiles(app, [fakeFile("x.png")], folderOf(vault, "target"));

		expect(imported).toBe(1);
		expect(created).toEqual(["target/x.png"]);
	});

	test("suffixes the name instead of overwriting an existing file", async () => {
		const { app, vault, created } = makeFileOpsApp(["target/x.png"]);

		await importExternalFiles(app, [fakeFile("x.png")], folderOf(vault, "target"));

		expect(created[0]).not.toBe("target/x.png");
		expect(created[0]).toMatch(/^target\/x.*\.png$/);
	});

	test("counts only the files that were written", async () => {
		const { app, vault } = makeFileOpsApp(["target/"]);
		const broken = { name: "y.png", arrayBuffer: () => Promise.reject(new Error("io")) } as unknown as File;

		const imported = await importExternalFiles(app, [broken], folderOf(vault, "target"));

		expect(imported).toBe(0);
	});
});

describe("undo notice", () => {
	/** Фрагмент последнего уведомления — в нём живёт ссылка «Отменить». */
	function undoLink(): HTMLAnchorElement | null {
		const last = createdNotices[createdNotices.length - 1];
		if (!last || typeof last.message === "string") return null;
		return last.message.querySelector<HTMLAnchorElement>("a.column-explorer-undo-link");
	}

	test("a successful move shows a notice with an undo link", async () => {
		const { app, vault } = makeFileOpsApp(["a.md", "target/"]);

		await moveFiles(app, ["a.md"], folderOf(vault, "target"));

		expect(undoLink()).not.toBeNull();
	});

	test("no notice appears when nothing moved", async () => {
		const { app, vault } = makeFileOpsApp(["target/a.md"]);

		await moveFiles(app, ["target/a.md"], folderOf(vault, "target"));

		expect(createdNotices).toHaveLength(0);
	});

	test("undo moves the files back to where they were", async () => {
		const { app, vault, fileManager } = makeFileOpsApp(["a.md", "target/"]);
		await moveFiles(app, ["a.md"], folderOf(vault, "target"));
		// Файл действительно переехал — иначе undo сочтёт исходное имя занятым
		vault.rename("a.md", "target/a.md");

		undoLink()?.dispatchEvent(new MouseEvent("click"));
		await vi.waitFor(() => expect(fileManager.renamed).toHaveLength(2));

		expect(fileManager.renamed[1]).toEqual({ from: "target/a.md", to: "a.md" });
		await vi.waitFor(() => expect(createdNotices[createdNotices.length - 1]?.message).toBe(t("undoMoveResult", {
			restored: 1, skipped: 0, failed: 0,
		})));
	});

	test("undo skips a file whose original name is taken again", async () => {
		const { app, vault, fileManager } = makeFileOpsApp(["a.md", "target/"]);
		await moveFiles(app, ["a.md"], folderOf(vault, "target"));
		// Путь a.md всё ещё занят — возвращать некуда

		undoLink()?.dispatchEvent(new MouseEvent("click"));
		await Promise.resolve();

		expect(fileManager.renamed).toHaveLength(1);
		await vi.waitFor(() => expect(createdNotices[createdNotices.length - 1]?.message).toBe(t("undoMoveResult", {
			restored: 0, skipped: 1, failed: 0,
		})));
		void vault;
	});

	test("undo reports rename failures separately from skipped files", async () => {
		const { app, vault } = makeFileOpsApp(["a.md", "target/"]);
		await moveFiles(app, ["a.md"], folderOf(vault, "target"));
		vault.rename("a.md", "target/a.md");
		app.fileManager.renameFile = () => Promise.reject(new Error("locked"));

		undoLink()?.dispatchEvent(new MouseEvent("click"));

		await vi.waitFor(() => expect(createdNotices[createdNotices.length - 1]?.message).toBe(t("undoMoveResult", {
			restored: 0, skipped: 0, failed: 1,
		})));
		expect(createdNotices.map((entry) => entry.message)).toContain(
			t("moveFailed", { name: "a.md", error: "locked" })
		);
	});

	test("clicking undo hides the notice", async () => {
		const { app, vault } = makeFileOpsApp(["a.md", "target/"]);
		await moveFiles(app, ["a.md"], folderOf(vault, "target"));

		undoLink()?.dispatchEvent(new MouseEvent("click"));

		expect(createdNotices[createdNotices.length - 1].hidden).toBe(true);
	});
});
