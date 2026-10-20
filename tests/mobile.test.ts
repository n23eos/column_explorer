import { describe, expect, test } from "vitest";
import { buildMobileToolbar } from "../src/mobile";
import {
	DEFAULT_MOBILE_ICON,
	DEFAULT_MOBILE_SCALE,
	EDGE_ZONE_PX,
	MIN_TOUCH_TARGET_PX,
	SWIPE_MIN_DISTANCE_PX,
	detectEdgeSwipe,
	errorMessage,
	exceedsMoveTolerance,
	mobileControlSize,
	mobileSelectionMode,
	mobileTapAction,
	nextPressPhase,
	normalizeMobileSettings,
	normalizeSettings,
	parentSelection,
} from "../src/pure";
import { makeVault } from "./setup/vault";
import { makeView } from "./setup/view";

/** Свайп в контейнере шириной 400px по умолчанию. */
function swipe(over: Partial<Parameters<typeof detectEdgeSwipe>[0]>) {
	return detectEdgeSwipe({
		startX: 0, startY: 100, endX: 0, endY: 100, containerWidth: 400,
		...over,
	});
}

describe("detectEdgeSwipe", () => {
	test("recognizes a valid back swipe from the left edge", () => {
		// Arrange
		const gesture = { startX: 10, startY: 200, endX: 90, endY: 210, containerWidth: 400 };

		// Act
		const direction = detectEdgeSwipe(gesture);

		// Assert
		expect(direction).toBe("back");
	});

	test("recognizes a valid forward swipe from the right edge", () => {
		expect(swipe({ startX: 390, endX: 300 })).toBe("forward");
	});

	test("rejects a swipe shorter than the minimum distance", () => {
		expect(swipe({ startX: 10, endX: 10 + SWIPE_MIN_DISTANCE_PX - 1 })).toBeNull();
	});

	test("rejects a mostly vertical gesture", () => {
		// 80px по горизонтали против 100px по вертикали — меньше отношения 1.5
		expect(swipe({ startX: 10, startY: 100, endX: 90, endY: 200 })).toBeNull();
	});

	test("rejects a gesture that starts outside the edge zone", () => {
		expect(swipe({ startX: EDGE_ZONE_PX + 1, endX: EDGE_ZONE_PX + 101 })).toBeNull();
	});

	test("rejects a leftward swipe that starts at the left edge", () => {
		expect(swipe({ startX: 10, endX: -80 })).toBeNull();
	});

	test("rejects a rightward swipe that starts at the right edge", () => {
		expect(swipe({ startX: 390, endX: 470 })).toBeNull();
	});
});

describe("exceedsMoveTolerance", () => {
	test("allows a small finger drift", () => {
		expect(exceedsMoveTolerance(6, 6)).toBe(false);
	});

	test("cancels once the finger travels past the tolerance", () => {
		expect(exceedsMoveTolerance(0, 11)).toBe(true);
	});
});

describe("nextPressPhase", () => {
	test("a press starts as pending", () => {
		expect(nextPressPhase("idle", { type: "down" })).toBe("pending");
	});

	test("holding past the timeout fires the long press", () => {
		expect(nextPressPhase("pending", { type: "timeout" })).toBe("fired");
	});

	test("scrolling past the tolerance cancels the pending press", () => {
		expect(nextPressPhase("pending", { type: "move", dx: 0, dy: 20 })).toBe("cancelled");
	});

	test("a small drift keeps the press pending", () => {
		expect(nextPressPhase("pending", { type: "move", dx: 2, dy: 3 })).toBe("pending");
	});

	test("releasing early cancels the press", () => {
		expect(nextPressPhase("pending", { type: "up" })).toBe("cancelled");
	});

	test("pointercancel cancels the press", () => {
		expect(nextPressPhase("pending", { type: "cancel" })).toBe("cancelled");
	});

	test("a fired press survives the release so the click can be suppressed", () => {
		expect(nextPressPhase("fired", { type: "up" })).toBe("fired");
	});

	test("the suppressed click consumes the fired state", () => {
		expect(nextPressPhase("fired", { type: "click" })).toBe("idle");
	});

	test("a new press restarts from a cancelled state", () => {
		expect(nextPressPhase("cancelled", { type: "down" })).toBe("pending");
	});
});

