import { beforeEach, describe, expect, test, vi } from "vitest";
import { App, TAbstractFile, TFile, TFolder } from "obsidian";
import { createdNotices, resetNotices } from "./__mocks__/obsidian";
import {
	copyFiles,
	duplicateFile,
	duplicateFolder,
	importExternalFiles,
	moveFiles,
	moveFilesDetailed,
	trashFiles,
} from "../src/fileops";
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
	const createdNodes = new WeakSet<TAbstractFile>();

	const parentFor = (path: string): TFolder => {
		const slash = path.lastIndexOf("/");
		const parentPath = slash === -1 ? "/" : path.slice(0, slash);
		const parent = vault.getAbstractFileByPath(parentPath);
		if (!(parent instanceof TFolder)) throw new Error(`missing parent: ${parentPath}`);
		return parent;
	};

	const addFolder = (path: string): TFolder => {
		if (vault.getAbstractFileByPath(path)) throw new Error(`path exists: ${path}`);
		const folder = new TFolder();
		folder.path = path;
		folder.name = path.slice(path.lastIndexOf("/") + 1);
		folder.parent = parentFor(path);
		folder.parent.children.push(folder);
		vault.index.set(path, folder);
		createdNodes.add(folder);
		return folder;
	};

	const addFile = (source: TFile, path: string): TFile => {
		if (vault.getAbstractFileByPath(path)) throw new Error(`path exists: ${path}`);
		const file = new TFile();
		file.path = path;
		file.name = path.slice(path.lastIndexOf("/") + 1);
		const dot = file.name.lastIndexOf(".");
		file.basename = dot > 0 ? file.name.slice(0, dot) : file.name;
		file.extension = source.extension;
		file.stat = { ...source.stat };
		file.parent = parentFor(path);
		file.parent.children.push(file);
		vault.index.set(path, file);
		createdNodes.add(file);
		return file;
	};

	const removeNode = (node: TAbstractFile) => {
		if (node instanceof TFolder) {
			for (const child of [...node.children]) removeNode(child);
		}
		vault.index.delete(node.path);
		if (node.parent) node.parent.children = node.parent.children.filter((child) => child !== node);
	};

	const fileManager = {
		...base.fileManager,
		renameFile: async (f: TAbstractFile, path: string) => {
			await base.fileManager.renameFile(f, path);
			if (createdNodes.has(f)) vault.rename(f.path, path);
		},
		trashFile: async (f: TAbstractFile) => {
			base.fileManager.trashed.push(f.path);
			removeNode(f);
		},
	};

	const app = {
		...base,
		vault: {
			...base.vault,
			getAllLoadedFiles: () => [...vault.index.values()],
			createBinary: (path: string) => { created.push(path); return Promise.resolve(); },
			copy: (f: TFile, path: string) => {
				copied.push({ from: f.path, to: path });
				return Promise.resolve(addFile(f, path));
			},
			createFolder: (path: string) => {
				createdFolders.push(path);
				return Promise.resolve(addFolder(path));
			},
		},
		fileManager,
	};
	return { app: app as unknown as App, vault, created, copied, createdFolders, fileManager };
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

	test("reports only failed and colliding paths as remaining", async () => {
		const { app, vault } = makeFileOpsApp([
			"bad.md", "good.md", "collision.md", "target/collision.md", "target/inside.md",
		]);
		app.fileManager.renameFile = (f, path) => {
			if (f.path === "bad.md") return Promise.reject(new Error("locked"));
			return Promise.resolve(void path);
		};

		const result = await moveFilesDetailed(app, [
			"bad.md", "good.md", "collision.md", "ghost.md", "target/inside.md",
		], folderOf(vault, "target"));

		expect(result).toEqual({
			movedPaths: ["good.md"],
			remainingPaths: ["bad.md", "collision.md"],
		});
	});

	test("keeps a folder that cannot be moved into its descendant", async () => {
		const { app, vault } = makeFileOpsApp(["parent/child/"]);

		const result = await moveFilesDetailed(app, ["parent"], folderOf(vault, "parent/child"));

		expect(result).toEqual({ movedPaths: [], remainingPaths: ["parent"] });
	});

	test("keeps a folder when it is also the move target", async () => {
		const { app, vault } = makeFileOpsApp(["parent/"]);

		const result = await moveFilesDetailed(app, ["parent"], folderOf(vault, "parent"));

		expect(result).toEqual({ movedPaths: [], remainingPaths: ["parent"] });
	});

	test("collapses a selected child under its selected parent", async () => {
		const { app, vault, fileManager } = makeFileOpsApp(["parent/child.md", "target/"]);

		const result = await moveFilesDetailed(app, ["parent/child.md", "parent"], folderOf(vault, "target"));

		expect(result).toEqual({ movedPaths: ["parent"], remainingPaths: [] });
		expect(fileManager.renamed).toEqual([{ from: "parent", to: "target/parent" }]);
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

	test("does not append a dot when the file has no extension", async () => {
		const { app, vault, copied } = makeFileOpsApp(["LICENSE"]);

		await duplicateFile(app, vault.getAbstractFileByPath("LICENSE") as TFile);

		expect(copied).toEqual([{ from: "LICENSE", to: "LICENSE copy" }]);
	});

	test("numbers an extensionless copy without adding a dot", async () => {
		const { app, vault, copied } = makeFileOpsApp(["LICENSE", "LICENSE copy", "LICENSE copy 1"]);

		await duplicateFile(app, vault.getAbstractFileByPath("LICENSE") as TFile);

		expect(copied).toEqual([{ from: "LICENSE", to: "LICENSE copy 2" }]);
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
		const { app, vault } = makeFileOpsApp(["dir/x.md", "dir/sub/y.md", "target/"]);

		await copyFiles(app, ["dir"], folderOf(vault, "target"));

		expect(vault.getAbstractFileByPath("target/dir")).toBeInstanceOf(TFolder);
		expect(vault.getAbstractFileByPath("target/dir/x.md")).toBeInstanceOf(TFile);
		expect(vault.getAbstractFileByPath("target/dir/sub")).toBeInstanceOf(TFolder);
		expect(vault.getAbstractFileByPath("target/dir/sub/y.md")).toBeInstanceOf(TFile);
	});

	test("refuses to paste a folder into itself or a descendant", async () => {
		const { app, vault, createdFolders } = makeFileOpsApp(["dir/sub/"]);

		await copyFiles(app, ["dir"], folderOf(vault, "dir/sub"));

		expect(createdFolders).toEqual([]);
		expect(createdNotices.map((n) => n.message)).toContain(t("cantMoveIntoSelf"));
	});

	test("preserves an unchanged partial copy while retry uses the intended folder name", async () => {
		const { app, vault, createdFolders } = makeFileOpsApp(["dir/a.md", "dir/b.md", "target/"]);
		const copy = app.vault.copy.bind(app.vault);
		let fail = true;
		app.vault.copy = async (file, path) => {
			if (fail && file.name === "b.md") {
				fail = false;
				throw new Error("disk full");
			}
			return copy(file, path);
		};

		expect(await copyFiles(app, ["dir"], folderOf(vault, "target"))).toBe(0);
		expect(vault.getAbstractFileByPath("target/dir")).toBeNull();
		expect(vault.getAbstractFileByPath(createdFolders[0] + "/a.md")).toBeInstanceOf(TFile);

		expect(await copyFiles(app, ["dir"], folderOf(vault, "target"))).toBe(1);
		expect(vault.getAbstractFileByPath("target/dir")).toBeInstanceOf(TFolder);
		expect(vault.getAbstractFileByPath("target/dir 1")).toBeNull();
	});

	test("preserves an unknown file created by a copy call that rejects late", async () => {
		const { app, vault, createdFolders } = makeFileOpsApp(["dir/a.md", "dir/b.md", "target/"]);
		const copy = app.vault.copy.bind(app.vault);
		app.vault.copy = async (file, path) => {
			const copied = await copy(file, path);
			if (file.name === "b.md") throw new Error("late adapter error");
			return copied;
		};

		expect(await copyFiles(app, ["dir"], folderOf(vault, "target"))).toBe(0);

		const stagingPath = createdFolders[0];
		expect(vault.getAbstractFileByPath("target/dir")).toBeNull();
		expect(vault.getAbstractFileByPath(stagingPath + "/b.md")).toBeInstanceOf(TFile);
		expect(createdNotices.map((notice) => notice.message)).toContain(
			t("copyPartialPreserved", { path: stagingPath })
		);
	});

	test("preserves a copied file that changed before failure cleanup", async () => {
		const { app, vault, createdFolders } = makeFileOpsApp(["dir/a.md", "dir/b.md", "target/"]);
		const copy = app.vault.copy.bind(app.vault);
		let firstCopy: TFile | null = null;
		app.vault.copy = async (file, path) => {
			if (file.name === "b.md") {
				if (firstCopy) firstCopy.stat.mtime += 1;
				throw new Error("disk full");
			}
			const copied = await copy(file, path);
			firstCopy = copied as unknown as TFile;
			return copied;
		};

		await copyFiles(app, ["dir"], folderOf(vault, "target"));

		const stagingPath = createdFolders[0];
		expect(vault.getAbstractFileByPath(stagingPath + "/a.md")).toBe(firstCopy);
		expect(createdNotices.map((notice) => notice.message)).toContain(
			t("copyPartialPreserved", { path: stagingPath })
		);
	});

	test("preserves a copied file changed before the copy promise resolves", async () => {
		const { app, vault, createdFolders } = makeFileOpsApp(["dir/a.md", "dir/b.md", "target/"]);
		const copy = app.vault.copy.bind(app.vault);
		let copiedBeforeResolve: TFile | null = null;
		app.vault.copy = async (file, path) => {
			if (file.name === "b.md") throw new Error("disk full");
			const copied = await copy(file, path);
			const copiedFile = copied as unknown as TFile;
			copiedFile.stat.mtime += 1;
			copiedBeforeResolve = copiedFile;
			return copied;
		};

		await copyFiles(app, ["dir"], folderOf(vault, "target"));

		const stagingPath = createdFolders[0];
		expect(vault.getAbstractFileByPath(stagingPath + "/a.md")).toBe(copiedBeforeResolve);
		expect(createdNotices.map((notice) => notice.message)).toContain(
			t("copyPartialPreserved", { path: stagingPath })
		);
	});

	test("does not trash even empty staging folders after a copy failure", async () => {
		const { app, vault, createdFolders, fileManager } = makeFileOpsApp(["dir/empty/", "dir/b.md", "target/"]);
		const copy = app.vault.copy.bind(app.vault);
		app.vault.copy = (file, path) => file.name === "b.md"
			? Promise.reject(new Error("disk full"))
			: copy(file, path);

		await copyFiles(app, ["dir"], folderOf(vault, "target"));

		const stagingPath = createdFolders[0];
		expect(vault.getAbstractFileByPath(stagingPath + "/empty")).toBeInstanceOf(TFolder);
		expect(fileManager.trashed).toEqual([]);
		expect(createdNotices.map((notice) => notice.message)).toContain(
			t("copyPartialPreserved", { path: stagingPath })
		);
	});

	test("does not treat an externally moved incomplete staging folder as success", async () => {
		const { app, vault, createdFolders } = makeFileOpsApp(["dir/a.md", "dir/b.md", "target/"]);
		const copy = app.vault.copy.bind(app.vault);
		app.vault.copy = async (file, path) => {
			if (file.name === "a.md") {
				const stagingRoot = vault.getAbstractFileByPath(createdFolders[0]);
				if (!(stagingRoot instanceof TFolder)) throw new Error("missing staging root");
				vault.rename(stagingRoot.path, "target/dir");
				throw new Error("external move during copy");
			}
			return copy(file, path);
		};

		expect(await copyFiles(app, ["dir"], folderOf(vault, "target"))).toBe(0);
		expect(vault.getAbstractFileByPath("target/dir")).toBeInstanceOf(TFolder);
		expect(createdNotices.map((notice) => notice.message)).toContain(
			t("copyPartialPreserved", { path: "target/dir" })
		);
	});

	test("refuses to copy the vault root into one of its folders", async () => {
		const { app, vault } = makeFileOpsApp(["target/"]);
		let createAttempts = 0;
		app.vault.createFolder = () => {
			createAttempts++;
			return Promise.reject(new Error("must not create"));
		};

		await copyFiles(app, ["/"], folderOf(vault, "target"));

		expect(createAttempts).toBe(0);
		expect(createdNotices.map((notice) => notice.message)).toContain(t("cantMoveIntoSelf"));
	});

	test("does not replace a destination that appears before staging is published", async () => {
		const { app, vault, createdFolders } = makeFileOpsApp(["dir/a.md", "target/"]);
		let concurrentDestination: TFolder | null = null;
		app.fileManager.renameFile = async (file, path) => {
			concurrentDestination = await app.vault.createFolder(path);
			void file;
			throw new Error("destination appeared");
		};

		expect(await copyFiles(app, ["dir"], folderOf(vault, "target"))).toBe(0);

		expect(vault.getAbstractFileByPath("target/dir")).toBe(concurrentDestination);
		expect(vault.getAbstractFileByPath(createdFolders[0])).toBeInstanceOf(TFolder);
		expect(createdNotices.map((notice) => notice.message)).toContain(
			t("copyPartialPreserved", { path: createdFolders[0] })
		);
	});
});

