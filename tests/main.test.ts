import { beforeEach, describe, expect, test } from "vitest";
import { TFile } from "obsidian";
import ColumnExplorerPlugin from "../src/main";
import { ColumnExplorerSettings, setPanelAutoResize } from "../src/settings";
import { makeVault } from "./setup/vault";
import { makeApp } from "./setup/app";

/**
 * Поднимает плагин на фейковом app с заданным содержимым data.json.
 * `null` — установка с нуля (первый запуск).
 */
async function loadPlugin(data: Partial<ColumnExplorerSettings> | null, paths: string[] = ["a.md", "b.md"]) {
	const vault = makeVault(paths);
	const app = makeApp(vault);
	const layoutReady: (() => void)[] = [];
	Object.assign(app.workspace, {
		getLastOpenFiles: () => ["b.md", "a.md"],
		getLeavesOfType: () => [],
		getLeftLeaf: () => null,
		revealLeaf: () => Promise.resolve(),
		onLayoutReady: (cb: () => void) => layoutReady.push(cb),
	});

	// Настоящий Plugin принимает (app, manifest); мок — нет, поэтому конструктор
	// зовём без аргументов и подставляем app вручную
	const PluginCtor = ColumnExplorerPlugin as unknown as new () => ColumnExplorerPlugin;
	const plugin = new PluginCtor();
	(plugin as unknown as { app: unknown }).app = app;
	(plugin as unknown as { loadDataResult: unknown }).loadDataResult = data;
	await plugin.onload();
	return { plugin, app, vault, layoutReady };
}

beforeEach(() => {
	document.body.innerHTML = "";
});

describe("loadSettings", () => {
	test("fills in defaults for keys missing from data.json", async () => {
		const { plugin } = await loadPlugin({ columnWidth: 300 });

		expect(plugin.settings.columnWidth).toBe(300);
		expect(plugin.settings.sortMode).toBe("name-asc");
	});

	test("clamps an out-of-range column width from a hand-edited file", async () => {
		const { plugin } = await loadPlugin({ columnWidth: 99999 } as Partial<ColumnExplorerSettings>);

		expect(plugin.settings.columnWidth).toBeLessThan(99999);
	});

	test("replaces an unknown sort mode with the default", async () => {
		const { plugin } = await loadPlugin({ sortMode: "nonsense" } as unknown as Partial<ColumnExplorerSettings>);

		expect(plugin.settings.sortMode).toBe("name-asc");
	});

	test("replaces an unknown open location with the sidebar default", async () => {
		const { plugin } = await loadPlugin({ openLocation: "nonsense" } as unknown as Partial<ColumnExplorerSettings>);

		expect(plugin.settings.openLocation).toBe("sidebar");
	});

	test("migrates boolean pins from v1.3.x to numeric order", async () => {
		const data = { pinnedPaths: { "a.md": true, "b.md": true } } as unknown as Partial<ColumnExplorerSettings>;

		const { plugin } = await loadPlugin(data);

		expect(plugin.settings.pinnedPaths).toEqual({ "a.md": 0, "b.md": 1 });
	});

	test("mixed boolean and numeric pins get unique orders", async () => {
		// Откат на 1.3.x и обратно: часть пинов уже числа, часть — снова true
		const data = { pinnedPaths: { "a.md": true, "b.md": 2, "c.md": true } } as unknown as Partial<ColumnExplorerSettings>;

		const { plugin } = await loadPlugin(data);

		expect(plugin.settings.pinnedPaths).toEqual({ "a.md": 3, "b.md": 2, "c.md": 4 });
	});

	test("keeps numeric pin order untouched", async () => {
		const { plugin } = await loadPlugin({ pinnedPaths: { "a.md": 5, "b.md": 2 } });

		expect(plugin.settings.pinnedPaths).toEqual({ "a.md": 5, "b.md": 2 });
	});

	test("values that are not an order and not `true` are not pins", async () => {
		const data = {
			pinnedPaths: { "a.md": true, "b.md": false, "c.md": "yes", "d.md": null, "e.md": NaN },
		} as unknown as Partial<ColumnExplorerSettings>;

		const { plugin } = await loadPlugin(data);

		expect(plugin.settings.pinnedPaths).toEqual({ "a.md": 0 });
	});

	test("loading survives pinnedPaths that is not an object", async () => {
		const data = { pinnedPaths: "everything" } as unknown as Partial<ColumnExplorerSettings>;

		const { plugin } = await loadPlugin(data);

		expect(plugin.settings.pinnedPaths).toEqual({});
	});

	test("drops stale per-day column width keys", async () => {
		const data = { columnWidths: { "::day::2026-07-19": 300, "notes": 250 } } as Partial<ColumnExplorerSettings>;

		const { plugin } = await loadPlugin(data);

		expect(plugin.settings.columnWidths).toEqual({ notes: 250 });
	});
});