describe("mobileTapAction", () => {
	test("suppresses the click that follows a long press", () => {
		expect(mobileTapAction({ selectionMode: true, pressPhase: "fired" })).toBe("suppress");
	});

	test("toggles selection while selection mode is active", () => {
		expect(mobileTapAction({ selectionMode: true, pressPhase: "idle" })).toBe("toggle");
	});

	test("opens the item when selection mode is off", () => {
		expect(mobileTapAction({ selectionMode: false, pressPhase: "idle" })).toBe("activate");
	});
});

describe("mobileSelectionMode", () => {
	test("stays active while something is selected", () => {
		expect(mobileSelectionMode(true, 2)).toBe(true);
	});

	test("closes once the last item is deselected", () => {
		expect(mobileSelectionMode(true, 0)).toBe(false);
	});

	test("stays closed when it was never opened", () => {
		expect(mobileSelectionMode(false, 3)).toBe(false);
	});
});

describe("normalizeMobileSettings", () => {
	test("clamps a scale below the minimum", () => {
		expect(normalizeMobileSettings({ mobileUiScale: 40 }).mobileUiScale).toBe(90);
	});

	test("clamps a scale above the maximum", () => {
		expect(normalizeMobileSettings({ mobileUiScale: 400 }).mobileUiScale).toBe(150);
	});

	test("clamps an icon size below the minimum", () => {
		expect(normalizeMobileSettings({ mobileIconSize: 8 }).mobileIconSize).toBe(22);
	});

	test("clamps an icon size above the maximum", () => {
		expect(normalizeMobileSettings({ mobileIconSize: 120 }).mobileIconSize).toBe(36);
	});

	test("falls back to defaults when the values are missing", () => {
		// Arrange: настройки старой версии, без мобильных ключей
		const stored = {};

		// Act
		const normalized = normalizeMobileSettings(stored);

		// Assert
		expect(normalized).toEqual({
			mobileUiScale: DEFAULT_MOBILE_SCALE,
			mobileIconSize: DEFAULT_MOBILE_ICON,
		});
	});

	test("falls back to defaults for NaN and non-numbers", () => {
		expect(normalizeMobileSettings({ mobileUiScale: NaN, mobileIconSize: "28" })).toEqual({
			mobileUiScale: DEFAULT_MOBILE_SCALE,
			mobileIconSize: DEFAULT_MOBILE_ICON,
		});
	});

	test("keeps valid values", () => {
		expect(normalizeMobileSettings({ mobileUiScale: 120, mobileIconSize: 30 })).toEqual({
			mobileUiScale: 120,
			mobileIconSize: 30,
		});
	});
});

describe("mobileControlSize", () => {
	test("scales the touch target with the ui scale", () => {
		expect(mobileControlSize(1.15, 400, 5)).toBe(51);
	});

	test("shrinks the control so all buttons fit the container", () => {
		// 44 * 1.5 = 66px на кнопку, но в 320px помещается только 64px
		expect(mobileControlSize(1.5, 320, 5)).toBe(64);
	});

	test("never goes below the minimum touch target", () => {
		expect(mobileControlSize(0.5, 400, 5)).toBe(MIN_TOUCH_TARGET_PX);
	});

	test("keeps the minimum touch target on a very narrow container", () => {
		expect(mobileControlSize(1.15, 160, 5)).toBe(MIN_TOUCH_TARGET_PX);
	});

	test("uses the configured size when the container is not measured yet", () => {
		expect(mobileControlSize(1.15, 0, 5)).toBe(51);
	});
});

describe("mobile toolbar buttons", () => {
	test("native-disabled navigation buttons cannot invoke history actions", () => {
		const view = makeView(makeVault(["a.md"]));
		let backCalls = 0;
		let forwardCalls = 0;
		Object.assign(view, {
			canGoBack: () => false,
			canGoForward: () => false,
			isSearchOpen: () => false,
			goBack: () => { backCalls++; },
			goForward: () => { forwardCalls++; },
		});
		const toolbar = document.body.createDiv();

		buildMobileToolbar(view, toolbar)();
		const [back, forward] = Array.from(toolbar.querySelectorAll("button"));
		back.click();
		forward.click();

		expect(back.disabled).toBe(true);
		expect(forward.disabled).toBe(true);
		expect(backCalls).toBe(0);
		expect(forwardCalls).toBe(0);
	});
});

