import { beforeEach, describe, expect, test, vi } from "vitest";
import { App } from "obsidian";
// Компоненты — из мока: у них есть .change()/.click(), которыми тест
// имитирует пользователя. В рантайме это те же объекты (resolve.alias)
import {
	ButtonComponent, DropdownComponent, SliderComponent, TextComponent, ToggleComponent,
} from "./__mocks__/obsidian";
import { createdSettings, resetSettings } from "./__mocks__/obsidian";
import { ColumnExplorerSettingTab, DEFAULT_SETTINGS, setPanelAutoResize } from "../src/settings";
import { normalizeSettings } from "../src/pure";
import { t } from "../src/i18n";
import type ColumnExplorerPlugin from "../src/main";
import { MAX_RECENT_FILES, MIN_RECENT_FILES } from "../src/settings";

/** Плагин-заглушка: настройки, счётчик записей и подставная вью. */
function makeTab(settings = {}) {
	const saved: unknown[] = [];
	const renders: string[] = [];
	const plugin = {
		settings: { ...DEFAULT_SETTINGS, ...settings },
		saveSettings: () => { saved.push({ ...plugin.settings }); return Promise.resolve(); },
		getView: () => ({
			render: () => renders.push("render"),
			applyMobileScale: () => renders.push("scale"),
		}),
	};
	const tab = new ColumnExplorerSettingTab(new App(), plugin as unknown as ColumnExplorerPlugin);
	tab.containerEl = document.createElement("div");
	document.body.appendChild(tab.containerEl);
	return { tab, plugin, saved, renders };
}

/** Все элементы определений, включая вложенные в группы. */
type FlatSettingItem = {
	name: string;
	visible?: boolean | (() => boolean);
	action?: () => void;
	control?: { key?: string; type: string };
};

function flatItems(tab: ColumnExplorerSettingTab): FlatSettingItem[] {
	return tab.getSettingDefinitions().flatMap((group) =>
		"items" in group && Array.isArray(group.items) ? group.items : [group]
	) as FlatSettingItem[];
}

function isVisible(item: FlatSettingItem): boolean {
	return typeof item.visible === "function" ? item.visible() : item.visible !== false;
}

beforeEach(() => {
	document.body.innerHTML = "";
	resetSettings();
});

describe("getSettingDefinitions", () => {
	test("every control points at an existing settings key", () => {
		const { tab } = makeTab();

		const keys = flatItems(tab).map((i) => i.control?.key).filter(Boolean) as string[];

		expect(keys.length).toBeGreaterThan(0);
		for (const key of keys) expect(DEFAULT_SETTINGS).toHaveProperty(key);
	});

	test("no settings key is offered twice", () => {
		const { tab } = makeTab();

		const keys = flatItems(tab).map((i) => i.control?.key).filter(Boolean);

		expect(new Set(keys).size).toBe(keys.length);
	});

	test("every item has a name", () => {
		const { tab } = makeTab();

		for (const item of flatItems(tab)) expect(item.name).toBeTruthy();
	});

	// Тумблер, забытый в настройках, выключается только правкой data.json:
	// так уехали маркеры непрочитанного в 1.14.0
	test("every boolean setting has a control", () => {
		const { tab } = makeTab();
		const offered = new Set(flatItems(tab).map((i) => i.control?.key));

		const booleans = Object.keys(DEFAULT_SETTINGS).filter(
			(k) => k !== "lockColumnWidths"
				&& typeof DEFAULT_SETTINGS[k as keyof typeof DEFAULT_SETTINGS] === "boolean"
		);

		expect(booleans.length).toBeGreaterThan(0);
		for (const key of booleans) expect(offered).toContain(key);
	});

	test("offers one canonical panel auto-resize control", () => {
		const { tab } = makeTab();
		const offered = flatItems(tab).map((item) => item.control?.key).filter(Boolean);

		expect(offered).toContain("autoPanelResize");
		expect(offered).not.toContain("lockColumnWidths");
	});

	test("dependent definitions follow their parent setting", () => {
		const { tab, plugin } = makeTab({ showPreview: false, showRecents: false, showStorage: false });
		const byKey = (key: string) => flatItems(tab).find((item) => item.control?.key === key || item.name === t(key));

		expect(isVisible(byKey("showMarkdownPreview")!)).toBe(false);
		expect(isVisible(byKey("recentFilesCount")!)).toBe(false);
		expect(isVisible(byKey("clearRecents")!)).toBe(false);
		expect(isVisible(byKey("storageExcluded")!)).toBe(false);
		expect(isVisible(byKey("storageRingCount")!)).toBe(false);

		plugin.settings.showPreview = true;
		plugin.settings.showRecents = true;
		plugin.settings.showStorage = true;
		expect(isVisible(byKey("showMarkdownPreview")!)).toBe(true);
		expect(isVisible(byKey("recentFilesCount")!)).toBe(true);
		expect(isVisible(byKey("storageExcluded")!)).toBe(true);
	});
});

