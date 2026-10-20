/**
 * Спецстрока и колонка «Использование диска»: появление в корне, отрисовка
 * диаграммы и то, ради чего заведён отдельный контроллер, — переживание
 * перерисовок колонок без повторного скана хранилища.
 */
import { beforeEach, describe, expect, test } from "vitest";
import { ColumnExplorerView } from "../src/view";
import type ColumnExplorerPlugin from "../src/main";
import { STORAGE_PATH } from "../src/pure";
import { ColumnExplorerSettings } from "../src/settings";
import { TFile } from "obsidian";
import { makeVault, FakeVault } from "./setup/vault";
import { makeApp, makePlugin } from "./setup/app";
import { resetObservers } from "./setup/obsidian-dom";

async function mountView(paths: string[], settings: Partial<ColumnExplorerSettings> = {}) {
	const vault = makeVault(paths);
	const app = makeApp(vault);
	const plugin = makePlugin(app, { showRecents: false, showBookmarks: false, showCalendar: false, ...settings });
	const view = new ColumnExplorerView({ getRoot: () => ({}) } as never, plugin as unknown as ColumnExplorerPlugin);
	(view as unknown as { app: unknown }).app = app;
	document.body.appendChild(view.contentEl);
	await view.onOpen();
	return { view, app, vault, plugin };
}

/** makeVault отдаёт файлы нулевого размера — диаграмме нужно чем заполнять кольца. */
function giveFilesSize(vault: FakeVault, bytes = 1024) {
	for (const node of vault.index.values()) {
		if (node instanceof TFile) node.stat = { ...node.stat, size: bytes };
	}
}

/**
 * Первая отрисовка происходит синхронно внутри цепочки промисов скана, ДО
 * вступительной анимации: она стартует с нулевого угла и на первом кадре
 * убирает все секторы, поэтому дуги проверяем сразу после микрозадачи.
 */
const flushScan = () => Promise.resolve();

/** Полный проход скана вместе со словосчётом. */
const flushWords = () => new Promise((resolve) => setTimeout(resolve, 0));

const itemPaths = (view: ColumnExplorerView) =>
	Array.from(view.contentEl.querySelectorAll<HTMLElement>(".column-explorer-item[data-path]"))
		.map((c) => c.dataset.path ?? "");

/** Клавиатура вью слушает колонки, а не корневой элемент. */
function keydown(view: ColumnExplorerView, key: string) {
	view.contentEl.querySelector<HTMLElement>(".column-explorer-columns")
		?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}

const chartEl = (view: ColumnExplorerView) =>
	view.contentEl.querySelector<HTMLElement>(".column-explorer-du");

beforeEach(() => {
	document.body.innerHTML = "";
	resetObservers();
});

describe("disk usage row", () => {
	test("sits in the root column when enabled", async () => {
		const { view } = await mountView(["a.md"]);

		expect(itemPaths(view)).toContain(STORAGE_PATH);
	});

	test("is hidden when the setting is off", async () => {
		const { view } = await mountView(["a.md"], { showStorage: false });

		expect(itemPaths(view)).not.toContain(STORAGE_PATH);
		expect(view.specialKind(STORAGE_PATH)).toBeNull();
	});
});

describe("disk usage column", () => {
	test("renders the chart with one arc per visible node", async () => {
		const { view, vault } = await mountView(["notes/a.md", "notes/b.md", "c.md"]);
		giveFilesSize(vault);

		view.selectSpecial(STORAGE_PATH);
		await flushScan();

		const chart = chartEl(view);
		expect(chart).not.toBeNull();
		expect(chart!.querySelectorAll("path.column-explorer-du-arc").length).toBeGreaterThan(0);
		expect(chart!.querySelector(".column-explorer-du-crumb")?.textContent).toBe("TestVault");
	});

	test("shows all three metric buttons, words disabled until counted", async () => {
		const { view } = await mountView(["a.md"]);

		view.selectSpecial(STORAGE_PATH);
		const buttons = view.contentEl.querySelectorAll<HTMLButtonElement>(".column-explorer-du-seg-btn");

		expect(Array.from(buttons).map((b) => b.textContent)).toEqual(["Size", "Words", "Files"]);
		expect(buttons[1].disabled).toBe(true);
	});

	test("survives a re-render instead of rescanning the vault", async () => {
		const { view, vault } = await mountView(["a.md"]);
		giveFilesSize(vault);

		view.selectSpecial(STORAGE_PATH);
		await flushScan();
		const before = chartEl(view);
		view.render();
		const after = chartEl(view);

		expect(before).not.toBeNull();
		expect(after).toBe(before);
		expect(after!.querySelectorAll("path.column-explorer-du-arc").length).toBeGreaterThan(0);
	});

	test("an empty vault shows the empty state instead of a chart", async () => {
		const { view } = await mountView(["a.md"]);

		view.selectSpecial(STORAGE_PATH);
		await flushScan();

		const empty = chartEl(view)?.querySelector<HTMLElement>(".column-explorer-du-empty");
		expect(empty?.textContent).toBe("Vault is empty");
		expect(empty?.style.display).not.toBe("none");
	});

	test("turning the setting off drops the chart", async () => {
		const { view, plugin } = await mountView(["a.md"]);

		view.selectSpecial(STORAGE_PATH);
		await flushWords();
		const before = chartEl(view);
		plugin.settings.showStorage = false;
		view.render();

		expect(before).not.toBeNull();
		expect(chartEl(view)).toBeNull();
		// Спецстрока исчезает вместе с колонкой
		expect(itemPaths(view)).not.toContain(STORAGE_PATH);
	});

	// Отказ скана оставлял rejected-промис в хвосте очереди, и все следующие
	// сканы молча пропускались — диаграмма застывала на старых данных
	test("a failed scan does not kill later rescans", async () => {
		const { view, app, vault } = await mountView(["notes/a.md", "c.md"]);
		giveFilesSize(vault);
		const workingList = app.vault.getRoot;
		view.selectSpecial(STORAGE_PATH);
		await flushWords();
		app.vault.getRoot = () => { throw new Error("scan boom"); };
		view.contentEl.querySelector<HTMLButtonElement>(".column-explorer-du-icon-btn")?.click();
		await flushWords();

		// Считаем обращения к vault: рескан «прошёл», если файлы снова спросили
		let listed = 0;
		app.vault.getRoot = () => { listed++; return workingList(); };
		view.contentEl.querySelector<HTMLButtonElement>(".column-explorer-du-icon-btn")?.click();
		await flushWords();

		expect(listed).toBe(1);
	});

	test("keyboard cannot walk inside the chart column", async () => {
		const { view } = await mountView(["a.md"]);

		view.selectSpecial(STORAGE_PATH);
		keydown(view, "ArrowRight");

		expect(view.selection).toEqual([STORAGE_PATH]);
	});

	test("escape at the root of the chart keeps the selection", async () => {
		const { view } = await mountView(["a.md"]);

		view.selectSpecial(STORAGE_PATH);
		await flushWords();
		keydown(view, "Escape");

		expect(view.selection).toEqual([STORAGE_PATH]);
	});
});