describe("first run", () => {
	test("seeds recent files from Obsidian when the key is absent", async () => {
		const { plugin } = await loadPlugin({});

		expect(plugin.settings.recentFiles).toEqual(["b.md", "a.md"]);
	});

	test("does not re-seed when the user has cleared the list", async () => {
		const { plugin } = await loadPlugin({ recentFiles: [] });

		expect(plugin.settings.recentFiles).toEqual([]);
	});

	test("opens the view once when data.json does not exist yet", async () => {
		const { layoutReady } = await loadPlugin(null);

		expect(layoutReady).toHaveLength(1);
	});

	test("does not auto-open on later launches", async () => {
		const { layoutReady } = await loadPlugin({});

		expect(layoutReady).toHaveLength(0);
	});
});

describe("registration", () => {
	test("registers the view, ribbon icon and commands", async () => {
		const { plugin } = await loadPlugin({});
		const registered = plugin as unknown as { views: string[]; ribbonIcons: string[]; commands: { id: string }[] };

		expect(registered.views).toEqual(["column-explorer-view"]);
		expect(registered.ribbonIcons).toEqual(["columns-3"]);
		expect(registered.commands.map((c) => c.id)).toEqual([
			"open-view", "reveal-active-file", "focus-view", "new-note-here", "new-folder-here",
		]);
	});

	test("folder commands stay hidden while no view leaf exists", async () => {
		const { plugin } = await loadPlugin({});
		const commands = (plugin as unknown as { commands: { id: string; checkCallback?: (c: boolean) => boolean }[] }).commands;

		const newNote = commands.find((c) => c.id === "new-note-here");

		expect(newNote?.checkCallback?.(true)).toBe(false);
	});
});