describe("setControlValue", () => {
	test("stores a plain value and re-renders the view", async () => {
		const { tab, plugin, renders } = makeTab();

		await tab.setControlValue("foldersFirst", false);

		expect(plugin.settings.foldersFirst).toBe(false);
		expect(renders).toContain("render");
	});

	test("clamps the recent-files count into its allowed range", async () => {
		const { tab, plugin } = makeTab();

		await tab.setControlValue("recentFilesCount", 9999);
		expect(plugin.settings.recentFilesCount).toBe(MAX_RECENT_FILES);

		await tab.setControlValue("recentFilesCount", 0);
		expect(plugin.settings.recentFilesCount).toBe(MIN_RECENT_FILES);
	});

	test("rounds a fractional recent-files count", async () => {
		const { tab, plugin } = makeTab();

		await tab.setControlValue("recentFilesCount", 12.7);

		expect(plugin.settings.recentFilesCount).toBe(13);
	});

	test("mobile sizes only update CSS variables, not the whole render", async () => {
		const { tab, plugin, renders } = makeTab();

		await tab.setControlValue("mobileUiScale", 130);

		expect(plugin.settings.mobileUiScale).toBe(130);
		expect(renders).toEqual(["scale"]);
	});

	test("an out-of-range mobile scale is normalized instead of stored raw", async () => {
		const { tab, plugin } = makeTab();

		await tab.setControlValue("mobileUiScale", 9999);

		expect(plugin.settings.mobileUiScale).toBeLessThan(9999);
	});

	test("panel auto-resize updates its legacy inverse", async () => {
		const { tab, plugin } = makeTab({ autoPanelResize: false, lockColumnWidths: true });

		await tab.setControlValue("autoPanelResize", true);
		expect(plugin.settings.autoPanelResize).toBe(true);
		expect(plugin.settings.lockColumnWidths).toBe(false);

		await tab.setControlValue("autoPanelResize", false);
		expect(plugin.settings.autoPanelResize).toBe(false);
		expect(plugin.settings.lockColumnWidths).toBe(true);
	});

	test("parent toggles ask declarative settings to re-evaluate visibility", async () => {
		const { tab } = makeTab();
		const refreshDomState = vi.fn();
		Object.assign(tab, { refreshDomState });

		await tab.setControlValue("showPreview", true);
		await tab.setControlValue("showRecents", false);
		await tab.setControlValue("showStorage", false);

		expect(refreshDomState).toHaveBeenCalledTimes(3);
	});
});

describe("panel auto-resize migration", () => {
	test.each([
		{ autoPanelResize: true, lockColumnWidths: false, expected: true },
		{ autoPanelResize: true, lockColumnWidths: true, expected: false },
		{ autoPanelResize: false, lockColumnWidths: false, expected: false },
		{ autoPanelResize: false, lockColumnWidths: true, expected: false },
	])("preserves the effective old mode for $autoPanelResize/$lockColumnWidths", ({ autoPanelResize, lockColumnWidths, expected }) => {
		const columnWidths = { "/": 310, notes: 420 };
		const normalized = normalizeSettings({ autoPanelResize, lockColumnWidths, columnWidths });

		expect(normalized.autoPanelResize).toBe(expected);
		expect(normalized.lockColumnWidths).toBe(!expected);
		expect(normalized.columnWidths).toEqual(columnWidths);
		expect(normalizeSettings({ ...normalized })).toEqual(normalized);
	});

	test("a pre-lock saved value keeps its auto-resize behaviour", () => {
		const normalized = normalizeSettings({ autoPanelResize: true, columnWidths: { "/": 310 } });

		expect(normalized.autoPanelResize).toBe(true);
		expect(normalized.lockColumnWidths).toBe(false);
		expect(normalized.columnWidths).toEqual({ "/": 310 });
	});

	test("a fresh install defaults to manual panel sizing", () => {
		const normalized = normalizeSettings({});

		expect(normalized.autoPanelResize).toBe(false);
		expect(normalized.lockColumnWidths).toBe(true);
	});

	test("the shared helper always writes an inverse legacy mirror", () => {
		const settings = { autoPanelResize: false, lockColumnWidths: true };

		setPanelAutoResize(settings, true);
		expect(settings).toEqual({ autoPanelResize: true, lockColumnWidths: false });

		setPanelAutoResize(settings, false);
		expect(settings).toEqual({ autoPanelResize: false, lockColumnWidths: true });
	});
});