describe("parentSelection", () => {
	const isFolder = (p: string) => !p.includes(".");

	test("drops the deepest folder of a plain chain", () => {
		expect(parentSelection(["Notes", "Notes/Sub"], isFolder)).toEqual(["Notes"]);
	});

	test("goes to the root from a first-level folder", () => {
		expect(parentSelection(["Notes"], isFolder)).toEqual([]);
	});

	test("drops the file together with its folder", () => {
		expect(parentSelection(["Notes", "Notes/a.md"], isFolder)).toEqual([]);
	});

	test("returns null at the root", () => {
		expect(parentSelection([], isFolder)).toBeNull();
	});

	test("returns null when only a root-level file is selected", () => {
		expect(parentSelection(["a.md"], isFolder)).toBeNull();
	});

	test("goes from a calendar day column back to the calendar", () => {
		expect(parentSelection(["::calendar::", "::day::2026-07-19"], isFolder)).toEqual(["::calendar::"]);
	});

	test("goes from a calendar day file back to the calendar", () => {
		expect(parentSelection(["::calendar::", "::day::2026-07-19", "a.md"], isFolder))
			.toEqual(["::calendar::"]);
	});

	test("goes from recents back to the root", () => {
		expect(parentSelection(["::recents::", "a.md"], isFolder)).toEqual([]);
	});
});

/* --------------------------- normalizeSettings ------------------------- */

describe("normalizeSettings", () => {
	test("keeps valid values untouched", () => {
		const result = normalizeSettings({
			columnWidth: 260,
			columnWidths: { Notes: 300 },
			autoPanelResize: true,
			lockColumnWidths: false,
			recentFilesCount: 25,
			lockedColumnCount: 2,
			sortMode: "size-desc",
			specialItemsPosition: "bottom",
			openLocation: "tab",
			storageRingCount: 7,
			seenAt: { "Notes/a.md": 1700 },
			unreadBaseline: 1600,
			folderColors: { Notes: "blue" },
			columnViewModes: { Notes: "grid" },
			columnSortModes: { Notes: "size-asc" },
			folderIcons: { Notes: "star" },
			favorites: ["Notes/a.md"],
			recentFiles: ["Notes/a.md"],
		});

		expect(result).toEqual({
			columnWidth: 260,
			columnWidths: { Notes: 300 },
			autoPanelResize: true,
			lockColumnWidths: false,
			recentFilesCount: 25,
			lockedColumnCount: 2,
			sortMode: "size-desc",
			specialItemsPosition: "bottom",
			openLocation: "tab",
			storageRingCount: 7,
			seenAt: { "Notes/a.md": 1700 },
			unreadBaseline: 1600,
			folderColors: { Notes: "blue" },
			columnViewModes: { Notes: "grid" },
			columnSortModes: { Notes: "size-asc" },
			folderIcons: { Notes: "star" },
			favorites: ["Notes/a.md"],
			recentFiles: ["Notes/a.md"],
		});
	});

	test("falls back to defaults on missing keys", () => {
		const result = normalizeSettings({});

		expect(result.columnWidth).toBe(200);
		expect(result.recentFilesCount).toBe(10);
		expect(result.lockedColumnCount).toBeNull();
		expect(result.sortMode).toBe("name-asc");
		expect(result.specialItemsPosition).toBe("top");
		expect(result.storageRingCount).toBe(5);
		expect(result.columnWidths).toEqual({});
	});

	test("clamps out-of-range numbers", () => {
		expect(normalizeSettings({ columnWidth: 9000 }).columnWidth).toBe(500);
		expect(normalizeSettings({ columnWidth: 10 }).columnWidth).toBe(140);
		expect(normalizeSettings({ recentFilesCount: 0 }).recentFilesCount).toBe(5);
		expect(normalizeSettings({ recentFilesCount: 999 }).recentFilesCount).toBe(50);
		expect(normalizeSettings({ storageRingCount: 1 }).storageRingCount).toBe(3);
		expect(normalizeSettings({ storageRingCount: 99 }).storageRingCount).toBe(8);
		expect(normalizeSettings({ storageRingCount: "many" }).storageRingCount).toBe(5);
	});

	test("rounds fractional numbers", () => {
		expect(normalizeSettings({ columnWidth: 233.7 }).columnWidth).toBe(234);
		expect(normalizeSettings({ recentFilesCount: 12.4 }).recentFilesCount).toBe(12);
	});

	test("replaces non-numeric values with defaults", () => {
		expect(normalizeSettings({ columnWidth: "wide" }).columnWidth).toBe(200);
		expect(normalizeSettings({ columnWidth: NaN }).columnWidth).toBe(200);
		expect(normalizeSettings({ columnWidth: null }).columnWidth).toBe(200);
		expect(normalizeSettings({ recentFilesCount: [] }).recentFilesCount).toBe(10);
	});

	test("treats an unknown sort mode or position as the default", () => {
		expect(normalizeSettings({ sortMode: "chaos" }).sortMode).toBe("name-asc");
		expect(normalizeSettings({ sortMode: 7 }).sortMode).toBe("name-asc");
		expect(normalizeSettings({ specialItemsPosition: "middle" }).specialItemsPosition).toBe("top");
	});

	test("keeps null as a valid locked column count and floors bogus ones at 1", () => {
		expect(normalizeSettings({ lockedColumnCount: null }).lockedColumnCount).toBeNull();
		expect(normalizeSettings({ lockedColumnCount: "two" }).lockedColumnCount).toBeNull();
		expect(normalizeSettings({ lockedColumnCount: 0 }).lockedColumnCount).toBe(1);
		expect(normalizeSettings({ lockedColumnCount: -3 }).lockedColumnCount).toBe(1);
	});

	test("drops column widths that are not numbers or are out of range", () => {
		const result = normalizeSettings({
			columnWidths: { good: 250, tiny: 5, huge: 9000, text: "200", missing: null },
		});

		expect(result.columnWidths).toEqual({ good: 250 });
	});

	test("survives a columnWidths value that is not an object at all", () => {
		expect(normalizeSettings({ columnWidths: "nope" }).columnWidths).toEqual({});
		expect(normalizeSettings({ columnWidths: [1, 2] }).columnWidths).toEqual({});
		expect(normalizeSettings({ columnWidths: null }).columnWidths).toEqual({});
	});

	test("drops record entries whose value is not a known one", () => {
		const result = normalizeSettings({
			folderColors: { ok: "green", bad: "chartreuse", wrong: 7 },
			columnViewModes: { ok: "grid", bad: "gallery" },
			columnSortModes: { ok: "mtime-desc", bad: "chaos" },
			folderIcons: { ok: "star", bad: 12 },
		});

		expect(result.folderColors).toEqual({ ok: "green" });
		expect(result.columnViewModes).toEqual({ ok: "grid" });
		expect(result.columnSortModes).toEqual({ ok: "mtime-desc" });
		expect(result.folderIcons).toEqual({ ok: "star" });
	});

	// Строка или null вместо объекта роняли загрузку плагина на первом Object.keys
	test("survives records and lists that are not containers at all", () => {
		const result = normalizeSettings({
			folderColors: "nope",
			columnViewModes: null,
			columnSortModes: [1, 2],
			folderIcons: 42,
			favorites: "a.md",
			recentFiles: null,
		});

		expect(result.folderColors).toEqual({});
		expect(result.columnViewModes).toEqual({});
		expect(result.columnSortModes).toEqual({});
		expect(result.folderIcons).toEqual({});
		expect(result.favorites).toEqual([]);
		expect(result.recentFiles).toEqual([]);
	});

	test("drops non-string entries from path lists", () => {
		const result = normalizeSettings({ favorites: ["a.md", 7, null, "b.md"], recentFiles: [{}, "c.md"] });

		expect(result.favorites).toEqual(["a.md", "b.md"]);
		expect(result.recentFiles).toEqual(["c.md"]);
	});
});