describe("duplicateFolder", () => {
	test("recreates the folder tree under a ' copy' name", async () => {
		const { app, vault } = makeFileOpsApp(["dir/a.md", "dir/sub/b.md"]);

		await duplicateFolder(app, folderOf(vault, "dir"));

		expect(vault.getAbstractFileByPath("dir copy")).toBeInstanceOf(TFolder);
		expect(vault.getAbstractFileByPath("dir copy/a.md")).toBeInstanceOf(TFile);
		expect(vault.getAbstractFileByPath("dir copy/sub")).toBeInstanceOf(TFolder);
		expect(vault.getAbstractFileByPath("dir copy/sub/b.md")).toBeInstanceOf(TFile);
	});

	test("numbers the copy when the plain copy name is taken", async () => {
		const { app, vault } = makeFileOpsApp(["dir/", "dir copy/"]);

		await duplicateFolder(app, folderOf(vault, "dir"));

		expect(vault.getAbstractFileByPath("dir copy 1")).toBeInstanceOf(TFolder);
	});

	test("refuses to duplicate the vault root", async () => {
		const { app, vault } = makeFileOpsApp([]);
		let createAttempts = 0;
		app.vault.createFolder = () => {
			createAttempts++;
			return Promise.reject(new Error("must not create"));
		};

		await duplicateFolder(app, vault.getRoot());

		expect(createAttempts).toBe(0);
		expect(createdNotices.map((notice) => notice.message)).toContain(t("cantMoveIntoSelf"));
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