describe("vault and workspace events", () => {
	test("opening a file pushes it to the front of the recent list", async () => {
		const { plugin, app, vault } = await loadPlugin({ recentFiles: ["a.md"] });

		app.workspace.trigger("file-open", vault.getAbstractFileByPath("b.md") as TFile);

		expect(plugin.settings.recentFiles).toEqual(["b.md", "a.md"]);
	});

	test("an empty file-open event leaves recents alone", async () => {
		const { plugin, app } = await loadPlugin({ recentFiles: ["a.md"] });

		app.workspace.trigger("file-open", null);

		expect(plugin.settings.recentFiles).toEqual(["a.md"]);
	});

	test("renaming remaps recents and favorites", async () => {
		const { plugin, app, vault } = await loadPlugin({ recentFiles: ["a.md"], favorites: ["a.md"] });

		const renamed = vault.rename("a.md", "renamed.md");
		app.vault.trigger("rename", renamed, "a.md");

		expect(plugin.settings.recentFiles).toEqual(["renamed.md"]);
		expect(plugin.settings.favorites).toEqual(["renamed.md"]);
	});

	test("deleting a folder drops its children from recents and favorites", async () => {
		const { plugin, app, vault } = await loadPlugin(
			{ recentFiles: ["sub/x.md"], favorites: ["sub/x.md", "a.md"] },
			["a.md", "sub/x.md"]
		);

		app.vault.trigger("delete", vault.getAbstractFileByPath("sub"));

		expect(plugin.settings.recentFiles).toEqual([]);
		expect(plugin.settings.favorites).toEqual(["a.md"]);
	});

	test("opening a file records when the human last saw it", async () => {
		const { plugin, app, vault } = await loadPlugin({});
		const before = Date.now();

		app.workspace.trigger("file-open", vault.getAbstractFileByPath("b.md") as TFile);

		expect(plugin.settings.seenAt["b.md"]).toBeGreaterThanOrEqual(before);
	});

	test("renaming moves the seen mark to the new path", async () => {
		const { plugin, app, vault } = await loadPlugin({ seenAt: { "a.md": 500 } });

		const renamed = vault.rename("a.md", "renamed.md");
		app.vault.trigger("rename", renamed, "a.md");

		expect(plugin.settings.seenAt).toEqual({ "renamed.md": 500 });
	});

	test("deleting a folder drops seen marks of its children", async () => {
		const { plugin, app, vault } = await loadPlugin(
			{ seenAt: { "sub/x.md": 500, "a.md": 500 } },
			["a.md", "sub/x.md"]
		);

		app.vault.trigger("delete", vault.getAbstractFileByPath("sub"));

		expect(plugin.settings.seenAt).toEqual({ "a.md": 500 });
	});

	test("editing the file you are looking at keeps it marked as seen", async () => {
		// Своя правка не должна ставить себе же метку «изменён кем-то другим»
		const { plugin, app, vault } = await loadPlugin({ seenAt: { "a.md": 500 } });
		const file = vault.getAbstractFileByPath("a.md") as TFile;
		file.stat = { ...file.stat, mtime: 90_000 };
		app.workspace.getActiveFile = () => file;

		app.vault.trigger("modify", file);

		expect(plugin.settings.seenAt["a.md"]).toBe(90_000);
	});

	test("a background edit leaves the seen mark alone", async () => {
		// Правка агента/синка в неактивном файле — это и есть непрочитанное
		const { plugin, app, vault } = await loadPlugin({ seenAt: { "a.md": 500 } });
		const file = vault.getAbstractFileByPath("a.md") as TFile;
		file.stat = { ...file.stat, mtime: 90_000 };

		app.vault.trigger("modify", file);

		expect(plugin.settings.seenAt["a.md"]).toBe(500);
	});
});

describe("unread baseline", () => {
	test("a fresh install stamps the baseline with the current time", async () => {
		const before = Date.now();

		const { plugin } = await loadPlugin(null);

		expect(plugin.settings.unreadBaseline).toBeGreaterThanOrEqual(before);
	});

	test("an existing baseline is never moved", async () => {
		const { plugin } = await loadPlugin({ unreadBaseline: 777 });

		expect(plugin.settings.unreadBaseline).toBe(777);
	});

	test("an upgrade from a version without the feature stamps the baseline once", async () => {
		// Иначе после апдейта «новым» стал бы весь существующий vault
		const before = Date.now();

		const { plugin } = await loadPlugin({ columnWidth: 300 });

		expect(plugin.settings.unreadBaseline).toBeGreaterThanOrEqual(before);
	});
});

describe("activateView", () => {
	/** Лист сайдбара с вью нужного типа. */
	function fakeLeaf(view: unknown) {
		return {
			view,
			states: [] as unknown[],
			setViewState(state: unknown) { this.states.push(state); return Promise.resolve(); },
			loadIfDeferred: () => Promise.resolve(),
			getRoot: () => ({}),
		};
	}

	test("returns null when there is no left sidebar to put it in", async () => {
		const { plugin } = await loadPlugin({});

		await expect(plugin.activateView()).resolves.toBeNull();
	});

	test("creates the view state in a fresh leaf", async () => {
		const { plugin, app } = await loadPlugin({});
		const leaf = fakeLeaf(null);
		Object.assign(app.workspace, { getLeftLeaf: () => leaf, getLeavesOfType: () => [] });

		await plugin.activateView();

		expect(leaf.states).toEqual([{ type: "column-explorer-view", active: true }]);
	});

	test("opens in the main area when the setting says tab", async () => {
		const { plugin, app } = await loadPlugin({ openLocation: "tab" });
		const leaf = fakeLeaf(null);
		const requested: string[] = [];
		Object.assign(app.workspace, {
			getLeavesOfType: () => [],
			getLeaf: (where: string) => { requested.push(where); return leaf; },
		});

		await plugin.activateView();

		expect(requested).toEqual(["tab"]);
		expect(leaf.states).toEqual([{ type: "column-explorer-view", active: true }]);
	});

	test("reuses an existing leaf instead of creating a second one", async () => {
		const { plugin, app } = await loadPlugin({});
		const leaf = fakeLeaf(null);
		Object.assign(app.workspace, { getLeavesOfType: () => [leaf] });

		await plugin.activateView();

		expect(leaf.states).toEqual([]);
	});

	test("getView returns null while the leaf holds a different view", async () => {
		const { plugin, app } = await loadPlugin({});
		Object.assign(app.workspace, { getLeavesOfType: () => [fakeLeaf({})] });

		expect(plugin.getView()).toBeNull();
	});

	test("folder commands become available once a view leaf exists", async () => {
		const { plugin, app } = await loadPlugin({});
		Object.assign(app.workspace, { getLeavesOfType: () => [fakeLeaf(null)] });
		const commands = (plugin as unknown as { commands: { id: string; checkCallback?: (c: boolean) => boolean }[] }).commands;

		expect(commands.find((c) => c.id === "new-folder-here")?.checkCallback?.(true)).toBe(true);
	});
});