describe("display", () => {
	test("renders setting rows into the container", () => {
		const { tab } = makeTab();

		tab.display();

		expect(tab.containerEl.querySelectorAll(".setting-item").length).toBeGreaterThan(10);
	});

	test("legacy rows match the visible declarative controls and actions", () => {
		const { tab } = makeTab();
		const expected = flatItems(tab)
			.filter(isVisible)
			.filter((item) => item.control || item.action)
			.map((item) => item.name)
			.sort();

		tab.display();
		const actual = createdSettings
			.filter((setting) => setting.components.length > 0)
			.map((setting) => setting.name)
			.sort();

		expect(actual).toEqual(expected);
	});

	test("legacy dependent rows appear and disappear after their parent toggle", async () => {
		const { tab } = makeTab({ showPreview: false, showRecents: false, showStorage: false });
		tab.display();
		const before = createdSettings.length;

		await componentOf(t("setPreview"), ToggleComponent)?.change(true);
		await componentOf(t("setShowRecents"), ToggleComponent)?.change(true);
		await componentOf(t("setShowStorage"), ToggleComponent)?.change(true);
		expect(createdSettings.length).toBeGreaterThan(before);

		resetSettings();
		tab.display();
		const visible = new Set(createdSettings.map((setting) => setting.name));
		expect(visible).toContain(t("setMdPreview"));
		expect(visible).toContain(t("setRecentCount"));
		expect(visible).toContain(t("clearRecents"));
		expect(visible).toContain(t("setStorageExclude"));
		expect(visible).toContain(t("setStorageRings"));

		await componentOf(t("setPreview"), ToggleComponent)?.change(false);
		await componentOf(t("setShowRecents"), ToggleComponent)?.change(false);
		await componentOf(t("setShowStorage"), ToggleComponent)?.change(false);
		resetSettings();
		tab.display();
		const hidden = new Set(createdSettings.map((setting) => setting.name));
		expect(hidden).not.toContain(t("setMdPreview"));
		expect(hidden).not.toContain(t("setRecentCount"));
		expect(hidden).not.toContain(t("clearRecents"));
		expect(hidden).not.toContain(t("setStorageExclude"));
		expect(hidden).not.toContain(t("setStorageRings"));
	});

	test("a toggle writes its new value into settings", async () => {
		const { tab, plugin } = makeTab({ foldersFirst: true });
		tab.display();

		const toggle = firstComponent(tab, ToggleComponent);
		await toggle?.change(false);

		expect(plugin.settings.foldersFirst).toBe(false);
	});

	test("the legacy panel toggle updates the canonical mode and compatibility mirror", async () => {
		const { tab, plugin } = makeTab({ autoPanelResize: false, lockColumnWidths: true });
		tab.display();

		await componentOf(t("setAutoPanel"), ToggleComponent)?.change(true);

		expect(plugin.settings.autoPanelResize).toBe(true);
		expect(plugin.settings.lockColumnWidths).toBe(false);
	});

	test("the column width slider carries its limits", () => {
		const { tab } = makeTab();
		tab.display();

		const slider = firstComponent(tab, SliderComponent);

		expect(slider?.limits).toBeDefined();
	});

	test("the sort dropdown offers every sort mode", () => {
		const { tab } = makeTab();
		tab.display();

		const dropdown = componentOf(t("setSort"), DropdownComponent);

		expect(Object.keys(dropdown?.options ?? {})).toContain("mtime-desc");
	});

	test("the exclude-patterns field saves what was typed", async () => {
		const { tab, plugin } = makeTab();
		tab.display();

		const text = firstComponent(tab, TextComponent);
		await text?.change("*.tmp");

		expect(plugin.settings.excludePatterns).toBe("*.tmp");
	});

	test("reset widths clears the per-column widths", async () => {
		const { tab, plugin } = makeTab({ columnWidths: { notes: 400 } });
		tab.display();

		const button = firstComponent(tab, ButtonComponent);
		await button?.click();

		expect(plugin.settings.columnWidths).toEqual({});
	});
});