/* ----------------------------- errorMessage ---------------------------- */

describe("errorMessage", () => {
	test("uses the message of an Error", () => {
		expect(errorMessage(new Error("file is locked"))).toBe("file is locked");
	});

	test("passes a plain string through", () => {
		expect(errorMessage("ENOENT")).toBe("ENOENT");
	});

	test("stringifies anything else", () => {
		expect(errorMessage(404)).toBe("404");
		expect(errorMessage(null)).toBe("null");
		expect(errorMessage(undefined)).toBe("undefined");
	});
});

describe("width lock settings migration", () => {
	test("preserves auto-resize for existing installations without changing saved widths", () => {
		const settings = normalizeSettings({ autoPanelResize: true, columnWidths: { "/": 310 } });
		expect(settings.autoPanelResize).toBe(true);
		expect(settings.lockColumnWidths).toBe(false);
		expect(settings.columnWidths).toEqual({ "/": 310 });
	});
	test("retains an explicitly disabled lock and rejects invalid values", () => {
		expect(normalizeSettings({ autoPanelResize: true, lockColumnWidths: false }).lockColumnWidths).toBe(false);
		for (const value of [undefined, null, "false", 0, true]) {
			expect(normalizeSettings({ lockColumnWidths: value }).lockColumnWidths).toBe(true);
		}
	});
});