describe("saveSettings", () => {
	test("writes the current settings to data.json", async () => {
		const { plugin } = await loadPlugin({ columnWidth: 280 });

		await plugin.saveSettings();

		expect((plugin as unknown as { savedData: { columnWidth: number } }).savedData.columnWidth).toBe(280);
	});

	test("queued saves eventually write too", async () => {
		const { plugin } = await loadPlugin({});

		plugin.queueSaveSettings();
		await Promise.resolve();

		expect((plugin as unknown as { savedData: unknown }).savedData).not.toBeNull();
	});
});

describe("active-leaf-change", () => {
	/** Плагин с уже «загруженной» вью — её методы подставные. */
	async function withView(settings: Partial<ColumnExplorerSettings>, active: TFile | null) {
		const calls: string[] = [];
		const view = {
			updateActiveFileHighlight: () => calls.push("highlight"),
			selectedFilePath: () => "a.md",
			revealFile: () => calls.push("reveal"),
		};
		const { plugin, app } = await loadPlugin(settings);
		Object.assign(app.workspace, { getActiveFile: () => active });
		// getView() проверяет instanceof — подменяем сам метод
		(plugin as unknown as { getView: () => unknown }).getView = () => view;
		return { plugin, app, calls };
	}

	test("refreshes the highlight on every leaf change", async () => {
		const { app, calls } = await withView({ autoReveal: false }, null);

		app.workspace.trigger("active-leaf-change");

		expect(calls).toEqual(["highlight"]);
	});

	test("auto-reveal follows the newly active file", async () => {
		const { app, calls } = await withView({ autoReveal: true }, { path: "b.md" } as TFile);

		app.workspace.trigger("active-leaf-change");

		expect(calls).toEqual(["highlight", "reveal"]);
	});

	test("auto-reveal skips a file that is already selected", async () => {
		const { app, calls } = await withView({ autoReveal: true }, { path: "a.md" } as TFile);

		app.workspace.trigger("active-leaf-change");

		expect(calls).toEqual(["highlight"]);
	});
});

describe("column width lock persistence", () => {
	test("preserves auto-resize on upgrade and restores the saved canonical choice", async () => {
		const { plugin } = await loadPlugin({ autoPanelResize: true, columnWidths: { "/": 310 } });
		expect(plugin.settings.autoPanelResize).toBe(true);
		expect(plugin.settings.lockColumnWidths).toBe(false);
		expect(plugin.settings.columnWidths).toEqual({ "/": 310 });
		setPanelAutoResize(plugin.settings, false);
		await plugin.saveSettings();
		const saved = (plugin as unknown as { savedData: ColumnExplorerSettings }).savedData;
		const { plugin: reopened } = await loadPlugin(saved);
		expect(reopened.settings.autoPanelResize).toBe(false);
		expect(reopened.settings.lockColumnWidths).toBe(true);
		expect(reopened.settings.columnWidths).toEqual({ "/": 310 });
	});
});