/** Все компоненты нужного типа со всех строк отрисованной вкладки. */
function allComponents<T>(type: new (...args: never[]) => T): T[] {
	return createdSettings.flatMap((setting) => setting.components).filter((c): c is T => c instanceof type);
}

/** Компонент строки с заданным именем. */
function componentOf<T>(name: string, type: new (...args: never[]) => T): T | undefined {
	return createdSettings
		.filter((setting) => setting.name === name)
		.flatMap((setting) => setting.components)
		.find((c): c is T => c instanceof type);
}

/** Первый компонент нужного типа среди всех строк отрисованной вкладки. */
function firstComponent<T>(_tab: ColumnExplorerSettingTab, type: new (...args: never[]) => T): T | undefined {
	return createdSettings
		.flatMap((setting) => setting.components)
		.find((c): c is T => c instanceof type);
}

describe("display — remaining controls", () => {
	test("the recent-count field clamps what was typed", async () => {
		const { tab, plugin } = makeTab();
		tab.display();

		await componentOf(t("setRecentCount"), TextComponent)?.change("9999");

		expect(plugin.settings.recentFilesCount).toBe(MAX_RECENT_FILES);
	});

	test("a non-numeric recent count is ignored", async () => {
		const { tab, plugin } = makeTab({ recentFilesCount: 10 });
		tab.display();

		await componentOf(t("setRecentCount"), TextComponent)?.change("abc");

		expect(plugin.settings.recentFilesCount).toBe(10);
	});

	test("clear recents empties the list", async () => {
		const { tab, plugin } = makeTab({ recentFiles: ["a.md"] });
		tab.display();

		await componentOf(t("clearRecents"), ButtonComponent)?.click();

		expect(plugin.settings.recentFiles).toEqual([]);
	});

	test("the mobile sliders only refresh CSS variables", async () => {
		const { tab, plugin, renders } = makeTab();
		tab.display();

		await componentOf(t("setMobileScale"), SliderComponent)?.change(130);

		expect(plugin.settings.mobileUiScale).toBe(130);
		expect(renders).toEqual(["scale"]);
	});

	test("resetting mobile sizes restores the defaults in settings and sliders", async () => {
		const { tab, plugin } = makeTab({ mobileUiScale: 150, mobileIconSize: 34 });
		tab.display();

		await componentOf(t("resetMobileSizes"), ButtonComponent)?.click();

		expect(plugin.settings.mobileUiScale).toBe(DEFAULT_SETTINGS.mobileUiScale);
		expect(componentOf(t("setMobileScale"), SliderComponent)?.value).toBe(DEFAULT_SETTINGS.mobileUiScale);
	});

	test("the special-items dropdown accepts both positions", async () => {
		const { tab, plugin } = makeTab();
		tab.display();
		const dropdown = componentOf(t("setSpecialPos"), DropdownComponent);

		await dropdown?.change("bottom");
		expect(plugin.settings.specialItemsPosition).toBe("bottom");

		await dropdown?.change("top");
		expect(plugin.settings.specialItemsPosition).toBe("top");
	});

	test("the open-location dropdown switches between sidebar and tab", async () => {
		const { tab, plugin } = makeTab();
		tab.display();
		const dropdown = componentOf(t("setOpenLocation"), DropdownComponent);

		await dropdown?.change("tab");
		expect(plugin.settings.openLocation).toBe("tab");

		await dropdown?.change("sidebar");
		expect(plugin.settings.openLocation).toBe("sidebar");
	});

	test("the sort dropdown writes the chosen mode", async () => {
		const { tab, plugin } = makeTab();
		tab.display();

		await componentOf(t("setSort"), DropdownComponent)?.change("size-desc");

		expect(plugin.settings.sortMode).toBe("size-desc");
	});

	test("the column width slider stores its value", async () => {
		const { tab, plugin } = makeTab();
		tab.display();

		await componentOf(t("setColWidth"), SliderComponent)?.change(320);

		expect(plugin.settings.columnWidth).toBe(320);
	});

	test("hide flushes a pending text-field save", () => {
		const { tab } = makeTab();
		tab.display();

		expect(() => tab.hide()).not.toThrow();
	});

	test("every toggle row carries a toggle component", () => {
		const { tab } = makeTab();
		tab.display();

		expect(allComponents(ToggleComponent).length).toBeGreaterThanOrEqual(10);
	});
});
