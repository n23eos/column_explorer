import { App, Notice, TFile, TFolder, normalizePath } from "obsidian";
import { t } from "./i18n";
import { availablePath, errorMessage } from "./pure";

const UNDO_NOTICE_MS = 8000;

interface MoveRecord { from: string; to: string }
interface UndoMoveResult { restored: number; skipped: number; failed: number }

/**
 * Move a set of paths into a target folder. Shared by drag & drop and
 * the "Move to folder…" action. Returns the number of items moved.
 */
export async function moveFiles(app: App, paths: string[], target: TFolder): Promise<number> {
	const moves: MoveRecord[] = [];
	for (const path of paths) {
		const src = app.vault.getAbstractFileByPath(path);
		if (!src || src.path === target.path) continue;
		if (target.path.startsWith(src.path + "/")) {
			new Notice(t("cantMoveIntoSelf"));
			continue;
		}
		if (src.parent?.path === target.path) continue;
		const dest = normalizePath((target.isRoot() ? "" : target.path + "/") + src.name);
		if (app.vault.getAbstractFileByPath(dest)) {
			new Notice(t("alreadyExists", { name: src.name }));
			continue;
		}
		// Сбой одного файла не должен рвать всю пачку — сообщаем и идём дальше
		try {
			await app.fileManager.renameFile(src, dest);
			moves.push({ from: path, to: dest });
		} catch (err) {
			new Notice(t("moveFailed", { name: src.name, error: errorMessage(err) }));
		}
	}
	if (moves.length > 0) showUndoMoveNotice(app, moves);
	return moves.length;
}

/** Notice with an inline "Undo" action that moves the files back. */
function showUndoMoveNotice(app: App, moves: MoveRecord[]) {
	const frag = createFragment();
	frag.createSpan({ text: t("itemsMoved", { n: moves.length }) + " " });
	const undoBtn = frag.createEl("a", { text: t("undo"), cls: "column-explorer-undo-link" });
	const notice = new Notice(frag, UNDO_NOTICE_MS);
	undoBtn.addEventListener("click", () => {
		notice.hide();
		void undoMoves(app, moves).then(({ restored, skipped, failed }) => {
			new Notice(t("undoMoveResult", { restored, skipped, failed }));
		});
	});
}

async function undoMoves(app: App, moves: MoveRecord[]): Promise<UndoMoveResult> {
	let restored = 0;
	let skipped = 0;
	let failed = 0;
	for (const move of moves) {
		const f = app.vault.getAbstractFileByPath(move.to);
		// Файл мог быть удалён/переименован, а исходное имя — занято заново
		if (!f || app.vault.getAbstractFileByPath(move.from)) {
			skipped++;
			continue;
		}
		try {
			await app.fileManager.renameFile(f, move.from);
			restored++;
		} catch (err) {
			failed++;
			new Notice(t("moveFailed", { name: f.name, error: errorMessage(err) }));
		}
	}
	return { restored, skipped, failed };
}

/**
 * Copy files dragged in from the OS into a vault folder. Name clashes get
 * a numeric suffix instead of overwriting. Returns the number imported.
 */
export async function importExternalFiles(app: App, files: readonly File[], target: TFolder): Promise<number> {
	let imported = 0;
	for (const file of files) {
		try {
			const data = await file.arrayBuffer();
			// Свежий набор занятых путей на каждый файл — учитывает только что созданные
			const taken = new Set(app.vault.getAllLoadedFiles().map((f) => f.path));
			const dest = normalizePath(availablePath(target.isRoot() ? "" : target.path, file.name, taken));
			await app.vault.createBinary(dest, data);
			imported++;
		} catch {
			new Notice(t("importFailed", { name: file.name }));
		}
	}
	if (imported > 0) new Notice(t("filesImported", { n: imported }));
	return imported;
}

export async function duplicateFile(app: App, f: TFile): Promise<void> {
	const dir = f.parent && !f.parent.isRoot() ? f.parent.path + "/" : "";
	let n = 1;
	let path = normalizePath(dir + f.basename + " copy." + f.extension);
	while (app.vault.getAbstractFileByPath(path)) {
		path = normalizePath(dir + f.basename + " copy " + n++ + "." + f.extension);
	}
	try {
		await app.vault.copy(f, path);
	} catch (err) {
		new Notice(t("duplicateFailed", { name: f.name, error: errorMessage(err) }));
	}
}

/**
 * Вставка внутреннего буфера Copy/Paste: копии путей в целевую папку.
 * Коллизии имён получают числовой суффикс (как импорт из ОС), папки
 * копируются со всем поддеревом. Возвращает число вставленных элементов.
 */
export async function copyFiles(app: App, paths: string[], target: TFolder): Promise<number> {
	let pasted = 0;
	for (const path of paths) {
		const src = app.vault.getAbstractFileByPath(path);
		if (!src) continue;
		// Копия папки внутрь самой себя зациклила бы рекурсию
		if (src.path === target.path || target.path.startsWith(src.path + "/")) {
			new Notice(t("cantMoveIntoSelf"));
			continue;
		}
		// Свежий набор занятых путей на каждый элемент — учитывает уже вставленные
		const taken = new Set(app.vault.getAllLoadedFiles().map((f) => f.path));
		const dest = normalizePath(availablePath(target.isRoot() ? "" : target.path, src.name, taken));
		try {
			if (src instanceof TFolder) await copyFolderInto(app, src, dest);
			else if (src instanceof TFile) await app.vault.copy(src, dest);
			else continue;
			pasted++;
		} catch (err) {
			new Notice(t("duplicateFailed", { name: src.name, error: errorMessage(err) }));
		}
	}
	if (pasted > 0) new Notice(t("itemsPasted", { n: pasted }));
	return pasted;
}

/** Рекурсивная копия папки рядом с исходной, под именем "X copy". */
export async function duplicateFolder(app: App, folder: TFolder): Promise<void> {
	const dir = folder.parent && !folder.parent.isRoot() ? folder.parent.path + "/" : "";
	let n = 1;
	let dest = normalizePath(dir + folder.name + " copy");
	while (app.vault.getAbstractFileByPath(dest)) {
		dest = normalizePath(dir + folder.name + " copy " + n++);
	}
	try {
		await copyFolderInto(app, folder, dest);
	} catch (err) {
		new Notice(t("duplicateFailed", { name: folder.name, error: errorMessage(err) }));
	}
}

async function copyFolderInto(app: App, folder: TFolder, dest: string): Promise<void> {
	await app.vault.createFolder(dest);
	for (const child of folder.children) {
		const childDest = dest + "/" + child.name;
		if (child instanceof TFolder) await copyFolderInto(app, child, childDest);
		else if (child instanceof TFile) await app.vault.copy(child, childDest);
	}
}

export async function trashFiles(app: App, paths: string[]): Promise<void> {
	for (const p of paths) {
		const f = app.vault.getAbstractFileByPath(p);
		if (!f) continue;
		try {
			await app.fileManager.trashFile(f);
		} catch (err) {
			new Notice(t("deleteFailed", { name: f.name, error: errorMessage(err) }));
		}
	}
}
