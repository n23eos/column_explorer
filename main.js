"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ColumnExplorerPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian14 = require("obsidian");

// src/i18n.ts
var import_obsidian = require("obsidian");

// src/pure.ts
var collator = new Intl.Collator(void 0, { numeric: true, sensitivity: "base" });
function naturalCompare(a, b) {
  return collator.compare(a, b);
}
function filterByMatcher(items, nameOf, matcher, keepAlways) {
  if (!matcher) return [...items];
  return items.filter((item) => keepAlways(item) || matcher(nameOf(item)) !== null);
}
function matchRanges(name, ranges) {
  const chunks = [];
  let pos = 0;
  for (const [start, end] of [...ranges].sort((a, b) => a[0] - b[0])) {
    const from = Math.max(pos, Math.min(start, name.length));
    const to = Math.max(from, Math.min(end, name.length));
    if (from >= to) continue;
    if (from > pos) chunks.push({ text: name.slice(pos, from), hit: false });
    const last = chunks[chunks.length - 1];
    if ((last == null ? void 0 : last.hit) && from === pos) last.text += name.slice(from, to);
    else chunks.push({ text: name.slice(from, to), hit: true });
    pos = to;
  }
  if (pos < name.length) chunks.push({ text: name.slice(pos), hit: false });
  return chunks;
}
function humanSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  const units = ["KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = -1;
  do {
    value /= 1024;
    unitIndex++;
  } while (value >= 1024 && unitIndex < units.length - 1);
  return value.toFixed(1) + " " + units[unitIndex];
}
function shellEscapePath(path) {
  return path.replace(/[^\p{L}\p{N}_./-]/gu, "\\$&");
}
function formatTemplate(template, vars) {
  let result = template;
  for (const key of Object.keys(vars)) {
    result = result.replace("{" + key + "}", () => String(vars[key]));
  }
  return result;
}
function parseExcludePatterns(raw) {
  return raw.split(",").map((p) => p.trim()).filter((p) => p.length > 0);
}
function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]");
  return new RegExp("^" + escaped + "$");
}
function remapPathKeys(record, oldPath, newPath) {
  const result = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === oldPath) result[newPath] = value;
    else if (key.startsWith(oldPath + "/")) result[newPath + key.slice(oldPath.length)] = value;
    else result[key] = value;
  }
  return result;
}
function prunePathKeys(record, deletedPath) {
  const result = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === deletedPath || key.startsWith(deletedPath + "/")) continue;
    result[key] = value;
  }
  return result;
}
function prunePathSet(paths, deletedPath) {
  const result = /* @__PURE__ */ new Set();
  for (const p of paths) {
    if (p === deletedPath || p.startsWith(deletedPath + "/")) continue;
    result.add(p);
  }
  return result;
}
function pinnedFirst(items, orderOf) {
  const pinned = [];
  const rest = [];
  for (const item of items) {
    const order = orderOf(item);
    if (order === void 0) rest.push(item);
    else pinned.push({ item, order });
  }
  pinned.sort((a, b) => a.order - b.order);
  return [...pinned.map((p) => p.item), ...rest];
}
function movePinnedBefore(pinned, dragPath, targetPath) {
  if (pinned[dragPath] === void 0 || pinned[targetPath] === void 0 || dragPath === targetPath) {
    return { ...pinned };
  }
  const ordered = Object.keys(pinned).sort((a, b) => pinned[a] - pinned[b]).filter((p) => p !== dragPath);
  ordered.splice(ordered.indexOf(targetPath), 0, dragPath);
  const result = {};
  ordered.forEach((path, i) => {
    result[path] = i;
  });
  return result;
}
function lockedColumnVisible(depth, folderColumns, lockedCount) {
  if (lockedCount === null) return true;
  return depth < Math.max(1, lockedCount) - 1 || depth === folderColumns - 1;
}
function parseDragPaths(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [raw];
  } catch (e) {
    return [raw];
  }
}
var MAX_PANEL_WINDOW_RATIO = 0.6;
function desiredPanelWidth(contentWidth, windowWidth, minWidth) {
  const capped = Math.min(contentWidth, windowWidth * MAX_PANEL_WINDOW_RATIO);
  return Math.max(minWidth, capped);
}
function availablePath(folderPath, fileName, taken) {
  const prefix = folderPath ? folderPath + "/" : "";
  if (!taken.has(prefix + fileName)) return prefix + fileName;
  const dot = fileName.lastIndexOf(".");
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ext = dot > 0 ? fileName.slice(dot) : "";
  let counter = 1;
  while (taken.has(`${prefix}${base} ${counter}${ext}`)) counter++;
  return `${prefix}${base} ${counter}${ext}`;
}
var RECENTS_PATH = "::recents::";
var BOOKMARKS_PATH = "::bookmarks::";
var STORAGE_PATH = "::storage::";
var CALENDAR_PATH = "::calendar::";
var DAY_PATH_PREFIX = "::day::";
function dayKey(ts) {
  const d = new Date(ts);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}
function monthGrid(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells = new Array(firstWeekday).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(dayKey(new Date(year, month, day).getTime()));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
function pushRecent(list, path, limit) {
  return [path, ...list.filter((p) => p !== path)].slice(0, limit);
}
function remapPathList(list, oldPath, newPath) {
  return list.map((p) => {
    if (p === oldPath) return newPath;
    if (p.startsWith(oldPath + "/")) return newPath + p.slice(oldPath.length);
    return p;
  });
}
function takeFirstExisting(paths, exists, limit) {
  const result = [];
  for (const path of paths) {
    if (result.length >= limit) break;
    if (exists(path)) result.push(path);
  }
  return result;
}
var EDGE_ZONE_PX = 24;
var SWIPE_MIN_DISTANCE_PX = 60;
var SWIPE_RATIO = 1.5;
function detectEdgeSwipe(swipe) {
  const dx = swipe.endX - swipe.startX;
  const dy = swipe.endY - swipe.startY;
  if (Math.abs(dx) < SWIPE_MIN_DISTANCE_PX) return null;
  if (Math.abs(dx) < SWIPE_RATIO * Math.abs(dy)) return null;
  if (dx > 0 && swipe.startX <= EDGE_ZONE_PX) return "back";
  if (dx < 0 && swipe.startX >= swipe.containerWidth - EDGE_ZONE_PX) return "forward";
  return null;
}
var MIN_TOUCH_TARGET_PX = 44;
var MIN_MOBILE_SCALE = 90;
var MAX_MOBILE_SCALE = 150;
var DEFAULT_MOBILE_SCALE = 115;
var MIN_MOBILE_ICON = 22;
var MAX_MOBILE_ICON = 36;
var DEFAULT_MOBILE_ICON = 28;
function clampOrDefault(value, min, max, fallback) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}
function normalizeMobileSettings(raw) {
  return {
    mobileUiScale: clampOrDefault(raw.mobileUiScale, MIN_MOBILE_SCALE, MAX_MOBILE_SCALE, DEFAULT_MOBILE_SCALE),
    mobileIconSize: clampOrDefault(raw.mobileIconSize, MIN_MOBILE_ICON, MAX_MOBILE_ICON, DEFAULT_MOBILE_ICON)
  };
}
function mobileControlSize(scale, containerWidth, buttonCount) {
  const configured = Math.round(MIN_TOUCH_TARGET_PX * scale);
  const available = containerWidth > 0 ? Math.floor(containerWidth / buttonCount) : configured;
  return Math.max(MIN_TOUCH_TARGET_PX, Math.min(configured, available));
}
var LONG_PRESS_MS = 500;
var LONG_PRESS_TOLERANCE_PX = 10;
function exceedsMoveTolerance(dx, dy) {
  return Math.hypot(dx, dy) > LONG_PRESS_TOLERANCE_PX;
}
function nextPressPhase(phase, event) {
  switch (event.type) {
    case "down":
      return "pending";
    case "move":
      return phase === "pending" && exceedsMoveTolerance(event.dx, event.dy) ? "cancelled" : phase;
    case "timeout":
      return phase === "pending" ? "fired" : phase;
    case "up":
      return phase === "pending" ? "cancelled" : phase;
    case "cancel":
      return "cancelled";
    case "click":
      return phase === "fired" ? "idle" : phase;
  }
}
function mobileTapAction(state) {
  if (state.pressPhase === "fired") return "suppress";
  return state.selectionMode ? "toggle" : "activate";
}
function mobileSelectionMode(active, selectedCount) {
  return active && selectedCount > 0;
}
function parentSelection(selection, isFolder) {
  const isColumnRoot = (path) => path.startsWith("::") || isFolder(path);
  for (let i = selection.length - 1; i >= 0; i--) {
    if (isColumnRoot(selection[i])) return selection.slice(0, i);
  }
  return null;
}
function matchesExcludePatterns(path, patterns) {
  var _a;
  if (patterns.length === 0) return false;
  const name = (_a = path.split("/").pop()) != null ? _a : path;
  return patterns.some((pattern) => {
    if (pattern.endsWith("/")) {
      const base = pattern.slice(0, -1);
      return path === base || path.startsWith(base + "/");
    }
    if (pattern.includes("*") || pattern.includes("?")) {
      return globToRegExp(pattern).test(name);
    }
    return path.includes(pattern);
  });
}
function errorMessage(err) {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return String(err);
}
var MIN_COLUMN_WIDTH = 140;
var MAX_COLUMN_WIDTH = 500;
var DEFAULT_COLUMN_WIDTH = 200;
var ROOT_COLUMN_EXTRA_WIDTH = 60;
var DEFAULT_STORAGE_COLUMN_WIDTH = 420;
var MIN_RECENT_FILES = 5;
var MAX_RECENT_FILES = 50;
var DEFAULT_RECENT_FILES = 10;
var SORT_MODE_VALUES = [
  "name-asc",
  "name-desc",
  "mtime-desc",
  "mtime-asc",
  "ctime-desc",
  "ctime-asc",
  "size-desc",
  "size-asc"
];
var SPECIAL_POSITIONS = ["top", "bottom"];
var COLUMN_VIEW_MODES = ["list", "grid"];
var FOLDER_COLOR_KEYS = ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink"];
var MIN_STORAGE_RINGS = 3;
var MAX_STORAGE_RINGS = 8;
var DEFAULT_STORAGE_RINGS = 5;
var OPEN_LOCATIONS = ["sidebar", "tab"];
function clampInt(value, min, max, fallback) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}
function oneOf(value, allowed, fallback) {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}
function cleanEnumRecord(value, allowed) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const result = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "string" && allowed.includes(raw)) result[key] = raw;
  }
  return result;
}
function cleanStringRecord(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const result = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "string") result[key] = raw;
  }
  return result;
}
function cleanPathList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((p) => typeof p === "string");
}
function cleanWidths(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const result = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
    if (raw < MIN_COLUMN_WIDTH || raw > MAX_COLUMN_WIDTH) continue;
    result[key] = Math.round(raw);
  }
  return result;
}
var MTIME_TOLERANCE_MS = 2e3;
function unreadState(stat, seenAt, baseline) {
  if (seenAt === void 0) {
    return baseline > 0 && stat.ctime > baseline ? "new" : null;
  }
  return stat.mtime > seenAt + MTIME_TOLERANCE_MS ? "modified" : null;
}
function cleanSeenAt(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const result = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) continue;
    result[key] = Math.round(raw);
  }
  return result;
}
function normalizeSettings(raw) {
  const locked = raw.lockedColumnCount;
  return {
    columnWidth: clampInt(raw.columnWidth, MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH, DEFAULT_COLUMN_WIDTH),
    columnWidths: cleanWidths(raw.columnWidths),
    lockColumnWidths: raw.lockColumnWidths !== false,
    recentFilesCount: clampInt(raw.recentFilesCount, MIN_RECENT_FILES, MAX_RECENT_FILES, DEFAULT_RECENT_FILES),
    // null — режим «показывать все колонки», это валидное значение
    lockedColumnCount: typeof locked === "number" && Number.isFinite(locked) ? Math.max(1, Math.round(locked)) : null,
    sortMode: oneOf(raw.sortMode, SORT_MODE_VALUES, "name-asc"),
    specialItemsPosition: oneOf(raw.specialItemsPosition, SPECIAL_POSITIONS, "top"),
    openLocation: oneOf(raw.openLocation, OPEN_LOCATIONS, "sidebar"),
    storageRingCount: clampInt(raw.storageRingCount, MIN_STORAGE_RINGS, MAX_STORAGE_RINGS, DEFAULT_STORAGE_RINGS),
    seenAt: cleanSeenAt(raw.seenAt),
    // 0 — «фича ещё не включалась»; момент включения проставит main.ts
    unreadBaseline: clampInt(raw.unreadBaseline, 0, Number.MAX_SAFE_INTEGER, 0),
    // Записи путь → значение и списки путей: без этого строка или null
    // вместо объекта роняли бы загрузку плагина на первом же Object.keys
    folderColors: cleanEnumRecord(raw.folderColors, FOLDER_COLOR_KEYS),
    columnViewModes: cleanEnumRecord(raw.columnViewModes, COLUMN_VIEW_MODES),
    columnSortModes: cleanEnumRecord(raw.columnSortModes, SORT_MODE_VALUES),
    folderIcons: cleanStringRecord(raw.folderIcons),
    favorites: cleanPathList(raw.favorites),
    recentFiles: cleanPathList(raw.recentFiles)
  };
}

// src/locales/en.ts
var en = {
  lockColumnWidths: "Lock column widths",
  lockColumnWidthsDesc: "Prevent automatic panel resizing when switching files. You can still resize columns manually. Turn off to allow the Auto-resize panel setting.",
  newNote: "New note",
  newFolder: "New folder",
  reveal: "Reveal active file",
  collapse: "Collapse to root",
  search: "Filter files\u2026",
  sort: "Sort order",
  empty: "Empty",
  noResults: "No matches",
  open: "Open",
  openNewTab: "Open in new tab",
  openRight: "Open to the right",
  duplicate: "Duplicate",
  rename: "Rename",
  delete: "Delete",
  copy: "Copy",
  cut: "Cut",
  paste: "Paste",
  itemsPasted: "{n} items pasted",
  deleteN: "Delete {n} items",
  duplicateN: "Duplicate {n} items",
  moveTo: "Move to folder\u2026",
  moveToPlaceholder: "Choose target folder\u2026",
  copyPath: "Copy path",
  copyFullPath: "Copy full path",
  pathCopied: "Path copied",
  copyFailed: "Couldn't copy to clipboard",
  untitled: "Untitled",
  newFolderName: "New folder",
  cantMoveIntoSelf: "Cannot move a folder into itself",
  alreadyExists: "\u201C{name}\u201D already exists in the target folder",
  renameFailed: "Rename failed: ",
  createFailed: "Could not create \u201C{name}\u201D: {error}",
  moveFailed: "Could not move \u201C{name}\u201D: {error}",
  duplicateFailed: "Could not duplicate \u201C{name}\u201D: {error}",
  deleteFailed: "Could not delete \u201C{name}\u201D: {error}",
  modified: "Modified",
  created: "Created",
  sortNameAsc: "Name (A \u2192 Z)",
  sortNameDesc: "Name (Z \u2192 A)",
  sortMtimeDesc: "Modified (newest first)",
  sortMtimeAsc: "Modified (oldest first)",
  sortCtimeDesc: "Created (newest first)",
  sortCtimeAsc: "Created (oldest first)",
  sortSizeDesc: "Size (largest first)",
  sortSizeAsc: "Size (smallest first)",
  confirmDeleteTitle: "Delete",
  confirmDeleteOne: "Delete \u201C{name}\u201D?",
  confirmDeleteMany: "Delete {n} items?",
  confirm: "Delete",
  cancel: "Cancel",
  itemsMoved: "{n} items moved",
  undo: "Undo",
  filesImported: "{n} files imported",
  importFailed: "Failed to import \u201C{name}\u201D",
  cmdOpen: "Open column explorer",
  cmdReveal: "Reveal active file in columns",
  cmdNewNote: "New note in current folder",
  cmdNewFolder: "New folder in current folder",
  cmdFocus: "Focus column explorer",
  setFoldersFirst: "Folders first",
  setFoldersFirstDesc: "Always list folders above files.",
  setShowExt: "Show extension badges",
  setShowExtDesc: "Show a small badge with the file extension for non-Markdown files.",
  setPreview: "Show file preview column",
  setPreviewDesc: "Show a details column when a file is selected.",
  setMdPreview: "Preview note content",
  setMdPreviewDesc: "Render the beginning of Markdown notes in the preview column.",
  setConfirmDelete: "Confirm before deleting",
  setConfirmDeleteDesc: "Ask for confirmation before moving files to trash.",
  setColWidth: "Default column width",
  setColWidthDesc: "In pixels. Drag a column's right edge to resize that column; double-click the edge to reset it.",
  setAutoPanel: "Auto-resize panel",
  setAutoPanelDesc: "Grow and shrink the sidebar panel to fit all open columns, keeping the column width fixed.",
  setSort: "Default sort order",
  setOpenLocation: "Where to open",
  setOpenLocationDesc: "Where the open command and the ribbon icon put the view. An already open view stays where it is.",
  locSidebar: "Left sidebar",
  locTab: "Tab in the main area",
  setAutoReveal: "Auto-reveal active file",
  setAutoRevealDesc: "Follow the active editor tab and select its file in the columns.",
  setExclude: "Excluded files",
  setExcludeDesc: "Comma-separated patterns to hide, e.g. \u201C*.tmp, archive/, .trash\u201D.",
  folderColor: "Folder color",
  colorDefault: "Default",
  colorRed: "Red",
  colorOrange: "Orange",
  colorYellow: "Yellow",
  colorGreen: "Green",
  colorCyan: "Cyan",
  colorBlue: "Blue",
  colorPurple: "Purple",
  colorPink: "Pink",
  viewAsList: "View as list",
  viewAsGrid: "View as icons",
  pin: "Pin to top",
  unpin: "Unpin",
  newCanvas: "New canvas",
  copyWikiLink: "Copy wikilink",
  copyMdLink: "Copy Markdown link",
  copyObsidianUrl: "Copy Obsidian URL",
  linkCopied: "Link copied",
  sortDefault: "Default sort",
  folderIcon: "Folder icon\u2026",
  folderIconReset: "Reset folder icon",
  iconPlaceholder: "Choose an icon\u2026",
  setFolderNote: "Open folder notes",
  setFolderNoteDesc: "Selecting a folder also opens the note with the same name inside it, when one exists.",
  lockPanel: "Lock column count",
  unlockPanel: "Unlock columns",
  recents: "Recents",
  setRecentCount: "Recent files count",
  setRecentCountDesc: "How many files the \u201CRecents\u201D column shows.",
  headAppearance: "Appearance",
  headBehavior: "Behavior",
  headColumns: "Columns",
  setShowRecents: "Show recents",
  setShowRecentsDesc: "Show the recents row at the top of the first column.",
  resetWidths: "Reset all column widths",
  resetWidthsDesc: "Forget individually dragged widths and use the default width everywhere.",
  widthsReset: "Column widths reset",
  reset: "Reset",
  clearRecents: "Clear recent files",
  clearRecentsDesc: "Remove all entries from the recents list.",
  recentsCleared: "Recent files cleared",
  clear: "Clear",
  bookmarks: "Bookmarks",
  calendar: "Calendar",
  favorites: "Favorites",
  addFavorite: "Add to favorites",
  removeFavorite: "Remove from favorites",
  favoriteAdded: "Path added to favorites",
  favoriteRemoved: "Removed from favorites",
  setShowFavorites: "Show favorites",
  setShowFavoritesDesc: "Show your saved favorite files and folders at the top of the Bookmarks column.",
  headSpecial: "Special items",
  setShowBookmarks: "Show bookmarks",
  setShowBookmarksDesc: "Show the bookmarks row (needs the core Bookmarks plugin).",
  setShowCalendar: "Show calendar",
  setShowCalendarDesc: "Show the calendar row: notes by creation day.",
  setSpecialPos: "Special items position",
  setSpecialPosDesc: "Where the special rows sit in the first column.",
  posTop: "Top",
  posBottom: "Bottom",
  today: "Today",
  navBack: "Back",
  navForward: "Forward",
  navUp: "Go to parent folder",
  create: "Create",
  more: "More actions",
  preview: "Preview",
  close: "Close",
  selectedN: "{n} selected",
  cancelSelection: "Cancel selection",
  headMobile: "Mobile interface",
  setMobileScale: "Mobile interface scale",
  setMobileScaleDesc: "Changes the size of rows, controls, text and spacing on phones and tablets.",
  setMobileIcon: "Mobile button icon size",
  setMobileIconDesc: "Changes toolbar, navigation and action-bar icons. File and folder icons are not affected.",
  resetMobileSizes: "Reset mobile sizes",
  mobileSizesReset: "Mobile sizes reset",
  diskUsage: "Disk usage",
  duSize: "Size",
  duWords: "Words",
  duFiles: "Files",
  duRescan: "Rescan",
  duZoomIn: "Zoom in",
  duReveal: "Reveal in columns",
  duEmpty: "Vault is empty",
  duNoWords: "No words in vault",
  duWordCount_one: "{n} word",
  duWordCount_few: "{n} words",
  duWordCount_many: "{n} words",
  duWordCount_other: "{n} words",
  duFileCount_one: "{n} file",
  duFileCount_few: "{n} files",
  duFileCount_many: "{n} files",
  duFileCount_other: "{n} files",
  duSmallItem_one: "{n} small item",
  duSmallItem_few: "{n} small items",
  duSmallItem_many: "{n} small items",
  duSmallItem_other: "{n} small items",
  setShowStorage: "Show disk usage",
  setShowStorageDesc: "Show the disk usage row: a sunburst chart of folder sizes, word counts and file counts.",
  setStorageExclude: "Disk usage: excluded folders",
  setStorageExcludeDesc: "Comma-separated vault paths skipped while scanning, e.g. \u201Cattachments, archive/old\u201D.",
  setStorageRings: "Disk usage: ring count",
  setStorageRingsDesc: "How many nesting levels the chart shows at once.",
  setShowUnread: "Show unread markers",
  setShowUnreadDesc: "Badge files you have never opened, and dot files edited since you last opened them.",
  unreadNew: "New",
  unreadModifiedTooltip: "Edited since you last opened it"
};

// src/locales/ru.ts
var ru = {
  lockColumnWidths: "\u0417\u0430\u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0448\u0438\u0440\u0438\u043D\u0443 \u043A\u043E\u043B\u043E\u043D\u043E\u043A",
  lockColumnWidthsDesc: "\u041D\u0435 \u043C\u0435\u043D\u044F\u0442\u044C \u0448\u0438\u0440\u0438\u043D\u0443 \u043F\u0430\u043D\u0435\u043B\u0438 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u043F\u0440\u0438 \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0438 \u0444\u0430\u0439\u043B\u043E\u0432. \u041A\u043E\u043B\u043E\u043D\u043A\u0438 \u043C\u043E\u0436\u043D\u043E \u043C\u0435\u043D\u044F\u0442\u044C \u0432\u0440\u0443\u0447\u043D\u0443\u044E. \u041E\u0442\u043A\u043B\u044E\u0447\u0438\u0442\u0435 \u0444\u0438\u043A\u0441\u0430\u0446\u0438\u044E, \u0447\u0442\u043E\u0431\u044B \u0440\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u044C \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0443 \u0430\u0432\u0442\u043E\u043F\u043E\u0434\u0433\u043E\u043D\u043A\u0438 \u043F\u0430\u043D\u0435\u043B\u0438.",
  newNote: "\u041D\u043E\u0432\u0430\u044F \u0437\u0430\u043C\u0435\u0442\u043A\u0430",
  newFolder: "\u041D\u043E\u0432\u0430\u044F \u043F\u0430\u043F\u043A\u0430",
  reveal: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0439 \u0444\u0430\u0439\u043B",
  collapse: "\u0421\u0432\u0435\u0440\u043D\u0443\u0442\u044C \u043A \u043A\u043E\u0440\u043D\u044E",
  search: "\u0424\u0438\u043B\u044C\u0442\u0440 \u0444\u0430\u0439\u043B\u043E\u0432\u2026",
  sort: "\u0421\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u043A\u0430",
  empty: "\u041F\u0443\u0441\u0442\u043E",
  noResults: "\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E",
  open: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C",
  openNewTab: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0432 \u043D\u043E\u0432\u043E\u0439 \u0432\u043A\u043B\u0430\u0434\u043A\u0435",
  openRight: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0441\u043F\u0440\u0430\u0432\u0430",
  duplicate: "\u0414\u0443\u0431\u043B\u0438\u0440\u043E\u0432\u0430\u0442\u044C",
  rename: "\u041F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u0442\u044C",
  delete: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C",
  copy: "\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C",
  cut: "\u0412\u044B\u0440\u0435\u0437\u0430\u0442\u044C",
  paste: "\u0412\u0441\u0442\u0430\u0432\u0438\u0442\u044C",
  itemsPasted: "\u0412\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043E \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u0432: {n}",
  deleteN: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C {n} \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u0432",
  duplicateN: "\u0414\u0443\u0431\u043B\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u0432: {n}",
  moveTo: "\u041F\u0435\u0440\u0435\u043C\u0435\u0441\u0442\u0438\u0442\u044C \u0432 \u043F\u0430\u043F\u043A\u0443\u2026",
  moveToPlaceholder: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043F\u0430\u043F\u043A\u0443\u2026",
  copyPath: "\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043F\u0443\u0442\u044C",
  copyFullPath: "\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043F\u043E\u043B\u043D\u044B\u0439 \u043F\u0443\u0442\u044C",
  pathCopied: "\u041F\u0443\u0442\u044C \u0441\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D",
  copyFailed: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0432 \u0431\u0443\u0444\u0435\u0440 \u043E\u0431\u043C\u0435\u043D\u0430",
  untitled: "\u0411\u0435\u0437 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F",
  newFolderName: "\u041D\u043E\u0432\u0430\u044F \u043F\u0430\u043F\u043A\u0430",
  cantMoveIntoSelf: "\u041D\u0435\u043B\u044C\u0437\u044F \u043F\u0435\u0440\u0435\u043C\u0435\u0441\u0442\u0438\u0442\u044C \u043F\u0430\u043F\u043A\u0443 \u0432\u043D\u0443\u0442\u0440\u044C \u0441\u0430\u043C\u043E\u0439 \u0441\u0435\u0431\u044F",
  alreadyExists: "\u0412 \u0446\u0435\u043B\u0435\u0432\u043E\u0439 \u043F\u0430\u043F\u043A\u0435 \u0443\u0436\u0435 \u0435\u0441\u0442\u044C \xAB{name}\xBB",
  renameFailed: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u0442\u044C: ",
  createFailed: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0437\u0434\u0430\u0442\u044C \xAB{name}\xBB: {error}",
  moveFailed: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0435\u0440\u0435\u043C\u0435\u0441\u0442\u0438\u0442\u044C \xAB{name}\xBB: {error}",
  duplicateFailed: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u043A\u043E\u043F\u0438\u044E \xAB{name}\xBB: {error}",
  deleteFailed: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0443\u0434\u0430\u043B\u0438\u0442\u044C \xAB{name}\xBB: {error}",
  modified: "\u0418\u0437\u043C\u0435\u043D\u0451\u043D",
  created: "\u0421\u043E\u0437\u0434\u0430\u043D",
  sortNameAsc: "\u0418\u043C\u044F (\u0410 \u2192 \u042F)",
  sortNameDesc: "\u0418\u043C\u044F (\u042F \u2192 \u0410)",
  sortMtimeDesc: "\u0414\u0430\u0442\u0430 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F (\u0441\u043D\u0430\u0447\u0430\u043B\u0430 \u043D\u043E\u0432\u044B\u0435)",
  sortMtimeAsc: "\u0414\u0430\u0442\u0430 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F (\u0441\u043D\u0430\u0447\u0430\u043B\u0430 \u0441\u0442\u0430\u0440\u044B\u0435)",
  sortCtimeDesc: "\u0414\u0430\u0442\u0430 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F (\u0441\u043D\u0430\u0447\u0430\u043B\u0430 \u043D\u043E\u0432\u044B\u0435)",
  sortCtimeAsc: "\u0414\u0430\u0442\u0430 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F (\u0441\u043D\u0430\u0447\u0430\u043B\u0430 \u0441\u0442\u0430\u0440\u044B\u0435)",
  sortSizeDesc: "\u0420\u0430\u0437\u043C\u0435\u0440 (\u0441\u043D\u0430\u0447\u0430\u043B\u0430 \u0431\u043E\u043B\u044C\u0448\u0438\u0435)",
  sortSizeAsc: "\u0420\u0430\u0437\u043C\u0435\u0440 (\u0441\u043D\u0430\u0447\u0430\u043B\u0430 \u043C\u0430\u043B\u0435\u043D\u044C\u043A\u0438\u0435)",
  confirmDeleteTitle: "\u0423\u0434\u0430\u043B\u0435\u043D\u0438\u0435",
  confirmDeleteOne: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \xAB{name}\xBB?",
  confirmDeleteMany: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u0432: {n}?",
  confirm: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C",
  cancel: "\u041E\u0442\u043C\u0435\u043D\u0430",
  itemsMoved: "\u041F\u0435\u0440\u0435\u043C\u0435\u0449\u0435\u043D\u043E \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u0432: {n}",
  undo: "\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C",
  filesImported: "\u0418\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u043E \u0444\u0430\u0439\u043B\u043E\u0432: {n}",
  importFailed: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0438\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \xAB{name}\xBB",
  cmdOpen: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043F\u0440\u043E\u0432\u043E\u0434\u043D\u0438\u043A-\u043A\u043E\u043B\u043E\u043D\u043A\u0438",
  cmdReveal: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0439 \u0444\u0430\u0439\u043B \u0432 \u043A\u043E\u043B\u043E\u043D\u043A\u0430\u0445",
  cmdNewNote: "\u041D\u043E\u0432\u0430\u044F \u0437\u0430\u043C\u0435\u0442\u043A\u0430 \u0432 \u0442\u0435\u043A\u0443\u0449\u0435\u0439 \u043F\u0430\u043F\u043A\u0435",
  cmdNewFolder: "\u041D\u043E\u0432\u0430\u044F \u043F\u0430\u043F\u043A\u0430 \u0432 \u0442\u0435\u043A\u0443\u0449\u0435\u0439 \u043F\u0430\u043F\u043A\u0435",
  cmdFocus: "\u0424\u043E\u043A\u0443\u0441 \u043D\u0430 \u043F\u0440\u043E\u0432\u043E\u0434\u043D\u0438\u043A-\u043A\u043E\u043B\u043E\u043D\u043A\u0438",
  setFoldersFirst: "\u041F\u0430\u043F\u043A\u0438 \u0441\u0432\u0435\u0440\u0445\u0443",
  setFoldersFirstDesc: "\u0412\u0441\u0435\u0433\u0434\u0430 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u043F\u0430\u043F\u043A\u0438 \u0432\u044B\u0448\u0435 \u0444\u0430\u0439\u043B\u043E\u0432.",
  setShowExt: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u044F",
  setShowExtDesc: "\u041D\u0435\u0431\u043E\u043B\u044C\u0448\u043E\u0439 \u0431\u0435\u0439\u0434\u0436 \u0441 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435\u043C \u0443 \u043D\u0435-Markdown \u0444\u0430\u0439\u043B\u043E\u0432.",
  setPreview: "\u041A\u043E\u043B\u043E\u043D\u043A\u0430 \u043F\u0440\u0435\u0432\u044C\u044E \u0444\u0430\u0439\u043B\u0430",
  setPreviewDesc: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u043A\u043E\u043B\u043E\u043D\u043A\u0443 \u0441 \u0434\u0435\u0442\u0430\u043B\u044F\u043C\u0438 \u043F\u0440\u0438 \u0432\u044B\u0431\u043E\u0440\u0435 \u0444\u0430\u0439\u043B\u0430.",
  setMdPreview: "\u041F\u0440\u0435\u0432\u044C\u044E \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u043C\u043E\u0433\u043E \u0437\u0430\u043C\u0435\u0442\u043A\u0438",
  setMdPreviewDesc: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u043D\u0430\u0447\u0430\u043B\u043E Markdown-\u0437\u0430\u043C\u0435\u0442\u043A\u0438 \u0432 \u043A\u043E\u043B\u043E\u043D\u043A\u0435 \u043F\u0440\u0435\u0432\u044C\u044E.",
  setConfirmDelete: "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u0442\u044C \u0443\u0434\u0430\u043B\u0435\u043D\u0438\u0435",
  setConfirmDeleteDesc: "\u0421\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u0442\u044C \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435 \u043F\u0435\u0440\u0435\u0434 \u043F\u0435\u0440\u0435\u043C\u0435\u0449\u0435\u043D\u0438\u0435\u043C \u0432 \u043A\u043E\u0440\u0437\u0438\u043D\u0443.",
  setColWidth: "\u0428\u0438\u0440\u0438\u043D\u0430 \u043A\u043E\u043B\u043E\u043D\u043A\u0438 \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E",
  setColWidthDesc: "\u0412 \u043F\u0438\u043A\u0441\u0435\u043B\u044F\u0445. \u041F\u0440\u0430\u0432\u044B\u0439 \u043A\u0440\u0430\u0439 \u043A\u043E\u043B\u043E\u043D\u043A\u0438: \u043F\u0435\u0440\u0435\u0442\u0430\u0449\u0438\u0442\u044C \u2014 \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0448\u0438\u0440\u0438\u043D\u0443 \u044D\u0442\u043E\u0439 \u043A\u043E\u043B\u043E\u043D\u043A\u0438, \u0434\u0432\u043E\u0439\u043D\u043E\u0439 \u043A\u043B\u0438\u043A \u2014 \u0441\u0431\u0440\u043E\u0441\u0438\u0442\u044C.",
  setAutoPanel: "\u0410\u0432\u0442\u043E-\u0448\u0438\u0440\u0438\u043D\u0430 \u043F\u0430\u043D\u0435\u043B\u0438",
  setAutoPanelDesc: "\u0410\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u0440\u0430\u0441\u0448\u0438\u0440\u044F\u0442\u044C \u0438 \u0441\u0443\u0436\u0430\u0442\u044C \u0431\u043E\u043A\u043E\u0432\u0443\u044E \u043F\u0430\u043D\u0435\u043B\u044C \u043F\u043E\u0434 \u043E\u0442\u043A\u0440\u044B\u0442\u044B\u0435 \u043A\u043E\u043B\u043E\u043D\u043A\u0438, \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u044F \u0448\u0438\u0440\u0438\u043D\u0443 \u043A\u043E\u043B\u043E\u043D\u043E\u043A.",
  setSort: "\u0421\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u043A\u0430 \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E",
  setOpenLocation: "\u0413\u0434\u0435 \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u0442\u044C",
  setOpenLocationDesc: "\u041A\u0443\u0434\u0430 \u043A\u043E\u043C\u0430\u043D\u0434\u0430 \u043E\u0442\u043A\u0440\u044B\u0442\u0438\u044F \u0438 \u0438\u043A\u043E\u043D\u043A\u0430 \u043D\u0430 \u043B\u0435\u043D\u0442\u0435 \u043F\u043E\u043C\u0435\u0449\u0430\u044E\u0442 \u0432\u044C\u044E. \u0423\u0436\u0435 \u043E\u0442\u043A\u0440\u044B\u0442\u0430\u044F \u0432\u044C\u044E \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u043D\u0430 \u043C\u0435\u0441\u0442\u0435.",
  locSidebar: "\u041B\u0435\u0432\u0430\u044F \u043F\u0430\u043D\u0435\u043B\u044C",
  locTab: "\u0412\u043A\u043B\u0430\u0434\u043A\u0430 \u0432 \u043E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u043E\u0431\u043B\u0430\u0441\u0442\u0438",
  setAutoReveal: "\u0421\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u044C \u0437\u0430 \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u043C \u0444\u0430\u0439\u043B\u043E\u043C",
  setAutoRevealDesc: "\u0410\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u0432\u044B\u0434\u0435\u043B\u044F\u0442\u044C \u0432 \u043A\u043E\u043B\u043E\u043D\u043A\u0430\u0445 \u0444\u0430\u0439\u043B \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0439 \u0432\u043A\u043B\u0430\u0434\u043A\u0438.",
  setExclude: "\u0421\u043A\u0440\u044B\u0442\u044B\u0435 \u0444\u0430\u0439\u043B\u044B",
  setExcludeDesc: "\u041F\u0430\u0442\u0442\u0435\u0440\u043D\u044B \u0447\u0435\u0440\u0435\u0437 \u0437\u0430\u043F\u044F\u0442\u0443\u044E, \u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440 \xAB*.tmp, archive/, .trash\xBB.",
  folderColor: "\u0426\u0432\u0435\u0442 \u043F\u0430\u043F\u043A\u0438",
  colorDefault: "\u0421\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u043D\u044B\u0439",
  colorRed: "\u041A\u0440\u0430\u0441\u043D\u044B\u0439",
  colorOrange: "\u041E\u0440\u0430\u043D\u0436\u0435\u0432\u044B\u0439",
  colorYellow: "\u0416\u0451\u043B\u0442\u044B\u0439",
  colorGreen: "\u0417\u0435\u043B\u0451\u043D\u044B\u0439",
  colorCyan: "\u0413\u043E\u043B\u0443\u0431\u043E\u0439",
  colorBlue: "\u0421\u0438\u043D\u0438\u0439",
  colorPurple: "\u0424\u0438\u043E\u043B\u0435\u0442\u043E\u0432\u044B\u0439",
  colorPink: "\u0420\u043E\u0437\u043E\u0432\u044B\u0439",
  viewAsList: "\u0412\u0438\u0434: \u0441\u043F\u0438\u0441\u043E\u043A",
  viewAsGrid: "\u0412\u0438\u0434: \u0437\u043D\u0430\u0447\u043A\u0438",
  pin: "\u0417\u0430\u043A\u0440\u0435\u043F\u0438\u0442\u044C \u0441\u0432\u0435\u0440\u0445\u0443",
  unpin: "\u041E\u0442\u043A\u0440\u0435\u043F\u0438\u0442\u044C",
  newCanvas: "\u041D\u043E\u0432\u044B\u0439 \u0445\u043E\u043B\u0441\u0442",
  copyWikiLink: "\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0432\u0438\u043A\u0438-\u0441\u0441\u044B\u043B\u043A\u0443",
  copyMdLink: "\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C markdown-\u0441\u0441\u044B\u043B\u043A\u0443",
  copyObsidianUrl: "\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C Obsidian URL",
  linkCopied: "\u0421\u0441\u044B\u043B\u043A\u0430 \u0441\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u0430",
  sortDefault: "\u0421\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u043A\u0430 \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E",
  folderIcon: "\u0418\u043A\u043E\u043D\u043A\u0430 \u043F\u0430\u043F\u043A\u0438\u2026",
  folderIconReset: "\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u0438\u043A\u043E\u043D\u043A\u0443 \u043F\u0430\u043F\u043A\u0438",
  iconPlaceholder: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0438\u043A\u043E\u043D\u043A\u0443\u2026",
  setFolderNote: "\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u0442\u044C \u0437\u0430\u043C\u0435\u0442\u043A\u0438 \u043F\u0430\u043F\u043E\u043A",
  setFolderNoteDesc: "\u0412\u044B\u0431\u043E\u0440 \u043F\u0430\u043F\u043A\u0438 \u0442\u0430\u043A\u0436\u0435 \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442 \u0437\u0430\u043C\u0435\u0442\u043A\u0443 \u0441 \u0435\u0451 \u0438\u043C\u0435\u043D\u0435\u043C \u0432\u043D\u0443\u0442\u0440\u0438, \u0435\u0441\u043B\u0438 \u043E\u043D\u0430 \u0435\u0441\u0442\u044C.",
  lockPanel: "\u0417\u0430\u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0447\u0438\u0441\u043B\u043E \u043A\u043E\u043B\u043E\u043D\u043E\u043A",
  unlockPanel: "\u0421\u043D\u044F\u0442\u044C \u0444\u0438\u043A\u0441\u0430\u0446\u0438\u044E \u043A\u043E\u043B\u043E\u043D\u043E\u043A",
  recents: "\u041D\u0435\u0434\u0430\u0432\u043D\u0438\u0435",
  setRecentCount: "\u0427\u0438\u0441\u043B\u043E \u043D\u0435\u0434\u0430\u0432\u043D\u0438\u0445 \u0444\u0430\u0439\u043B\u043E\u0432",
  setRecentCountDesc: "\u0421\u043A\u043E\u043B\u044C\u043A\u043E \u0444\u0430\u0439\u043B\u043E\u0432 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u0432 \u043A\u043E\u043B\u043E\u043D\u043A\u0435 \xAB\u041D\u0435\u0434\u0430\u0432\u043D\u0438\u0435\xBB.",
  headAppearance: "\u0412\u0438\u0434",
  headBehavior: "\u041F\u043E\u0432\u0435\u0434\u0435\u043D\u0438\u0435",
  headColumns: "\u041A\u043E\u043B\u043E\u043D\u043A\u0438",
  setShowRecents: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \xAB\u041D\u0435\u0434\u0430\u0432\u043D\u0438\u0435\xBB",
  setShowRecentsDesc: "\u041F\u0443\u043D\u043A\u0442 \xAB\u041D\u0435\u0434\u0430\u0432\u043D\u0438\u0435\xBB \u0432\u0432\u0435\u0440\u0445\u0443 \u043F\u0435\u0440\u0432\u043E\u0439 \u043A\u043E\u043B\u043E\u043D\u043A\u0438.",
  resetWidths: "\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u0448\u0438\u0440\u0438\u043D\u044B \u0432\u0441\u0435\u0445 \u043A\u043E\u043B\u043E\u043D\u043E\u043A",
  resetWidthsDesc: "\u0417\u0430\u0431\u044B\u0442\u044C \u0438\u043D\u0434\u0438\u0432\u0438\u0434\u0443\u0430\u043B\u044C\u043D\u043E \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D\u043D\u044B\u0435 \u0448\u0438\u0440\u0438\u043D\u044B \u0438 \u0432\u0435\u0440\u043D\u0443\u0442\u044C \u0432\u0441\u0435\u043C \u043A\u043E\u043B\u043E\u043D\u043A\u0430\u043C \u0448\u0438\u0440\u0438\u043D\u0443 \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E.",
  widthsReset: "\u0428\u0438\u0440\u0438\u043D\u044B \u043A\u043E\u043B\u043E\u043D\u043E\u043A \u0441\u0431\u0440\u043E\u0448\u0435\u043D\u044B",
  reset: "\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C",
  clearRecents: "\u041E\u0447\u0438\u0441\u0442\u0438\u0442\u044C \u043D\u0435\u0434\u0430\u0432\u043D\u0438\u0435",
  clearRecentsDesc: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0432\u0441\u0435 \u0437\u0430\u043F\u0438\u0441\u0438 \u0438\u0437 \u0441\u043F\u0438\u0441\u043A\u0430 \u043D\u0435\u0434\u0430\u0432\u043D\u0438\u0445.",
  recentsCleared: "\u0421\u043F\u0438\u0441\u043E\u043A \u043D\u0435\u0434\u0430\u0432\u043D\u0438\u0445 \u043E\u0447\u0438\u0449\u0435\u043D",
  clear: "\u041E\u0447\u0438\u0441\u0442\u0438\u0442\u044C",
  bookmarks: "\u0417\u0430\u043A\u043B\u0430\u0434\u043A\u0438",
  calendar: "\u041A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044C",
  favorites: "\u0418\u0437\u0431\u0440\u0430\u043D\u043D\u043E\u0435",
  addFavorite: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432 \u0438\u0437\u0431\u0440\u0430\u043D\u043D\u043E\u0435",
  removeFavorite: "\u0423\u0431\u0440\u0430\u0442\u044C \u0438\u0437 \u0438\u0437\u0431\u0440\u0430\u043D\u043D\u043E\u0433\u043E",
  favoriteAdded: "\u041F\u0443\u0442\u044C \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D \u0432 \u0438\u0437\u0431\u0440\u0430\u043D\u043D\u043E\u0435",
  favoriteRemoved: "\u0423\u0431\u0440\u0430\u043D\u043E \u0438\u0437 \u0438\u0437\u0431\u0440\u0430\u043D\u043D\u043E\u0433\u043E",
  setShowFavorites: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \xAB\u0418\u0437\u0431\u0440\u0430\u043D\u043D\u043E\u0435\xBB",
  setShowFavoritesDesc: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0435 \u0438\u0437\u0431\u0440\u0430\u043D\u043D\u044B\u0435 \u0444\u0430\u0439\u043B\u044B \u0438 \u043F\u0430\u043F\u043A\u0438 \u0432\u0432\u0435\u0440\u0445\u0443 \u043A\u043E\u043B\u043E\u043D\u043A\u0438 \xAB\u0417\u0430\u043A\u043B\u0430\u0434\u043A\u0438\xBB.",
  headSpecial: "\u0421\u043F\u0435\u0446\u043F\u0443\u043D\u043A\u0442\u044B",
  setShowBookmarks: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \xAB\u0417\u0430\u043A\u043B\u0430\u0434\u043A\u0438\xBB",
  setShowBookmarksDesc: "\u041F\u0443\u043D\u043A\u0442 \xAB\u0417\u0430\u043A\u043B\u0430\u0434\u043A\u0438\xBB (\u043D\u0443\u0436\u0435\u043D \u0432\u0441\u0442\u0440\u043E\u0435\u043D\u043D\u044B\u0439 \u043F\u043B\u0430\u0433\u0438\u043D Bookmarks).",
  setShowCalendar: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \xAB\u041A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044C\xBB",
  setShowCalendarDesc: "\u041F\u0443\u043D\u043A\u0442 \xAB\u041A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044C\xBB: \u0437\u0430\u043C\u0435\u0442\u043A\u0438 \u043F\u043E \u0434\u043D\u044E \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F.",
  setSpecialPos: "\u041F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0441\u043F\u0435\u0446\u043F\u0443\u043D\u043A\u0442\u043E\u0432",
  setSpecialPosDesc: "\u0413\u0434\u0435 \u0432 \u043F\u0435\u0440\u0432\u043E\u0439 \u043A\u043E\u043B\u043E\u043D\u043A\u0435 \u0441\u0442\u043E\u044F\u0442 \u0441\u043F\u0435\u0446\u0441\u0442\u0440\u043E\u043A\u0438.",
  posTop: "\u0421\u0432\u0435\u0440\u0445\u0443",
  posBottom: "\u0421\u043D\u0438\u0437\u0443",
  today: "\u0421\u0435\u0433\u043E\u0434\u043D\u044F",
  navBack: "\u041D\u0430\u0437\u0430\u0434",
  navForward: "\u0412\u043F\u0435\u0440\u0451\u0434",
  navUp: "\u0412 \u0440\u043E\u0434\u0438\u0442\u0435\u043B\u044C\u0441\u043A\u0443\u044E \u043F\u0430\u043F\u043A\u0443",
  create: "\u0421\u043E\u0437\u0434\u0430\u0442\u044C",
  more: "\u0415\u0449\u0451 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F",
  preview: "\u041F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440",
  close: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C",
  selectedN: "\u0412\u044B\u0431\u0440\u0430\u043D\u043E: {n}",
  cancelSelection: "\u0421\u043D\u044F\u0442\u044C \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u0438\u0435",
  headMobile: "\u041C\u043E\u0431\u0438\u043B\u044C\u043D\u044B\u0439 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441",
  setMobileScale: "\u041C\u0430\u0441\u0448\u0442\u0430\u0431 \u043C\u043E\u0431\u0438\u043B\u044C\u043D\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430",
  setMobileScaleDesc: "\u0418\u0437\u043C\u0435\u043D\u044F\u0435\u0442 \u0440\u0430\u0437\u043C\u0435\u0440 \u0441\u0442\u0440\u043E\u043A, \u043A\u043D\u043E\u043F\u043E\u043A, \u0442\u0435\u043A\u0441\u0442\u0430 \u0438 \u043E\u0442\u0441\u0442\u0443\u043F\u043E\u0432 \u043D\u0430 \u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0430\u0445 \u0438 \u043F\u043B\u0430\u043D\u0448\u0435\u0442\u0430\u0445.",
  setMobileIcon: "\u0420\u0430\u0437\u043C\u0435\u0440 \u0438\u043A\u043E\u043D\u043E\u043A \u043C\u043E\u0431\u0438\u043B\u044C\u043D\u044B\u0445 \u043A\u043D\u043E\u043F\u043E\u043A",
  setMobileIconDesc: "\u0418\u0437\u043C\u0435\u043D\u044F\u0435\u0442 \u0438\u043A\u043E\u043D\u043A\u0438 \u043F\u0430\u043D\u0435\u043B\u0438 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u043E\u0432, \u043D\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u0438 \u0438 \u043F\u0430\u043D\u0435\u043B\u0438 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0439. \u0418\u043A\u043E\u043D\u043A\u0438 \u0444\u0430\u0439\u043B\u043E\u0432 \u0438 \u043F\u0430\u043F\u043E\u043A \u043D\u0435 \u043C\u0435\u043D\u044F\u044E\u0442\u0441\u044F.",
  resetMobileSizes: "\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u043C\u043E\u0431\u0438\u043B\u044C\u043D\u044B\u0435 \u0440\u0430\u0437\u043C\u0435\u0440\u044B",
  mobileSizesReset: "\u041C\u043E\u0431\u0438\u043B\u044C\u043D\u044B\u0435 \u0440\u0430\u0437\u043C\u0435\u0440\u044B \u0441\u0431\u0440\u043E\u0448\u0435\u043D\u044B",
  diskUsage: "\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u0435 \u0434\u0438\u0441\u043A\u0430",
  duSize: "\u0420\u0430\u0437\u043C\u0435\u0440",
  duWords: "\u0421\u043B\u043E\u0432\u0430",
  duFiles: "\u0424\u0430\u0439\u043B\u044B",
  duRescan: "\u041F\u0435\u0440\u0435\u0441\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u0442\u044C",
  duZoomIn: "\u0423\u0432\u0435\u043B\u0438\u0447\u0438\u0442\u044C",
  duReveal: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0432 \u043A\u043E\u043B\u043E\u043D\u043A\u0430\u0445",
  duEmpty: "\u0425\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0435 \u043F\u0443\u0441\u0442\u043E\u0435",
  duNoWords: "\u0412 \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0435 \u043D\u0435\u0442 \u0441\u043B\u043E\u0432",
  duWordCount_one: "{n} \u0441\u043B\u043E\u0432\u043E",
  duWordCount_few: "{n} \u0441\u043B\u043E\u0432\u0430",
  duWordCount_many: "{n} \u0441\u043B\u043E\u0432",
  duWordCount_other: "{n} \u0441\u043B\u043E\u0432",
  duFileCount_one: "{n} \u0444\u0430\u0439\u043B",
  duFileCount_few: "{n} \u0444\u0430\u0439\u043B\u0430",
  duFileCount_many: "{n} \u0444\u0430\u0439\u043B\u043E\u0432",
  duFileCount_other: "{n} \u0444\u0430\u0439\u043B\u043E\u0432",
  duSmallItem_one: "{n} \u043C\u0435\u043B\u043A\u0438\u0439 \u044D\u043B\u0435\u043C\u0435\u043D\u0442",
  duSmallItem_few: "{n} \u043C\u0435\u043B\u043A\u0438\u0445 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u0430",
  duSmallItem_many: "{n} \u043C\u0435\u043B\u043A\u0438\u0445 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u0432",
  duSmallItem_other: "{n} \u043C\u0435\u043B\u043A\u0438\u0445 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u0432",
  setShowStorage: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u0435 \u0434\u0438\u0441\u043A\u0430",
  setShowStorageDesc: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u0441\u0442\u0440\u043E\u043A\u0443 \xAB\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u0435 \u0434\u0438\u0441\u043A\u0430\xBB: \u043A\u0440\u0443\u0433\u043E\u0432\u0430\u044F \u0434\u0438\u0430\u0433\u0440\u0430\u043C\u043C\u0430 \u0440\u0430\u0437\u043C\u0435\u0440\u043E\u0432 \u043F\u0430\u043F\u043E\u043A, \u0447\u0438\u0441\u043B\u0430 \u0441\u043B\u043E\u0432 \u0438 \u0444\u0430\u0439\u043B\u043E\u0432.",
  setStorageExclude: "\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u0435 \u0434\u0438\u0441\u043A\u0430: \u0438\u0441\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u0435 \u043F\u0430\u043F\u043A\u0438",
  setStorageExcludeDesc: "\u041F\u0443\u0442\u0438 \u0432 \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0435 \u0447\u0435\u0440\u0435\u0437 \u0437\u0430\u043F\u044F\u0442\u0443\u044E, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u043F\u0440\u043E\u043F\u0443\u0441\u043A\u0430\u044E\u0442\u0441\u044F \u043F\u0440\u0438 \u0441\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0438, \u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440 \xABattachments, archive/old\xBB.",
  setStorageRings: "\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u0435 \u0434\u0438\u0441\u043A\u0430: \u0447\u0438\u0441\u043B\u043E \u043A\u043E\u043B\u0435\u0446",
  setStorageRingsDesc: "\u0421\u043A\u043E\u043B\u044C\u043A\u043E \u0443\u0440\u043E\u0432\u043D\u0435\u0439 \u0432\u043B\u043E\u0436\u0435\u043D\u043D\u043E\u0441\u0442\u0438 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442 \u0434\u0438\u0430\u0433\u0440\u0430\u043C\u043C\u0430.",
  setShowUnread: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u043C\u0430\u0440\u043A\u0435\u0440\u044B \u043D\u0435\u043F\u0440\u043E\u0447\u0438\u0442\u0430\u043D\u043D\u043E\u0433\u043E",
  setShowUnreadDesc: "\u0411\u0435\u0439\u0434\u0436 \u0443 \u0444\u0430\u0439\u043B\u043E\u0432, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u0432\u044B \u043D\u0438 \u0440\u0430\u0437\u0443 \u043D\u0435 \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u043B\u0438, \u0438 \u0442\u043E\u0447\u043A\u0430 \u0443 \u0438\u0437\u043C\u0435\u043D\u0451\u043D\u043D\u044B\u0445 \u043F\u043E\u0441\u043B\u0435 \u0432\u0430\u0448\u0435\u0433\u043E \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0435\u0433\u043E \u043E\u0442\u043A\u0440\u044B\u0442\u0438\u044F.",
  unreadNew: "\u041D\u043E\u0432\u044B\u0439",
  unreadModifiedTooltip: "\u0418\u0437\u043C\u0435\u043D\u0451\u043D \u043F\u043E\u0441\u043B\u0435 \u0442\u043E\u0433\u043E, \u043A\u0430\u043A \u0432\u044B \u0435\u0433\u043E \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u043B\u0438"
};

// src/locales/es.ts
var es = {
  lockColumnWidths: "Fijar el ancho de las columnas",
  lockColumnWidthsDesc: "Evita cambiar autom\xE1ticamente el ancho del panel al cambiar de archivo. Las columnas se pueden ajustar manualmente. Desact\xEDvalo para permitir el ajuste autom\xE1tico del panel.",
  newNote: "Nueva nota",
  newFolder: "Nueva carpeta",
  reveal: "Mostrar el archivo activo",
  collapse: "Contraer a la ra\xEDz",
  search: "Filtrar archivos\u2026",
  sort: "Orden",
  empty: "Vac\xEDo",
  noResults: "Sin coincidencias",
  open: "Abrir",
  openNewTab: "Abrir en una pesta\xF1a nueva",
  openRight: "Abrir a la derecha",
  duplicate: "Duplicar",
  rename: "Cambiar nombre",
  delete: "Eliminar",
  copy: "Copiar",
  cut: "Cortar",
  paste: "Pegar",
  itemsPasted: "{n} elementos pegados",
  deleteN: "Eliminar {n} elementos",
  duplicateN: "Duplicar {n} elementos",
  moveTo: "Mover a la carpeta\u2026",
  moveToPlaceholder: "Elige la carpeta de destino\u2026",
  copyPath: "Copiar ruta",
  copyFullPath: "Copiar ruta completa",
  pathCopied: "Ruta copiada",
  copyFailed: "No se pudo copiar al portapapeles",
  untitled: "Sin t\xEDtulo",
  newFolderName: "Nueva carpeta",
  cantMoveIntoSelf: "No se puede mover una carpeta dentro de s\xED misma",
  alreadyExists: "\xAB{name}\xBB ya existe en la carpeta de destino",
  renameFailed: "No se pudo cambiar el nombre: ",
  createFailed: "No se pudo crear \xAB{name}\xBB: {error}",
  moveFailed: "No se pudo mover \xAB{name}\xBB: {error}",
  duplicateFailed: "No se pudo duplicar \xAB{name}\xBB: {error}",
  deleteFailed: "No se pudo eliminar \xAB{name}\xBB: {error}",
  modified: "Modificado",
  created: "Creado",
  sortNameAsc: "Nombre (A \u2192 Z)",
  sortNameDesc: "Nombre (Z \u2192 A)",
  sortMtimeDesc: "Modificaci\xF3n (m\xE1s recientes primero)",
  sortMtimeAsc: "Modificaci\xF3n (m\xE1s antiguos primero)",
  sortCtimeDesc: "Creaci\xF3n (m\xE1s recientes primero)",
  sortCtimeAsc: "Creaci\xF3n (m\xE1s antiguos primero)",
  sortSizeDesc: "Tama\xF1o (mayor primero)",
  sortSizeAsc: "Tama\xF1o (menor primero)",
  confirmDeleteTitle: "Eliminar",
  confirmDeleteOne: "\xBFEliminar \xAB{name}\xBB?",
  confirmDeleteMany: "\xBFEliminar {n} elementos?",
  confirm: "Eliminar",
  cancel: "Cancelar",
  itemsMoved: "{n} elementos movidos",
  undo: "Deshacer",
  filesImported: "{n} archivos importados",
  importFailed: "No se pudo importar \xAB{name}\xBB",
  cmdOpen: "Abrir el explorador de columnas",
  cmdReveal: "Mostrar el archivo activo en las columnas",
  cmdNewNote: "Nueva nota en la carpeta actual",
  cmdNewFolder: "Nueva carpeta en la carpeta actual",
  cmdFocus: "Enfocar el explorador de columnas",
  setFoldersFirst: "Carpetas primero",
  setFoldersFirstDesc: "Mostrar siempre las carpetas por encima de los archivos.",
  setShowExt: "Mostrar la extensi\xF3n",
  setShowExtDesc: "Muestra una peque\xF1a etiqueta con la extensi\xF3n en los archivos que no son Markdown.",
  setPreview: "Mostrar la columna de vista previa",
  setPreviewDesc: "Muestra una columna de detalles cuando se selecciona un archivo.",
  setMdPreview: "Vista previa del contenido",
  setMdPreviewDesc: "Muestra el principio de las notas Markdown en la columna de vista previa.",
  setConfirmDelete: "Confirmar antes de eliminar",
  setConfirmDeleteDesc: "Pide confirmaci\xF3n antes de mover archivos a la papelera.",
  setColWidth: "Ancho de columna predeterminado",
  setColWidthDesc: "En p\xEDxeles. Arrastra el borde derecho de una columna para ajustarla; haz doble clic en el borde para restablecerla.",
  setAutoPanel: "Ajustar el panel autom\xE1ticamente",
  setAutoPanelDesc: "Ensancha y estrecha el panel lateral para que quepan todas las columnas abiertas, sin cambiar su ancho.",
  setSort: "Orden predeterminado",
  setOpenLocation: "D\xF3nde abrir",
  setOpenLocationDesc: "D\xF3nde colocan la vista el comando de apertura y el icono de la cinta. Una vista ya abierta se queda donde est\xE1.",
  locSidebar: "Barra lateral izquierda",
  locTab: "Pesta\xF1a en el \xE1rea principal",
  setAutoReveal: "Seguir al archivo activo",
  setAutoRevealDesc: "Sigue la pesta\xF1a activa del editor y selecciona su archivo en las columnas.",
  setExclude: "Archivos excluidos",
  setExcludeDesc: "Patrones separados por comas, por ejemplo \xAB*.tmp, archive/, .trash\xBB.",
  folderColor: "Color de la carpeta",
  colorDefault: "Predeterminado",
  colorRed: "Rojo",
  colorOrange: "Naranja",
  colorYellow: "Amarillo",
  colorGreen: "Verde",
  colorCyan: "Cian",
  colorBlue: "Azul",
  colorPurple: "Morado",
  colorPink: "Rosa",
  viewAsList: "Ver como lista",
  viewAsGrid: "Ver como iconos",
  pin: "Fijar arriba",
  unpin: "Dejar de fijar",
  newCanvas: "Nuevo lienzo",
  copyWikiLink: "Copiar el enlace wiki",
  copyMdLink: "Copiar el enlace Markdown",
  copyObsidianUrl: "Copiar la URL de Obsidian",
  linkCopied: "Enlace copiado",
  sortDefault: "Orden predeterminado",
  folderIcon: "Icono de la carpeta\u2026",
  folderIconReset: "Restablecer el icono",
  iconPlaceholder: "Elige un icono\u2026",
  setFolderNote: "Abrir las notas de carpeta",
  setFolderNoteDesc: "Al seleccionar una carpeta se abre tambi\xE9n la nota con su mismo nombre, si existe.",
  lockPanel: "Fijar el n\xFAmero de columnas",
  unlockPanel: "Liberar las columnas",
  recents: "Recientes",
  setRecentCount: "N\xFAmero de archivos recientes",
  setRecentCountDesc: "Cu\xE1ntos archivos muestra la columna \xABRecientes\xBB.",
  headAppearance: "Apariencia",
  headBehavior: "Comportamiento",
  headColumns: "Columnas",
  setShowRecents: "Mostrar los recientes",
  setShowRecentsDesc: "Muestra la fila \xABRecientes\xBB en la primera columna.",
  resetWidths: "Restablecer el ancho de las columnas",
  resetWidthsDesc: "Olvida los anchos ajustados a mano y usa el ancho predeterminado en todas partes.",
  widthsReset: "Anchos de columna restablecidos",
  reset: "Restablecer",
  clearRecents: "Vaciar los archivos recientes",
  clearRecentsDesc: "Elimina todas las entradas de la lista de recientes.",
  recentsCleared: "Lista de recientes vaciada",
  clear: "Vaciar",
  bookmarks: "Marcadores",
  calendar: "Calendario",
  favorites: "Favoritos",
  addFavorite: "A\xF1adir a favoritos",
  removeFavorite: "Quitar de favoritos",
  favoriteAdded: "Ruta a\xF1adida a favoritos",
  favoriteRemoved: "Quitado de favoritos",
  setShowFavorites: "Mostrar los favoritos",
  setShowFavoritesDesc: "Muestra tus archivos y carpetas favoritos en la parte superior de la columna \xABMarcadores\xBB.",
  headSpecial: "Elementos especiales",
  setShowBookmarks: "Mostrar los marcadores",
  setShowBookmarksDesc: "Muestra la fila \xABMarcadores\xBB (necesita el plugin Bookmarks).",
  setShowCalendar: "Mostrar el calendario",
  setShowCalendarDesc: "Muestra la fila \xABCalendario\xBB: notas por d\xEDa de creaci\xF3n.",
  setSpecialPos: "Posici\xF3n de los elementos especiales",
  setSpecialPosDesc: "D\xF3nde se sit\xFAan las filas especiales en la primera columna.",
  posTop: "Arriba",
  posBottom: "Abajo",
  today: "Hoy",
  navBack: "Atr\xE1s",
  navForward: "Adelante",
  navUp: "Ir a la carpeta superior",
  create: "Crear",
  more: "M\xE1s acciones",
  preview: "Vista previa",
  close: "Cerrar",
  selectedN: "{n} seleccionados",
  cancelSelection: "Cancelar la selecci\xF3n",
  headMobile: "Interfaz m\xF3vil",
  setMobileScale: "Escala de la interfaz m\xF3vil",
  setMobileScaleDesc: "Cambia el tama\xF1o de las filas, los controles, el texto y los espacios en tel\xE9fonos y tabletas.",
  setMobileIcon: "Tama\xF1o de los iconos m\xF3viles",
  setMobileIconDesc: "Cambia los iconos de la barra de herramientas, la navegaci\xF3n y la barra de acciones. Los iconos de archivos y carpetas no cambian.",
  resetMobileSizes: "Restablecer los tama\xF1os m\xF3viles",
  mobileSizesReset: "Tama\xF1os m\xF3viles restablecidos",
  diskUsage: "Uso del disco",
  duSize: "Tama\xF1o",
  duWords: "Palabras",
  duFiles: "Archivos",
  duRescan: "Reescanear",
  duZoomIn: "Ampliar",
  duReveal: "Mostrar en las columnas",
  duEmpty: "La b\xF3veda est\xE1 vac\xEDa",
  duNoWords: "No hay palabras en la b\xF3veda",
  duWordCount_one: "{n} palabra",
  duWordCount_few: "{n} palabras",
  duWordCount_many: "{n} palabras",
  duWordCount_other: "{n} palabras",
  duFileCount_one: "{n} archivo",
  duFileCount_few: "{n} archivos",
  duFileCount_many: "{n} archivos",
  duFileCount_other: "{n} archivos",
  duSmallItem_one: "{n} elemento peque\xF1o",
  duSmallItem_few: "{n} elementos peque\xF1os",
  duSmallItem_many: "{n} elementos peque\xF1os",
  duSmallItem_other: "{n} elementos peque\xF1os",
  setShowStorage: "Mostrar uso del disco",
  setShowStorageDesc: "Muestra la fila de uso del disco: un gr\xE1fico radial con el tama\xF1o de las carpetas, las palabras y los archivos.",
  setStorageExclude: "Uso del disco: carpetas excluidas",
  setStorageExcludeDesc: "Rutas de la b\xF3veda separadas por comas que se omiten al escanear, p. ej. \xABattachments, archive/old\xBB.",
  setStorageRings: "Uso del disco: n\xFAmero de anillos",
  setStorageRingsDesc: "Cu\xE1ntos niveles de anidamiento muestra el gr\xE1fico a la vez.",
  setShowUnread: "Mostrar marcadores de no le\xEDdo",
  setShowUnreadDesc: "Insignia en los archivos que nunca has abierto y punto en los editados desde la \xFAltima vez que los abriste.",
  unreadNew: "Nuevo",
  unreadModifiedTooltip: "Editado desde la \xFAltima vez que lo abriste"
};

// src/locales/fr.ts
var fr = {
  lockColumnWidths: "Verrouiller la largeur des colonnes",
  lockColumnWidthsDesc: "Emp\xEAche le redimensionnement automatique du panneau lors du changement de fichier. Les colonnes restent ajustables manuellement. D\xE9sactivez pour autoriser le r\xE9glage automatique du panneau.",
  newNote: "Nouvelle note",
  newFolder: "Nouveau dossier",
  reveal: "Afficher le fichier actif",
  collapse: "Replier jusqu'\xE0 la racine",
  search: "Filtrer les fichiers\u2026",
  sort: "Tri",
  empty: "Vide",
  noResults: "Aucun r\xE9sultat",
  open: "Ouvrir",
  openNewTab: "Ouvrir dans un nouvel onglet",
  openRight: "Ouvrir \xE0 droite",
  duplicate: "Dupliquer",
  rename: "Renommer",
  delete: "Supprimer",
  copy: "Copier",
  cut: "Couper",
  paste: "Coller",
  itemsPasted: "{n} \xE9l\xE9ments coll\xE9s",
  deleteN: "Supprimer {n} \xE9l\xE9ments",
  duplicateN: "Dupliquer {n} \xE9l\xE9ments",
  moveTo: "D\xE9placer vers le dossier\u2026",
  moveToPlaceholder: "Choisissez le dossier de destination\u2026",
  copyPath: "Copier le chemin",
  copyFullPath: "Copier le chemin complet",
  pathCopied: "Chemin copi\xE9",
  copyFailed: "Impossible de copier dans le presse-papiers",
  untitled: "Sans titre",
  newFolderName: "Nouveau dossier",
  cantMoveIntoSelf: "Impossible de d\xE9placer un dossier dans lui-m\xEAme",
  alreadyExists: "\xAB {name} \xBB existe d\xE9j\xE0 dans le dossier de destination",
  renameFailed: "\xC9chec du renommage : ",
  createFailed: "Impossible de cr\xE9er \xAB {name} \xBB : {error}",
  moveFailed: "Impossible de d\xE9placer \xAB {name} \xBB : {error}",
  duplicateFailed: "Impossible de dupliquer \xAB {name} \xBB : {error}",
  deleteFailed: "Impossible de supprimer \xAB {name} \xBB : {error}",
  modified: "Modifi\xE9",
  created: "Cr\xE9\xE9",
  sortNameAsc: "Nom (A \u2192 Z)",
  sortNameDesc: "Nom (Z \u2192 A)",
  sortMtimeDesc: "Modification (plus r\xE9cents d'abord)",
  sortMtimeAsc: "Modification (plus anciens d'abord)",
  sortCtimeDesc: "Cr\xE9ation (plus r\xE9cents d'abord)",
  sortCtimeAsc: "Cr\xE9ation (plus anciens d'abord)",
  sortSizeDesc: "Taille (plus grands d'abord)",
  sortSizeAsc: "Taille (plus petits d'abord)",
  confirmDeleteTitle: "Supprimer",
  confirmDeleteOne: "Supprimer \xAB {name} \xBB ?",
  confirmDeleteMany: "Supprimer {n} \xE9l\xE9ments ?",
  confirm: "Supprimer",
  cancel: "Annuler",
  itemsMoved: "{n} \xE9l\xE9ments d\xE9plac\xE9s",
  undo: "Annuler",
  filesImported: "{n} fichiers import\xE9s",
  importFailed: "\xC9chec de l'importation de \xAB {name} \xBB",
  cmdOpen: "Ouvrir l'explorateur en colonnes",
  cmdReveal: "Afficher le fichier actif dans les colonnes",
  cmdNewNote: "Nouvelle note dans le dossier courant",
  cmdNewFolder: "Nouveau dossier dans le dossier courant",
  cmdFocus: "Activer l'explorateur en colonnes",
  setFoldersFirst: "Dossiers en premier",
  setFoldersFirstDesc: "Toujours afficher les dossiers au-dessus des fichiers.",
  setShowExt: "Afficher l'extension",
  setShowExtDesc: "Affiche une petite \xE9tiquette avec l'extension pour les fichiers non Markdown.",
  setPreview: "Afficher la colonne d'aper\xE7u",
  setPreviewDesc: "Affiche une colonne de d\xE9tails lorsqu'un fichier est s\xE9lectionn\xE9.",
  setMdPreview: "Aper\xE7u du contenu des notes",
  setMdPreviewDesc: "Affiche le d\xE9but des notes Markdown dans la colonne d'aper\xE7u.",
  setConfirmDelete: "Confirmer avant de supprimer",
  setConfirmDeleteDesc: "Demande confirmation avant de mettre des fichiers \xE0 la corbeille.",
  setColWidth: "Largeur de colonne par d\xE9faut",
  setColWidthDesc: "En pixels. Faites glisser le bord droit d'une colonne pour la redimensionner ; double-cliquez sur le bord pour la r\xE9initialiser.",
  setAutoPanel: "Ajuster le panneau automatiquement",
  setAutoPanelDesc: "\xC9largit et r\xE9tr\xE9cit le panneau lat\xE9ral pour contenir toutes les colonnes ouvertes, sans changer leur largeur.",
  setSort: "Tri par d\xE9faut",
  setOpenLocation: "O\xF9 ouvrir",
  setOpenLocationDesc: "O\xF9 la commande d'ouverture et l'ic\xF4ne du ruban placent la vue. Une vue d\xE9j\xE0 ouverte reste o\xF9 elle est.",
  locSidebar: "Barre lat\xE9rale gauche",
  locTab: "Onglet dans la zone principale",
  setAutoReveal: "Suivre le fichier actif",
  setAutoRevealDesc: "Suit l'onglet actif de l'\xE9diteur et s\xE9lectionne son fichier dans les colonnes.",
  setExclude: "Fichiers exclus",
  setExcludeDesc: "Motifs s\xE9par\xE9s par des virgules, par exemple \xAB *.tmp, archive/, .trash \xBB.",
  folderColor: "Couleur du dossier",
  colorDefault: "Par d\xE9faut",
  colorRed: "Rouge",
  colorOrange: "Orange",
  colorYellow: "Jaune",
  colorGreen: "Vert",
  colorCyan: "Cyan",
  colorBlue: "Bleu",
  colorPurple: "Violet",
  colorPink: "Rose",
  viewAsList: "Afficher en liste",
  viewAsGrid: "Afficher en ic\xF4nes",
  pin: "\xC9pingler en haut",
  unpin: "D\xE9tacher",
  newCanvas: "Nouveau canevas",
  copyWikiLink: "Copier le lien wiki",
  copyMdLink: "Copier le lien Markdown",
  copyObsidianUrl: "Copier l'URL Obsidian",
  linkCopied: "Lien copi\xE9",
  sortDefault: "Tri par d\xE9faut",
  folderIcon: "Ic\xF4ne du dossier\u2026",
  folderIconReset: "R\xE9initialiser l'ic\xF4ne",
  iconPlaceholder: "Choisissez une ic\xF4ne\u2026",
  setFolderNote: "Ouvrir les notes de dossier",
  setFolderNoteDesc: "S\xE9lectionner un dossier ouvre aussi la note portant le m\xEAme nom \xE0 l'int\xE9rieur, si elle existe.",
  lockPanel: "Verrouiller le nombre de colonnes",
  unlockPanel: "D\xE9verrouiller les colonnes",
  recents: "R\xE9cents",
  setRecentCount: "Nombre de fichiers r\xE9cents",
  setRecentCountDesc: "Combien de fichiers la colonne \xAB R\xE9cents \xBB affiche.",
  headAppearance: "Apparence",
  headBehavior: "Comportement",
  headColumns: "Colonnes",
  setShowRecents: "Afficher les r\xE9cents",
  setShowRecentsDesc: "Affiche la ligne \xAB R\xE9cents \xBB dans la premi\xE8re colonne.",
  resetWidths: "R\xE9initialiser la largeur des colonnes",
  resetWidthsDesc: "Oublie les largeurs ajust\xE9es \xE0 la main et applique partout la largeur par d\xE9faut.",
  widthsReset: "Largeurs de colonnes r\xE9initialis\xE9es",
  reset: "R\xE9initialiser",
  clearRecents: "Vider les fichiers r\xE9cents",
  clearRecentsDesc: "Supprime toutes les entr\xE9es de la liste des r\xE9cents.",
  recentsCleared: "Liste des r\xE9cents vid\xE9e",
  clear: "Vider",
  bookmarks: "Signets",
  calendar: "Calendrier",
  favorites: "Favoris",
  addFavorite: "Ajouter aux favoris",
  removeFavorite: "Retirer des favoris",
  favoriteAdded: "Chemin ajout\xE9 aux favoris",
  favoriteRemoved: "Retir\xE9 des favoris",
  setShowFavorites: "Afficher les favoris",
  setShowFavoritesDesc: "Affiche vos fichiers et dossiers favoris en haut de la colonne \xAB Signets \xBB.",
  headSpecial: "\xC9l\xE9ments sp\xE9ciaux",
  setShowBookmarks: "Afficher les signets",
  setShowBookmarksDesc: "Affiche la ligne \xAB Signets \xBB (n\xE9cessite le plugin Bookmarks).",
  setShowCalendar: "Afficher le calendrier",
  setShowCalendarDesc: "Affiche la ligne \xAB Calendrier \xBB : les notes par jour de cr\xE9ation.",
  setSpecialPos: "Position des \xE9l\xE9ments sp\xE9ciaux",
  setSpecialPosDesc: "O\xF9 se placent les lignes sp\xE9ciales dans la premi\xE8re colonne.",
  posTop: "En haut",
  posBottom: "En bas",
  today: "Aujourd'hui",
  navBack: "Pr\xE9c\xE9dent",
  navForward: "Suivant",
  navUp: "Aller au dossier parent",
  create: "Cr\xE9er",
  more: "Plus d'actions",
  preview: "Aper\xE7u",
  close: "Fermer",
  selectedN: "{n} s\xE9lectionn\xE9s",
  cancelSelection: "Annuler la s\xE9lection",
  headMobile: "Interface mobile",
  setMobileScale: "\xC9chelle de l'interface mobile",
  setMobileScaleDesc: "Change la taille des lignes, des contr\xF4les, du texte et des espacements sur t\xE9l\xE9phones et tablettes.",
  setMobileIcon: "Taille des ic\xF4nes mobiles",
  setMobileIconDesc: "Change les ic\xF4nes de la barre d'outils, de la navigation et de la barre d'actions. Les ic\xF4nes de fichiers et de dossiers ne changent pas.",
  resetMobileSizes: "R\xE9initialiser les tailles mobiles",
  mobileSizesReset: "Tailles mobiles r\xE9initialis\xE9es",
  diskUsage: "Espace disque",
  duSize: "Taille",
  duWords: "Mots",
  duFiles: "Fichiers",
  duRescan: "R\xE9analyser",
  duZoomIn: "Zoomer",
  duReveal: "Afficher dans les colonnes",
  duEmpty: "Le coffre est vide",
  duNoWords: "Aucun mot dans le coffre",
  duWordCount_one: "{n} mot",
  duWordCount_few: "{n} mots",
  duWordCount_many: "{n} mots",
  duWordCount_other: "{n} mots",
  duFileCount_one: "{n} fichier",
  duFileCount_few: "{n} fichiers",
  duFileCount_many: "{n} fichiers",
  duFileCount_other: "{n} fichiers",
  duSmallItem_one: "{n} petit \xE9l\xE9ment",
  duSmallItem_few: "{n} petits \xE9l\xE9ments",
  duSmallItem_many: "{n} petits \xE9l\xE9ments",
  duSmallItem_other: "{n} petits \xE9l\xE9ments",
  setShowStorage: "Afficher l'espace disque",
  setShowStorageDesc: "Affiche la ligne \xAB Espace disque \xBB : un graphique radial de la taille des dossiers, des mots et des fichiers.",
  setStorageExclude: "Espace disque : dossiers exclus",
  setStorageExcludeDesc: "Chemins du coffre s\xE9par\xE9s par des virgules, ignor\xE9s lors de l'analyse, par ex. \xAB attachments, archive/old \xBB.",
  setStorageRings: "Espace disque : nombre d'anneaux",
  setStorageRingsDesc: "Combien de niveaux d'imbrication le graphique affiche \xE0 la fois.",
  setShowUnread: "Afficher les marqueurs de non-lu",
  setShowUnreadDesc: "Badge sur les fichiers jamais ouverts et point sur ceux modifi\xE9s depuis votre derni\xE8re ouverture.",
  unreadNew: "Nouveau",
  unreadModifiedTooltip: "Modifi\xE9 depuis votre derni\xE8re ouverture"
};

// src/locales/it.ts
var it = {
  lockColumnWidths: "Blocca la larghezza delle colonne",
  lockColumnWidthsDesc: "Impedisce il ridimensionamento automatico del pannello quando cambi file. Le colonne restano regolabili manualmente. Disattiva per consentire il ridimensionamento automatico del pannello.",
  newNote: "Nuova nota",
  newFolder: "Nuova cartella",
  reveal: "Mostra il file attivo",
  collapse: "Comprimi alla radice",
  search: "Filtra i file\u2026",
  sort: "Ordinamento",
  empty: "Vuoto",
  noResults: "Nessun risultato",
  open: "Apri",
  openNewTab: "Apri in una nuova scheda",
  openRight: "Apri a destra",
  duplicate: "Duplica",
  rename: "Rinomina",
  delete: "Elimina",
  copy: "Copia",
  cut: "Taglia",
  paste: "Incolla",
  itemsPasted: "{n} elementi incollati",
  deleteN: "Elimina {n} elementi",
  duplicateN: "Duplica {n} elementi",
  moveTo: "Sposta nella cartella\u2026",
  moveToPlaceholder: "Scegli la cartella di destinazione\u2026",
  copyPath: "Copia il percorso",
  copyFullPath: "Copia il percorso completo",
  pathCopied: "Percorso copiato",
  copyFailed: "Impossibile copiare negli appunti",
  untitled: "Senza titolo",
  newFolderName: "Nuova cartella",
  cantMoveIntoSelf: "Impossibile spostare una cartella dentro se stessa",
  alreadyExists: "\xAB{name}\xBB esiste gi\xE0 nella cartella di destinazione",
  renameFailed: "Rinomina non riuscita: ",
  createFailed: "Impossibile creare \xAB{name}\xBB: {error}",
  moveFailed: "Impossibile spostare \xAB{name}\xBB: {error}",
  duplicateFailed: "Impossibile duplicare \xAB{name}\xBB: {error}",
  deleteFailed: "Impossibile eliminare \xAB{name}\xBB: {error}",
  modified: "Modificato",
  created: "Creato",
  sortNameAsc: "Nome (A \u2192 Z)",
  sortNameDesc: "Nome (Z \u2192 A)",
  sortMtimeDesc: "Modifica (prima i pi\xF9 recenti)",
  sortMtimeAsc: "Modifica (prima i pi\xF9 vecchi)",
  sortCtimeDesc: "Creazione (prima i pi\xF9 recenti)",
  sortCtimeAsc: "Creazione (prima i pi\xF9 vecchi)",
  sortSizeDesc: "Dimensione (prima i pi\xF9 grandi)",
  sortSizeAsc: "Dimensione (prima i pi\xF9 piccoli)",
  confirmDeleteTitle: "Elimina",
  confirmDeleteOne: "Eliminare \xAB{name}\xBB?",
  confirmDeleteMany: "Eliminare {n} elementi?",
  confirm: "Elimina",
  cancel: "Annulla",
  itemsMoved: "{n} elementi spostati",
  undo: "Annulla",
  filesImported: "{n} file importati",
  importFailed: "Impossibile importare \xAB{name}\xBB",
  cmdOpen: "Apri l'esploratore a colonne",
  cmdReveal: "Mostra il file attivo nelle colonne",
  cmdNewNote: "Nuova nota nella cartella corrente",
  cmdNewFolder: "Nuova cartella nella cartella corrente",
  cmdFocus: "Attiva l'esploratore a colonne",
  setFoldersFirst: "Prima le cartelle",
  setFoldersFirstDesc: "Mostra sempre le cartelle sopra i file.",
  setShowExt: "Mostra l'estensione",
  setShowExtDesc: "Mostra una piccola etichetta con l'estensione per i file non Markdown.",
  setPreview: "Mostra la colonna di anteprima",
  setPreviewDesc: "Mostra una colonna con i dettagli quando si seleziona un file.",
  setMdPreview: "Anteprima del contenuto",
  setMdPreviewDesc: "Mostra l'inizio delle note Markdown nella colonna di anteprima.",
  setConfirmDelete: "Conferma prima di eliminare",
  setConfirmDeleteDesc: "Chiede conferma prima di spostare i file nel cestino.",
  setColWidth: "Larghezza predefinita delle colonne",
  setColWidthDesc: "In pixel. Trascina il bordo destro di una colonna per ridimensionarla; fai doppio clic sul bordo per ripristinarla.",
  setAutoPanel: "Adatta il pannello automaticamente",
  setAutoPanelDesc: "Allarga e restringe il pannello laterale per contenere tutte le colonne aperte, senza cambiarne la larghezza.",
  setSort: "Ordinamento predefinito",
  setOpenLocation: "Dove aprire",
  setOpenLocationDesc: "Dove il comando di apertura e l'icona della barra mettono la vista. Una vista gi\xE0 aperta resta dov'\xE8.",
  locSidebar: "Barra laterale sinistra",
  locTab: "Scheda nell'area principale",
  setAutoReveal: "Segui il file attivo",
  setAutoRevealDesc: "Segue la scheda attiva dell'editor e seleziona il suo file nelle colonne.",
  setExclude: "File esclusi",
  setExcludeDesc: "Modelli separati da virgole, ad esempio \xAB*.tmp, archive/, .trash\xBB.",
  folderColor: "Colore della cartella",
  colorDefault: "Predefinito",
  colorRed: "Rosso",
  colorOrange: "Arancione",
  colorYellow: "Giallo",
  colorGreen: "Verde",
  colorCyan: "Ciano",
  colorBlue: "Blu",
  colorPurple: "Viola",
  colorPink: "Rosa",
  viewAsList: "Vista a elenco",
  viewAsGrid: "Vista a icone",
  pin: "Fissa in alto",
  unpin: "Rimuovi dai fissati",
  newCanvas: "Nuova tela",
  copyWikiLink: "Copia il collegamento wiki",
  copyMdLink: "Copia il collegamento Markdown",
  copyObsidianUrl: "Copia l'URL di Obsidian",
  linkCopied: "Collegamento copiato",
  sortDefault: "Ordinamento predefinito",
  folderIcon: "Icona della cartella\u2026",
  folderIconReset: "Ripristina l'icona",
  iconPlaceholder: "Scegli un'icona\u2026",
  setFolderNote: "Apri le note di cartella",
  setFolderNoteDesc: "Selezionando una cartella si apre anche la nota con lo stesso nome al suo interno, se esiste.",
  lockPanel: "Blocca il numero di colonne",
  unlockPanel: "Sblocca le colonne",
  recents: "Recenti",
  setRecentCount: "Numero di file recenti",
  setRecentCountDesc: "Quanti file mostra la colonna \xABRecenti\xBB.",
  headAppearance: "Aspetto",
  headBehavior: "Comportamento",
  headColumns: "Colonne",
  setShowRecents: "Mostra i recenti",
  setShowRecentsDesc: "Mostra la riga \xABRecenti\xBB nella prima colonna.",
  resetWidths: "Ripristina la larghezza delle colonne",
  resetWidthsDesc: "Dimentica le larghezze impostate a mano e usa ovunque quella predefinita.",
  widthsReset: "Larghezze delle colonne ripristinate",
  reset: "Ripristina",
  clearRecents: "Svuota i file recenti",
  clearRecentsDesc: "Rimuove tutte le voci dall'elenco dei recenti.",
  recentsCleared: "Elenco dei recenti svuotato",
  clear: "Svuota",
  bookmarks: "Segnalibri",
  calendar: "Calendario",
  favorites: "Preferiti",
  addFavorite: "Aggiungi ai preferiti",
  removeFavorite: "Rimuovi dai preferiti",
  favoriteAdded: "Percorso aggiunto ai preferiti",
  favoriteRemoved: "Rimosso dai preferiti",
  setShowFavorites: "Mostra i preferiti",
  setShowFavoritesDesc: "Mostra i file e le cartelle preferiti in cima alla colonna \xABSegnalibri\xBB.",
  headSpecial: "Elementi speciali",
  setShowBookmarks: "Mostra i segnalibri",
  setShowBookmarksDesc: "Mostra la riga \xABSegnalibri\xBB (richiede il plugin Bookmarks).",
  setShowCalendar: "Mostra il calendario",
  setShowCalendarDesc: "Mostra la riga \xABCalendario\xBB: le note per giorno di creazione.",
  setSpecialPos: "Posizione degli elementi speciali",
  setSpecialPosDesc: "Dove si trovano le righe speciali nella prima colonna.",
  posTop: "In alto",
  posBottom: "In basso",
  today: "Oggi",
  navBack: "Indietro",
  navForward: "Avanti",
  navUp: "Vai alla cartella superiore",
  create: "Crea",
  more: "Altre azioni",
  preview: "Anteprima",
  close: "Chiudi",
  selectedN: "{n} selezionati",
  cancelSelection: "Annulla la selezione",
  headMobile: "Interfaccia mobile",
  setMobileScale: "Scala dell'interfaccia mobile",
  setMobileScaleDesc: "Cambia la dimensione di righe, controlli, testo e spaziature su telefoni e tablet.",
  setMobileIcon: "Dimensione delle icone mobili",
  setMobileIconDesc: "Cambia le icone della barra degli strumenti, della navigazione e della barra delle azioni. Le icone di file e cartelle non cambiano.",
  resetMobileSizes: "Ripristina le dimensioni mobili",
  mobileSizesReset: "Dimensioni mobili ripristinate",
  diskUsage: "Spazio su disco",
  duSize: "Dimensione",
  duWords: "Parole",
  duFiles: "File",
  duRescan: "Riscansiona",
  duZoomIn: "Ingrandisci",
  duReveal: "Mostra nelle colonne",
  duEmpty: "Il vault \xE8 vuoto",
  duNoWords: "Nessuna parola nel vault",
  duWordCount_one: "{n} parola",
  duWordCount_few: "{n} parole",
  duWordCount_many: "{n} parole",
  duWordCount_other: "{n} parole",
  duFileCount_one: "{n} file",
  duFileCount_few: "{n} file",
  duFileCount_many: "{n} file",
  duFileCount_other: "{n} file",
  duSmallItem_one: "{n} elemento piccolo",
  duSmallItem_few: "{n} elementi piccoli",
  duSmallItem_many: "{n} elementi piccoli",
  duSmallItem_other: "{n} elementi piccoli",
  setShowStorage: "Mostra spazio su disco",
  setShowStorageDesc: "Mostra la riga \xABSpazio su disco\xBB: un grafico radiale con dimensioni delle cartelle, parole e file.",
  setStorageExclude: "Spazio su disco: cartelle escluse",
  setStorageExcludeDesc: "Percorsi del vault separati da virgole, saltati durante la scansione, ad es. \xABattachments, archive/old\xBB.",
  setStorageRings: "Spazio su disco: numero di anelli",
  setStorageRingsDesc: "Quanti livelli di annidamento mostra il grafico contemporaneamente.",
  setShowUnread: "Mostra gli indicatori di non letto",
  setShowUnreadDesc: "Badge sui file mai aperti e punto su quelli modificati dall\u2019ultima volta che li hai aperti.",
  unreadNew: "Nuovo",
  unreadModifiedTooltip: "Modificato dall\u2019ultima volta che l\u2019hai aperto"
};

// src/locales/de.ts
var de = {
  lockColumnWidths: "Spaltenbreiten fixieren",
  lockColumnWidthsDesc: "Verhindert automatische Gr\xF6\xDFen\xE4nderungen beim Dateiwechsel. Spalten bleiben manuell ver\xE4nderbar. Deaktivieren, um die automatische Panelgr\xF6\xDFe zu erlauben.",
  newNote: "Neue Notiz",
  newFolder: "Neuer Ordner",
  reveal: "Aktive Datei anzeigen",
  collapse: "Zur Wurzel einklappen",
  search: "Dateien filtern\u2026",
  sort: "Sortierung",
  empty: "Leer",
  noResults: "Keine Treffer",
  open: "\xD6ffnen",
  openNewTab: "In neuem Tab \xF6ffnen",
  openRight: "Rechts \xF6ffnen",
  duplicate: "Duplizieren",
  rename: "Umbenennen",
  delete: "L\xF6schen",
  copy: "Kopieren",
  cut: "Ausschneiden",
  paste: "Einf\xFCgen",
  itemsPasted: "{n} Elemente eingef\xFCgt",
  deleteN: "{n} Elemente l\xF6schen",
  duplicateN: "{n} Elemente duplizieren",
  moveTo: "In Ordner verschieben\u2026",
  moveToPlaceholder: "Zielordner w\xE4hlen\u2026",
  copyPath: "Pfad kopieren",
  copyFullPath: "Vollst\xE4ndigen Pfad kopieren",
  pathCopied: "Pfad kopiert",
  copyFailed: "Kopieren in die Zwischenablage fehlgeschlagen",
  untitled: "Ohne Titel",
  newFolderName: "Neuer Ordner",
  cantMoveIntoSelf: "Ein Ordner kann nicht in sich selbst verschoben werden",
  alreadyExists: "\u201E{name}\u201C existiert bereits im Zielordner",
  renameFailed: "Umbenennen fehlgeschlagen: ",
  createFailed: "\u201E{name}\u201C konnte nicht erstellt werden: {error}",
  moveFailed: "\u201E{name}\u201C konnte nicht verschoben werden: {error}",
  duplicateFailed: "\u201E{name}\u201C konnte nicht dupliziert werden: {error}",
  deleteFailed: "\u201E{name}\u201C konnte nicht gel\xF6scht werden: {error}",
  modified: "Ge\xE4ndert",
  created: "Erstellt",
  sortNameAsc: "Name (A \u2192 Z)",
  sortNameDesc: "Name (Z \u2192 A)",
  sortMtimeDesc: "\xC4nderung (neueste zuerst)",
  sortMtimeAsc: "\xC4nderung (\xE4lteste zuerst)",
  sortCtimeDesc: "Erstellung (neueste zuerst)",
  sortCtimeAsc: "Erstellung (\xE4lteste zuerst)",
  sortSizeDesc: "Gr\xF6\xDFe (gr\xF6\xDFte zuerst)",
  sortSizeAsc: "Gr\xF6\xDFe (kleinste zuerst)",
  confirmDeleteTitle: "L\xF6schen",
  confirmDeleteOne: "\u201E{name}\u201C l\xF6schen?",
  confirmDeleteMany: "{n} Elemente l\xF6schen?",
  confirm: "L\xF6schen",
  cancel: "Abbrechen",
  itemsMoved: "{n} Elemente verschoben",
  undo: "R\xFCckg\xE4ngig",
  filesImported: "{n} Dateien importiert",
  importFailed: "\u201E{name}\u201C konnte nicht importiert werden",
  cmdOpen: "Spaltenexplorer \xF6ffnen",
  cmdReveal: "Aktive Datei in den Spalten anzeigen",
  cmdNewNote: "Neue Notiz im aktuellen Ordner",
  cmdNewFolder: "Neuer Ordner im aktuellen Ordner",
  cmdFocus: "Spaltenexplorer fokussieren",
  setFoldersFirst: "Ordner zuerst",
  setFoldersFirstDesc: "Ordner immer \xFCber den Dateien anzeigen.",
  setShowExt: "Dateiendung anzeigen",
  setShowExtDesc: "Zeigt bei Nicht-Markdown-Dateien ein kleines Etikett mit der Dateiendung.",
  setPreview: "Vorschauspalte anzeigen",
  setPreviewDesc: "Zeigt eine Detailspalte, sobald eine Datei ausgew\xE4hlt ist.",
  setMdPreview: "Notizinhalt in der Vorschau",
  setMdPreviewDesc: "Zeigt den Anfang von Markdown-Notizen in der Vorschauspalte.",
  setConfirmDelete: "Vor dem L\xF6schen best\xE4tigen",
  setConfirmDeleteDesc: "Fragt nach, bevor Dateien in den Papierkorb verschoben werden.",
  setColWidth: "Standardbreite der Spalten",
  setColWidthDesc: "In Pixeln. Ziehe den rechten Rand einer Spalte, um sie anzupassen; ein Doppelklick auf den Rand setzt sie zur\xFCck.",
  setAutoPanel: "Bereich automatisch anpassen",
  setAutoPanelDesc: "Verbreitert und verschm\xE4lert die Seitenleiste, damit alle ge\xF6ffneten Spalten hineinpassen, ohne deren Breite zu \xE4ndern.",
  setSort: "Standardsortierung",
  setOpenLocation: "Wo \xF6ffnen",
  setOpenLocationDesc: "Wohin der \xD6ffnen-Befehl und das Men\xFCbandsymbol die Ansicht legen. Eine bereits ge\xF6ffnete Ansicht bleibt, wo sie ist.",
  locSidebar: "Linke Seitenleiste",
  locTab: "Tab im Hauptbereich",
  setAutoReveal: "Aktiver Datei folgen",
  setAutoRevealDesc: "Folgt dem aktiven Editor-Tab und w\xE4hlt dessen Datei in den Spalten aus.",
  setExclude: "Ausgeschlossene Dateien",
  setExcludeDesc: "Durch Kommas getrennte Muster, zum Beispiel \u201E*.tmp, archive/, .trash\u201C.",
  folderColor: "Ordnerfarbe",
  colorDefault: "Standard",
  colorRed: "Rot",
  colorOrange: "Orange",
  colorYellow: "Gelb",
  colorGreen: "Gr\xFCn",
  colorCyan: "Cyan",
  colorBlue: "Blau",
  colorPurple: "Violett",
  colorPink: "Rosa",
  viewAsList: "Als Liste anzeigen",
  viewAsGrid: "Als Symbole anzeigen",
  pin: "Oben anheften",
  unpin: "L\xF6sen",
  newCanvas: "Neues Canvas",
  copyWikiLink: "Wikilink kopieren",
  copyMdLink: "Markdown-Link kopieren",
  copyObsidianUrl: "Obsidian-URL kopieren",
  linkCopied: "Link kopiert",
  sortDefault: "Standardsortierung",
  folderIcon: "Ordnersymbol\u2026",
  folderIconReset: "Ordnersymbol zur\xFCcksetzen",
  iconPlaceholder: "Symbol w\xE4hlen\u2026",
  setFolderNote: "Ordnernotizen \xF6ffnen",
  setFolderNoteDesc: "Beim Ausw\xE4hlen eines Ordners wird auch die gleichnamige Notiz darin ge\xF6ffnet, sofern vorhanden.",
  lockPanel: "Spaltenanzahl feststellen",
  unlockPanel: "Spalten freigeben",
  recents: "Zuletzt verwendet",
  setRecentCount: "Anzahl zuletzt verwendeter Dateien",
  setRecentCountDesc: "Wie viele Dateien die Spalte \u201EZuletzt verwendet\u201C zeigt.",
  headAppearance: "Darstellung",
  headBehavior: "Verhalten",
  headColumns: "Spalten",
  setShowRecents: "Zuletzt verwendete anzeigen",
  setShowRecentsDesc: "Zeigt die Zeile \u201EZuletzt verwendet\u201C in der ersten Spalte.",
  resetWidths: "Alle Spaltenbreiten zur\xFCcksetzen",
  resetWidthsDesc: "Vergisst einzeln angepasste Breiten und verwendet \xFCberall die Standardbreite.",
  widthsReset: "Spaltenbreiten zur\xFCckgesetzt",
  reset: "Zur\xFCcksetzen",
  clearRecents: "Zuletzt verwendete leeren",
  clearRecentsDesc: "Entfernt alle Eintr\xE4ge aus der Liste der zuletzt verwendeten Dateien.",
  recentsCleared: "Liste geleert",
  clear: "Leeren",
  bookmarks: "Lesezeichen",
  calendar: "Kalender",
  favorites: "Favoriten",
  addFavorite: "Zu Favoriten hinzuf\xFCgen",
  removeFavorite: "Aus Favoriten entfernen",
  favoriteAdded: "Pfad zu den Favoriten hinzugef\xFCgt",
  favoriteRemoved: "Aus den Favoriten entfernt",
  setShowFavorites: "Favoriten anzeigen",
  setShowFavoritesDesc: "Zeigt deine gespeicherten Lieblingsdateien und -ordner oben in der Spalte \u201ELesezeichen\u201C.",
  headSpecial: "Besondere Eintr\xE4ge",
  setShowBookmarks: "Lesezeichen anzeigen",
  setShowBookmarksDesc: "Zeigt die Zeile \u201ELesezeichen\u201C (ben\xF6tigt das Bookmarks-Plugin).",
  setShowCalendar: "Kalender anzeigen",
  setShowCalendarDesc: "Zeigt die Zeile \u201EKalender\u201C: Notizen nach Erstellungstag.",
  setSpecialPos: "Position der besonderen Eintr\xE4ge",
  setSpecialPosDesc: "Wo die Sonderzeilen in der ersten Spalte stehen.",
  posTop: "Oben",
  posBottom: "Unten",
  today: "Heute",
  navBack: "Zur\xFCck",
  navForward: "Vorw\xE4rts",
  navUp: "Zum \xFCbergeordneten Ordner",
  create: "Erstellen",
  more: "Weitere Aktionen",
  preview: "Vorschau",
  close: "Schlie\xDFen",
  selectedN: "{n} ausgew\xE4hlt",
  cancelSelection: "Auswahl aufheben",
  headMobile: "Mobile Oberfl\xE4che",
  setMobileScale: "Skalierung der mobilen Oberfl\xE4che",
  setMobileScaleDesc: "\xC4ndert die Gr\xF6\xDFe von Zeilen, Bedienelementen, Text und Abst\xE4nden auf Telefonen und Tablets.",
  setMobileIcon: "Symbolgr\xF6\xDFe auf Mobilger\xE4ten",
  setMobileIconDesc: "\xC4ndert die Symbole von Werkzeugleiste, Navigation und Aktionsleiste. Datei- und Ordnersymbole bleiben unver\xE4ndert.",
  resetMobileSizes: "Mobile Gr\xF6\xDFen zur\xFCcksetzen",
  mobileSizesReset: "Mobile Gr\xF6\xDFen zur\xFCckgesetzt",
  diskUsage: "Speicherplatz",
  duSize: "Gr\xF6\xDFe",
  duWords: "W\xF6rter",
  duFiles: "Dateien",
  duRescan: "Neu scannen",
  duZoomIn: "Vergr\xF6\xDFern",
  duReveal: "In den Spalten anzeigen",
  duEmpty: "Vault ist leer",
  duNoWords: "Keine W\xF6rter im Vault",
  duWordCount_one: "{n} Wort",
  duWordCount_few: "{n} W\xF6rter",
  duWordCount_many: "{n} W\xF6rter",
  duWordCount_other: "{n} W\xF6rter",
  duFileCount_one: "{n} Datei",
  duFileCount_few: "{n} Dateien",
  duFileCount_many: "{n} Dateien",
  duFileCount_other: "{n} Dateien",
  duSmallItem_one: "{n} kleines Element",
  duSmallItem_few: "{n} kleine Elemente",
  duSmallItem_many: "{n} kleine Elemente",
  duSmallItem_other: "{n} kleine Elemente",
  setShowStorage: "Speicherplatz anzeigen",
  setShowStorageDesc: "Zeigt die Zeile \u201ESpeicherplatz\u201C: ein Ringdiagramm mit Ordnergr\xF6\xDFen, W\xF6rtern und Dateien.",
  setStorageExclude: "Speicherplatz: ausgeschlossene Ordner",
  setStorageExcludeDesc: "Durch Kommas getrennte Vault-Pfade, die beim Scannen \xFCbersprungen werden, z. B. \u201Eattachments, archive/old\u201C.",
  setStorageRings: "Speicherplatz: Anzahl der Ringe",
  setStorageRingsDesc: "Wie viele Verschachtelungsebenen das Diagramm gleichzeitig zeigt.",
  setShowUnread: "Ungelesen-Markierungen anzeigen",
  setShowUnreadDesc: "Abzeichen an nie ge\xF6ffneten Dateien und ein Punkt an seit dem letzten \xD6ffnen ge\xE4nderten.",
  unreadNew: "Neu",
  unreadModifiedTooltip: "Seit dem letzten \xD6ffnen ge\xE4ndert"
};

// src/locales/pt-BR.ts
var ptBR = {
  lockColumnWidths: "Fixar a largura das colunas",
  lockColumnWidthsDesc: "Impede o redimensionamento autom\xE1tico do painel ao trocar de arquivo. As colunas continuam ajust\xE1veis manualmente. Desative para permitir o ajuste autom\xE1tico do painel.",
  newNote: "Nova nota",
  newFolder: "Nova pasta",
  reveal: "Mostrar o arquivo ativo",
  collapse: "Recolher at\xE9 a raiz",
  search: "Filtrar arquivos\u2026",
  sort: "Ordena\xE7\xE3o",
  empty: "Vazio",
  noResults: "Nenhum resultado",
  open: "Abrir",
  openNewTab: "Abrir em nova aba",
  openRight: "Abrir \xE0 direita",
  duplicate: "Duplicar",
  rename: "Renomear",
  delete: "Excluir",
  copy: "Copiar",
  cut: "Recortar",
  paste: "Colar",
  itemsPasted: "{n} itens colados",
  deleteN: "Excluir {n} itens",
  duplicateN: "Duplicar {n} itens",
  moveTo: "Mover para a pasta\u2026",
  moveToPlaceholder: "Escolha a pasta de destino\u2026",
  copyPath: "Copiar caminho",
  copyFullPath: "Copiar caminho completo",
  pathCopied: "Caminho copiado",
  copyFailed: "N\xE3o foi poss\xEDvel copiar para a \xE1rea de transfer\xEAncia",
  untitled: "Sem t\xEDtulo",
  newFolderName: "Nova pasta",
  cantMoveIntoSelf: "N\xE3o \xE9 poss\xEDvel mover uma pasta para dentro dela mesma",
  alreadyExists: "\u201C{name}\u201D j\xE1 existe na pasta de destino",
  renameFailed: "Falha ao renomear: ",
  createFailed: "N\xE3o foi poss\xEDvel criar \u201C{name}\u201D: {error}",
  moveFailed: "N\xE3o foi poss\xEDvel mover \u201C{name}\u201D: {error}",
  duplicateFailed: "N\xE3o foi poss\xEDvel duplicar \u201C{name}\u201D: {error}",
  deleteFailed: "N\xE3o foi poss\xEDvel excluir \u201C{name}\u201D: {error}",
  modified: "Modificado",
  created: "Criado",
  sortNameAsc: "Nome (A \u2192 Z)",
  sortNameDesc: "Nome (Z \u2192 A)",
  sortMtimeDesc: "Modifica\xE7\xE3o (mais recentes primeiro)",
  sortMtimeAsc: "Modifica\xE7\xE3o (mais antigos primeiro)",
  sortCtimeDesc: "Cria\xE7\xE3o (mais recentes primeiro)",
  sortCtimeAsc: "Cria\xE7\xE3o (mais antigos primeiro)",
  sortSizeDesc: "Tamanho (maiores primeiro)",
  sortSizeAsc: "Tamanho (menores primeiro)",
  confirmDeleteTitle: "Excluir",
  confirmDeleteOne: "Excluir \u201C{name}\u201D?",
  confirmDeleteMany: "Excluir {n} itens?",
  confirm: "Excluir",
  cancel: "Cancelar",
  itemsMoved: "{n} itens movidos",
  undo: "Desfazer",
  filesImported: "{n} arquivos importados",
  importFailed: "Falha ao importar \u201C{name}\u201D",
  cmdOpen: "Abrir o explorador em colunas",
  cmdReveal: "Mostrar o arquivo ativo nas colunas",
  cmdNewNote: "Nova nota na pasta atual",
  cmdNewFolder: "Nova pasta na pasta atual",
  cmdFocus: "Focar o explorador em colunas",
  setFoldersFirst: "Pastas primeiro",
  setFoldersFirstDesc: "Sempre listar as pastas acima dos arquivos.",
  setShowExt: "Mostrar a extens\xE3o",
  setShowExtDesc: "Mostra uma pequena etiqueta com a extens\xE3o nos arquivos que n\xE3o s\xE3o Markdown.",
  setPreview: "Mostrar a coluna de visualiza\xE7\xE3o",
  setPreviewDesc: "Mostra uma coluna de detalhes quando um arquivo \xE9 selecionado.",
  setMdPreview: "Visualizar o conte\xFAdo da nota",
  setMdPreviewDesc: "Mostra o in\xEDcio das notas Markdown na coluna de visualiza\xE7\xE3o.",
  setConfirmDelete: "Confirmar antes de excluir",
  setConfirmDeleteDesc: "Pede confirma\xE7\xE3o antes de mover arquivos para a lixeira.",
  setColWidth: "Largura padr\xE3o das colunas",
  setColWidthDesc: "Em pixels. Arraste a borda direita de uma coluna para redimension\xE1-la; d\xEA um duplo clique na borda para restaur\xE1-la.",
  setAutoPanel: "Ajustar o painel automaticamente",
  setAutoPanelDesc: "Alarga e estreita o painel lateral para caber todas as colunas abertas, sem mudar a largura delas.",
  setSort: "Ordena\xE7\xE3o padr\xE3o",
  setOpenLocation: "Onde abrir",
  setOpenLocationDesc: "Onde o comando de abrir e o \xEDcone da faixa colocam a visualiza\xE7\xE3o. Uma visualiza\xE7\xE3o j\xE1 aberta permanece onde est\xE1.",
  locSidebar: "Barra lateral esquerda",
  locTab: "Aba na \xE1rea principal",
  setAutoReveal: "Seguir o arquivo ativo",
  setAutoRevealDesc: "Segue a aba ativa do editor e seleciona o arquivo dela nas colunas.",
  setExclude: "Arquivos exclu\xEDdos",
  setExcludeDesc: "Padr\xF5es separados por v\xEDrgulas, por exemplo \u201C*.tmp, archive/, .trash\u201D.",
  folderColor: "Cor da pasta",
  colorDefault: "Padr\xE3o",
  colorRed: "Vermelho",
  colorOrange: "Laranja",
  colorYellow: "Amarelo",
  colorGreen: "Verde",
  colorCyan: "Ciano",
  colorBlue: "Azul",
  colorPurple: "Roxo",
  colorPink: "Rosa",
  viewAsList: "Ver como lista",
  viewAsGrid: "Ver como \xEDcones",
  pin: "Fixar no topo",
  unpin: "Desafixar",
  newCanvas: "Novo canvas",
  copyWikiLink: "Copiar link wiki",
  copyMdLink: "Copiar link Markdown",
  copyObsidianUrl: "Copiar URL do Obsidian",
  linkCopied: "Link copiado",
  sortDefault: "Ordena\xE7\xE3o padr\xE3o",
  folderIcon: "\xCDcone da pasta\u2026",
  folderIconReset: "Restaurar o \xEDcone",
  iconPlaceholder: "Escolha um \xEDcone\u2026",
  setFolderNote: "Abrir notas de pasta",
  setFolderNoteDesc: "Selecionar uma pasta tamb\xE9m abre a nota de mesmo nome dentro dela, quando existe.",
  lockPanel: "Travar o n\xFAmero de colunas",
  unlockPanel: "Destravar as colunas",
  recents: "Recentes",
  setRecentCount: "N\xFAmero de arquivos recentes",
  setRecentCountDesc: "Quantos arquivos a coluna \u201CRecentes\u201D mostra.",
  headAppearance: "Apar\xEAncia",
  headBehavior: "Comportamento",
  headColumns: "Colunas",
  setShowRecents: "Mostrar os recentes",
  setShowRecentsDesc: "Mostra a linha \u201CRecentes\u201D na primeira coluna.",
  resetWidths: "Restaurar a largura das colunas",
  resetWidthsDesc: "Esquece as larguras ajustadas manualmente e usa a largura padr\xE3o em todo lugar.",
  widthsReset: "Larguras das colunas restauradas",
  reset: "Restaurar",
  clearRecents: "Limpar os arquivos recentes",
  clearRecentsDesc: "Remove todas as entradas da lista de recentes.",
  recentsCleared: "Lista de recentes limpa",
  clear: "Limpar",
  bookmarks: "Favoritos",
  calendar: "Calend\xE1rio",
  favorites: "Preferidos",
  addFavorite: "Adicionar aos preferidos",
  removeFavorite: "Remover dos preferidos",
  favoriteAdded: "Caminho adicionado aos preferidos",
  favoriteRemoved: "Removido dos preferidos",
  setShowFavorites: "Mostrar os preferidos",
  setShowFavoritesDesc: "Mostra seus arquivos e pastas preferidos no topo da coluna \u201CFavoritos\u201D.",
  headSpecial: "Itens especiais",
  setShowBookmarks: "Mostrar os favoritos",
  setShowBookmarksDesc: "Mostra a linha \u201CFavoritos\u201D (precisa do plugin Bookmarks).",
  setShowCalendar: "Mostrar o calend\xE1rio",
  setShowCalendarDesc: "Mostra a linha \u201CCalend\xE1rio\u201D: notas por dia de cria\xE7\xE3o.",
  setSpecialPos: "Posi\xE7\xE3o dos itens especiais",
  setSpecialPosDesc: "Onde as linhas especiais ficam na primeira coluna.",
  posTop: "No topo",
  posBottom: "Embaixo",
  today: "Hoje",
  navBack: "Voltar",
  navForward: "Avan\xE7ar",
  navUp: "Ir para a pasta acima",
  create: "Criar",
  more: "Mais a\xE7\xF5es",
  preview: "Visualizar",
  close: "Fechar",
  selectedN: "{n} selecionados",
  cancelSelection: "Cancelar a sele\xE7\xE3o",
  headMobile: "Interface m\xF3vel",
  setMobileScale: "Escala da interface m\xF3vel",
  setMobileScaleDesc: "Muda o tamanho das linhas, dos controles, do texto e dos espa\xE7amentos em celulares e tablets.",
  setMobileIcon: "Tamanho dos \xEDcones no celular",
  setMobileIconDesc: "Muda os \xEDcones da barra de ferramentas, da navega\xE7\xE3o e da barra de a\xE7\xF5es. Os \xEDcones de arquivos e pastas n\xE3o mudam.",
  resetMobileSizes: "Restaurar os tamanhos m\xF3veis",
  mobileSizesReset: "Tamanhos m\xF3veis restaurados",
  diskUsage: "Uso do disco",
  duSize: "Tamanho",
  duWords: "Palavras",
  duFiles: "Arquivos",
  duRescan: "Reescanear",
  duZoomIn: "Ampliar",
  duReveal: "Mostrar nas colunas",
  duEmpty: "O cofre est\xE1 vazio",
  duNoWords: "Sem palavras no cofre",
  duWordCount_one: "{n} palavra",
  duWordCount_few: "{n} palavras",
  duWordCount_many: "{n} palavras",
  duWordCount_other: "{n} palavras",
  duFileCount_one: "{n} arquivo",
  duFileCount_few: "{n} arquivos",
  duFileCount_many: "{n} arquivos",
  duFileCount_other: "{n} arquivos",
  duSmallItem_one: "{n} item pequeno",
  duSmallItem_few: "{n} itens pequenos",
  duSmallItem_many: "{n} itens pequenos",
  duSmallItem_other: "{n} itens pequenos",
  setShowStorage: "Mostrar uso do disco",
  setShowStorageDesc: "Mostra a linha \xABUso do disco\xBB: um gr\xE1fico radial com tamanhos de pastas, palavras e arquivos.",
  setStorageExclude: "Uso do disco: pastas exclu\xEDdas",
  setStorageExcludeDesc: "Caminhos do cofre separados por v\xEDrgulas, ignorados na varredura, por ex. \xABattachments, archive/old\xBB.",
  setStorageRings: "Uso do disco: n\xFAmero de an\xE9is",
  setStorageRingsDesc: "Quantos n\xEDveis de aninhamento o gr\xE1fico mostra de uma vez.",
  setShowUnread: "Mostrar marcadores de n\xE3o lido",
  setShowUnreadDesc: "Selo nos arquivos que voc\xEA nunca abriu e ponto nos editados desde a \xFAltima vez que os abriu.",
  unreadNew: "Novo",
  unreadModifiedTooltip: "Editado desde a \xFAltima vez que voc\xEA abriu"
};

// src/locales/zh.ts
var zh = {
  lockColumnWidths: "\u56FA\u5B9A\u5217\u5BBD",
  lockColumnWidthsDesc: "\u5207\u6362\u6587\u4EF6\u65F6\u4E0D\u81EA\u52A8\u8C03\u6574\u9762\u677F\u5BBD\u5EA6\u3002\u4ECD\u53EF\u624B\u52A8\u8C03\u6574\u5217\u5BBD\u3002\u5173\u95ED\u540E\u5141\u8BB8\u9762\u677F\u81EA\u52A8\u8C03\u6574\u8BBE\u7F6E\u751F\u6548\u3002",
  newNote: "\u65B0\u5EFA\u7B14\u8BB0",
  newFolder: "\u65B0\u5EFA\u6587\u4EF6\u5939",
  reveal: "\u5B9A\u4F4D\u5F53\u524D\u6587\u4EF6",
  collapse: "\u6298\u53E0\u5230\u6839\u76EE\u5F55",
  search: "\u7B5B\u9009\u6587\u4EF6\u2026",
  sort: "\u6392\u5E8F\u65B9\u5F0F",
  empty: "\u7A7A",
  noResults: "\u65E0\u5339\u914D\u7ED3\u679C",
  open: "\u6253\u5F00",
  openNewTab: "\u5728\u65B0\u6807\u7B7E\u9875\u6253\u5F00",
  openRight: "\u5728\u53F3\u4FA7\u6253\u5F00",
  duplicate: "\u521B\u5EFA\u526F\u672C",
  rename: "\u91CD\u547D\u540D",
  delete: "\u5220\u9664",
  copy: "\u590D\u5236",
  cut: "\u526A\u5207",
  paste: "\u7C98\u8D34",
  itemsPasted: "\u5DF2\u7C98\u8D34 {n} \u4E2A\u9879\u76EE",
  deleteN: "\u5220\u9664 {n} \u4E2A\u9879\u76EE",
  duplicateN: "\u4E3A {n} \u4E2A\u9879\u76EE\u521B\u5EFA\u526F\u672C",
  moveTo: "\u79FB\u52A8\u5230\u6587\u4EF6\u5939\u2026",
  moveToPlaceholder: "\u9009\u62E9\u76EE\u6807\u6587\u4EF6\u5939\u2026",
  copyPath: "\u590D\u5236\u8DEF\u5F84",
  copyFullPath: "\u590D\u5236\u5B8C\u6574\u8DEF\u5F84",
  pathCopied: "\u8DEF\u5F84\u5DF2\u590D\u5236",
  copyFailed: "\u65E0\u6CD5\u590D\u5236\u5230\u526A\u8D34\u677F",
  untitled: "\u672A\u547D\u540D",
  newFolderName: "\u65B0\u5EFA\u6587\u4EF6\u5939",
  cantMoveIntoSelf: "\u65E0\u6CD5\u5C06\u6587\u4EF6\u5939\u79FB\u52A8\u5230\u5176\u81EA\u8EAB\u5185\u90E8",
  alreadyExists: "\u76EE\u6807\u6587\u4EF6\u5939\u4E2D\u5DF2\u5B58\u5728\u201C{name}\u201D",
  renameFailed: "\u91CD\u547D\u540D\u5931\u8D25\uFF1A",
  createFailed: "\u65E0\u6CD5\u521B\u5EFA\u201C{name}\u201D\uFF1A{error}",
  moveFailed: "\u65E0\u6CD5\u79FB\u52A8\u201C{name}\u201D\uFF1A{error}",
  duplicateFailed: "\u65E0\u6CD5\u521B\u5EFA\u201C{name}\u201D\u7684\u526F\u672C\uFF1A{error}",
  deleteFailed: "\u65E0\u6CD5\u5220\u9664\u201C{name}\u201D\uFF1A{error}",
  modified: "\u4FEE\u6539\u65F6\u95F4",
  created: "\u521B\u5EFA\u65F6\u95F4",
  sortNameAsc: "\u540D\u79F0\uFF08A \u2192 Z\uFF09",
  sortNameDesc: "\u540D\u79F0\uFF08Z \u2192 A\uFF09",
  sortMtimeDesc: "\u4FEE\u6539\u65F6\u95F4\uFF08\u6700\u65B0\u5728\u524D\uFF09",
  sortMtimeAsc: "\u4FEE\u6539\u65F6\u95F4\uFF08\u6700\u65E9\u5728\u524D\uFF09",
  sortCtimeDesc: "\u521B\u5EFA\u65F6\u95F4\uFF08\u6700\u65B0\u5728\u524D\uFF09",
  sortCtimeAsc: "\u521B\u5EFA\u65F6\u95F4\uFF08\u6700\u65E9\u5728\u524D\uFF09",
  sortSizeDesc: "\u5927\u5C0F\uFF08\u4ECE\u5927\u5230\u5C0F\uFF09",
  sortSizeAsc: "\u5927\u5C0F\uFF08\u4ECE\u5C0F\u5230\u5927\uFF09",
  confirmDeleteTitle: "\u5220\u9664",
  confirmDeleteOne: "\u786E\u5B9A\u5220\u9664\u201C{name}\u201D\u5417\uFF1F",
  confirmDeleteMany: "\u786E\u5B9A\u5220\u9664 {n} \u4E2A\u9879\u76EE\u5417\uFF1F",
  confirm: "\u5220\u9664",
  cancel: "\u53D6\u6D88",
  itemsMoved: "\u5DF2\u79FB\u52A8 {n} \u4E2A\u9879\u76EE",
  undo: "\u64A4\u9500",
  filesImported: "\u5DF2\u5BFC\u5165 {n} \u4E2A\u6587\u4EF6",
  importFailed: "\u5BFC\u5165\u201C{name}\u201D\u5931\u8D25",
  cmdOpen: "\u6253\u5F00\u5206\u680F\u6D4F\u89C8\u5668",
  cmdReveal: "\u5728\u5206\u680F\u4E2D\u5B9A\u4F4D\u5F53\u524D\u6587\u4EF6",
  cmdNewNote: "\u5728\u5F53\u524D\u6587\u4EF6\u5939\u65B0\u5EFA\u7B14\u8BB0",
  cmdNewFolder: "\u5728\u5F53\u524D\u6587\u4EF6\u5939\u65B0\u5EFA\u6587\u4EF6\u5939",
  cmdFocus: "\u805A\u7126\u5206\u680F\u6D4F\u89C8\u5668",
  setFoldersFirst: "\u6587\u4EF6\u5939\u4F18\u5148",
  setFoldersFirstDesc: "\u59CB\u7EC8\u5C06\u6587\u4EF6\u5939\u6392\u5728\u6587\u4EF6\u4E4B\u524D\u3002",
  setShowExt: "\u663E\u793A\u6269\u5C55\u540D",
  setShowExtDesc: "\u4E3A\u975E Markdown \u6587\u4EF6\u663E\u793A\u4E00\u4E2A\u6807\u6CE8\u6269\u5C55\u540D\u7684\u5C0F\u6807\u7B7E\u3002",
  setPreview: "\u663E\u793A\u9884\u89C8\u680F",
  setPreviewDesc: "\u9009\u4E2D\u6587\u4EF6\u65F6\u663E\u793A\u4E00\u4E2A\u8BE6\u60C5\u680F\u3002",
  setMdPreview: "\u9884\u89C8\u7B14\u8BB0\u5185\u5BB9",
  setMdPreviewDesc: "\u5728\u9884\u89C8\u680F\u4E2D\u6E32\u67D3 Markdown \u7B14\u8BB0\u7684\u5F00\u5934\u90E8\u5206\u3002",
  setConfirmDelete: "\u5220\u9664\u524D\u786E\u8BA4",
  setConfirmDeleteDesc: "\u5C06\u6587\u4EF6\u79FB\u5165\u56DE\u6536\u7AD9\u524D\u5148\u8BE2\u95EE\u786E\u8BA4\u3002",
  setColWidth: "\u9ED8\u8BA4\u680F\u5BBD",
  setColWidthDesc: "\u5355\u4F4D\u4E3A\u50CF\u7D20\u3002\u62D6\u52A8\u67D0\u4E00\u680F\u7684\u53F3\u8FB9\u7F18\u53EF\u8C03\u6574\u8BE5\u680F\u5BBD\u5EA6\uFF0C\u53CC\u51FB\u8FB9\u7F18\u53EF\u5C06\u5176\u91CD\u7F6E\u3002",
  setAutoPanel: "\u81EA\u52A8\u8C03\u6574\u9762\u677F\u5BBD\u5EA6",
  setAutoPanelDesc: "\u81EA\u52A8\u4F38\u7F29\u4FA7\u8FB9\u9762\u677F\u4EE5\u5BB9\u7EB3\u6240\u6709\u5DF2\u6253\u5F00\u7684\u680F\uFF0C\u540C\u65F6\u4FDD\u6301\u680F\u5BBD\u4E0D\u53D8\u3002",
  setSort: "\u9ED8\u8BA4\u6392\u5E8F\u65B9\u5F0F",
  setOpenLocation: "\u6253\u5F00\u4F4D\u7F6E",
  setOpenLocationDesc: "\u6253\u5F00\u547D\u4EE4\u548C\u529F\u80FD\u533A\u56FE\u6807\u5C06\u89C6\u56FE\u653E\u5728\u54EA\u91CC\u3002\u5DF2\u6253\u5F00\u7684\u89C6\u56FE\u4FDD\u6301\u539F\u4F4D\u3002",
  locSidebar: "\u5DE6\u4FA7\u8FB9\u680F",
  locTab: "\u4E3B\u533A\u57DF\u6807\u7B7E\u9875",
  setAutoReveal: "\u8DDF\u968F\u5F53\u524D\u6587\u4EF6",
  setAutoRevealDesc: "\u8DDF\u968F\u7F16\u8F91\u5668\u7684\u5F53\u524D\u6807\u7B7E\u9875\uFF0C\u5E76\u5728\u5206\u680F\u4E2D\u9009\u4E2D\u5176\u6587\u4EF6\u3002",
  setExclude: "\u6392\u9664\u7684\u6587\u4EF6",
  setExcludeDesc: "\u4EE5\u9017\u53F7\u5206\u9694\u7684\u5339\u914D\u6A21\u5F0F\uFF0C\u4F8B\u5982\u201C*.tmp, archive/, .trash\u201D\u3002",
  folderColor: "\u6587\u4EF6\u5939\u989C\u8272",
  colorDefault: "\u9ED8\u8BA4",
  colorRed: "\u7EA2\u8272",
  colorOrange: "\u6A59\u8272",
  colorYellow: "\u9EC4\u8272",
  colorGreen: "\u7EFF\u8272",
  colorCyan: "\u9752\u8272",
  colorBlue: "\u84DD\u8272",
  colorPurple: "\u7D2B\u8272",
  colorPink: "\u7C89\u8272",
  viewAsList: "\u4EE5\u5217\u8868\u663E\u793A",
  viewAsGrid: "\u4EE5\u56FE\u6807\u663E\u793A",
  pin: "\u7F6E\u9876",
  unpin: "\u53D6\u6D88\u7F6E\u9876",
  newCanvas: "\u65B0\u5EFA\u767D\u677F",
  copyWikiLink: "\u590D\u5236 Wiki \u94FE\u63A5",
  copyMdLink: "\u590D\u5236 Markdown \u94FE\u63A5",
  copyObsidianUrl: "\u590D\u5236 Obsidian \u94FE\u63A5",
  linkCopied: "\u94FE\u63A5\u5DF2\u590D\u5236",
  sortDefault: "\u9ED8\u8BA4\u6392\u5E8F",
  folderIcon: "\u6587\u4EF6\u5939\u56FE\u6807\u2026",
  folderIconReset: "\u91CD\u7F6E\u6587\u4EF6\u5939\u56FE\u6807",
  iconPlaceholder: "\u9009\u62E9\u4E00\u4E2A\u56FE\u6807\u2026",
  setFolderNote: "\u6253\u5F00\u6587\u4EF6\u5939\u7B14\u8BB0",
  setFolderNoteDesc: "\u9009\u4E2D\u6587\u4EF6\u5939\u65F6\uFF0C\u82E5\u5176\u5185\u90E8\u5B58\u5728\u540C\u540D\u7B14\u8BB0\uFF0C\u5219\u4E00\u5E76\u6253\u5F00\u3002",
  lockPanel: "\u9501\u5B9A\u680F\u6570",
  unlockPanel: "\u89E3\u9664\u680F\u6570\u9501\u5B9A",
  recents: "\u6700\u8FD1\u6587\u4EF6",
  setRecentCount: "\u6700\u8FD1\u6587\u4EF6\u6570\u91CF",
  setRecentCountDesc: "\u201C\u6700\u8FD1\u6587\u4EF6\u201D\u680F\u663E\u793A\u591A\u5C11\u4E2A\u6587\u4EF6\u3002",
  headAppearance: "\u5916\u89C2",
  headBehavior: "\u884C\u4E3A",
  headColumns: "\u680F",
  setShowRecents: "\u663E\u793A\u6700\u8FD1\u6587\u4EF6",
  setShowRecentsDesc: "\u5728\u7B2C\u4E00\u680F\u4E2D\u663E\u793A\u201C\u6700\u8FD1\u6587\u4EF6\u201D\u4E00\u884C\u3002",
  resetWidths: "\u91CD\u7F6E\u6240\u6709\u680F\u5BBD",
  resetWidthsDesc: "\u5FD8\u8BB0\u5355\u72EC\u8C03\u6574\u8FC7\u7684\u5BBD\u5EA6\uFF0C\u5904\u5904\u4F7F\u7528\u9ED8\u8BA4\u680F\u5BBD\u3002",
  widthsReset: "\u680F\u5BBD\u5DF2\u91CD\u7F6E",
  reset: "\u91CD\u7F6E",
  clearRecents: "\u6E05\u7A7A\u6700\u8FD1\u6587\u4EF6",
  clearRecentsDesc: "\u79FB\u9664\u6700\u8FD1\u6587\u4EF6\u5217\u8868\u4E2D\u7684\u5168\u90E8\u8BB0\u5F55\u3002",
  recentsCleared: "\u6700\u8FD1\u6587\u4EF6\u5217\u8868\u5DF2\u6E05\u7A7A",
  clear: "\u6E05\u7A7A",
  bookmarks: "\u4E66\u7B7E",
  calendar: "\u65E5\u5386",
  favorites: "\u6536\u85CF",
  addFavorite: "\u6DFB\u52A0\u5230\u6536\u85CF",
  removeFavorite: "\u4ECE\u6536\u85CF\u4E2D\u79FB\u9664",
  favoriteAdded: "\u8DEF\u5F84\u5DF2\u6DFB\u52A0\u5230\u6536\u85CF",
  favoriteRemoved: "\u5DF2\u4ECE\u6536\u85CF\u4E2D\u79FB\u9664",
  setShowFavorites: "\u663E\u793A\u6536\u85CF",
  setShowFavoritesDesc: "\u5728\u201C\u4E66\u7B7E\u201D\u680F\u9876\u90E8\u663E\u793A\u4F60\u6536\u85CF\u7684\u6587\u4EF6\u548C\u6587\u4EF6\u5939\u3002",
  headSpecial: "\u7279\u6B8A\u9879\u76EE",
  setShowBookmarks: "\u663E\u793A\u4E66\u7B7E",
  setShowBookmarksDesc: "\u663E\u793A\u201C\u4E66\u7B7E\u201D\u4E00\u884C\uFF08\u9700\u8981\u6838\u5FC3\u4E66\u7B7E\u63D2\u4EF6\uFF09\u3002",
  setShowCalendar: "\u663E\u793A\u65E5\u5386",
  setShowCalendarDesc: "\u663E\u793A\u201C\u65E5\u5386\u201D\u4E00\u884C\uFF1A\u6309\u521B\u5EFA\u65E5\u671F\u5F52\u7C7B\u7684\u7B14\u8BB0\u3002",
  setSpecialPos: "\u7279\u6B8A\u9879\u76EE\u7684\u4F4D\u7F6E",
  setSpecialPosDesc: "\u7279\u6B8A\u884C\u5728\u7B2C\u4E00\u680F\u4E2D\u7684\u4F4D\u7F6E\u3002",
  posTop: "\u9876\u90E8",
  posBottom: "\u5E95\u90E8",
  today: "\u4ECA\u5929",
  navBack: "\u540E\u9000",
  navForward: "\u524D\u8FDB",
  navUp: "\u8F6C\u5230\u4E0A\u7EA7\u6587\u4EF6\u5939",
  create: "\u65B0\u5EFA",
  more: "\u66F4\u591A\u64CD\u4F5C",
  preview: "\u9884\u89C8",
  close: "\u5173\u95ED",
  selectedN: "\u5DF2\u9009\u62E9 {n} \u9879",
  cancelSelection: "\u53D6\u6D88\u9009\u62E9",
  headMobile: "\u79FB\u52A8\u7AEF\u754C\u9762",
  setMobileScale: "\u79FB\u52A8\u7AEF\u754C\u9762\u7F29\u653E",
  setMobileScaleDesc: "\u8C03\u6574\u624B\u673A\u548C\u5E73\u677F\u4E0A\u884C\u9AD8\u3001\u63A7\u4EF6\u3001\u6587\u5B57\u548C\u95F4\u8DDD\u7684\u5927\u5C0F\u3002",
  setMobileIcon: "\u79FB\u52A8\u7AEF\u6309\u94AE\u56FE\u6807\u5927\u5C0F",
  setMobileIconDesc: "\u8C03\u6574\u5DE5\u5177\u680F\u3001\u5BFC\u822A\u680F\u548C\u64CD\u4F5C\u680F\u7684\u56FE\u6807\u3002\u6587\u4EF6\u548C\u6587\u4EF6\u5939\u56FE\u6807\u4E0D\u53D7\u5F71\u54CD\u3002",
  resetMobileSizes: "\u91CD\u7F6E\u79FB\u52A8\u7AEF\u5C3A\u5BF8",
  mobileSizesReset: "\u79FB\u52A8\u7AEF\u5C3A\u5BF8\u5DF2\u91CD\u7F6E",
  diskUsage: "\u78C1\u76D8\u5360\u7528",
  duSize: "\u5927\u5C0F",
  duWords: "\u5B57\u6570",
  duFiles: "\u6587\u4EF6",
  duRescan: "\u91CD\u65B0\u626B\u63CF",
  duZoomIn: "\u653E\u5927",
  duReveal: "\u5728\u5206\u680F\u4E2D\u663E\u793A",
  duEmpty: "\u4ED3\u5E93\u4E3A\u7A7A",
  duNoWords: "\u4ED3\u5E93\u4E2D\u6CA1\u6709\u6587\u5B57",
  duWordCount_one: "{n} \u5B57",
  duWordCount_few: "{n} \u5B57",
  duWordCount_many: "{n} \u5B57",
  duWordCount_other: "{n} \u5B57",
  duFileCount_one: "{n} \u4E2A\u6587\u4EF6",
  duFileCount_few: "{n} \u4E2A\u6587\u4EF6",
  duFileCount_many: "{n} \u4E2A\u6587\u4EF6",
  duFileCount_other: "{n} \u4E2A\u6587\u4EF6",
  duSmallItem_one: "{n} \u4E2A\u5C0F\u9879\u76EE",
  duSmallItem_few: "{n} \u4E2A\u5C0F\u9879\u76EE",
  duSmallItem_many: "{n} \u4E2A\u5C0F\u9879\u76EE",
  duSmallItem_other: "{n} \u4E2A\u5C0F\u9879\u76EE",
  setShowStorage: "\u663E\u793A\u78C1\u76D8\u5360\u7528",
  setShowStorageDesc: "\u663E\u793A\u300C\u78C1\u76D8\u5360\u7528\u300D\u884C\uFF1A\u4EE5\u65ED\u65E5\u56FE\u5C55\u793A\u6587\u4EF6\u5939\u5927\u5C0F\u3001\u5B57\u6570\u548C\u6587\u4EF6\u6570\u3002",
  setStorageExclude: "\u78C1\u76D8\u5360\u7528\uFF1A\u6392\u9664\u7684\u6587\u4EF6\u5939",
  setStorageExcludeDesc: "\u4EE5\u9017\u53F7\u5206\u9694\u7684\u4ED3\u5E93\u8DEF\u5F84\uFF0C\u626B\u63CF\u65F6\u8DF3\u8FC7\uFF0C\u4F8B\u5982\u300Cattachments, archive/old\u300D\u3002",
  setStorageRings: "\u78C1\u76D8\u5360\u7528\uFF1A\u73AF\u6570",
  setStorageRingsDesc: "\u56FE\u8868\u540C\u65F6\u663E\u793A\u7684\u5D4C\u5957\u5C42\u7EA7\u6570\u3002",
  setShowUnread: "\u663E\u793A\u672A\u8BFB\u6807\u8BB0",
  setShowUnreadDesc: "\u4E3A\u4ECE\u672A\u6253\u5F00\u8FC7\u7684\u6587\u4EF6\u52A0\u6807\u8BB0\uFF0C\u4E3A\u4E0A\u6B21\u6253\u5F00\u540E\u88AB\u4FEE\u6539\u7684\u6587\u4EF6\u52A0\u5706\u70B9\u3002",
  unreadNew: "\u65B0",
  unreadModifiedTooltip: "\u81EA\u4E0A\u6B21\u6253\u5F00\u540E\u5DF2\u4FEE\u6539"
};

// src/locales/ja.ts
var ja = {
  lockColumnWidths: "\u5217\u306E\u5E45\u3092\u56FA\u5B9A",
  lockColumnWidthsDesc: "\u30D5\u30A1\u30A4\u30EB\u5207\u308A\u66FF\u3048\u6642\u306B\u30D1\u30CD\u30EB\u5E45\u3092\u81EA\u52D5\u5909\u66F4\u3057\u307E\u305B\u3093\u3002\u5217\u5E45\u306F\u624B\u52D5\u3067\u5909\u66F4\u3067\u304D\u307E\u3059\u3002\u30D1\u30CD\u30EB\u306E\u81EA\u52D5\u8ABF\u6574\u3092\u8A31\u53EF\u3059\u308B\u306B\u306F\u30AA\u30D5\u306B\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
  newNote: "\u65B0\u898F\u30CE\u30FC\u30C8",
  newFolder: "\u65B0\u898F\u30D5\u30A9\u30EB\u30C0",
  reveal: "\u30A2\u30AF\u30C6\u30A3\u30D6\u306A\u30D5\u30A1\u30A4\u30EB\u3092\u8868\u793A",
  collapse: "\u30EB\u30FC\u30C8\u307E\u3067\u6298\u308A\u305F\u305F\u3080",
  search: "\u30D5\u30A1\u30A4\u30EB\u3092\u7D5E\u308A\u8FBC\u3080\u2026",
  sort: "\u4E26\u3073\u66FF\u3048",
  empty: "\u7A7A",
  noResults: "\u8A72\u5F53\u306A\u3057",
  open: "\u958B\u304F",
  openNewTab: "\u65B0\u3057\u3044\u30BF\u30D6\u3067\u958B\u304F",
  openRight: "\u53F3\u5074\u3067\u958B\u304F",
  duplicate: "\u8907\u88FD",
  rename: "\u540D\u524D\u3092\u5909\u66F4",
  delete: "\u524A\u9664",
  copy: "\u30B3\u30D4\u30FC",
  cut: "\u5207\u308A\u53D6\u308A",
  paste: "\u8CBC\u308A\u4ED8\u3051",
  itemsPasted: "{n}\u4EF6\u3092\u8CBC\u308A\u4ED8\u3051\u307E\u3057\u305F",
  deleteN: "{n} \u4EF6\u3092\u524A\u9664",
  duplicateN: "{n} \u4EF6\u3092\u8907\u88FD",
  moveTo: "\u30D5\u30A9\u30EB\u30C0\u3078\u79FB\u52D5\u2026",
  moveToPlaceholder: "\u79FB\u52D5\u5148\u306E\u30D5\u30A9\u30EB\u30C0\u3092\u9078\u629E\u2026",
  copyPath: "\u30D1\u30B9\u3092\u30B3\u30D4\u30FC",
  copyFullPath: "\u5B8C\u5168\u306A\u30D1\u30B9\u3092\u30B3\u30D4\u30FC",
  pathCopied: "\u30D1\u30B9\u3092\u30B3\u30D4\u30FC\u3057\u307E\u3057\u305F",
  copyFailed: "\u30AF\u30EA\u30C3\u30D7\u30DC\u30FC\u30C9\u306B\u30B3\u30D4\u30FC\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F",
  untitled: "\u7121\u984C",
  newFolderName: "\u65B0\u898F\u30D5\u30A9\u30EB\u30C0",
  cantMoveIntoSelf: "\u30D5\u30A9\u30EB\u30C0\u3092\u81EA\u8EAB\u306E\u4E2D\u3078\u306F\u79FB\u52D5\u3067\u304D\u307E\u305B\u3093",
  alreadyExists: "\u79FB\u52D5\u5148\u306E\u30D5\u30A9\u30EB\u30C0\u306B\u306F\u300C{name}\u300D\u304C\u65E2\u306B\u3042\u308A\u307E\u3059",
  renameFailed: "\u540D\u524D\u306E\u5909\u66F4\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ",
  createFailed: "\u300C{name}\u300D\u3092\u4F5C\u6210\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F: {error}",
  moveFailed: "\u300C{name}\u300D\u3092\u79FB\u52D5\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F: {error}",
  duplicateFailed: "\u300C{name}\u300D\u3092\u8907\u88FD\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F: {error}",
  deleteFailed: "\u300C{name}\u300D\u3092\u524A\u9664\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F: {error}",
  modified: "\u66F4\u65B0\u65E5\u6642",
  created: "\u4F5C\u6210\u65E5\u6642",
  sortNameAsc: "\u540D\u524D\uFF08A \u2192 Z\uFF09",
  sortNameDesc: "\u540D\u524D\uFF08Z \u2192 A\uFF09",
  sortMtimeDesc: "\u66F4\u65B0\u65E5\u6642\uFF08\u65B0\u3057\u3044\u9806\uFF09",
  sortMtimeAsc: "\u66F4\u65B0\u65E5\u6642\uFF08\u53E4\u3044\u9806\uFF09",
  sortCtimeDesc: "\u4F5C\u6210\u65E5\u6642\uFF08\u65B0\u3057\u3044\u9806\uFF09",
  sortCtimeAsc: "\u4F5C\u6210\u65E5\u6642\uFF08\u53E4\u3044\u9806\uFF09",
  sortSizeDesc: "\u30B5\u30A4\u30BA\uFF08\u5927\u304D\u3044\u9806\uFF09",
  sortSizeAsc: "\u30B5\u30A4\u30BA\uFF08\u5C0F\u3055\u3044\u9806\uFF09",
  confirmDeleteTitle: "\u524A\u9664",
  confirmDeleteOne: "\u300C{name}\u300D\u3092\u524A\u9664\u3057\u307E\u3059\u304B\uFF1F",
  confirmDeleteMany: "{n} \u4EF6\u3092\u524A\u9664\u3057\u307E\u3059\u304B\uFF1F",
  confirm: "\u524A\u9664",
  cancel: "\u30AD\u30E3\u30F3\u30BB\u30EB",
  itemsMoved: "{n} \u4EF6\u3092\u79FB\u52D5\u3057\u307E\u3057\u305F",
  undo: "\u5143\u306B\u623B\u3059",
  filesImported: "{n} \u4EF6\u306E\u30D5\u30A1\u30A4\u30EB\u3092\u8AAD\u307F\u8FBC\u307F\u307E\u3057\u305F",
  importFailed: "\u300C{name}\u300D\u306E\u8AAD\u307F\u8FBC\u307F\u306B\u5931\u6557\u3057\u307E\u3057\u305F",
  cmdOpen: "\u30AB\u30E9\u30E0\u30A8\u30AF\u30B9\u30D7\u30ED\u30FC\u30E9\u30FC\u3092\u958B\u304F",
  cmdReveal: "\u30A2\u30AF\u30C6\u30A3\u30D6\u306A\u30D5\u30A1\u30A4\u30EB\u3092\u30AB\u30E9\u30E0\u3067\u8868\u793A",
  cmdNewNote: "\u73FE\u5728\u306E\u30D5\u30A9\u30EB\u30C0\u306B\u65B0\u898F\u30CE\u30FC\u30C8",
  cmdNewFolder: "\u73FE\u5728\u306E\u30D5\u30A9\u30EB\u30C0\u306B\u65B0\u898F\u30D5\u30A9\u30EB\u30C0",
  cmdFocus: "\u30AB\u30E9\u30E0\u30A8\u30AF\u30B9\u30D7\u30ED\u30FC\u30E9\u30FC\u306B\u30D5\u30A9\u30FC\u30AB\u30B9",
  setFoldersFirst: "\u30D5\u30A9\u30EB\u30C0\u3092\u5148\u306B\u8868\u793A",
  setFoldersFirstDesc: "\u5E38\u306B\u30D5\u30A9\u30EB\u30C0\u3092\u30D5\u30A1\u30A4\u30EB\u3088\u308A\u4E0A\u306B\u4E26\u3079\u307E\u3059\u3002",
  setShowExt: "\u62E1\u5F35\u5B50\u3092\u8868\u793A",
  setShowExtDesc: "Markdown \u4EE5\u5916\u306E\u30D5\u30A1\u30A4\u30EB\u306B\u62E1\u5F35\u5B50\u306E\u5C0F\u3055\u306A\u30E9\u30D9\u30EB\u3092\u8868\u793A\u3057\u307E\u3059\u3002",
  setPreview: "\u30D7\u30EC\u30D3\u30E5\u30FC\u5217\u3092\u8868\u793A",
  setPreviewDesc: "\u30D5\u30A1\u30A4\u30EB\u3092\u9078\u629E\u3057\u305F\u3068\u304D\u306B\u8A73\u7D30\u5217\u3092\u8868\u793A\u3057\u307E\u3059\u3002",
  setMdPreview: "\u30CE\u30FC\u30C8\u306E\u5185\u5BB9\u3092\u30D7\u30EC\u30D3\u30E5\u30FC",
  setMdPreviewDesc: "\u30D7\u30EC\u30D3\u30E5\u30FC\u5217\u306B Markdown \u30CE\u30FC\u30C8\u306E\u5192\u982D\u3092\u8868\u793A\u3057\u307E\u3059\u3002",
  setConfirmDelete: "\u524A\u9664\u524D\u306B\u78BA\u8A8D",
  setConfirmDeleteDesc: "\u30D5\u30A1\u30A4\u30EB\u3092\u30B4\u30DF\u7BB1\u306B\u79FB\u3059\u524D\u306B\u78BA\u8A8D\u3057\u307E\u3059\u3002",
  setColWidth: "\u65E2\u5B9A\u306E\u30AB\u30E9\u30E0\u5E45",
  setColWidthDesc: "\u30D4\u30AF\u30BB\u30EB\u5358\u4F4D\u3002\u30AB\u30E9\u30E0\u306E\u53F3\u7AEF\u3092\u30C9\u30E9\u30C3\u30B0\u3059\u308B\u3068\u3001\u305D\u306E\u30AB\u30E9\u30E0\u306E\u5E45\u3092\u5909\u66F4\u3067\u304D\u307E\u3059\u3002\u53F3\u7AEF\u3092\u30C0\u30D6\u30EB\u30AF\u30EA\u30C3\u30AF\u3059\u308B\u3068\u5143\u306B\u623B\u308A\u307E\u3059\u3002",
  setAutoPanel: "\u30D1\u30CD\u30EB\u5E45\u3092\u81EA\u52D5\u8ABF\u6574",
  setAutoPanelDesc: "\u30AB\u30E9\u30E0\u306E\u5E45\u306F\u4FDD\u3063\u305F\u307E\u307E\u3001\u958B\u3044\u3066\u3044\u308B\u30AB\u30E9\u30E0\u304C\u3059\u3079\u3066\u53CE\u307E\u308B\u3088\u3046\u30B5\u30A4\u30C9\u30D1\u30CD\u30EB\u3092\u4F38\u7E2E\u3055\u305B\u307E\u3059\u3002",
  setSort: "\u65E2\u5B9A\u306E\u4E26\u3073\u66FF\u3048",
  setOpenLocation: "\u958B\u304F\u5834\u6240",
  setOpenLocationDesc: "\u958B\u304F\u30B3\u30DE\u30F3\u30C9\u3068\u30EA\u30DC\u30F3\u30A2\u30A4\u30B3\u30F3\u304C\u30D3\u30E5\u30FC\u3092\u914D\u7F6E\u3059\u308B\u5834\u6240\u3002\u3059\u3067\u306B\u958B\u3044\u3066\u3044\u308B\u30D3\u30E5\u30FC\u306F\u305D\u306E\u307E\u307E\u3067\u3059\u3002",
  locSidebar: "\u5DE6\u30B5\u30A4\u30C9\u30D0\u30FC",
  locTab: "\u30E1\u30A4\u30F3\u30A8\u30EA\u30A2\u306E\u30BF\u30D6",
  setAutoReveal: "\u30A2\u30AF\u30C6\u30A3\u30D6\u306A\u30D5\u30A1\u30A4\u30EB\u3092\u8FFD\u8DE1",
  setAutoRevealDesc: "\u30A8\u30C7\u30A3\u30BF\u306E\u30A2\u30AF\u30C6\u30A3\u30D6\u306A\u30BF\u30D6\u306B\u8FFD\u5F93\u3057\u3001\u305D\u306E\u30D5\u30A1\u30A4\u30EB\u3092\u30AB\u30E9\u30E0\u5185\u3067\u9078\u629E\u3057\u307E\u3059\u3002",
  setExclude: "\u9664\u5916\u3059\u308B\u30D5\u30A1\u30A4\u30EB",
  setExcludeDesc: "\u30AB\u30F3\u30DE\u533A\u5207\u308A\u306E\u30D1\u30BF\u30FC\u30F3\u3002\u4F8B:\u300C*.tmp, archive/, .trash\u300D",
  folderColor: "\u30D5\u30A9\u30EB\u30C0\u306E\u8272",
  colorDefault: "\u65E2\u5B9A",
  colorRed: "\u8D64",
  colorOrange: "\u30AA\u30EC\u30F3\u30B8",
  colorYellow: "\u9EC4",
  colorGreen: "\u7DD1",
  colorCyan: "\u30B7\u30A2\u30F3",
  colorBlue: "\u9752",
  colorPurple: "\u7D2B",
  colorPink: "\u30D4\u30F3\u30AF",
  viewAsList: "\u30EA\u30B9\u30C8\u8868\u793A",
  viewAsGrid: "\u30A2\u30A4\u30B3\u30F3\u8868\u793A",
  pin: "\u5148\u982D\u306B\u30D4\u30F3\u7559\u3081",
  unpin: "\u30D4\u30F3\u7559\u3081\u3092\u89E3\u9664",
  newCanvas: "\u65B0\u898F\u30AD\u30E3\u30F3\u30D0\u30B9",
  copyWikiLink: "\u30A6\u30A3\u30AD\u30EA\u30F3\u30AF\u3092\u30B3\u30D4\u30FC",
  copyMdLink: "Markdown \u30EA\u30F3\u30AF\u3092\u30B3\u30D4\u30FC",
  copyObsidianUrl: "Obsidian URL \u3092\u30B3\u30D4\u30FC",
  linkCopied: "\u30EA\u30F3\u30AF\u3092\u30B3\u30D4\u30FC\u3057\u307E\u3057\u305F",
  sortDefault: "\u65E2\u5B9A\u306E\u4E26\u3073\u66FF\u3048",
  folderIcon: "\u30D5\u30A9\u30EB\u30C0\u306E\u30A2\u30A4\u30B3\u30F3\u2026",
  folderIconReset: "\u30D5\u30A9\u30EB\u30C0\u306E\u30A2\u30A4\u30B3\u30F3\u3092\u30EA\u30BB\u30C3\u30C8",
  iconPlaceholder: "\u30A2\u30A4\u30B3\u30F3\u3092\u9078\u629E\u2026",
  setFolderNote: "\u30D5\u30A9\u30EB\u30C0\u30CE\u30FC\u30C8\u3092\u958B\u304F",
  setFolderNoteDesc: "\u30D5\u30A9\u30EB\u30C0\u3092\u9078\u629E\u3057\u305F\u3068\u304D\u3001\u305D\u306E\u4E2D\u306B\u540C\u540D\u306E\u30CE\u30FC\u30C8\u304C\u3042\u308C\u3070\u4E00\u7DD2\u306B\u958B\u304D\u307E\u3059\u3002",
  lockPanel: "\u30AB\u30E9\u30E0\u6570\u3092\u56FA\u5B9A",
  unlockPanel: "\u30AB\u30E9\u30E0\u6570\u306E\u56FA\u5B9A\u3092\u89E3\u9664",
  recents: "\u6700\u8FD1\u306E\u30D5\u30A1\u30A4\u30EB",
  setRecentCount: "\u6700\u8FD1\u306E\u30D5\u30A1\u30A4\u30EB\u306E\u4EF6\u6570",
  setRecentCountDesc: "\u300C\u6700\u8FD1\u306E\u30D5\u30A1\u30A4\u30EB\u300D\u5217\u306B\u8868\u793A\u3059\u308B\u4EF6\u6570\u3002",
  headAppearance: "\u5916\u89B3",
  headBehavior: "\u52D5\u4F5C",
  headColumns: "\u30AB\u30E9\u30E0",
  setShowRecents: "\u6700\u8FD1\u306E\u30D5\u30A1\u30A4\u30EB\u3092\u8868\u793A",
  setShowRecentsDesc: "\u6700\u521D\u306E\u30AB\u30E9\u30E0\u306B\u300C\u6700\u8FD1\u306E\u30D5\u30A1\u30A4\u30EB\u300D\u306E\u884C\u3092\u8868\u793A\u3057\u307E\u3059\u3002",
  resetWidths: "\u3059\u3079\u3066\u306E\u30AB\u30E9\u30E0\u5E45\u3092\u30EA\u30BB\u30C3\u30C8",
  resetWidthsDesc: "\u500B\u5225\u306B\u8ABF\u6574\u3057\u305F\u5E45\u3092\u7834\u68C4\u3057\u3001\u3069\u3053\u3067\u3082\u65E2\u5B9A\u306E\u5E45\u3092\u4F7F\u3044\u307E\u3059\u3002",
  widthsReset: "\u30AB\u30E9\u30E0\u5E45\u3092\u30EA\u30BB\u30C3\u30C8\u3057\u307E\u3057\u305F",
  reset: "\u30EA\u30BB\u30C3\u30C8",
  clearRecents: "\u6700\u8FD1\u306E\u30D5\u30A1\u30A4\u30EB\u3092\u6D88\u53BB",
  clearRecentsDesc: "\u6700\u8FD1\u306E\u30D5\u30A1\u30A4\u30EB\u306E\u4E00\u89A7\u304B\u3089\u3059\u3079\u3066\u306E\u9805\u76EE\u3092\u524A\u9664\u3057\u307E\u3059\u3002",
  recentsCleared: "\u6700\u8FD1\u306E\u30D5\u30A1\u30A4\u30EB\u3092\u6D88\u53BB\u3057\u307E\u3057\u305F",
  clear: "\u6D88\u53BB",
  bookmarks: "\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF",
  calendar: "\u30AB\u30EC\u30F3\u30C0\u30FC",
  favorites: "\u304A\u6C17\u306B\u5165\u308A",
  addFavorite: "\u304A\u6C17\u306B\u5165\u308A\u306B\u8FFD\u52A0",
  removeFavorite: "\u304A\u6C17\u306B\u5165\u308A\u304B\u3089\u524A\u9664",
  favoriteAdded: "\u30D1\u30B9\u3092\u304A\u6C17\u306B\u5165\u308A\u306B\u8FFD\u52A0\u3057\u307E\u3057\u305F",
  favoriteRemoved: "\u304A\u6C17\u306B\u5165\u308A\u304B\u3089\u524A\u9664\u3057\u307E\u3057\u305F",
  setShowFavorites: "\u304A\u6C17\u306B\u5165\u308A\u3092\u8868\u793A",
  setShowFavoritesDesc: "\u4FDD\u5B58\u3057\u305F\u304A\u6C17\u306B\u5165\u308A\u306E\u30D5\u30A1\u30A4\u30EB\u3068\u30D5\u30A9\u30EB\u30C0\u3092\u300C\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF\u300D\u5217\u306E\u5148\u982D\u306B\u8868\u793A\u3057\u307E\u3059\u3002",
  headSpecial: "\u7279\u5225\u306A\u9805\u76EE",
  setShowBookmarks: "\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF\u3092\u8868\u793A",
  setShowBookmarksDesc: "\u300C\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF\u300D\u306E\u884C\u3092\u8868\u793A\u3057\u307E\u3059\uFF08\u30B3\u30A2\u306E\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF\u30D7\u30E9\u30B0\u30A4\u30F3\u304C\u5FC5\u8981\uFF09\u3002",
  setShowCalendar: "\u30AB\u30EC\u30F3\u30C0\u30FC\u3092\u8868\u793A",
  setShowCalendarDesc: "\u300C\u30AB\u30EC\u30F3\u30C0\u30FC\u300D\u306E\u884C\u3092\u8868\u793A\u3057\u307E\u3059: \u4F5C\u6210\u65E5\u3054\u3068\u306E\u30CE\u30FC\u30C8\u3002",
  setSpecialPos: "\u7279\u5225\u306A\u9805\u76EE\u306E\u4F4D\u7F6E",
  setSpecialPosDesc: "\u7279\u5225\u306A\u884C\u3092\u6700\u521D\u306E\u30AB\u30E9\u30E0\u306E\u3069\u3053\u306B\u7F6E\u304F\u304B\u3002",
  posTop: "\u4E0A",
  posBottom: "\u4E0B",
  today: "\u4ECA\u65E5",
  navBack: "\u623B\u308B",
  navForward: "\u9032\u3080",
  navUp: "\u89AA\u30D5\u30A9\u30EB\u30C0\u3078\u79FB\u52D5",
  create: "\u4F5C\u6210",
  more: "\u305D\u306E\u4ED6\u306E\u64CD\u4F5C",
  preview: "\u30D7\u30EC\u30D3\u30E5\u30FC",
  close: "\u9589\u3058\u308B",
  selectedN: "{n} \u4EF6\u3092\u9078\u629E\u4E2D",
  cancelSelection: "\u9078\u629E\u3092\u89E3\u9664",
  headMobile: "\u30E2\u30D0\u30A4\u30EB UI",
  setMobileScale: "\u30E2\u30D0\u30A4\u30EB UI \u306E\u62E1\u5927\u7387",
  setMobileScaleDesc: "\u30B9\u30DE\u30FC\u30C8\u30D5\u30A9\u30F3\u3084\u30BF\u30D6\u30EC\u30C3\u30C8\u3067\u306E\u884C\u3001\u30B3\u30F3\u30C8\u30ED\u30FC\u30EB\u3001\u6587\u5B57\u3001\u4F59\u767D\u306E\u5927\u304D\u3055\u3092\u5909\u66F4\u3057\u307E\u3059\u3002",
  setMobileIcon: "\u30E2\u30D0\u30A4\u30EB\u306E\u30A2\u30A4\u30B3\u30F3\u30B5\u30A4\u30BA",
  setMobileIconDesc: "\u30C4\u30FC\u30EB\u30D0\u30FC\u3001\u30CA\u30D3\u30B2\u30FC\u30B7\u30E7\u30F3\u3001\u30A2\u30AF\u30B7\u30E7\u30F3\u30D0\u30FC\u306E\u30A2\u30A4\u30B3\u30F3\u3092\u5909\u66F4\u3057\u307E\u3059\u3002\u30D5\u30A1\u30A4\u30EB\u3068\u30D5\u30A9\u30EB\u30C0\u306E\u30A2\u30A4\u30B3\u30F3\u306F\u5909\u308F\u308A\u307E\u305B\u3093\u3002",
  resetMobileSizes: "\u30E2\u30D0\u30A4\u30EB\u306E\u30B5\u30A4\u30BA\u3092\u30EA\u30BB\u30C3\u30C8",
  mobileSizesReset: "\u30E2\u30D0\u30A4\u30EB\u306E\u30B5\u30A4\u30BA\u3092\u30EA\u30BB\u30C3\u30C8\u3057\u307E\u3057\u305F",
  diskUsage: "\u30C7\u30A3\u30B9\u30AF\u4F7F\u7528\u91CF",
  duSize: "\u30B5\u30A4\u30BA",
  duWords: "\u6587\u5B57\u6570",
  duFiles: "\u30D5\u30A1\u30A4\u30EB",
  duRescan: "\u518D\u30B9\u30AD\u30E3\u30F3",
  duZoomIn: "\u62E1\u5927",
  duReveal: "\u30AB\u30E9\u30E0\u3067\u8868\u793A",
  duEmpty: "\u4FDD\u7BA1\u5EAB\u306F\u7A7A\u3067\u3059",
  duNoWords: "\u4FDD\u7BA1\u5EAB\u306B\u6587\u5B57\u304C\u3042\u308A\u307E\u305B\u3093",
  duWordCount_one: "{n} \u6587\u5B57",
  duWordCount_few: "{n} \u6587\u5B57",
  duWordCount_many: "{n} \u6587\u5B57",
  duWordCount_other: "{n} \u6587\u5B57",
  duFileCount_one: "{n} \u30D5\u30A1\u30A4\u30EB",
  duFileCount_few: "{n} \u30D5\u30A1\u30A4\u30EB",
  duFileCount_many: "{n} \u30D5\u30A1\u30A4\u30EB",
  duFileCount_other: "{n} \u30D5\u30A1\u30A4\u30EB",
  duSmallItem_one: "{n} \u4EF6\u306E\u5C0F\u3055\u3044\u9805\u76EE",
  duSmallItem_few: "{n} \u4EF6\u306E\u5C0F\u3055\u3044\u9805\u76EE",
  duSmallItem_many: "{n} \u4EF6\u306E\u5C0F\u3055\u3044\u9805\u76EE",
  duSmallItem_other: "{n} \u4EF6\u306E\u5C0F\u3055\u3044\u9805\u76EE",
  setShowStorage: "\u30C7\u30A3\u30B9\u30AF\u4F7F\u7528\u91CF\u3092\u8868\u793A",
  setShowStorageDesc: "\u300C\u30C7\u30A3\u30B9\u30AF\u4F7F\u7528\u91CF\u300D\u306E\u884C\u3092\u8868\u793A\u3057\u307E\u3059\u3002\u30D5\u30A9\u30EB\u30C0\u306E\u30B5\u30A4\u30BA\u3001\u6587\u5B57\u6570\u3001\u30D5\u30A1\u30A4\u30EB\u6570\u3092\u30B5\u30F3\u30D0\u30FC\u30B9\u30C8\u30C1\u30E3\u30FC\u30C8\u3067\u793A\u3057\u307E\u3059\u3002",
  setStorageExclude: "\u30C7\u30A3\u30B9\u30AF\u4F7F\u7528\u91CF\uFF1A\u9664\u5916\u30D5\u30A9\u30EB\u30C0",
  setStorageExcludeDesc: "\u30AB\u30F3\u30DE\u533A\u5207\u308A\u306E\u4FDD\u7BA1\u5EAB\u30D1\u30B9\u3002\u30B9\u30AD\u30E3\u30F3\u6642\u306B\u30B9\u30AD\u30C3\u30D7\u3055\u308C\u307E\u3059\uFF08\u4F8B\uFF1Aattachments, archive/old\uFF09\u3002",
  setStorageRings: "\u30C7\u30A3\u30B9\u30AF\u4F7F\u7528\u91CF\uFF1A\u30EA\u30F3\u30B0\u6570",
  setStorageRingsDesc: "\u30C1\u30E3\u30FC\u30C8\u304C\u540C\u6642\u306B\u8868\u793A\u3059\u308B\u30CD\u30B9\u30C8\u306E\u6DF1\u3055\u3002",
  setShowUnread: "\u672A\u8AAD\u30DE\u30FC\u30AB\u30FC\u3092\u8868\u793A",
  setShowUnreadDesc: "\u4E00\u5EA6\u3082\u958B\u3044\u3066\u3044\u306A\u3044\u30D5\u30A1\u30A4\u30EB\u306B\u30D0\u30C3\u30B8\u3092\u3001\u524D\u56DE\u958B\u3044\u3066\u304B\u3089\u5909\u66F4\u3055\u308C\u305F\u30D5\u30A1\u30A4\u30EB\u306B\u30C9\u30C3\u30C8\u3092\u4ED8\u3051\u307E\u3059\u3002",
  unreadNew: "\u65B0\u898F",
  unreadModifiedTooltip: "\u524D\u56DE\u958B\u3044\u3066\u304B\u3089\u5909\u66F4\u3055\u308C\u307E\u3057\u305F"
};

// src/locales/ko.ts
var ko = {
  lockColumnWidths: "\uC5F4 \uB108\uBE44 \uACE0\uC815",
  lockColumnWidthsDesc: "\uD30C\uC77C \uC804\uD658 \uC2DC \uD328\uB110 \uB108\uBE44\uAC00 \uC790\uB3D9\uC73C\uB85C \uBC14\uB00C\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC5F4 \uB108\uBE44\uB294 \uC218\uB3D9\uC73C\uB85C \uC870\uC808\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uD328\uB110 \uC790\uB3D9 \uD06C\uAE30 \uC870\uC815\uC744 \uD5C8\uC6A9\uD558\uB824\uBA74 \uB044\uC138\uC694.",
  newNote: "\uC0C8 \uB178\uD2B8",
  newFolder: "\uC0C8 \uD3F4\uB354",
  reveal: "\uD604\uC7AC \uD30C\uC77C \uD45C\uC2DC",
  collapse: "\uB8E8\uD2B8\uAE4C\uC9C0 \uC811\uAE30",
  search: "\uD30C\uC77C \uD544\uD130\u2026",
  sort: "\uC815\uB82C \uBC29\uC2DD",
  empty: "\uBE44\uC5B4 \uC788\uC74C",
  noResults: "\uC77C\uCE58\uD558\uB294 \uD56D\uBAA9 \uC5C6\uC74C",
  open: "\uC5F4\uAE30",
  openNewTab: "\uC0C8 \uD0ED\uC5D0\uC11C \uC5F4\uAE30",
  openRight: "\uC624\uB978\uCABD\uC5D0\uC11C \uC5F4\uAE30",
  duplicate: "\uBCF5\uC81C",
  rename: "\uC774\uB984 \uBC14\uAFB8\uAE30",
  delete: "\uC0AD\uC81C",
  copy: "\uBCF5\uC0AC",
  cut: "\uC798\uB77C\uB0B4\uAE30",
  paste: "\uBD99\uC5EC\uB123\uAE30",
  itemsPasted: "{n}\uAC1C \uD56D\uBAA9\uC744 \uBD99\uC5EC\uB123\uC5C8\uC2B5\uB2C8\uB2E4",
  deleteN: "{n}\uAC1C \uD56D\uBAA9 \uC0AD\uC81C",
  duplicateN: "{n}\uAC1C \uD56D\uBAA9 \uBCF5\uC81C",
  moveTo: "\uD3F4\uB354\uB85C \uC774\uB3D9\u2026",
  moveToPlaceholder: "\uB300\uC0C1 \uD3F4\uB354 \uC120\uD0DD\u2026",
  copyPath: "\uACBD\uB85C \uBCF5\uC0AC",
  copyFullPath: "\uC804\uCCB4 \uACBD\uB85C \uBCF5\uC0AC",
  pathCopied: "\uACBD\uB85C\uB97C \uBCF5\uC0AC\uD588\uC2B5\uB2C8\uB2E4",
  copyFailed: "\uD074\uB9BD\uBCF4\uB4DC\uC5D0 \uBCF5\uC0AC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4",
  untitled: "\uC81C\uBAA9 \uC5C6\uC74C",
  newFolderName: "\uC0C8 \uD3F4\uB354",
  cantMoveIntoSelf: "\uD3F4\uB354\uB97C \uC790\uAE30 \uC790\uC2E0 \uC548\uC73C\uB85C \uC62E\uAE38 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4",
  alreadyExists: "\uB300\uC0C1 \uD3F4\uB354\uC5D0 \u201C{name}\u201D\uC774(\uAC00) \uC774\uBBF8 \uC788\uC2B5\uB2C8\uB2E4",
  renameFailed: "\uC774\uB984 \uBC14\uAFB8\uAE30\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4: ",
  createFailed: "\u201C{name}\u201D\uC744(\uB97C) \uB9CC\uB4E4 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4: {error}",
  moveFailed: "\u201C{name}\u201D\uC744(\uB97C) \uC62E\uAE38 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4: {error}",
  duplicateFailed: "\u201C{name}\u201D\uC744(\uB97C) \uBCF5\uC81C\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4: {error}",
  deleteFailed: "\u201C{name}\u201D\uC744(\uB97C) \uC0AD\uC81C\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4: {error}",
  modified: "\uC218\uC815\uD55C \uB0A0\uC9DC",
  created: "\uB9CC\uB4E0 \uB0A0\uC9DC",
  sortNameAsc: "\uC774\uB984 (A \u2192 Z)",
  sortNameDesc: "\uC774\uB984 (Z \u2192 A)",
  sortMtimeDesc: "\uC218\uC815\uD55C \uB0A0\uC9DC (\uCD5C\uC2E0 \uC21C)",
  sortMtimeAsc: "\uC218\uC815\uD55C \uB0A0\uC9DC (\uC624\uB798\uB41C \uC21C)",
  sortCtimeDesc: "\uB9CC\uB4E0 \uB0A0\uC9DC (\uCD5C\uC2E0 \uC21C)",
  sortCtimeAsc: "\uB9CC\uB4E0 \uB0A0\uC9DC (\uC624\uB798\uB41C \uC21C)",
  sortSizeDesc: "\uD06C\uAE30 (\uD070 \uC21C)",
  sortSizeAsc: "\uD06C\uAE30 (\uC791\uC740 \uC21C)",
  confirmDeleteTitle: "\uC0AD\uC81C",
  confirmDeleteOne: "\u201C{name}\u201D\uC744(\uB97C) \uC0AD\uC81C\uD560\uAE4C\uC694?",
  confirmDeleteMany: "{n}\uAC1C \uD56D\uBAA9\uC744 \uC0AD\uC81C\uD560\uAE4C\uC694?",
  confirm: "\uC0AD\uC81C",
  cancel: "\uCDE8\uC18C",
  itemsMoved: "{n}\uAC1C \uD56D\uBAA9\uC744 \uC62E\uACBC\uC2B5\uB2C8\uB2E4",
  undo: "\uC2E4\uD589 \uCDE8\uC18C",
  filesImported: "{n}\uAC1C \uD30C\uC77C\uC744 \uAC00\uC838\uC654\uC2B5\uB2C8\uB2E4",
  importFailed: "\u201C{name}\u201D\uC744(\uB97C) \uAC00\uC838\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4",
  cmdOpen: "\uCE7C\uB7FC \uD0D0\uC0C9\uAE30 \uC5F4\uAE30",
  cmdReveal: "\uD604\uC7AC \uD30C\uC77C\uC744 \uCE7C\uB7FC\uC5D0\uC11C \uD45C\uC2DC",
  cmdNewNote: "\uD604\uC7AC \uD3F4\uB354\uC5D0 \uC0C8 \uB178\uD2B8",
  cmdNewFolder: "\uD604\uC7AC \uD3F4\uB354\uC5D0 \uC0C8 \uD3F4\uB354",
  cmdFocus: "\uCE7C\uB7FC \uD0D0\uC0C9\uAE30\uC5D0 \uD3EC\uCEE4\uC2A4",
  setFoldersFirst: "\uD3F4\uB354 \uBA3C\uC800",
  setFoldersFirstDesc: "\uD56D\uC0C1 \uD3F4\uB354\uB97C \uD30C\uC77C\uBCF4\uB2E4 \uC704\uC5D0 \uD45C\uC2DC\uD569\uB2C8\uB2E4.",
  setShowExt: "\uD655\uC7A5\uC790 \uD45C\uC2DC",
  setShowExtDesc: "\uB9C8\uD06C\uB2E4\uC6B4\uC774 \uC544\uB2CC \uD30C\uC77C\uC5D0 \uD655\uC7A5\uC790\uB97C \uB098\uD0C0\uB0B4\uB294 \uC791\uC740 \uBC30\uC9C0\uB97C \uD45C\uC2DC\uD569\uB2C8\uB2E4.",
  setPreview: "\uBBF8\uB9AC\uBCF4\uAE30 \uCE7C\uB7FC \uD45C\uC2DC",
  setPreviewDesc: "\uD30C\uC77C\uC744 \uC120\uD0DD\uD558\uBA74 \uC138\uBD80 \uC815\uBCF4 \uCE7C\uB7FC\uC744 \uD45C\uC2DC\uD569\uB2C8\uB2E4.",
  setMdPreview: "\uB178\uD2B8 \uB0B4\uC6A9 \uBBF8\uB9AC\uBCF4\uAE30",
  setMdPreviewDesc: "\uBBF8\uB9AC\uBCF4\uAE30 \uCE7C\uB7FC\uC5D0 \uB9C8\uD06C\uB2E4\uC6B4 \uB178\uD2B8\uC758 \uC55E\uBD80\uBD84\uC744 \uD45C\uC2DC\uD569\uB2C8\uB2E4.",
  setConfirmDelete: "\uC0AD\uC81C \uC804 \uD655\uC778",
  setConfirmDeleteDesc: "\uD30C\uC77C\uC744 \uD734\uC9C0\uD1B5\uC73C\uB85C \uC62E\uAE30\uAE30 \uC804\uC5D0 \uD655\uC778\uC744 \uC694\uCCAD\uD569\uB2C8\uB2E4.",
  setColWidth: "\uAE30\uBCF8 \uCE7C\uB7FC \uB108\uBE44",
  setColWidthDesc: "\uD53D\uC140 \uB2E8\uC704. \uCE7C\uB7FC\uC758 \uC624\uB978\uCABD \uAC00\uC7A5\uC790\uB9AC\uB97C \uB04C\uC5B4 \uB108\uBE44\uB97C \uC870\uC808\uD558\uACE0, \uAC00\uC7A5\uC790\uB9AC\uB97C \uB450 \uBC88 \uD074\uB9AD\uD558\uBA74 \uCD08\uAE30\uD654\uB429\uB2C8\uB2E4.",
  setAutoPanel: "\uD328\uB110 \uB108\uBE44 \uC790\uB3D9 \uC870\uC808",
  setAutoPanelDesc: "\uCE7C\uB7FC \uB108\uBE44\uB294 \uADF8\uB300\uB85C \uB450\uACE0, \uC5F4\uB9B0 \uCE7C\uB7FC\uC774 \uBAA8\uB450 \uB4E4\uC5B4\uAC00\uB3C4\uB85D \uC0AC\uC774\uB4DC \uD328\uB110\uC744 \uB298\uC774\uACE0 \uC904\uC785\uB2C8\uB2E4.",
  setSort: "\uAE30\uBCF8 \uC815\uB82C \uBC29\uC2DD",
  setOpenLocation: "\uC5EC\uB294 \uC704\uCE58",
  setOpenLocationDesc: "\uC5F4\uAE30 \uBA85\uB839\uACFC \uB9AC\uBCF8 \uC544\uC774\uCF58\uC774 \uBDF0\uB97C \uBC30\uCE58\uD558\uB294 \uC704\uCE58\uC785\uB2C8\uB2E4. \uC774\uBBF8 \uC5F4\uB824 \uC788\uB294 \uBDF0\uB294 \uADF8\uB300\uB85C \uC720\uC9C0\uB429\uB2C8\uB2E4.",
  locSidebar: "\uC67C\uCABD \uC0AC\uC774\uB4DC\uBC14",
  locTab: "\uAE30\uBCF8 \uC601\uC5ED\uC758 \uD0ED",
  setAutoReveal: "\uD604\uC7AC \uD30C\uC77C \uB530\uB77C\uAC00\uAE30",
  setAutoRevealDesc: "\uD3B8\uC9D1\uAE30\uC758 \uD604\uC7AC \uD0ED\uC744 \uB530\uB77C\uAC00\uBA70 \uD574\uB2F9 \uD30C\uC77C\uC744 \uCE7C\uB7FC\uC5D0\uC11C \uC120\uD0DD\uD569\uB2C8\uB2E4.",
  setExclude: "\uC81C\uC678\uD560 \uD30C\uC77C",
  setExcludeDesc: "\uC27C\uD45C\uB85C \uAD6C\uBD84\uD55C \uD328\uD134. \uC608: \u201C*.tmp, archive/, .trash\u201D",
  folderColor: "\uD3F4\uB354 \uC0C9\uC0C1",
  colorDefault: "\uAE30\uBCF8\uAC12",
  colorRed: "\uBE68\uAC15",
  colorOrange: "\uC8FC\uD669",
  colorYellow: "\uB178\uB791",
  colorGreen: "\uCD08\uB85D",
  colorCyan: "\uCCAD\uB85D",
  colorBlue: "\uD30C\uB791",
  colorPurple: "\uBCF4\uB77C",
  colorPink: "\uBD84\uD64D",
  viewAsList: "\uBAA9\uB85D\uC73C\uB85C \uBCF4\uAE30",
  viewAsGrid: "\uC544\uC774\uCF58\uC73C\uB85C \uBCF4\uAE30",
  pin: "\uB9E8 \uC704\uC5D0 \uACE0\uC815",
  unpin: "\uACE0\uC815 \uD574\uC81C",
  newCanvas: "\uC0C8 \uCE94\uBC84\uC2A4",
  copyWikiLink: "\uC704\uD0A4 \uB9C1\uD06C \uBCF5\uC0AC",
  copyMdLink: "\uB9C8\uD06C\uB2E4\uC6B4 \uB9C1\uD06C \uBCF5\uC0AC",
  copyObsidianUrl: "Obsidian URL \uBCF5\uC0AC",
  linkCopied: "\uB9C1\uD06C\uB97C \uBCF5\uC0AC\uD588\uC2B5\uB2C8\uB2E4",
  sortDefault: "\uAE30\uBCF8 \uC815\uB82C",
  folderIcon: "\uD3F4\uB354 \uC544\uC774\uCF58\u2026",
  folderIconReset: "\uD3F4\uB354 \uC544\uC774\uCF58 \uCD08\uAE30\uD654",
  iconPlaceholder: "\uC544\uC774\uCF58 \uC120\uD0DD\u2026",
  setFolderNote: "\uD3F4\uB354 \uB178\uD2B8 \uC5F4\uAE30",
  setFolderNoteDesc: "\uD3F4\uB354\uB97C \uC120\uD0DD\uD560 \uB54C \uADF8 \uC548\uC5D0 \uAC19\uC740 \uC774\uB984\uC758 \uB178\uD2B8\uAC00 \uC788\uC73C\uBA74 \uD568\uAED8 \uC5FD\uB2C8\uB2E4.",
  lockPanel: "\uCE7C\uB7FC \uAC1C\uC218 \uACE0\uC815",
  unlockPanel: "\uCE7C\uB7FC \uACE0\uC815 \uD574\uC81C",
  recents: "\uCD5C\uADFC \uD30C\uC77C",
  setRecentCount: "\uCD5C\uADFC \uD30C\uC77C \uAC1C\uC218",
  setRecentCountDesc: "\u201C\uCD5C\uADFC \uD30C\uC77C\u201D \uCE7C\uB7FC\uC5D0 \uD45C\uC2DC\uD560 \uD30C\uC77C \uC218.",
  headAppearance: "\uBAA8\uC591",
  headBehavior: "\uB3D9\uC791",
  headColumns: "\uCE7C\uB7FC",
  setShowRecents: "\uCD5C\uADFC \uD30C\uC77C \uD45C\uC2DC",
  setShowRecentsDesc: "\uCCAB \uBC88\uC9F8 \uCE7C\uB7FC\uC5D0 \u201C\uCD5C\uADFC \uD30C\uC77C\u201D \uC904\uC744 \uD45C\uC2DC\uD569\uB2C8\uB2E4.",
  resetWidths: "\uBAA8\uB4E0 \uCE7C\uB7FC \uB108\uBE44 \uCD08\uAE30\uD654",
  resetWidthsDesc: "\uAC1C\uBCC4\uC801\uC73C\uB85C \uC870\uC808\uD55C \uB108\uBE44\uB97C \uC9C0\uC6B0\uACE0 \uC5B4\uB514\uC11C\uB098 \uAE30\uBCF8 \uB108\uBE44\uB97C \uC0AC\uC6A9\uD569\uB2C8\uB2E4.",
  widthsReset: "\uCE7C\uB7FC \uB108\uBE44\uB97C \uCD08\uAE30\uD654\uD588\uC2B5\uB2C8\uB2E4",
  reset: "\uCD08\uAE30\uD654",
  clearRecents: "\uCD5C\uADFC \uD30C\uC77C \uBE44\uC6B0\uAE30",
  clearRecentsDesc: "\uCD5C\uADFC \uD30C\uC77C \uBAA9\uB85D\uC758 \uBAA8\uB4E0 \uD56D\uBAA9\uC744 \uC9C0\uC6C1\uB2C8\uB2E4.",
  recentsCleared: "\uCD5C\uADFC \uD30C\uC77C \uBAA9\uB85D\uC744 \uBE44\uC6E0\uC2B5\uB2C8\uB2E4",
  clear: "\uBE44\uC6B0\uAE30",
  bookmarks: "\uBD81\uB9C8\uD06C",
  calendar: "\uB2EC\uB825",
  favorites: "\uC990\uACA8\uCC3E\uAE30",
  addFavorite: "\uC990\uACA8\uCC3E\uAE30\uC5D0 \uCD94\uAC00",
  removeFavorite: "\uC990\uACA8\uCC3E\uAE30\uC5D0\uC11C \uC81C\uAC70",
  favoriteAdded: "\uACBD\uB85C\uB97C \uC990\uACA8\uCC3E\uAE30\uC5D0 \uCD94\uAC00\uD588\uC2B5\uB2C8\uB2E4",
  favoriteRemoved: "\uC990\uACA8\uCC3E\uAE30\uC5D0\uC11C \uC81C\uAC70\uD588\uC2B5\uB2C8\uB2E4",
  setShowFavorites: "\uC990\uACA8\uCC3E\uAE30 \uD45C\uC2DC",
  setShowFavoritesDesc: "\uC800\uC7A5\uD55C \uC990\uACA8\uCC3E\uAE30 \uD30C\uC77C\uACFC \uD3F4\uB354\uB97C \u201C\uBD81\uB9C8\uD06C\u201D \uCE7C\uB7FC \uB9E8 \uC704\uC5D0 \uD45C\uC2DC\uD569\uB2C8\uB2E4.",
  headSpecial: "\uD2B9\uBCC4 \uD56D\uBAA9",
  setShowBookmarks: "\uBD81\uB9C8\uD06C \uD45C\uC2DC",
  setShowBookmarksDesc: "\u201C\uBD81\uB9C8\uD06C\u201D \uC904\uC744 \uD45C\uC2DC\uD569\uB2C8\uB2E4 (\uCF54\uC5B4 \uBD81\uB9C8\uD06C \uD50C\uB7EC\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4).",
  setShowCalendar: "\uB2EC\uB825 \uD45C\uC2DC",
  setShowCalendarDesc: "\u201C\uB2EC\uB825\u201D \uC904\uC744 \uD45C\uC2DC\uD569\uB2C8\uB2E4: \uB9CC\uB4E0 \uB0A0\uC9DC\uBCC4 \uB178\uD2B8.",
  setSpecialPos: "\uD2B9\uBCC4 \uD56D\uBAA9\uC758 \uC704\uCE58",
  setSpecialPosDesc: "\uD2B9\uC218 \uD589\uC774 \uCCAB \uBC88\uC9F8 \uC5F4\uC5D0\uC11C \uB193\uC774\uB294 \uC704\uCE58.",
  posTop: "\uC704",
  posBottom: "\uC544\uB798",
  today: "\uC624\uB298",
  navBack: "\uB4A4\uB85C",
  navForward: "\uC55E\uC73C\uB85C",
  navUp: "\uC0C1\uC704 \uD3F4\uB354\uB85C \uC774\uB3D9",
  create: "\uB9CC\uB4E4\uAE30",
  more: "\uB2E4\uB978 \uC791\uC5C5",
  preview: "\uBBF8\uB9AC\uBCF4\uAE30",
  close: "\uB2EB\uAE30",
  selectedN: "{n}\uAC1C \uC120\uD0DD\uB428",
  cancelSelection: "\uC120\uD0DD \uD574\uC81C",
  headMobile: "\uBAA8\uBC14\uC77C \uC778\uD130\uD398\uC774\uC2A4",
  setMobileScale: "\uBAA8\uBC14\uC77C \uC778\uD130\uD398\uC774\uC2A4 \uBC30\uC728",
  setMobileScaleDesc: "\uD734\uB300\uD3F0\uACFC \uD0DC\uBE14\uB9BF\uC5D0\uC11C \uC904, \uCEE8\uD2B8\uB864, \uAE00\uC790, \uC5EC\uBC31\uC758 \uD06C\uAE30\uB97C \uBC14\uAFC9\uB2C8\uB2E4.",
  setMobileIcon: "\uBAA8\uBC14\uC77C \uC544\uC774\uCF58 \uD06C\uAE30",
  setMobileIconDesc: "\uB3C4\uAD6C \uBAA8\uC74C, \uD0D0\uC0C9, \uC791\uC5C5 \uBC14\uC758 \uC544\uC774\uCF58\uC744 \uBC14\uAFC9\uB2C8\uB2E4. \uD30C\uC77C\uACFC \uD3F4\uB354 \uC544\uC774\uCF58\uC740 \uBC14\uB00C\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.",
  resetMobileSizes: "\uBAA8\uBC14\uC77C \uD06C\uAE30 \uCD08\uAE30\uD654",
  mobileSizesReset: "\uBAA8\uBC14\uC77C \uD06C\uAE30\uB97C \uCD08\uAE30\uD654\uD588\uC2B5\uB2C8\uB2E4",
  diskUsage: "\uB514\uC2A4\uD06C \uC0AC\uC6A9\uB7C9",
  duSize: "\uD06C\uAE30",
  duWords: "\uB2E8\uC5B4",
  duFiles: "\uD30C\uC77C",
  duRescan: "\uB2E4\uC2DC \uAC80\uC0AC",
  duZoomIn: "\uD655\uB300",
  duReveal: "\uC5F4\uC5D0\uC11C \uD45C\uC2DC",
  duEmpty: "\uBCF4\uAD00\uD568\uC774 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4",
  duNoWords: "\uBCF4\uAD00\uD568\uC5D0 \uB2E8\uC5B4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4",
  duWordCount_one: "{n} \uB2E8\uC5B4",
  duWordCount_few: "{n} \uB2E8\uC5B4",
  duWordCount_many: "{n} \uB2E8\uC5B4",
  duWordCount_other: "{n} \uB2E8\uC5B4",
  duFileCount_one: "{n} \uD30C\uC77C",
  duFileCount_few: "{n} \uD30C\uC77C",
  duFileCount_many: "{n} \uD30C\uC77C",
  duFileCount_other: "{n} \uD30C\uC77C",
  duSmallItem_one: "{n} \uAC1C\uC758 \uC791\uC740 \uD56D\uBAA9",
  duSmallItem_few: "{n} \uAC1C\uC758 \uC791\uC740 \uD56D\uBAA9",
  duSmallItem_many: "{n} \uAC1C\uC758 \uC791\uC740 \uD56D\uBAA9",
  duSmallItem_other: "{n} \uAC1C\uC758 \uC791\uC740 \uD56D\uBAA9",
  setShowStorage: "\uB514\uC2A4\uD06C \uC0AC\uC6A9\uB7C9 \uD45C\uC2DC",
  setShowStorageDesc: "\xAB\uB514\uC2A4\uD06C \uC0AC\uC6A9\uB7C9\xBB \uD589\uC744 \uD45C\uC2DC\uD569\uB2C8\uB2E4. \uD3F4\uB354 \uD06C\uAE30, \uB2E8\uC5B4 \uC218, \uD30C\uC77C \uC218\uB97C \uC120\uBC84\uC2A4\uD2B8 \uCC28\uD2B8\uB85C \uBCF4\uC5EC\uC90D\uB2C8\uB2E4.",
  setStorageExclude: "\uB514\uC2A4\uD06C \uC0AC\uC6A9\uB7C9: \uC81C\uC678\uB41C \uD3F4\uB354",
  setStorageExcludeDesc: "\uC27C\uD45C\uB85C \uAD6C\uBD84\uB41C \uBCF4\uAD00\uD568 \uACBD\uB85C. \uAC80\uC0AC \uC2DC \uAC74\uB108\uB701\uB2C8\uB2E4. \uC608: \xABattachments, archive/old\xBB.",
  setStorageRings: "\uB514\uC2A4\uD06C \uC0AC\uC6A9\uB7C9: \uB9C1 \uAC1C\uC218",
  setStorageRingsDesc: "\uCC28\uD2B8\uAC00 \uD55C \uBC88\uC5D0 \uD45C\uC2DC\uD558\uB294 \uC911\uCCA9 \uC218\uC900\uC758 \uC218.",
  setShowUnread: "\uC77D\uC9C0 \uC54A\uC74C \uD45C\uC2DC \uBCF4\uAE30",
  setShowUnreadDesc: "\uD55C \uBC88\uB3C4 \uC5F4\uC9C0 \uC54A\uC740 \uD30C\uC77C\uC5D0 \uBC30\uC9C0\uB97C, \uB9C8\uC9C0\uB9C9\uC73C\uB85C \uC5F0 \uC774\uD6C4 \uBCC0\uACBD\uB41C \uD30C\uC77C\uC5D0 \uC810\uC744 \uD45C\uC2DC\uD569\uB2C8\uB2E4.",
  unreadNew: "\uC2E0\uADDC",
  unreadModifiedTooltip: "\uB9C8\uC9C0\uB9C9\uC73C\uB85C \uC5F0 \uC774\uD6C4 \uBCC0\uACBD\uB428"
};

// src/i18n.ts
var LOCALES = {
  en,
  ru,
  es,
  fr,
  it,
  de,
  zh,
  ja,
  ko,
  "pt-BR": ptBR
};
function t(key, vars) {
  var _a, _b, _c;
  const strings = (_a = LOCALES[(0, import_obsidian.getLanguage)()]) != null ? _a : en;
  const s = (_c = (_b = strings[key]) != null ? _b : en[key]) != null ? _c : key;
  return vars ? formatTemplate(s, vars) : s;
}
function tPlural(base, n) {
  const lang = localeCode();
  const key = `${base}_${new Intl.PluralRules(lang).select(n)}`;
  const known = key in en ? key : `${base}_other`;
  return t(known, { n: n.toLocaleString(lang) });
}
function localeCode() {
  const lang = (0, import_obsidian.getLanguage)();
  try {
    new Intl.PluralRules(lang);
    return lang;
  } catch (e) {
    return "en";
  }
}

// src/settings.ts
var import_obsidian2 = require("obsidian");
var TEXT_INPUT_SAVE_DELAY_MS = 500;
var DEFAULT_SETTINGS = {
  foldersFirst: true,
  showExtensions: true,
  showPreview: false,
  showMarkdownPreview: true,
  confirmDelete: true,
  autoReveal: false,
  columnWidth: DEFAULT_COLUMN_WIDTH,
  columnWidths: {},
  autoPanelResize: true,
  lockColumnWidths: true,
  sortMode: "name-asc",
  excludePatterns: "",
  folderColors: {},
  columnViewModes: {},
  pinnedPaths: {},
  columnSortModes: {},
  folderIcons: {},
  openFolderNote: false,
  lockedColumnCount: null,
  recentFilesCount: DEFAULT_RECENT_FILES,
  recentFiles: [],
  showRecents: true,
  showBookmarks: true,
  showCalendar: true,
  showStorage: true,
  storageExcluded: "",
  storageRingCount: DEFAULT_STORAGE_RINGS,
  specialItemsPosition: "top",
  openLocation: "sidebar",
  favorites: [],
  showFavorites: true,
  mobileUiScale: DEFAULT_MOBILE_SCALE,
  mobileIconSize: DEFAULT_MOBILE_ICON,
  showUnreadMarkers: true,
  seenAt: {},
  unreadBaseline: 0
};
var ColumnExplorerSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  /**
   * Declarative settings (Obsidian 1.13+): powers the settings search.
   * Older versions fall back to display() below.
   */
  getSettingDefinitions() {
    return [
      {
        type: "group",
        heading: t("headAppearance"),
        items: [
          { name: t("setFoldersFirst"), desc: t("setFoldersFirstDesc"), control: { type: "toggle", key: "foldersFirst" } },
          { name: t("setShowExt"), desc: t("setShowExtDesc"), control: { type: "toggle", key: "showExtensions" } },
          { name: t("setPreview"), desc: t("setPreviewDesc"), control: { type: "toggle", key: "showPreview" } },
          { name: t("setMdPreview"), desc: t("setMdPreviewDesc"), control: { type: "toggle", key: "showMarkdownPreview" } },
          { name: t("setShowUnread"), desc: t("setShowUnreadDesc"), control: { type: "toggle", key: "showUnreadMarkers" } }
        ]
      },
      {
        type: "group",
        heading: t("headBehavior"),
        items: [
          {
            name: t("setOpenLocation"),
            desc: t("setOpenLocationDesc"),
            control: { type: "dropdown", key: "openLocation", options: { sidebar: t("locSidebar"), tab: t("locTab") } }
          },
          {
            name: t("setSort"),
            control: {
              type: "dropdown",
              key: "sortMode",
              options: {
                "name-asc": t("sortNameAsc"),
                "name-desc": t("sortNameDesc"),
                "mtime-desc": t("sortMtimeDesc"),
                "mtime-asc": t("sortMtimeAsc"),
                "ctime-desc": t("sortCtimeDesc"),
                "ctime-asc": t("sortCtimeAsc"),
                "size-desc": t("sortSizeDesc"),
                "size-asc": t("sortSizeAsc")
              }
            }
          },
          { name: t("setAutoReveal"), desc: t("setAutoRevealDesc"), control: { type: "toggle", key: "autoReveal" } },
          { name: t("setFolderNote"), desc: t("setFolderNoteDesc"), control: { type: "toggle", key: "openFolderNote" } },
          { name: t("setConfirmDelete"), desc: t("setConfirmDeleteDesc"), control: { type: "toggle", key: "confirmDelete" } },
          { name: t("setExclude"), desc: t("setExcludeDesc"), control: { type: "text", key: "excludePatterns" } }
        ]
      },
      {
        type: "group",
        heading: t("headColumns"),
        items: [
          { name: t("lockColumnWidths"), desc: t("lockColumnWidthsDesc"), control: { type: "toggle", key: "lockColumnWidths" } },
          { name: t("setAutoPanel"), desc: t("setAutoPanelDesc"), control: { type: "toggle", key: "autoPanelResize" } },
          {
            name: t("setColWidth"),
            desc: t("setColWidthDesc"),
            control: { type: "slider", key: "columnWidth", min: MIN_COLUMN_WIDTH, max: MAX_COLUMN_WIDTH, step: 10 }
          },
          { name: t("resetWidths"), desc: t("resetWidthsDesc"), action: () => void this.resetColumnWidths() }
        ]
      },
      {
        type: "group",
        heading: t("headSpecial"),
        items: [
          {
            name: t("setSpecialPos"),
            desc: t("setSpecialPosDesc"),
            control: { type: "dropdown", key: "specialItemsPosition", options: { top: t("posTop"), bottom: t("posBottom") } }
          },
          { name: t("setShowRecents"), desc: t("setShowRecentsDesc"), control: { type: "toggle", key: "showRecents" } },
          {
            name: t("setRecentCount"),
            desc: t("setRecentCountDesc"),
            control: { type: "number", key: "recentFilesCount", min: MIN_RECENT_FILES, max: MAX_RECENT_FILES, step: 1 }
          },
          { name: t("clearRecents"), desc: t("clearRecentsDesc"), action: () => void this.clearRecents() },
          { name: t("setShowFavorites"), desc: t("setShowFavoritesDesc"), control: { type: "toggle", key: "showFavorites" } },
          { name: t("setShowBookmarks"), desc: t("setShowBookmarksDesc"), control: { type: "toggle", key: "showBookmarks" } },
          { name: t("setShowCalendar"), desc: t("setShowCalendarDesc"), control: { type: "toggle", key: "showCalendar" } },
          { name: t("setShowStorage"), desc: t("setShowStorageDesc"), control: { type: "toggle", key: "showStorage" } },
          { name: t("setStorageExclude"), desc: t("setStorageExcludeDesc"), control: { type: "text", key: "storageExcluded" } },
          {
            name: t("setStorageRings"),
            desc: t("setStorageRingsDesc"),
            control: { type: "slider", key: "storageRingCount", min: MIN_STORAGE_RINGS, max: MAX_STORAGE_RINGS, step: 1 }
          }
        ]
      },
      {
        type: "group",
        heading: t("headMobile"),
        items: [
          {
            name: t("setMobileScale"),
            desc: t("setMobileScaleDesc"),
            control: { type: "slider", key: "mobileUiScale", min: MIN_MOBILE_SCALE, max: MAX_MOBILE_SCALE, step: 5 }
          },
          {
            name: t("setMobileIcon"),
            desc: t("setMobileIconDesc"),
            control: { type: "slider", key: "mobileIconSize", min: MIN_MOBILE_ICON, max: MAX_MOBILE_ICON, step: 2 }
          },
          { name: t("resetMobileSizes"), action: () => void this.resetMobileSizes() }
        ]
      }
    ];
  }
  async resetColumnWidths() {
    var _a;
    this.plugin.settings.columnWidths = {};
    await this.plugin.saveSettings();
    (_a = this.plugin.getView()) == null ? void 0 : _a.render();
    new import_obsidian2.Notice(t("widthsReset"));
  }
  async clearRecents() {
    var _a;
    this.plugin.settings.recentFiles = [];
    await this.plugin.saveSettings();
    (_a = this.plugin.getView()) == null ? void 0 : _a.render();
    new import_obsidian2.Notice(t("recentsCleared"));
  }
  /** Сброс мобильных размеров к дефолтным, с обновлением открытых слайдеров. */
  async resetMobileSizes() {
    var _a, _b;
    const s = this.plugin.settings;
    s.mobileUiScale = DEFAULT_MOBILE_SCALE;
    s.mobileIconSize = DEFAULT_MOBILE_ICON;
    await this.plugin.saveSettings();
    (_a = this.plugin.getView()) == null ? void 0 : _a.applyMobileScale();
    (_b = this.refreshMobileSliders) == null ? void 0 : _b.call(this);
    new import_obsidian2.Notice(t("mobileSizesReset"));
  }
  /** Self-contained override — avoids calling the 1.13-only base implementation. */
  async setControlValue(key, value) {
    var _a, _b;
    if (key === "mobileUiScale" || key === "mobileIconSize") {
      const s = this.plugin.settings;
      const normalized = normalizeMobileSettings({ ...s, [key]: value });
      s.mobileUiScale = normalized.mobileUiScale;
      s.mobileIconSize = normalized.mobileIconSize;
      await this.plugin.saveSettings();
      (_a = this.plugin.getView()) == null ? void 0 : _a.applyMobileScale();
      return;
    }
    if (key === "recentFilesCount" && typeof value === "number") {
      value = Math.max(MIN_RECENT_FILES, Math.min(MAX_RECENT_FILES, Math.round(value)));
    }
    this.plugin.settings[key] = value;
    await this.plugin.saveSettings();
    (_b = this.plugin.getView()) == null ? void 0 : _b.render();
  }
  /** Закрытие вкладки не должно ждать дебаунса — дописываем сразу. */
  hide() {
    var _a;
    (_a = this.saveTextInput) == null ? void 0 : _a.run();
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    const s = this.plugin.settings;
    const save = async () => {
      var _a;
      await this.plugin.saveSettings();
      (_a = this.plugin.getView()) == null ? void 0 : _a.render();
    };
    const saveTextInput = (0, import_obsidian2.debounce)(() => void save(), TEXT_INPUT_SAVE_DELAY_MS, true);
    this.saveTextInput = saveTextInput;
    new import_obsidian2.Setting(containerEl).setName(t("headAppearance")).setHeading();
    new import_obsidian2.Setting(containerEl).setName(t("setFoldersFirst")).setDesc(t("setFoldersFirstDesc")).addToggle((tg) => tg.setValue(s.foldersFirst).onChange(async (v) => {
      s.foldersFirst = v;
      await save();
    }));
    new import_obsidian2.Setting(containerEl).setName(t("setShowExt")).setDesc(t("setShowExtDesc")).addToggle((tg) => tg.setValue(s.showExtensions).onChange(async (v) => {
      s.showExtensions = v;
      await save();
    }));
    new import_obsidian2.Setting(containerEl).setName(t("setPreview")).setDesc(t("setPreviewDesc")).addToggle((tg) => tg.setValue(s.showPreview).onChange(async (v) => {
      s.showPreview = v;
      await save();
    }));
    new import_obsidian2.Setting(containerEl).setName(t("setMdPreview")).setDesc(t("setMdPreviewDesc")).addToggle((tg) => tg.setValue(s.showMarkdownPreview).onChange(async (v) => {
      s.showMarkdownPreview = v;
      await save();
    }));
    new import_obsidian2.Setting(containerEl).setName(t("setShowUnread")).setDesc(t("setShowUnreadDesc")).addToggle((tg) => tg.setValue(s.showUnreadMarkers).onChange(async (v) => {
      s.showUnreadMarkers = v;
      await save();
    }));
    new import_obsidian2.Setting(containerEl).setName(t("headBehavior")).setHeading();
    new import_obsidian2.Setting(containerEl).setName(t("setOpenLocation")).setDesc(t("setOpenLocationDesc")).addDropdown((d) => d.addOption("sidebar", t("locSidebar")).addOption("tab", t("locTab")).setValue(s.openLocation).onChange(async (v) => {
      s.openLocation = v === "tab" ? "tab" : "sidebar";
      await save();
    }));
    new import_obsidian2.Setting(containerEl).setName(t("setSort")).addDropdown((d) => d.addOption("name-asc", t("sortNameAsc")).addOption("name-desc", t("sortNameDesc")).addOption("mtime-desc", t("sortMtimeDesc")).addOption("mtime-asc", t("sortMtimeAsc")).addOption("ctime-desc", t("sortCtimeDesc")).addOption("ctime-asc", t("sortCtimeAsc")).addOption("size-desc", t("sortSizeDesc")).addOption("size-asc", t("sortSizeAsc")).setValue(s.sortMode).onChange(async (v) => {
      s.sortMode = v;
      await save();
    }));
    new import_obsidian2.Setting(containerEl).setName(t("setAutoReveal")).setDesc(t("setAutoRevealDesc")).addToggle((tg) => tg.setValue(s.autoReveal).onChange(async (v) => {
      s.autoReveal = v;
      await save();
    }));
    new import_obsidian2.Setting(containerEl).setName(t("setFolderNote")).setDesc(t("setFolderNoteDesc")).addToggle((tg) => tg.setValue(s.openFolderNote).onChange(async (v) => {
      s.openFolderNote = v;
      await save();
    }));
    new import_obsidian2.Setting(containerEl).setName(t("setConfirmDelete")).setDesc(t("setConfirmDeleteDesc")).addToggle((tg) => tg.setValue(s.confirmDelete).onChange(async (v) => {
      s.confirmDelete = v;
      await save();
    }));
    new import_obsidian2.Setting(containerEl).setName(t("setExclude")).setDesc(t("setExcludeDesc")).addText((txt) => txt.setValue(s.excludePatterns).onChange((v) => {
      s.excludePatterns = v;
      saveTextInput();
    }));
    new import_obsidian2.Setting(containerEl).setName(t("headColumns")).setHeading();
    new import_obsidian2.Setting(containerEl).setName(t("lockColumnWidths")).setDesc(t("lockColumnWidthsDesc")).addToggle((tg) => tg.setValue(s.lockColumnWidths).onChange(async (v) => {
      s.lockColumnWidths = v;
      await save();
    }));
    new import_obsidian2.Setting(containerEl).setName(t("setAutoPanel")).setDesc(t("setAutoPanelDesc")).addToggle((tg) => tg.setValue(s.autoPanelResize).onChange(async (v) => {
      s.autoPanelResize = v;
      await save();
    }));
    new import_obsidian2.Setting(containerEl).setName(t("setColWidth")).setDesc(t("setColWidthDesc")).addSlider((sl) => sl.setLimits(MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH, 10).setValue(s.columnWidth).onChange(async (v) => {
      s.columnWidth = v;
      await save();
    }));
    new import_obsidian2.Setting(containerEl).setName(t("resetWidths")).setDesc(t("resetWidthsDesc")).addButton((b) => b.setButtonText(t("reset")).onClick(() => void this.resetColumnWidths()));
    new import_obsidian2.Setting(containerEl).setName(t("headSpecial")).setHeading();
    new import_obsidian2.Setting(containerEl).setName(t("setSpecialPos")).setDesc(t("setSpecialPosDesc")).addDropdown((d) => d.addOption("top", t("posTop")).addOption("bottom", t("posBottom")).setValue(s.specialItemsPosition).onChange(async (v) => {
      s.specialItemsPosition = v === "bottom" ? "bottom" : "top";
      await save();
    }));
    new import_obsidian2.Setting(containerEl).setName(t("setShowRecents")).setDesc(t("setShowRecentsDesc")).addToggle((tg) => tg.setValue(s.showRecents).onChange(async (v) => {
      s.showRecents = v;
      await save();
    }));
    new import_obsidian2.Setting(containerEl).setName(t("setRecentCount")).setDesc(t("setRecentCountDesc")).addText((txt) => {
      txt.inputEl.type = "number";
      txt.setValue(String(s.recentFilesCount)).onChange(async (v) => {
        const n = Number(v);
        if (!Number.isFinite(n)) return;
        s.recentFilesCount = Math.max(MIN_RECENT_FILES, Math.min(MAX_RECENT_FILES, Math.round(n)));
        await save();
      });
    });
    new import_obsidian2.Setting(containerEl).setName(t("clearRecents")).setDesc(t("clearRecentsDesc")).addButton((b) => b.setButtonText(t("clear")).onClick(() => void this.clearRecents()));
    new import_obsidian2.Setting(containerEl).setName(t("setShowFavorites")).setDesc(t("setShowFavoritesDesc")).addToggle((tg) => tg.setValue(s.showFavorites).onChange(async (v) => {
      s.showFavorites = v;
      await save();
    }));
    new import_obsidian2.Setting(containerEl).setName(t("setShowBookmarks")).setDesc(t("setShowBookmarksDesc")).addToggle((tg) => tg.setValue(s.showBookmarks).onChange(async (v) => {
      s.showBookmarks = v;
      await save();
    }));
    new import_obsidian2.Setting(containerEl).setName(t("setShowCalendar")).setDesc(t("setShowCalendarDesc")).addToggle((tg) => tg.setValue(s.showCalendar).onChange(async (v) => {
      s.showCalendar = v;
      await save();
    }));
    new import_obsidian2.Setting(containerEl).setName(t("setShowStorage")).setDesc(t("setShowStorageDesc")).addToggle((tg) => tg.setValue(s.showStorage).onChange(async (v) => {
      s.showStorage = v;
      await save();
    }));
    new import_obsidian2.Setting(containerEl).setName(t("setStorageExclude")).setDesc(t("setStorageExcludeDesc")).addText((txt) => txt.setValue(s.storageExcluded).onChange((v) => {
      s.storageExcluded = v;
      saveTextInput();
    }));
    new import_obsidian2.Setting(containerEl).setName(t("setStorageRings")).setDesc(t("setStorageRingsDesc")).addSlider((sl) => sl.setLimits(MIN_STORAGE_RINGS, MAX_STORAGE_RINGS, 1).setValue(s.storageRingCount).onChange(async (v) => {
      s.storageRingCount = v;
      await save();
    }));
    new import_obsidian2.Setting(containerEl).setName(t("headMobile")).setHeading();
    const saveMobile = async () => {
      var _a;
      await this.plugin.saveSettings();
      (_a = this.plugin.getView()) == null ? void 0 : _a.applyMobileScale();
    };
    let scaleSlider = null;
    new import_obsidian2.Setting(containerEl).setName(t("setMobileScale")).setDesc(t("setMobileScaleDesc")).addSlider((sl) => {
      scaleSlider = sl;
      sl.setLimits(MIN_MOBILE_SCALE, MAX_MOBILE_SCALE, 5).setValue(s.mobileUiScale).onChange(async (v) => {
        s.mobileUiScale = v;
        await saveMobile();
      });
    });
    let iconSlider = null;
    new import_obsidian2.Setting(containerEl).setName(t("setMobileIcon")).setDesc(t("setMobileIconDesc")).addSlider((sl) => {
      iconSlider = sl;
      sl.setLimits(MIN_MOBILE_ICON, MAX_MOBILE_ICON, 2).setValue(s.mobileIconSize).onChange(async (v) => {
        s.mobileIconSize = v;
        await saveMobile();
      });
    });
    this.refreshMobileSliders = () => {
      scaleSlider == null ? void 0 : scaleSlider.setValue(s.mobileUiScale);
      iconSlider == null ? void 0 : iconSlider.setValue(s.mobileIconSize);
    };
    new import_obsidian2.Setting(containerEl).setName(t("resetMobileSizes")).addButton((b) => b.setButtonText(t("reset")).onClick(() => void this.resetMobileSizes()));
  }
};

// src/view.ts
var import_obsidian13 = require("obsidian");

// src/mobile.ts
var import_obsidian8 = require("obsidian");

// src/fileops.ts
var import_obsidian3 = require("obsidian");
var UNDO_NOTICE_MS = 8e3;
async function moveFiles(app, paths, target) {
  var _a;
  const moves = [];
  for (const path of paths) {
    const src = app.vault.getAbstractFileByPath(path);
    if (!src || src.path === target.path) continue;
    if (target.path.startsWith(src.path + "/")) {
      new import_obsidian3.Notice(t("cantMoveIntoSelf"));
      continue;
    }
    if (((_a = src.parent) == null ? void 0 : _a.path) === target.path) continue;
    const dest = (0, import_obsidian3.normalizePath)((target.isRoot() ? "" : target.path + "/") + src.name);
    if (app.vault.getAbstractFileByPath(dest)) {
      new import_obsidian3.Notice(t("alreadyExists", { name: src.name }));
      continue;
    }
    try {
      await app.fileManager.renameFile(src, dest);
      moves.push({ from: path, to: dest });
    } catch (err) {
      new import_obsidian3.Notice(t("moveFailed", { name: src.name, error: errorMessage(err) }));
    }
  }
  if (moves.length > 0) showUndoMoveNotice(app, moves);
  return moves.length;
}
function showUndoMoveNotice(app, moves) {
  const frag = createFragment();
  frag.createSpan({ text: t("itemsMoved", { n: moves.length }) + " " });
  const undoBtn = frag.createEl("a", { text: t("undo"), cls: "column-explorer-undo-link" });
  const notice = new import_obsidian3.Notice(frag, UNDO_NOTICE_MS);
  undoBtn.addEventListener("click", () => {
    notice.hide();
    void undoMoves(app, moves);
  });
}
async function undoMoves(app, moves) {
  for (const move of moves) {
    const f = app.vault.getAbstractFileByPath(move.to);
    if (!f || app.vault.getAbstractFileByPath(move.from)) continue;
    try {
      await app.fileManager.renameFile(f, move.from);
    } catch (err) {
      new import_obsidian3.Notice(t("moveFailed", { name: f.name, error: errorMessage(err) }));
    }
  }
}
async function importExternalFiles(app, files, target) {
  let imported = 0;
  for (const file of files) {
    try {
      const data = await file.arrayBuffer();
      const taken = new Set(app.vault.getAllLoadedFiles().map((f) => f.path));
      const dest = (0, import_obsidian3.normalizePath)(availablePath(target.isRoot() ? "" : target.path, file.name, taken));
      await app.vault.createBinary(dest, data);
      imported++;
    } catch (e) {
      new import_obsidian3.Notice(t("importFailed", { name: file.name }));
    }
  }
  if (imported > 0) new import_obsidian3.Notice(t("filesImported", { n: imported }));
  return imported;
}
async function duplicateFile(app, f) {
  const dir = f.parent && !f.parent.isRoot() ? f.parent.path + "/" : "";
  let n = 1;
  let path = (0, import_obsidian3.normalizePath)(dir + f.basename + " copy." + f.extension);
  while (app.vault.getAbstractFileByPath(path)) {
    path = (0, import_obsidian3.normalizePath)(dir + f.basename + " copy " + n++ + "." + f.extension);
  }
  try {
    await app.vault.copy(f, path);
  } catch (err) {
    new import_obsidian3.Notice(t("duplicateFailed", { name: f.name, error: errorMessage(err) }));
  }
}
async function copyFiles(app, paths, target) {
  let pasted = 0;
  for (const path of paths) {
    const src = app.vault.getAbstractFileByPath(path);
    if (!src) continue;
    if (src.path === target.path || target.path.startsWith(src.path + "/")) {
      new import_obsidian3.Notice(t("cantMoveIntoSelf"));
      continue;
    }
    const taken = new Set(app.vault.getAllLoadedFiles().map((f) => f.path));
    const dest = (0, import_obsidian3.normalizePath)(availablePath(target.isRoot() ? "" : target.path, src.name, taken));
    try {
      if (src instanceof import_obsidian3.TFolder) await copyFolderInto(app, src, dest);
      else if (src instanceof import_obsidian3.TFile) await app.vault.copy(src, dest);
      else continue;
      pasted++;
    } catch (err) {
      new import_obsidian3.Notice(t("duplicateFailed", { name: src.name, error: errorMessage(err) }));
    }
  }
  if (pasted > 0) new import_obsidian3.Notice(t("itemsPasted", { n: pasted }));
  return pasted;
}
async function duplicateFolder(app, folder) {
  const dir = folder.parent && !folder.parent.isRoot() ? folder.parent.path + "/" : "";
  let n = 1;
  let dest = (0, import_obsidian3.normalizePath)(dir + folder.name + " copy");
  while (app.vault.getAbstractFileByPath(dest)) {
    dest = (0, import_obsidian3.normalizePath)(dir + folder.name + " copy " + n++);
  }
  try {
    await copyFolderInto(app, folder, dest);
  } catch (err) {
    new import_obsidian3.Notice(t("duplicateFailed", { name: folder.name, error: errorMessage(err) }));
  }
}
async function copyFolderInto(app, folder, dest) {
  await app.vault.createFolder(dest);
  for (const child of folder.children) {
    const childDest = dest + "/" + child.name;
    if (child instanceof import_obsidian3.TFolder) await copyFolderInto(app, child, childDest);
    else if (child instanceof import_obsidian3.TFile) await app.vault.copy(child, childDest);
  }
}
async function trashFiles(app, paths) {
  for (const p of paths) {
    const f = app.vault.getAbstractFileByPath(p);
    if (!f) continue;
    try {
      await app.fileManager.trashFile(f);
    } catch (err) {
      new import_obsidian3.Notice(t("deleteFailed", { name: f.name, error: errorMessage(err) }));
    }
  }
}

// src/modals.ts
var import_obsidian6 = require("obsidian");

// src/preview.ts
var import_obsidian5 = require("obsidian");

// src/utils.ts
var import_obsidian4 = require("obsidian");
function sortChildren(children, s, mode = s.sortMode) {
  const mtime = (f) => f instanceof import_obsidian4.TFile ? f.stat.mtime : 0;
  const ctime = (f) => f instanceof import_obsidian4.TFile ? f.stat.ctime : 0;
  const size = (f) => f instanceof import_obsidian4.TFile ? f.stat.size : 0;
  return [...children].sort((a, b) => {
    if (s.foldersFirst) {
      const aF = a instanceof import_obsidian4.TFolder, bF = b instanceof import_obsidian4.TFolder;
      if (aF !== bF) return aF ? -1 : 1;
    }
    switch (mode) {
      case "name-desc":
        return naturalCompare(b.name, a.name);
      case "mtime-desc":
        return mtime(b) - mtime(a) || naturalCompare(a.name, b.name);
      case "mtime-asc":
        return mtime(a) - mtime(b) || naturalCompare(a.name, b.name);
      case "ctime-desc":
        return ctime(b) - ctime(a) || naturalCompare(a.name, b.name);
      case "ctime-asc":
        return ctime(a) - ctime(b) || naturalCompare(a.name, b.name);
      case "size-desc":
        return size(b) - size(a) || naturalCompare(a.name, b.name);
      case "size-asc":
        return size(a) - size(b) || naturalCompare(a.name, b.name);
      default:
        return naturalCompare(a.name, b.name);
    }
  });
}
function visibleChildren(folder, s) {
  var _a;
  const patterns = parseExcludePatterns(s.excludePatterns);
  let children = folder.children;
  if (patterns.length > 0) {
    children = children.filter((c) => !matchesExcludePatterns(c.path, patterns));
  }
  const mode = (_a = s.columnSortModes[folder.path]) != null ? _a : s.sortMode;
  return pinnedFirst(sortChildren(children, s, mode), (c) => s.pinnedPaths[c.path]);
}
function folderNoteOf(folder) {
  const note = folder.children.find(
    (c) => c instanceof import_obsidian4.TFile && c.extension === "md" && c.basename === folder.name
  );
  return note instanceof import_obsidian4.TFile ? note : null;
}
function displayName(f) {
  if (f instanceof import_obsidian4.TFile && f.extension === "md") return f.basename;
  return f.name;
}
var IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"];
function isImageFile(f) {
  return IMAGE_EXTENSIONS.includes(f.extension);
}
function iconFor(f) {
  if (!(f instanceof import_obsidian4.TFile)) return "folder";
  switch (f.extension) {
    case "md":
      return "file-text";
    case "canvas":
      return "layout-dashboard";
    case "pdf":
      return "file-type";
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
    case "svg":
    case "bmp":
      return "image";
    case "mp3":
    case "wav":
    case "ogg":
    case "flac":
    case "m4a":
      return "file-audio";
    case "mp4":
    case "mov":
    case "webm":
    case "mkv":
      return "file-video";
    default:
      return "file";
  }
}

// src/preview.ts
var MARKDOWN_PREVIEW_CHARS = 1e3;
var AUDIO_EXTENSIONS = ["mp3", "wav", "ogg", "flac", "m4a"];
var VIDEO_EXTENSIONS = ["mp4", "mov", "webm", "ogv"];
function renderPreviewColumn(view, container, file) {
  const col = container.createDiv({ cls: "column-explorer-column column-explorer-preview" });
  const inner = col.createDiv({ cls: "column-explorer-preview-inner" });
  renderPreviewContent(view, inner, file, view.newPreviewOwner());
}
function renderPreviewContent(view, inner, file, owner) {
  if (!renderMediaPreview(view, inner, file)) {
    const big = inner.createDiv({ cls: "column-explorer-preview-icon" });
    (0, import_obsidian5.setIcon)(big, iconFor(file));
  }
  inner.createDiv({ cls: "column-explorer-preview-name", text: displayName(file) });
  const meta = inner.createDiv({ cls: "column-explorer-preview-meta" });
  meta.createDiv({ text: file.extension.toUpperCase() + " \xB7 " + humanSize(file.stat.size) });
  meta.createDiv({ text: t("modified") + ": " + new Date(file.stat.mtime).toLocaleString() });
  meta.createDiv({ text: t("created") + ": " + new Date(file.stat.ctime).toLocaleString() });
  const btn = inner.createEl("button", { text: t("open"), cls: "mod-cta" });
  btn.addEventListener("click", (e) => {
    void view.app.workspace.getLeaf(import_obsidian5.Keymap.isModEvent(e)).openFile(file);
  });
  if (file.extension === "md" && view.plugin.settings.showMarkdownPreview) {
    void renderMarkdownSnippet(view, inner, file, owner);
  }
}
function renderMediaPreview(view, inner, file) {
  const src = view.app.vault.getResourcePath(file);
  if (isImageFile(file)) {
    inner.createEl("img", { cls: "column-explorer-preview-image", attr: { src } });
    return true;
  }
  if (AUDIO_EXTENSIONS.includes(file.extension)) {
    inner.createEl("audio", { cls: "column-explorer-preview-audio", attr: { src, controls: "" } });
    return true;
  }
  if (VIDEO_EXTENSIONS.includes(file.extension)) {
    inner.createEl("video", { cls: "column-explorer-preview-video", attr: { src, controls: "" } });
    return true;
  }
  if (file.extension === "pdf" && import_obsidian5.Platform.isDesktopApp) {
    inner.createEl("iframe", { cls: "column-explorer-preview-pdf", attr: { src } });
    return true;
  }
  return false;
}
async function renderMarkdownSnippet(view, inner, file, owner) {
  try {
    const content = await view.app.vault.cachedRead(file);
    if (!inner.isConnected) return;
    let snippet = content.slice(0, MARKDOWN_PREVIEW_CHARS);
    if (content.length > MARKDOWN_PREVIEW_CHARS) snippet += "\u2026";
    if (!snippet.trim()) return;
    const box = inner.createDiv({ cls: "column-explorer-preview-md markdown-rendered" });
    await import_obsidian5.MarkdownRenderer.render(view.app, snippet, box, file.path, owner);
  } catch (e) {
  }
}

// src/modals.ts
var ConfirmModal = class extends import_obsidian6.Modal {
  constructor(app, message, onConfirm) {
    super(app);
    this.message = message;
    this.onConfirm = onConfirm;
  }
  onOpen() {
    this.titleEl.setText(t("confirmDeleteTitle"));
    this.contentEl.createEl("p", { text: this.message });
    const row = this.contentEl.createDiv({ cls: "modal-button-container" });
    const ok = row.createEl("button", { text: t("confirm"), cls: "mod-warning" });
    ok.addEventListener("click", () => {
      this.close();
      this.onConfirm();
    });
    const cancel = row.createEl("button", { text: t("cancel") });
    cancel.addEventListener("click", () => this.close());
  }
  onClose() {
    this.contentEl.empty();
  }
};
var QuickLookModal = class extends import_obsidian6.Modal {
  constructor(app, view, file) {
    super(app);
    this.view = view;
    this.file = file;
    /** Владелец отрисованного markdown — выгружается вместе с модалкой. */
    this.owner = new import_obsidian6.Component();
  }
  onOpen() {
    this.owner.load();
    this.modalEl.addClass("column-explorer-quicklook");
    if (import_obsidian6.Platform.isMobile) {
      const bar = this.contentEl.createDiv({ cls: "column-explorer-quicklook-bar" });
      const close = bar.createEl("button", { cls: "clickable-icon", attr: { "aria-label": t("close") } });
      (0, import_obsidian6.setIcon)(close, "x");
      close.addEventListener("click", () => this.close());
    }
    const inner = this.contentEl.createDiv({ cls: "column-explorer-preview-inner" });
    renderPreviewContent(this.view, inner, this.file, this.owner);
    this.scope.register([], " ", () => {
      this.close();
      return false;
    });
  }
  onClose() {
    this.owner.unload();
    this.contentEl.empty();
  }
};
var FolderSuggestModal = class extends import_obsidian6.FuzzySuggestModal {
  constructor(app, onChoose) {
    super(app);
    this.onChoose = onChoose;
    this.setPlaceholder(t("moveToPlaceholder"));
  }
  getItems() {
    const folders = [this.app.vault.getRoot()];
    const walk = (folder) => {
      for (const child of folder.children) {
        if (child instanceof import_obsidian6.TFolder) {
          folders.push(child);
          walk(child);
        }
      }
    };
    walk(this.app.vault.getRoot());
    return folders;
  }
  getItemText(folder) {
    return folder.isRoot() ? "/" : folder.path;
  }
  onChooseItem(folder) {
    this.onChoose(folder);
  }
};
var IconSuggestModal = class extends import_obsidian6.FuzzySuggestModal {
  constructor(app, onChoose) {
    super(app);
    this.onChoose = onChoose;
    this.setPlaceholder(t("iconPlaceholder"));
  }
  getItems() {
    return (0, import_obsidian6.getIconIds)();
  }
  getItemText(icon) {
    return icon;
  }
  renderSuggestion(match, el) {
    el.addClass("column-explorer-icon-suggestion");
    const preview = el.createSpan({ cls: "column-explorer-icon-suggestion-preview" });
    (0, import_obsidian6.setIcon)(preview, match.item);
    el.createSpan({ text: match.item });
  }
  onChooseItem(icon) {
    this.onChoose(icon);
  }
};

// src/menus.ts
var import_obsidian7 = require("obsidian");
function sortLabel(mode) {
  const keys = {
    "name-asc": "sortNameAsc",
    "name-desc": "sortNameDesc",
    "mtime-desc": "sortMtimeDesc",
    "mtime-asc": "sortMtimeAsc",
    "ctime-desc": "sortCtimeDesc",
    "ctime-asc": "sortCtimeAsc",
    "size-desc": "sortSizeDesc",
    "size-asc": "sortSizeAsc"
  };
  return t(keys[mode]);
}
function copyToClipboard(text, notice) {
  navigator.clipboard.writeText(text).then(
    () => new import_obsidian7.Notice(notice),
    () => new import_obsidian7.Notice(t("copyFailed"))
  );
}
function colorMenuTitle(colorKey, label) {
  return createFragment((frag) => {
    const dot = frag.createSpan({ cls: "column-explorer-color-dot" });
    if (colorKey) dot.style.setProperty("--ce-dot-color", `var(--color-${colorKey})`);
    else dot.addClass("is-default");
    const text = frag.createSpan({ text: label });
    if (colorKey) text.style.color = `var(--color-${colorKey})`;
  });
}
function addFolderColorMenu(view, menu, folder) {
  const current = view.plugin.settings.folderColors[folder.path];
  const capitalized = (k) => "color" + k.charAt(0).toUpperCase() + k.slice(1);
  const fillColorItems = (target) => {
    for (const key of FOLDER_COLOR_KEYS) {
      target.addItem((i) => i.setTitle(colorMenuTitle(key, t(capitalized(key)))).setChecked(current === key).onClick(async () => {
        view.plugin.settings.folderColors = {
          ...view.plugin.settings.folderColors,
          [folder.path]: key
        };
        await view.plugin.saveSettings();
        view.render();
      }));
    }
    target.addSeparator();
    target.addItem((i) => i.setTitle(colorMenuTitle(null, t("colorDefault"))).setChecked(!current).onClick(async () => {
      const rest = { ...view.plugin.settings.folderColors };
      delete rest[folder.path];
      view.plugin.settings.folderColors = rest;
      await view.plugin.saveSettings();
      view.render();
    }));
  };
  menu.addItem((item) => {
    item.setTitle(t("folderColor")).setIcon("palette");
    const withSubmenu = item;
    if (typeof withSubmenu.setSubmenu === "function") {
      fillColorItems(withSubmenu.setSubmenu());
    } else {
      fillColorItems(menu);
    }
  });
}
function showFileMenu(view, e, f, depth) {
  const app = view.app;
  const menu = new import_obsidian7.Menu();
  const multi = view.multiSelDepth === depth && view.multiSel.has(f.path) && view.multiSel.size > 1;
  if (multi) {
    const paths = [...view.multiSel];
    menu.addItem((i) => i.setTitle(t("copy")).setIcon("copy").onClick(() => view.copyItems(paths, false)));
    menu.addItem((i) => i.setTitle(t("cut")).setIcon("scissors").onClick(() => view.copyItems(paths, true)));
    menu.addItem((i) => i.setTitle(t("moveTo")).setIcon("folder-input").onClick(() => new FolderSuggestModal(app, (target) => {
      void moveFiles(app, paths, target).then(() => view.clearMulti());
    }).open()));
    menu.addItem((i) => i.setTitle(t("duplicateN", { n: paths.length })).setIcon("copy").onClick(async () => {
      for (const p of paths) {
        const file = app.vault.getAbstractFileByPath(p);
        if (file instanceof import_obsidian7.TFile) await duplicateFile(app, file);
        else if (file instanceof import_obsidian7.TFolder) await duplicateFolder(app, file);
      }
    }));
    menu.addItem((i) => i.setTitle(t("deleteN", { n: paths.length })).setIcon("trash").onClick(() => view.deleteMany(paths)));
    menu.showAtMouseEvent(e);
    return;
  }
  if (f instanceof import_obsidian7.TFolder) {
    menu.addItem((i) => i.setTitle(t("newNote")).setIcon("file-plus").onClick(() => view.createNote(f)));
    menu.addItem((i) => i.setTitle(t("newFolder")).setIcon("folder-plus").onClick(() => view.createFolder(f)));
    menu.addItem((i) => i.setTitle(t("duplicate")).setIcon("copy").onClick(() => void duplicateFolder(app, f)));
    if (view.hasFileClipboard()) {
      menu.addItem((i) => i.setTitle(t("paste")).setIcon("clipboard-paste").onClick(() => view.pasteClipboard(f)));
    }
    addFolderColorMenu(view, menu, f);
    addFolderIconItems(view, menu, f);
    menu.addSeparator();
  }
  if (f instanceof import_obsidian7.TFile) {
    if (import_obsidian7.Platform.isMobile) {
      menu.addItem((i) => i.setTitle(t("preview")).setIcon("eye").onClick(() => new QuickLookModal(app, view, f).open()));
    }
    menu.addItem((i) => i.setTitle(t("openNewTab")).setIcon("file-plus-2").onClick(() => app.workspace.getLeaf("tab").openFile(f)));
    menu.addItem((i) => i.setTitle(t("openRight")).setIcon("separator-vertical").onClick(() => app.workspace.getLeaf("split").openFile(f)));
    menu.addSeparator();
    menu.addItem((i) => i.setTitle(t("duplicate")).setIcon("copy").onClick(() => duplicateFile(app, f)));
  }
  menu.addItem((i) => i.setTitle(t("copy")).setIcon("copy").onClick(() => view.copyItems([f.path], false)));
  menu.addItem((i) => i.setTitle(t("cut")).setIcon("scissors").onClick(() => view.copyItems([f.path], true)));
  const isPinned = view.plugin.settings.pinnedPaths[f.path] !== void 0;
  menu.addItem((i) => i.setTitle(isPinned ? t("unpin") : t("pin")).setIcon(isPinned ? "pin-off" : "pin").onClick(async () => {
    const pinned = { ...view.plugin.settings.pinnedPaths };
    if (isPinned) {
      delete pinned[f.path];
    } else {
      const orders = Object.values(pinned);
      pinned[f.path] = orders.length > 0 ? Math.max(...orders) + 1 : 0;
    }
    view.plugin.settings.pinnedPaths = pinned;
    await view.plugin.saveSettings();
    view.render();
  }));
  const isFav = view.isFavorite(f.path);
  menu.addItem((i) => i.setTitle(isFav ? t("removeFavorite") : t("addFavorite")).setIcon(isFav ? "star-off" : "star").onClick(() => view.toggleFavorite(f.path)));
  menu.addItem((i) => i.setTitle(t("moveTo")).setIcon("folder-input").onClick(() => new FolderSuggestModal(app, (target) => void moveFiles(app, [f.path], target)).open()));
  menu.addItem((i) => i.setTitle(t("rename")).setIcon("pencil").onClick(() => view.startRename(f)));
  menu.addItem((i) => i.setTitle(t("delete")).setIcon("trash").onClick(() => view.deleteMany([f.path])));
  menu.addSeparator();
  menu.addItem((i) => i.setTitle(t("copyPath")).setIcon("clipboard-copy").onClick(() => copyToClipboard(f.path, t("pathCopied"))));
  const adapter = app.vault.adapter;
  if (adapter instanceof import_obsidian7.FileSystemAdapter) {
    menu.addItem((i) => i.setTitle(t("copyFullPath")).setIcon("terminal").onClick(() => copyToClipboard(shellEscapePath(adapter.getBasePath() + "/" + f.path), t("pathCopied"))));
  }
  if (f instanceof import_obsidian7.TFile) {
    menu.addItem((i) => i.setTitle(t("copyWikiLink")).setIcon("brackets").onClick(() => copyToClipboard("[[" + app.metadataCache.fileToLinktext(f, "", false) + "]]", t("linkCopied"))));
    menu.addItem((i) => i.setTitle(t("copyMdLink")).setIcon("link").onClick(() => copyToClipboard(app.fileManager.generateMarkdownLink(f, ""), t("linkCopied"))));
    menu.addItem((i) => i.setTitle(t("copyObsidianUrl")).setIcon("external-link").onClick(() => {
      const url = "obsidian://open?vault=" + encodeURIComponent(app.vault.getName()) + "&file=" + encodeURIComponent(f.path);
      copyToClipboard(url, t("linkCopied"));
    }));
  }
  app.workspace.trigger("file-menu", menu, f, "file-explorer-context-menu", view.leaf);
  menu.showAtMouseEvent(e);
}
function addFolderIconItems(view, menu, folder) {
  menu.addItem((i) => i.setTitle(t("folderIcon")).setIcon("shapes").onClick(() => new IconSuggestModal(view.app, (icon) => {
    view.plugin.settings.folderIcons = {
      ...view.plugin.settings.folderIcons,
      [folder.path]: icon
    };
    void view.plugin.saveSettings();
    view.render();
  }).open()));
  if (view.plugin.settings.folderIcons[folder.path]) {
    menu.addItem((i) => i.setTitle(t("folderIconReset")).setIcon("shapes").onClick(() => {
      const rest = { ...view.plugin.settings.folderIcons };
      delete rest[folder.path];
      view.plugin.settings.folderIcons = rest;
      void view.plugin.saveSettings();
      view.render();
    }));
  }
}
function showRecentsMenu(view, e) {
  const menu = new import_obsidian7.Menu();
  menu.addItem((i) => i.setTitle(t("clearRecents")).setIcon("eraser").onClick(() => {
    view.plugin.settings.recentFiles = [];
    void view.plugin.saveSettings();
    view.render();
  }));
  menu.showAtMouseEvent(e);
}
function showColumnHeaderMenu(view, e, folder) {
  const menu = new import_obsidian7.Menu();
  menu.addItem((i) => i.setTitle(t("newNote")).setIcon("file-plus").onClick(() => void view.createNote(folder)));
  menu.addItem((i) => i.setTitle(t("newFolder")).setIcon("folder-plus").onClick(() => void view.createFolder(folder)));
  menu.addItem((i) => i.setTitle(t("newCanvas")).setIcon("layout-dashboard").onClick(() => void view.createNote(folder, "canvas", "{}")));
  menu.addSeparator();
  const current = view.plugin.settings.columnSortModes[folder.path];
  const setMode = (mode) => {
    const rest = { ...view.plugin.settings.columnSortModes };
    if (mode === null) delete rest[folder.path];
    else rest[folder.path] = mode;
    view.plugin.settings.columnSortModes = rest;
    void view.plugin.saveSettings();
    view.render();
  };
  menu.addItem((i) => i.setTitle(t("sortDefault")).setChecked(current === void 0).onClick(() => setMode(null)));
  for (const mode of SORT_MODE_VALUES) {
    menu.addItem((i) => i.setTitle(sortLabel(mode)).setChecked(current === mode).onClick(() => setMode(mode)));
  }
  menu.showAtMouseEvent(e);
}
function showFolderBackgroundMenu(view, e, folder) {
  const menu = new import_obsidian7.Menu();
  menu.addItem((i) => i.setTitle(t("newNote")).setIcon("file-plus").onClick(() => void view.createNote(folder)));
  menu.addItem((i) => i.setTitle(t("newFolder")).setIcon("folder-plus").onClick(() => void view.createFolder(folder)));
  menu.addItem((i) => i.setTitle(t("newCanvas")).setIcon("layout-dashboard").onClick(() => void view.createNote(folder, "canvas", "{}")));
  if (view.hasFileClipboard()) {
    menu.addItem((i) => i.setTitle(t("paste")).setIcon("clipboard-paste").onClick(() => view.pasteClipboard(folder)));
  }
  menu.showAtMouseEvent(e);
}
function fillSortItems(view, target) {
  for (const m of SORT_MODE_VALUES) {
    target.addItem((i) => i.setTitle(sortLabel(m)).setChecked(view.plugin.settings.sortMode === m).onClick(async () => {
      view.plugin.settings.sortMode = m;
      await view.plugin.saveSettings();
      view.render();
    }));
  }
}
function showSortMenu(view, e) {
  const menu = new import_obsidian7.Menu();
  fillSortItems(view, menu);
  menu.showAtMouseEvent(e);
}
function showMobileCreateMenu(view, e) {
  const folder = view.currentFolder();
  const menu = new import_obsidian7.Menu();
  menu.addItem((i) => i.setTitle(t("newNote")).setIcon("file-plus").onClick(() => void view.createNote(folder)));
  menu.addItem((i) => i.setTitle(t("newFolder")).setIcon("folder-plus").onClick(() => void view.createFolder(folder)));
  menu.addItem((i) => i.setTitle(t("newCanvas")).setIcon("layout-dashboard").onClick(() => void view.createNote(folder, "canvas", "{}")));
  menu.showAtMouseEvent(e);
}
function showMobileMoreMenu(view, e) {
  const menu = new import_obsidian7.Menu();
  menu.addItem((i) => i.setTitle(t("reveal")).setIcon("locate").onClick(() => view.revealFile(view.app.workspace.getActiveFile())));
  menu.addItem((i) => i.setTitle(t("collapse")).setIcon("chevrons-left").onClick(() => view.collapseToRoot()));
  menu.addSeparator();
  menu.addItem((item) => {
    item.setTitle(t("sort")).setIcon("arrow-up-narrow-wide");
    const withSubmenu = item;
    if (typeof withSubmenu.setSubmenu === "function") fillSortItems(view, withSubmenu.setSubmenu());
    else fillSortItems(view, menu);
  });
  menu.showAtMouseEvent(e);
}

// src/mobile.ts
function vibrate() {
  if (typeof navigator.vibrate === "function") navigator.vibrate(20);
}
function toolbarButton(view, parent, icon, label, onClick) {
  const btn = parent.createEl("button", {
    cls: "clickable-icon column-explorer-toolbar-btn",
    attr: { "aria-label": label }
  });
  (0, import_obsidian8.setIcon)(btn, icon);
  view.registerDomEvent(btn, "click", onClick);
  return btn;
}
var MOBILE_TOOLBAR_BUTTONS = 5;
function setEnabled(btn, enabled) {
  btn.toggleClass("is-disabled", !enabled);
  btn.setAttribute("aria-disabled", String(!enabled));
}
function buildMobileToolbar(view, toolbar) {
  toolbar.addClass("is-mobile-toolbar");
  const back = toolbarButton(view, toolbar, "arrow-left", t("navBack"), () => view.goBack());
  const forward = toolbarButton(view, toolbar, "arrow-right", t("navForward"), () => view.goForward());
  const search = toolbarButton(view, toolbar, "search", t("search"), () => view.toggleMobileSearch());
  toolbarButton(view, toolbar, "plus", t("create"), (e) => showMobileCreateMenu(view, e));
  toolbarButton(view, toolbar, "more-horizontal", t("more"), (e) => showMobileMoreMenu(view, e));
  return () => {
    setEnabled(back, view.canGoBack());
    setEnabled(forward, view.canGoForward());
    search.setAttribute("aria-pressed", String(view.isSearchOpen()));
    search.toggleClass("is-active", view.isSearchOpen());
  };
}
function applyMobileScale(view, container) {
  const { mobileUiScale, mobileIconSize } = normalizeMobileSettings(view.plugin.settings);
  const scale = mobileUiScale / 100;
  const control = mobileControlSize(scale, container.clientWidth, MOBILE_TOOLBAR_BUTTONS);
  const rowHeight = Math.max(MIN_TOUCH_TARGET_PX, Math.round(MIN_TOUCH_TARGET_PX * scale));
  container.style.setProperty("--ce-mobile-scale", String(scale));
  container.style.setProperty("--ce-mobile-icon-size", mobileIconSize + "px");
  container.style.setProperty("--ce-mobile-control-size", control + "px");
  container.style.setProperty("--ce-mobile-row-height", rowHeight + "px");
}
function addUpButton(view, header) {
  const enabled = view.canGoUp();
  const btn = header.createEl("button", {
    cls: "clickable-icon column-explorer-up-btn",
    attr: { "aria-label": t("navUp"), "aria-disabled": String(!enabled) }
  });
  (0, import_obsidian8.setIcon)(btn, "arrow-up");
  if (enabled) btn.addEventListener("click", () => view.goUp());
  else btn.addClass("is-disabled");
  header.prepend(btn);
}
function buildActionBar(view, container) {
  const bar = container.createDiv({ cls: "column-explorer-action-bar", attr: { role: "toolbar" } });
  bar.hide();
  const count = bar.createDiv({ cls: "column-explorer-action-count", attr: { "aria-live": "polite" } });
  const action = (icon, label, onClick) => {
    const btn = bar.createEl("button", { cls: "clickable-icon column-explorer-action-btn", attr: { "aria-label": label } });
    (0, import_obsidian8.setIcon)(btn, icon);
    view.registerDomEvent(btn, "click", onClick);
  };
  action("folder-input", t("moveTo"), () => {
    const paths = [...view.multiSel];
    new FolderSuggestModal(view.app, (target) => {
      void moveFiles(view.app, paths, target).then(() => view.exitMobileSelection());
    }).open();
  });
  action("copy", t("duplicate"), () => {
    view.duplicateSelected(view.multiSelDepth);
    view.exitMobileSelection();
  });
  action("trash", t("delete"), () => view.deleteMany([...view.multiSel]));
  action("more-horizontal", t("more"), (e) => {
    var _a;
    const first = view.app.vault.getAbstractFileByPath((_a = [...view.multiSel][0]) != null ? _a : "");
    if (first) showFileMenu(view, e, first, view.multiSelDepth);
  });
  action("x", t("cancelSelection"), () => view.exitMobileSelection());
  return () => {
    const active = view.isMobileSelecting();
    const label = t("selectedN", { n: view.multiSel.size });
    bar.toggle(active);
    count.setText(label);
    bar.setAttribute("aria-label", label);
  };
}
function setupLongPress(view, listEl, depth) {
  let phase = "idle";
  let timer = 0;
  let startX = 0;
  let startY = 0;
  let pressedPath = null;
  const stopTimer = () => {
    window.clearTimeout(timer);
    timer = 0;
  };
  const itemPath = (e) => {
    var _a, _b;
    const el = (_a = e.target) == null ? void 0 : _a.closest(".column-explorer-item");
    return (_b = el == null ? void 0 : el.dataset.path) != null ? _b : null;
  };
  listEl.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary || e.pointerType === "mouse") return;
    pressedPath = itemPath(e);
    if (!pressedPath) return;
    startX = e.clientX;
    startY = e.clientY;
    phase = nextPressPhase(phase, { type: "down" });
    timer = window.setTimeout(() => {
      phase = nextPressPhase(phase, { type: "timeout" });
      if (phase !== "fired") return;
      const f = pressedPath ? view.app.vault.getAbstractFileByPath(pressedPath) : null;
      if (!f) {
        phase = "cancelled";
        return;
      }
      vibrate();
      view.enterMobileSelection(f, depth);
    }, LONG_PRESS_MS);
  });
  listEl.addEventListener("pointermove", (e) => {
    if (phase !== "pending") return;
    phase = nextPressPhase(phase, { type: "move", dx: e.clientX - startX, dy: e.clientY - startY });
    if (phase === "cancelled") stopTimer();
  });
  listEl.addEventListener("pointerup", () => {
    stopTimer();
    phase = nextPressPhase(phase, { type: "up" });
  });
  listEl.addEventListener("pointercancel", () => {
    stopTimer();
    phase = nextPressPhase(phase, { type: "cancel" });
  });
  listEl.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
  }, true);
  listEl.addEventListener("click", (e) => {
    const action = mobileTapAction({ selectionMode: view.isMobileSelecting(), pressPhase: phase });
    phase = nextPressPhase(phase, { type: "click" });
    if (action === "activate") return;
    e.preventDefault();
    e.stopPropagation();
    if (action !== "toggle") return;
    const path = itemPath(e);
    const f = path ? view.app.vault.getAbstractFileByPath(path) : null;
    if (f) view.toggleMobileSelection(f, depth);
  }, true);
}
var SWIPE_IGNORE_SELECTOR = "input, textarea, button, a, [role='button'], .clickable-icon";
function setupEdgeSwipe(view, el) {
  let start = null;
  view.registerDomEvent(el, "touchstart", (e) => {
    var _a;
    start = null;
    if (e.touches.length !== 1) return;
    if (view.isMobileSelecting()) return;
    if (el.ownerDocument.querySelector(".modal-container")) return;
    if ((_a = e.target) == null ? void 0 : _a.closest(SWIPE_IGNORE_SELECTOR)) return;
    const rect = el.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    if (x > EDGE_ZONE_PX && x < rect.width - EDGE_ZONE_PX) return;
    start = { x, y: e.touches[0].clientY, width: rect.width };
  }, { passive: true });
  view.registerDomEvent(el, "touchend", (e) => {
    const from = start;
    start = null;
    if (!from || e.changedTouches.length !== 1) return;
    const rect = el.getBoundingClientRect();
    const direction = detectEdgeSwipe({
      startX: from.x,
      startY: from.y,
      endX: e.changedTouches[0].clientX - rect.left,
      endY: e.changedTouches[0].clientY,
      containerWidth: from.width
    });
    if (direction === "back") view.goBack();
    else if (direction === "forward") view.goForward();
  });
  view.registerDomEvent(el, "touchcancel", () => {
    start = null;
  });
}
function setupViewportTracking(view, container) {
  const viewport = window.visualViewport;
  if (!viewport) return;
  const apply = () => {
    const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
    container.style.setProperty("--ce-keyboard-inset", inset + "px");
  };
  viewport.addEventListener("resize", apply);
  viewport.addEventListener("scroll", apply);
  view.register(() => {
    viewport.removeEventListener("resize", apply);
    viewport.removeEventListener("scroll", apply);
  });
  apply();
}

// src/column.ts
var import_obsidian10 = require("obsidian");

// src/dnd.ts
var import_obsidian9 = require("obsidian");
var activeDragPaths = null;
function clearActiveDrag() {
  activeDragPaths = null;
}
function setupGlobalDnd(view) {
  if (import_obsidian9.Platform.isMobile) return;
  view.registerDomEvent(view.containerEl.ownerDocument, "dragend", clearActiveDrag);
}
function notifyDragManager(app, e, f) {
  try {
    const dragManager = app.dragManager;
    if (!dragManager || !(f instanceof import_obsidian9.TFile || f instanceof import_obsidian9.TFolder)) return;
    const dragData = f instanceof import_obsidian9.TFile ? dragManager.dragFile(e, f) : dragManager.dragFolder(e, f);
    dragManager.onDragStart(e, dragData);
  } catch (e2) {
  }
}
function itemUnderEvent(e) {
  var _a;
  const target = e.target;
  return (_a = target == null ? void 0 : target.closest(".column-explorer-item")) != null ? _a : null;
}
function folderForItem(app, item) {
  if (!(item == null ? void 0 : item.dataset.path)) return null;
  const f = app.vault.getAbstractFileByPath(item.dataset.path);
  return f instanceof import_obsidian9.TFolder ? f : null;
}
function setupColumnDnd(view, listEl, columnFolder, depth) {
  if (import_obsidian9.Platform.isMobile) return;
  const app = view.app;
  let highlighted = null;
  const setHighlight = (el) => {
    if (highlighted === el) return;
    highlighted == null ? void 0 : highlighted.removeClass("is-drop-target");
    highlighted = el;
    highlighted == null ? void 0 : highlighted.addClass("is-drop-target");
  };
  listEl.addEventListener("dragstart", (e) => {
    var _a;
    const item = itemUnderEvent(e);
    if (!(item == null ? void 0 : item.dataset.path)) return;
    const f = app.vault.getAbstractFileByPath(item.dataset.path);
    if (!f) return;
    const paths = view.dragPayload(f, depth);
    activeDragPaths = paths;
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    if (paths.length === 1) notifyDragManager(app, e, f);
    (_a = e.dataTransfer) == null ? void 0 : _a.setData("text/plain", JSON.stringify(paths));
  });
  listEl.addEventListener("dragend", () => {
    activeDragPaths = null;
    setHighlight(null);
  });
  listEl.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = e.dataTransfer.types.includes("Files") ? "copy" : "move";
    const targetFolder = folderForItem(app, itemUnderEvent(e));
    setHighlight(targetFolder ? itemUnderEvent(e) : listEl);
  });
  listEl.addEventListener("dragleave", (e) => {
    if (!listEl.contains(e.relatedTarget)) setHighlight(null);
  });
  listEl.addEventListener("drop", (e) => {
    var _a, _b, _c, _d;
    e.preventDefault();
    e.stopPropagation();
    const dropFolder = (_a = folderForItem(app, itemUnderEvent(e))) != null ? _a : columnFolder;
    setHighlight(null);
    const osFiles = (_b = e.dataTransfer) == null ? void 0 : _b.files;
    if (!activeDragPaths && osFiles && osFiles.length > 0) {
      void importExternalFiles(app, Array.from(osFiles), dropFolder);
      return;
    }
    const paths = activeDragPaths != null ? activeDragPaths : parseDragPaths((_d = (_c = e.dataTransfer) == null ? void 0 : _c.getData("text/plain")) != null ? _d : "");
    activeDragPaths = null;
    if (paths.length === 0) return;
    if (paths.length === 1 && reorderPinned(view, paths[0], itemUnderEvent(e))) return;
    void moveFiles(app, paths, dropFolder).then(() => view.clearMulti());
  });
}
function setupCrumbDropTarget(view, el, folder) {
  if (import_obsidian9.Platform.isMobile) return;
  el.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    el.addClass("is-drop-target");
  });
  el.addEventListener("dragleave", () => el.removeClass("is-drop-target"));
  el.addEventListener("drop", (e) => {
    var _a, _b;
    e.preventDefault();
    e.stopPropagation();
    el.removeClass("is-drop-target");
    const paths = activeDragPaths != null ? activeDragPaths : parseDragPaths((_b = (_a = e.dataTransfer) == null ? void 0 : _a.getData("text/plain")) != null ? _b : "");
    activeDragPaths = null;
    if (paths.length === 0) return;
    void moveFiles(view.app, paths, folder).then(() => view.clearMulti());
  });
}
function reorderPinned(view, dragPath, targetItem) {
  var _a, _b;
  const targetPath = targetItem == null ? void 0 : targetItem.dataset.path;
  if (!targetPath || targetPath === dragPath) return false;
  const s = view.plugin.settings;
  if (s.pinnedPaths[dragPath] === void 0 || s.pinnedPaths[targetPath] === void 0) return false;
  const drag = view.app.vault.getAbstractFileByPath(dragPath);
  const target = view.app.vault.getAbstractFileByPath(targetPath);
  if (!drag || !target || ((_a = drag.parent) == null ? void 0 : _a.path) !== ((_b = target.parent) == null ? void 0 : _b.path)) return false;
  s.pinnedPaths = movePinnedBefore(s.pinnedPaths, dragPath, targetPath);
  void view.plugin.saveSettings();
  view.render();
  return true;
}

// src/column.ts
function itemFromEvent(e) {
  var _a;
  const el = (_a = e.target) == null ? void 0 : _a.closest(".column-explorer-item");
  return (el == null ? void 0 : el.dataset.path) ? { el, path: el.dataset.path } : null;
}
function renderColumn(view, container, folder, depth) {
  var _a, _b;
  const col = container.createDiv({ cls: "column-explorer-column" });
  col.dataset.depth = String(depth);
  col.dataset.folderPath = folder.path;
  const customWidth = (_a = view.plugin.settings.columnWidths[folder.path]) != null ? _a : folder.isRoot() ? view.plugin.settings.columnWidth + ROOT_COLUMN_EXTRA_WIDTH : void 0;
  if (customWidth) col.style.setProperty("--ce-col-width", customWidth + "px");
  const header = col.createDiv({ cls: "column-explorer-column-header" });
  if (import_obsidian10.Platform.isMobile) addUpButton(view, header);
  header.createSpan({ cls: "column-explorer-column-title", text: folder.isRoot() ? view.app.vault.getName() : folder.name });
  header.createSpan({ cls: "column-explorer-column-count" });
  header.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    showColumnHeaderMenu(view, e, folder);
  });
  const viewMode = (_b = view.plugin.settings.columnViewModes[folder.path]) != null ? _b : "list";
  const toggle = header.createDiv({
    cls: "clickable-icon column-explorer-view-toggle",
    attr: {
      "aria-label": viewMode === "list" ? t("viewAsGrid") : t("viewAsList"),
      role: "button",
      "aria-pressed": String(viewMode === "grid")
    }
  });
  (0, import_obsidian10.setIcon)(toggle, viewMode === "list" ? "layout-grid" : "list");
  toggle.addEventListener("click", () => {
    view.plugin.settings.columnViewModes = {
      ...view.plugin.settings.columnViewModes,
      [folder.path]: viewMode === "list" ? "grid" : "list"
    };
    void view.plugin.saveSettings();
    view.render();
  });
  const list = col.createDiv({ cls: "column-explorer-list", attr: { role: "listbox" } });
  if (viewMode === "grid") list.addClass("is-grid");
  list.addEventListener("click", (e) => {
    const hit = itemFromEvent(e);
    if (!hit) {
      if (e.target === list) {
        view.clearMulti();
        view.render();
      }
      return;
    }
    if (view.specialKind(hit.path)) {
      view.clearMulti();
      view.selectSpecial(hit.path);
      return;
    }
    const f = view.app.vault.getAbstractFileByPath(hit.path);
    if (!f || view.isRenaming(hit.path)) return;
    if (e.ctrlKey || e.metaKey) {
      view.toggleMulti(f, depth);
      return;
    }
    if (e.shiftKey) {
      view.rangeMulti(f, depth, view.childrenOf(folder));
      return;
    }
    view.clearMulti();
    view.selectItem(f, depth, e);
  });
  list.addEventListener("dblclick", (e) => {
    const hit = itemFromEvent(e);
    const f = hit ? view.app.vault.getAbstractFileByPath(hit.path) : null;
    if (f instanceof import_obsidian10.TFile) void view.app.workspace.getLeaf("tab").openFile(f);
  });
  list.addEventListener("auxclick", (e) => {
    if (e.button !== 1) return;
    const hit = itemFromEvent(e);
    const f = hit ? view.app.vault.getAbstractFileByPath(hit.path) : null;
    if (f instanceof import_obsidian10.TFile) void view.app.workspace.getLeaf("tab").openFile(f);
  });
  list.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const hit = itemFromEvent(e);
    if (!hit) {
      if (e.target === list) showFolderBackgroundMenu(view, e, folder);
      return;
    }
    if (view.specialKind(hit.path) === "recents") {
      showRecentsMenu(view, e);
      return;
    }
    const f = view.app.vault.getAbstractFileByPath(hit.path);
    if (f) showFileMenu(view, e, f, depth);
  });
  setupColumnDnd(view, list, folder, depth);
  if (import_obsidian10.Platform.isMobile) setupLongPress(view, list, depth);
  renderColumnList(view, list, folder, depth);
  addResizeHandle(view, col, folder.path);
  return col;
}
var RENDER_CHUNK = 300;
var listObservers = /* @__PURE__ */ new WeakMap();
function disconnectListObservers(container) {
  container.querySelectorAll(".column-explorer-list").forEach((list) => {
    var _a;
    (_a = listObservers.get(list)) == null ? void 0 : _a.disconnect();
    listObservers.delete(list);
  });
}
function renderColumnList(view, list, folder, depth) {
  var _a, _b, _c;
  (_a = listObservers.get(list)) == null ? void 0 : _a.disconnect();
  listObservers.delete(list);
  list.empty();
  const specials = folder.isRoot() && depth === 0 ? buildSpecialItems(view) : [];
  const specialsOnTop = view.plugin.settings.specialItemsPosition === "top";
  if (specialsOnTop) specials.forEach((el) => list.appendChild(el));
  const appendSpecialsBottom = () => {
    if (!specialsOnTop) specials.forEach((el) => list.appendChild(el));
  };
  const children = view.childrenOf(folder);
  const countEl = (_b = list.closest(".column-explorer-column")) == null ? void 0 : _b.querySelector(".column-explorer-column-count");
  countEl == null ? void 0 : countEl.setText(String(children.length));
  if (children.length === 0) {
    list.createDiv({ cls: "column-explorer-empty", text: view.hasFilter() ? t("noResults") : t("empty") });
    appendSpecialsBottom();
    return;
  }
  const isGrid = ((_c = view.plugin.settings.columnViewModes[folder.path]) != null ? _c : "list") === "grid";
  const selectedIdx = children.findIndex((c) => c.path === view.selection[depth]);
  let rendered = Math.min(children.length, Math.max(RENDER_CHUNK, selectedIdx + 1));
  const frag = createFragment();
  for (let i = 0; i < rendered; i++) frag.appendChild(buildItem(view, children[i], depth, isGrid));
  list.appendChild(frag);
  if (rendered >= children.length) {
    appendSpecialsBottom();
    return;
  }
  const sentinel = list.createDiv({ cls: "column-explorer-load-more" });
  appendSpecialsBottom();
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    const next = Math.min(children.length, rendered + RENDER_CHUNK);
    const batch = createFragment();
    for (let i = rendered; i < next; i++) batch.appendChild(buildItem(view, children[i], depth, isGrid));
    rendered = next;
    list.insertBefore(batch, sentinel);
    if (rendered >= children.length) {
      observer.disconnect();
      listObservers.delete(list);
      sentinel.remove();
    }
  }, { root: list });
  observer.observe(sentinel);
  listObservers.set(list, observer);
}
function buildItem(view, f, depth, isGrid = false) {
  const item = createDiv({ cls: "column-explorer-item", attr: { role: "option" } });
  item.dataset.path = f.path;
  item.draggable = !import_obsidian10.Platform.isMobile;
  const selected = view.selection[depth] === f.path;
  item.setAttribute("aria-selected", String(selected));
  if (selected) item.addClass("is-selected");
  if (selected && depth < view.selection.length - 1) item.addClass("is-ancestor");
  if (view.multiSelDepth === depth && view.multiSel.has(f.path)) item.addClass("is-multi-selected");
  const activeFile = view.app.workspace.getActiveFile();
  if (activeFile && activeFile.path === f.path) item.addClass("is-active-file");
  if (view.isCutPath(f.path)) item.addClass("is-cut");
  if (f instanceof import_obsidian10.TFolder) {
    const colorKey = view.plugin.settings.folderColors[f.path];
    if (colorKey) {
      item.addClass("has-folder-color");
      item.style.setProperty("--ce-folder-color", `var(--color-${colorKey})`);
    }
    if (folderNoteOf(f)) item.addClass("has-folder-note");
  }
  const iconEl = item.createDiv({ cls: "column-explorer-item-icon" });
  if (isGrid && f instanceof import_obsidian10.TFile && isImageFile(f)) {
    item.addClass("has-thumbnail");
    iconEl.createEl("img", {
      cls: "column-explorer-thumb",
      attr: { src: view.app.vault.getResourcePath(f), loading: "lazy", alt: displayName(f) }
    });
  } else {
    const customIcon = f instanceof import_obsidian10.TFolder ? view.plugin.settings.folderIcons[f.path] : void 0;
    (0, import_obsidian10.setIcon)(iconEl, customIcon != null ? customIcon : iconFor(f));
  }
  const title = item.createDiv({ cls: "column-explorer-item-title" });
  const name = displayName(f);
  const match = view.hasFilter() && f instanceof import_obsidian10.TFile ? view.matchOf(name) : null;
  if (match) {
    for (const chunk of matchRanges(name, match.matches)) {
      if (chunk.hit) title.createSpan({ cls: "column-explorer-match", text: chunk.text });
      else title.appendText(chunk.text);
    }
  } else {
    title.setText(name);
  }
  addUnreadMarker(view, item, f);
  if (view.plugin.settings.pinnedPaths[f.path] !== void 0) {
    const pin = item.createDiv({ cls: "column-explorer-item-pin" });
    (0, import_obsidian10.setIcon)(pin, "pin");
  }
  if (f instanceof import_obsidian10.TFolder) {
    const chev = item.createDiv({ cls: "column-explorer-item-chevron" });
    (0, import_obsidian10.setIcon)(chev, "chevron-right");
  } else if (f instanceof import_obsidian10.TFile && f.extension !== "md" && view.plugin.settings.showExtensions) {
    item.createDiv({ cls: "column-explorer-item-ext", text: f.extension });
  }
  return item;
}
function addUnreadMarker(view, item, f) {
  const s = view.plugin.settings;
  if (!s.showUnreadMarkers || !(f instanceof import_obsidian10.TFile)) return;
  const state = unreadState(f.stat, s.seenAt[f.path], s.unreadBaseline);
  if (!state) return;
  const marker = state === "new" ? createDiv({ cls: "column-explorer-item-badge", text: t("unreadNew") }) : createDiv({ cls: "column-explorer-item-dot", attr: { "aria-label": t("unreadModifiedTooltip") } });
  item.addClass(state === "new" ? "has-unread-new" : "has-unread-mod");
  const title = item.querySelector(".column-explorer-item-title");
  if (title) item.insertBefore(marker, title);
  else item.appendChild(marker);
}
function refreshUnreadMarker(view, container, path) {
  const items = container.querySelectorAll(
    `.column-explorer-item[data-path="${CSS.escape(path)}"]`
  );
  items.forEach((item) => {
    var _a, _b;
    item.removeClass("has-unread-new");
    item.removeClass("has-unread-mod");
    (_a = item.querySelector(".column-explorer-item-badge")) == null ? void 0 : _a.remove();
    (_b = item.querySelector(".column-explorer-item-dot")) == null ? void 0 : _b.remove();
    const f = view.app.vault.getAbstractFileByPath(path);
    if (f) addUnreadMarker(view, item, f);
  });
}
function buildSpecialItems(view) {
  const items = [];
  if (view.specialKind(RECENTS_PATH)) items.push(buildSpecialItem(view, RECENTS_PATH, "history", t("recents")));
  if (view.specialKind(BOOKMARKS_PATH)) items.push(buildSpecialItem(view, BOOKMARKS_PATH, "bookmark", t("bookmarks")));
  if (view.specialKind(CALENDAR_PATH)) items.push(buildSpecialItem(view, CALENDAR_PATH, "calendar-days", t("calendar")));
  if (view.specialKind(STORAGE_PATH)) items.push(buildSpecialItem(view, STORAGE_PATH, "pie-chart", t("diskUsage")));
  return items;
}
function buildSpecialItem(view, path, icon, label) {
  const item = createDiv({ cls: "column-explorer-item column-explorer-special", attr: { role: "option" } });
  item.dataset.path = path;
  const selected = view.selection[0] === path;
  item.setAttribute("aria-selected", String(selected));
  if (selected) item.addClass("is-selected");
  if (selected && view.selection.length > 1) item.addClass("is-ancestor");
  const iconEl = item.createDiv({ cls: "column-explorer-item-icon" });
  (0, import_obsidian10.setIcon)(iconEl, icon);
  item.createDiv({ cls: "column-explorer-item-title", text: label });
  const chev = item.createDiv({ cls: "column-explorer-item-chevron" });
  (0, import_obsidian10.setIcon)(chev, "chevron-right");
  return item;
}
function renderFileListColumn(view, container, title, files, sentinelPath, depth, favorites = []) {
  const col = container.createDiv({ cls: "column-explorer-column" });
  col.dataset.depth = String(depth);
  col.dataset.folderPath = sentinelPath;
  const widthKey = sentinelPath.startsWith(DAY_PATH_PREFIX) ? DAY_PATH_PREFIX : sentinelPath;
  const customWidth = view.plugin.settings.columnWidths[widthKey];
  if (customWidth) col.style.setProperty("--ce-col-width", customWidth + "px");
  const header = col.createDiv({ cls: "column-explorer-column-header" });
  if (import_obsidian10.Platform.isMobile) addUpButton(view, header);
  header.createSpan({ cls: "column-explorer-column-title", text: title });
  const countEl = header.createSpan({ cls: "column-explorer-column-count" });
  const list = col.createDiv({ cls: "column-explorer-list", attr: { role: "listbox" } });
  countEl.setText(String(favorites.length + files.length));
  if (favorites.length > 0) {
    list.createDiv({ cls: "column-explorer-section-label", text: t("favorites") });
    for (const f of favorites) list.appendChild(buildItem(view, f, depth));
    if (files.length > 0) list.createDiv({ cls: "column-explorer-section-divider" });
  }
  if (favorites.length === 0 && files.length === 0) {
    list.createDiv({ cls: "column-explorer-empty", text: t("empty") });
  } else {
    for (const f of files) list.appendChild(buildItem(view, f, depth));
  }
  list.addEventListener("click", (e) => {
    const hit = itemFromEvent(e);
    const f = hit ? view.app.vault.getAbstractFileByPath(hit.path) : null;
    if (f instanceof import_obsidian10.TFolder) {
      view.clearMulti();
      view.revealFile(f);
      return;
    }
    if (f instanceof import_obsidian10.TFile) {
      view.clearMulti();
      view.selectItem(f, depth, e);
    }
  });
  list.addEventListener("auxclick", (e) => {
    if (e.button !== 1) return;
    const hit = itemFromEvent(e);
    const f = hit ? view.app.vault.getAbstractFileByPath(hit.path) : null;
    if (f instanceof import_obsidian10.TFile) void view.app.workspace.getLeaf("tab").openFile(f);
  });
  list.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const hit = itemFromEvent(e);
    const f = hit ? view.app.vault.getAbstractFileByPath(hit.path) : null;
    if (f) showFileMenu(view, e, f, depth);
  });
  if (!import_obsidian10.Platform.isMobile) {
    list.addEventListener("dragstart", (e) => {
      var _a;
      const hit = itemFromEvent(e);
      const f = hit ? view.app.vault.getAbstractFileByPath(hit.path) : null;
      if (!f) return;
      notifyDragManager(view.app, e, f);
      (_a = e.dataTransfer) == null ? void 0 : _a.setData("text/plain", JSON.stringify([f.path]));
    });
  }
  if (import_obsidian10.Platform.isMobile) setupLongPress(view, list, depth);
  addResizeHandle(view, col, widthKey);
  return col;
}
function renderCalendarColumn(view, container) {
  var _a;
  const col = container.createDiv({ cls: "column-explorer-column column-explorer-calendar" });
  col.dataset.depth = "1";
  col.dataset.folderPath = CALENDAR_PATH;
  const customWidth = view.plugin.settings.columnWidths[CALENDAR_PATH];
  if (customWidth) col.style.setProperty("--ce-col-width", customWidth + "px");
  const header = col.createDiv({ cls: "column-explorer-column-header" });
  if (import_obsidian10.Platform.isMobile) addUpButton(view, header);
  header.createSpan({ cls: "column-explorer-column-title", text: t("calendar") });
  const { year, month } = view.currentCalendarMonth();
  const nav = col.createDiv({ cls: "column-explorer-cal-nav" });
  const prev = nav.createDiv({ cls: "clickable-icon", attr: { role: "button" } });
  (0, import_obsidian10.setIcon)(prev, "chevron-left");
  prev.addEventListener("click", () => view.navigateCalendarMonth(-1));
  const monthLabel = nav.createDiv({
    cls: "column-explorer-cal-month",
    text: new Date(year, month, 1).toLocaleDateString((0, import_obsidian10.getLanguage)(), { month: "long", year: "numeric" }),
    attr: { "aria-label": t("today"), role: "button" }
  });
  monthLabel.addEventListener("click", () => view.navigateCalendarMonth(0));
  const next = nav.createDiv({ cls: "clickable-icon", attr: { role: "button" } });
  (0, import_obsidian10.setIcon)(next, "chevron-right");
  next.addEventListener("click", () => view.navigateCalendarMonth(1));
  const counts = view.calendarCounts();
  const todayKey = dayKey(Date.now());
  const selectedDay = view.selectedDayKey();
  const grid = col.createDiv({ cls: "column-explorer-cal-grid" });
  for (let i = 0; i < 7; i++) {
    const weekday = new Date(2024, 0, 1 + i).toLocaleDateString((0, import_obsidian10.getLanguage)(), { weekday: "short" });
    grid.createDiv({ cls: "column-explorer-cal-weekday", text: weekday });
  }
  for (const week of monthGrid(year, month)) {
    for (const day of week) {
      const cell = grid.createDiv({ cls: "column-explorer-cal-cell" });
      if (!day) continue;
      cell.addClass("is-day");
      cell.dataset.day = day;
      if (day === todayKey) cell.addClass("is-today");
      if (day === selectedDay) cell.addClass("is-selected");
      cell.createDiv({ cls: "column-explorer-cal-daynum", text: String(Number(day.slice(8))) });
      const n = (_a = counts.get(day)) != null ? _a : 0;
      if (n > 0) cell.createDiv({ cls: "column-explorer-cal-count", text: String(n) });
    }
  }
  grid.addEventListener("click", (e) => {
    var _a2;
    const cell = (_a2 = e.target) == null ? void 0 : _a2.closest(".column-explorer-cal-cell.is-day");
    if (cell == null ? void 0 : cell.dataset.day) view.selectDay(cell.dataset.day);
  });
  addResizeHandle(view, col, CALENDAR_PATH);
  return col;
}
function renderStorageColumn(view, container) {
  var _a;
  const col = container.createDiv({ cls: "column-explorer-column column-explorer-storage" });
  col.dataset.depth = "1";
  col.dataset.folderPath = STORAGE_PATH;
  const customWidth = (_a = view.plugin.settings.columnWidths[STORAGE_PATH]) != null ? _a : DEFAULT_STORAGE_COLUMN_WIDTH;
  col.style.setProperty("--ce-col-width", customWidth + "px");
  const header = col.createDiv({ cls: "column-explorer-column-header" });
  if (import_obsidian10.Platform.isMobile) addUpButton(view, header);
  header.createSpan({ cls: "column-explorer-column-title", text: t("diskUsage") });
  view.sunburstController().mount(col);
  addResizeHandle(view, col, STORAGE_PATH);
  return col;
}
var finishActiveResize = null;
function commitActiveResize() {
  finishActiveResize == null ? void 0 : finishActiveResize();
}
function addResizeHandle(view, col, folderPath) {
  const handle = col.createDiv({ cls: "column-explorer-resize-handle" });
  handle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    commitActiveResize();
    const doc = col.ownerDocument;
    const startX = e.clientX;
    const startWidth = col.offsetWidth;
    let width = startWidth;
    const onMove = (ev) => {
      width = Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, startWidth + ev.clientX - startX));
      col.style.setProperty("--ce-col-width", width + "px");
      view.autoResizePanel();
    };
    const onUp = () => {
      doc.removeEventListener("mousemove", onMove);
      doc.removeEventListener("mouseup", onUp);
      finishActiveResize = null;
      if (width === startWidth) return;
      const s = view.plugin.settings;
      s.columnWidths = { ...s.columnWidths, [folderPath]: width };
      void view.plugin.saveSettings();
    };
    doc.addEventListener("mousemove", onMove);
    doc.addEventListener("mouseup", onUp);
    finishActiveResize = onUp;
  });
  handle.addEventListener("dblclick", () => {
    const s = view.plugin.settings;
    const rest = { ...s.columnWidths };
    delete rest[folderPath];
    s.columnWidths = rest;
    void view.plugin.saveSettings();
    if (folderPath === "/") {
      col.style.setProperty("--ce-col-width", s.columnWidth + ROOT_COLUMN_EXTRA_WIDTH + "px");
    } else {
      col.style.removeProperty("--ce-col-width");
    }
    view.autoResizePanel();
  });
}

// src/storage/sunburst.ts
var import_obsidian12 = require("obsidian");

// src/storage/color.ts
var HUE_OFFSET = 330;
var BASE_SATURATION = 74;
var BASE_LIGHTNESS = 54;
var SATURATION_FALLOFF_PER_RING = 7;
var LIGHTNESS_GAIN_PER_RING = 3.5;
var LEAF_SATURATION_DROP = 8;
var LEAF_LIGHTNESS_GAIN = 4;
function arcColor(midFraction, ring, isLeaf) {
  const hue = Math.round((midFraction * 360 + HUE_OFFSET) % 360);
  const saturation = Math.max(
    32,
    BASE_SATURATION - (ring - 1) * SATURATION_FALLOFF_PER_RING - (isLeaf ? LEAF_SATURATION_DROP : 0)
  );
  const lightness = Math.min(
    74,
    BASE_LIGHTNESS + (ring - 1) * LIGHTNESS_GAIN_PER_RING + (isLeaf ? LEAF_LIGHTNESS_GAIN : 0)
  );
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}
var REST_COLOR = "hsla(220, 5%, 55%, 0.35)";

// src/storage/exclude.ts
function makeExclusionFilter(rawEntries) {
  const prefixes = rawEntries.map((entry) => entry.trim().replace(/^\/+|\/+$/g, "")).filter((entry) => entry.length > 0);
  if (prefixes.length === 0) return () => false;
  return (path) => prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

// src/storage/format.ts
function formatPercent(part, whole) {
  if (whole <= 0) return "0%";
  const locale = localeCode();
  const pct = part / whole * 100;
  if (pct >= 99.95) return "100%";
  if (pct < 0.1) return `<${0.1.toLocaleString(locale)}%`;
  return `${pct.toLocaleString(locale, { maximumFractionDigits: 1 })}%`;
}

// src/storage/geometry.ts
var TAU = Math.PI * 2;
var FULL_CIRCLE_EPSILON = 1e-4;
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function lerp(from, to, t2) {
  return from + (to - from) * t2;
}
function easeInOutCubic(t2) {
  return t2 < 0.5 ? 4 * t2 * t2 * t2 : 1 - Math.pow(-2 * t2 + 2, 3) / 2;
}
function polar(radius, angle) {
  return [
    Math.round(Math.cos(angle) * radius * 100) / 100,
    Math.round(Math.sin(angle) * radius * 100) / 100
  ];
}
function fullAnnulusPath(r0, r1) {
  const [ax, ay] = polar(r1, 0);
  const [bx, by] = polar(r1, Math.PI);
  const [cx, cy] = polar(r0, 0);
  const [dx, dy] = polar(r0, Math.PI);
  return `M ${ax} ${ay} A ${r1} ${r1} 0 1 1 ${bx} ${by} A ${r1} ${r1} 0 1 1 ${ax} ${ay} Z M ${cx} ${cy} A ${r0} ${r0} 0 1 0 ${dx} ${dy} A ${r0} ${r0} 0 1 0 ${cx} ${cy} Z`;
}
function arcPath(a0, a1, r0, r1, gap = 0) {
  const span = a1 - a0;
  if (span <= 0 || r1 <= r0) return "";
  if (span >= TAU - FULL_CIRCLE_EPSILON) return fullAnnulusPath(r0, r1);
  const padAt = (r) => Math.min(gap / 2 / Math.max(r, 1), span / 2 * 0.9);
  const padInner = padAt(r0);
  const padOuter = padAt(r1);
  const outerStart = a0 + padOuter;
  const outerEnd = a1 - padOuter;
  const innerStart = a0 + padInner;
  const innerEnd = a1 - padInner;
  const largeOuter = outerEnd - outerStart > Math.PI ? 1 : 0;
  const largeInner = innerEnd - innerStart > Math.PI ? 1 : 0;
  const [ox0, oy0] = polar(r1, outerStart);
  const [ox1, oy1] = polar(r1, outerEnd);
  const [ix1, iy1] = polar(r0, innerEnd);
  const [ix0, iy0] = polar(r0, innerStart);
  return `M ${ox0} ${oy0} A ${r1} ${r1} 0 ${largeOuter} 1 ${ox1} ${oy1} L ${ix1} ${iy1} A ${r0} ${r0} 0 ${largeInner} 0 ${ix0} ${iy0} Z`;
}

// src/storage/layout.ts
function metricValue(node, metric) {
  if (metric === "size") return node.size;
  if (metric === "words") return node.words;
  return node.files;
}
function computeLayout(root, metric) {
  const angles = /* @__PURE__ */ new Map();
  const order = /* @__PURE__ */ new Map();
  const total = metricValue(root, metric);
  const place = (node, x0, x1) => {
    angles.set(node.path, { x0, x1 });
    if (!node.isFolder) return;
    const kids = node.children.filter((child) => metricValue(child, metric) > 0).sort((a, b) => metricValue(b, metric) - metricValue(a, metric));
    order.set(node.path, kids);
    const sum = kids.reduce((acc, child) => acc + metricValue(child, metric), 0);
    if (sum <= 0) return;
    const span = x1 - x0;
    let cursor = x0;
    for (const child of kids) {
      const width = metricValue(child, metric) / sum * span;
      place(child, cursor, cursor + width);
      cursor += width;
    }
  };
  if (total > 0) place(root, 0, 1);
  return { angles, order, total };
}
function pathDepth(path) {
  if (path === "/" || path === "") return 0;
  return path.split("/").length;
}

// src/storage/render.ts
var RING_COUNT = 5;
var MIN_RENDER_SPAN = 8e-4;
var MIN_VISIBLE_RING = 0.02;
function collectArcs(root, order, angleOf, view, valueOf, ringCount = RING_COUNT) {
  const arcs = [];
  const scale = 1 / Math.max(view.x1 - view.x0, 1e-9);
  const visit = (node, depth) => {
    var _a;
    const childRing = depth + 1 - view.depth;
    if (childRing > ringCount + 1) return;
    const kids = (_a = order.get(node.path)) != null ? _a : [];
    let restStart = null;
    let restEnd = 0;
    let restCount = 0;
    let restValue = 0;
    for (const kid of kids) {
      const angle = angleOf(kid.path);
      if (!angle) continue;
      const p0 = clamp((angle.x0 - view.x0) * scale, 0, 1);
      const p1 = clamp((angle.x1 - view.x0) * scale, 0, 1);
      const span = p1 - p0;
      if (span <= 0) continue;
      if (span < MIN_RENDER_SPAN) {
        if (childRing > MIN_VISIBLE_RING) {
          if (restStart === null) restStart = p0;
          restEnd = p1;
          restCount += kid.isFolder ? kid.files : 1;
          restValue += valueOf(kid);
        }
        continue;
      }
      if (childRing > MIN_VISIBLE_RING) {
        arcs.push({
          key: kid.path,
          path: kid.path,
          p0,
          p1,
          ring: childRing,
          isFolder: kid.isFolder,
          isRest: false,
          restCount: 0,
          restValue: 0
        });
      }
      if (kid.isFolder) visit(kid, depth + 1);
    }
    if (restStart !== null && restEnd - restStart >= MIN_RENDER_SPAN) {
      arcs.push({
        key: `${node.path}::rest`,
        path: node.path,
        p0: restStart,
        p1: restEnd,
        ring: childRing,
        isFolder: false,
        isRest: true,
        restCount,
        restValue
      });
    }
  };
  visit(root, 0);
  return arcs;
}

// src/storage/scan.ts
var import_obsidian11 = require("obsidian");

// src/storage/words.ts
var CJK_CHAR_RE = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/gu;
var WORD_RE = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;
function countWords(text) {
  var _a, _b, _c, _d;
  const cjkChars = (_b = (_a = text.match(CJK_CHAR_RE)) == null ? void 0 : _a.length) != null ? _b : 0;
  const rest = cjkChars > 0 ? text.replace(CJK_CHAR_RE, " ") : text;
  const words = (_d = (_c = rest.match(WORD_RE)) == null ? void 0 : _c.length) != null ? _d : 0;
  return cjkChars + words;
}

// src/storage/scan.ts
function buildTree(vault, wordsByPath, isExcluded = () => false) {
  const fromFolder = (folder) => {
    var _a;
    const children = [];
    for (const child of folder.children) {
      if (isExcluded(child.path)) continue;
      if (child instanceof import_obsidian11.TFolder) {
        const sub = fromFolder(child);
        if (sub.files > 0) children.push(sub);
      } else if (child instanceof import_obsidian11.TFile) {
        children.push({
          name: child.name,
          path: child.path,
          isFolder: false,
          size: child.stat.size,
          words: (_a = wordsByPath.get(child.path)) != null ? _a : 0,
          files: 1,
          children: []
        });
      }
    }
    return {
      name: folder.isRoot() ? vault.getName() : folder.name,
      path: folder.path,
      isFolder: true,
      size: children.reduce((sum, c) => sum + c.size, 0),
      words: children.reduce((sum, c) => sum + c.words, 0),
      files: children.reduce((sum, c) => sum + c.files, 0),
      children
    };
  };
  return fromFolder(vault.getRoot());
}
async function countVaultWords(vault, cache, onProgress, isExcluded = () => false) {
  const files = vault.getMarkdownFiles().filter((f) => !isExcluded(f.path));
  const result = /* @__PURE__ */ new Map();
  let done = 0;
  for (const file of files) {
    const cached = cache.get(file.path);
    if (cached && cached.mtime === file.stat.mtime) {
      result.set(file.path, cached.words);
    } else {
      let words = 0;
      try {
        words = countWords(await vault.cachedRead(file));
      } catch (e) {
      }
      cache.set(file.path, { mtime: file.stat.mtime, words });
      result.set(file.path, words);
    }
    done++;
    if (onProgress && (done % 50 === 0 || done === files.length)) {
      onProgress(done, files.length);
    }
  }
  for (const path of cache.keys()) {
    if (!result.has(path)) cache.delete(path);
  }
  return result;
}
function indexTree(root) {
  const index = /* @__PURE__ */ new Map();
  const walk = (node) => {
    index.set(node.path, node);
    for (const child of node.children) walk(child);
  };
  walk(root);
  return index;
}

// src/storage/sunburst.ts
var ANIM_MS = 750;
var INTRO_MS = 900;
var SECTOR_GAP_PX = 1.4;
var CENTER_RADIUS_FRACTION = 0.3;
var RESCAN_DEBOUNCE_MS = 2500;
var CENTER_NAME_MAX_CHARS = 20;
var SVG_NS = "http://www.w3.org/2000/svg";
var ROOT_PATH = "/";
var METRICS = ["size", "words", "files"];
var SunburstController = class extends import_obsidian12.Component {
  constructor(owner) {
    super();
    this.owner = owner;
    this.tree = null;
    this.nodeByPath = /* @__PURE__ */ new Map();
    this.layouts = {};
    this.wordCache = /* @__PURE__ */ new Map();
    this.wordsReady = false;
    this.metric = "size";
    this.rootPath = ROOT_PATH;
    this.view = { x0: 0, x1: 1, depth: 0 };
    this.radius = 280;
    this.animToken = 0;
    this.isClosed = false;
    this.rescanChain = Promise.resolve();
    this.hoveredKey = null;
    this.arcByKey = /* @__PURE__ */ new Map();
    this.pool = /* @__PURE__ */ new Map();
    this.metricBtns = {};
    this.resizeObserver = null;
    this.lastSettingsKey = `${owner.plugin.settings.storageExcluded}|${owner.plugin.settings.storageRingCount}`;
    this.el = createDiv({ cls: "column-explorer-du" });
    const header = this.el.createDiv({ cls: "column-explorer-du-header" });
    this.breadcrumbEl = header.createDiv({ cls: "column-explorer-du-crumbs" });
    const controls = header.createDiv({ cls: "column-explorer-du-controls" });
    const seg = controls.createDiv({ cls: "column-explorer-du-seg" });
    const labels = {
      size: t("duSize"),
      words: t("duWords"),
      files: t("duFiles")
    };
    for (const metric of METRICS) {
      const btn = seg.createEl("button", {
        text: labels[metric],
        cls: `column-explorer-du-seg-btn${metric === this.metric ? " is-active" : ""}`
      });
      btn.addEventListener("click", () => this.setMetric(metric));
      this.metricBtns[metric] = btn;
    }
    const wordsBtn = this.metricBtns.words;
    if (wordsBtn) wordsBtn.disabled = true;
    const refreshBtn = controls.createEl("button", { cls: "column-explorer-du-icon-btn" });
    (0, import_obsidian12.setIcon)(refreshBtn, "refresh-cw");
    (0, import_obsidian12.setTooltip)(refreshBtn, t("duRescan"));
    refreshBtn.addEventListener("click", () => void this.rescan(false));
    this.chartWrap = this.el.createDiv({ cls: "column-explorer-du-chart" });
    this.svg = document.createElementNS(SVG_NS, "svg");
    this.svg.classList.add("column-explorer-du-svg");
    this.chartWrap.appendChild(this.svg);
    this.gArcs = document.createElementNS(SVG_NS, "g");
    this.svg.appendChild(this.gArcs);
    this.buildCenter();
    this.tooltipEl = this.chartWrap.createDiv({ cls: "column-explorer-du-tooltip" });
    this.emptyEl = this.chartWrap.createDiv({ cls: "column-explorer-du-empty" });
    this.emptyEl.hide();
    const svgEl = this.svg;
    this.registerDomEvent(svgEl, "click", (e) => this.onClick(e));
    this.registerDomEvent(svgEl, "contextmenu", (e) => this.onContextMenu(e));
    this.registerDomEvent(svgEl, "mouseover", (e) => this.onOver(e));
    this.registerDomEvent(svgEl, "mouseout", (e) => this.onOut(e));
    this.registerDomEvent(svgEl, "mousemove", (e) => this.onMove(e));
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.chartWrap);
    }
    this.updateGeometry();
    const scheduleRescan = (0, import_obsidian12.debounce)(() => void this.rescan(false), RESCAN_DEBOUNCE_MS, true);
    const vault = this.app.vault;
    this.registerEvent(vault.on("create", scheduleRescan));
    this.registerEvent(vault.on("delete", scheduleRescan));
    this.registerEvent(vault.on("rename", scheduleRescan));
    this.registerEvent(vault.on("modify", scheduleRescan));
    void this.rescan(true);
  }
  get app() {
    return this.owner.app;
  }
  /**
   * Перенос готового элемента в свежую колонку — без пересборки диаграммы.
   * Заодно единственное место, где видно изменение настроек: колонка
   * перерисовывается после сохранения, а рескан нужен только если поменялись
   * исключения или число колец.
   */
  mount(container) {
    container.appendChild(this.el);
    const key = this.settingsKey();
    if (key !== this.lastSettingsKey) {
      this.lastSettingsKey = key;
      if (this.tree) void this.rescan(false);
    }
    this.handleResize();
  }
  settingsKey() {
    const s = this.owner.plugin.settings;
    return `${s.storageExcluded}|${s.storageRingCount}`;
  }
  onunload() {
    var _a;
    this.isClosed = true;
    this.animToken++;
    (_a = this.resizeObserver) == null ? void 0 : _a.disconnect();
    this.resizeObserver = null;
    this.el.detach();
  }
  /** Escape и клик по центру: шаг зума наружу. `false` — зумить больше некуда. */
  zoomOut() {
    if (this.rootPath === ROOT_PATH) return false;
    this.zoomTo(parentPath(this.rootPath));
    return true;
  }
  /* --------------------------------------------------------- сканирование */
  excluded() {
    return makeExclusionFilter(this.owner.plugin.settings.storageExcluded.split(","));
  }
  rings() {
    return this.owner.plugin.settings.storageRingCount;
  }
  /**
   * Сканы выстраиваются в очередь: событие vault, настройки и кнопка не
   * пересекаются. Отказ гасится здесь же: rejected-промис в хвосте цепочки
   * молча проглотил бы ВСЕ последующие сканы, и диаграмма навсегда застыла
   * бы на старых данных. Скан — best effort, как и словосчёт внутри него.
   */
  rescan(intro) {
    this.rescanChain = this.rescanChain.then(() => this.doRescan(intro)).catch(() => {
    });
    return this.rescanChain;
  }
  async doRescan(intro) {
    var _a, _b;
    if (this.isClosed) return;
    const isExcluded = this.excluded();
    if (!this.tree) {
      this.rebuild(/* @__PURE__ */ new Map(), isExcluded);
      this.drawStatic();
      if (intro) this.playIntro();
    }
    const wordsBtn = this.metricBtns.words;
    const words = await countVaultWords(
      this.app.vault,
      this.wordCache,
      (done, total) => {
        if (!this.wordsReady && !this.isClosed && wordsBtn) {
          wordsBtn.setText(`${t("duWords")} ${Math.round(done / total * 100)}%`);
        }
      },
      isExcluded
    );
    if (this.isClosed) return;
    this.rebuild(words, isExcluded);
    this.wordsReady = true;
    if (wordsBtn) {
      wordsBtn.setText(t("duWords"));
      wordsBtn.disabled = ((_b = (_a = this.layouts.words) == null ? void 0 : _a.total) != null ? _b : 0) <= 0;
      if (wordsBtn.disabled) (0, import_obsidian12.setTooltip)(wordsBtn, t("duNoWords"));
    }
    if (!intro) this.drawStatic();
  }
  rebuild(words, isExcluded) {
    this.tree = buildTree(this.app.vault, words, isExcluded);
    this.nodeByPath = indexTree(this.tree);
    this.layouts = {
      size: computeLayout(this.tree, "size"),
      words: computeLayout(this.tree, "words"),
      files: computeLayout(this.tree, "files")
    };
    if (!this.nodeByPath.has(this.rootPath) || !this.layout().angles.has(this.rootPath)) {
      this.rootPath = ROOT_PATH;
    }
    this.view = this.viewFor(this.rootPath);
    this.updateBreadcrumbs();
    this.updateEmptyState();
  }
  layout() {
    const layout = this.layouts[this.metric];
    if (!layout) throw new Error("Column Explorer: disk usage layout is not ready");
    return layout;
  }
  viewFor(path) {
    var _a;
    const angle = (_a = this.layout().angles.get(path)) != null ? _a : { x0: 0, x1: 1 };
    return { x0: angle.x0, x1: angle.x1, depth: pathDepth(path) };
  }
  /* ------------------------------------------------------------ отрисовка */
  updateGeometry() {
    const w = this.chartWrap.clientWidth || 600;
    const h = this.chartWrap.clientHeight || 500;
    this.radius = Math.max(80, Math.min(w, h) / 2 - 12);
    const pad = this.radius + 6;
    this.svg.setAttribute("viewBox", `${-pad} ${-pad} ${pad * 2} ${pad * 2}`);
    this.centerCircle.setAttribute("r", String(this.centerR()));
    this.scaleCenterText();
  }
  centerR() {
    return this.radius * CENTER_RADIUS_FRACTION;
  }
  ringT() {
    return (this.radius - this.centerR()) / this.rings();
  }
  staticLookup() {
    const angles = this.layout().angles;
    return (path) => angles.get(path);
  }
  drawStatic() {
    this.draw(this.staticLookup(), this.view);
    this.updateCenter(null);
  }
  draw(angleOf, view) {
    if (!this.tree) return;
    const layout = this.layout();
    const metric = this.metric;
    const rings = this.rings();
    const arcs = collectArcs(this.tree, layout.order, angleOf, view, (n) => metricValue(n, metric), rings);
    this.arcByKey = new Map(arcs.map((a) => [a.key, a]));
    const centerRadius = this.centerR();
    const ringThickness = this.ringT();
    const seen = /* @__PURE__ */ new Set();
    for (const arc of arcs) {
      const r0 = clamp(centerRadius + (arc.ring - 1) * ringThickness, centerRadius, this.radius);
      const r1 = clamp(centerRadius + arc.ring * ringThickness, centerRadius, this.radius);
      if (r1 - r0 < 0.5) continue;
      const a0 = arc.p0 * TAU - Math.PI / 2;
      const a1 = arc.p1 * TAU - Math.PI / 2;
      const d = arcPath(a0, a1, r0, r1, SECTOR_GAP_PX);
      if (!d) continue;
      seen.add(arc.key);
      let el = this.pool.get(arc.key);
      if (!el) {
        el = document.createElementNS(SVG_NS, "path");
        el.setAttribute("fill-rule", "evenodd");
        el.setAttribute("data-key", arc.key);
        el.classList.add("column-explorer-du-arc");
        this.gArcs.appendChild(el);
        this.pool.set(arc.key, el);
      }
      el.setAttribute("d", d);
      el.classList.toggle("is-rest", arc.isRest);
      el.classList.toggle("is-clickable", arc.isFolder);
      el.setAttribute(
        "fill",
        arc.isRest ? REST_COLOR : arcColor((arc.p0 + arc.p1) / 2, clamp(Math.round(arc.ring), 1, rings), !arc.isFolder)
      );
    }
    for (const [key, el] of this.pool) {
      if (seen.has(key)) continue;
      el.remove();
      this.pool.delete(key);
    }
  }
  /* ------------------------------------------------------------- анимации */
  animate(frame, durationMs, onDone) {
    const token = ++this.animToken;
    this.svg.classList.add("is-animating");
    const start = performance.now();
    const tick = (now) => {
      if (token !== this.animToken) return;
      const progress = clamp((now - start) / durationMs, 0, 1);
      frame(easeInOutCubic(progress));
      if (progress < 1) {
        window.requestAnimationFrame(tick);
        return;
      }
      this.svg.classList.remove("is-animating");
      onDone == null ? void 0 : onDone();
    };
    window.requestAnimationFrame(tick);
  }
  playIntro() {
    const angles = this.layout().angles;
    const view = this.view;
    this.animate(
      (t2) => {
        const sweep = (path) => {
          const a = angles.get(path);
          return a ? { x0: a.x0 * t2, x1: a.x1 * t2 } : void 0;
        };
        this.draw(sweep, view);
      },
      INTRO_MS,
      () => this.drawStatic()
    );
  }
  zoomTo(path) {
    if (path === this.rootPath || !this.layout().angles.has(path)) return;
    const from = { ...this.view };
    const to = this.viewFor(path);
    this.rootPath = path;
    this.view = to;
    this.clearHover();
    this.updateBreadcrumbs();
    const look = this.staticLookup();
    this.animate(
      (t2) => {
        this.draw(look, {
          x0: lerp(from.x0, to.x0, t2),
          x1: lerp(from.x1, to.x1, t2),
          depth: lerp(from.depth, to.depth, t2)
        });
      },
      ANIM_MS,
      () => this.drawStatic()
    );
    this.updateCenter(null);
  }
  setMetric(metric) {
    var _a;
    if (metric === this.metric || !this.tree) return;
    const oldLayout = this.layout();
    const oldView = { ...this.view };
    this.metric = metric;
    for (const m of METRICS) {
      (_a = this.metricBtns[m]) == null ? void 0 : _a.classList.toggle("is-active", m === metric);
    }
    const newLayout = this.layout();
    if (!newLayout.angles.has(this.rootPath)) this.rootPath = ROOT_PATH;
    const newView = this.viewFor(this.rootPath);
    this.view = newView;
    this.clearHover();
    this.updateBreadcrumbs();
    this.updateEmptyState();
    const collapsedAt = (b) => {
      const mid = (b.x0 + b.x1) / 2;
      return { x0: mid, x1: mid };
    };
    this.animate(
      (t2) => {
        const morph = (path) => {
          var _a2;
          const to = newLayout.angles.get(path);
          if (!to) return void 0;
          const from = (_a2 = oldLayout.angles.get(path)) != null ? _a2 : collapsedAt(to);
          return { x0: lerp(from.x0, to.x0, t2), x1: lerp(from.x1, to.x1, t2) };
        };
        this.draw(morph, {
          x0: lerp(oldView.x0, newView.x0, t2),
          x1: lerp(oldView.x1, newView.x1, t2),
          depth: lerp(oldView.depth, newView.depth, t2)
        });
      },
      ANIM_MS,
      () => this.drawStatic()
    );
    this.updateCenter(null);
  }
  /* --------------------------------------------------------- взаимодействие */
  arcFromEvent(e) {
    var _a, _b;
    const target = e.target;
    const pathEl = (_a = target == null ? void 0 : target.closest) == null ? void 0 : _a.call(target, "path[data-key]");
    const key = pathEl == null ? void 0 : pathEl.getAttribute("data-key");
    return key ? (_b = this.arcByKey.get(key)) != null ? _b : null : null;
  }
  onClick(e) {
    var _a;
    const target = e.target;
    if ((_a = target == null ? void 0 : target.closest) == null ? void 0 : _a.call(target, ".column-explorer-du-center")) {
      this.zoomOut();
      return;
    }
    const arc = this.arcFromEvent(e);
    if (!arc || arc.isRest) return;
    if (arc.isFolder) {
      this.zoomTo(arc.path);
      return;
    }
    this.openInNewTab(arc.path);
  }
  onContextMenu(e) {
    const arc = this.arcFromEvent(e);
    if (!arc || arc.isRest) return;
    e.preventDefault();
    const menu = new import_obsidian12.Menu();
    if (arc.isFolder) {
      menu.addItem((item) => item.setTitle(t("duZoomIn")).setIcon("zoom-in").onClick(() => this.zoomTo(arc.path)));
    } else {
      menu.addItem((item) => item.setTitle(t("openNewTab")).setIcon("file-plus").onClick(() => this.openInNewTab(arc.path)));
    }
    menu.addItem((item) => item.setTitle(t("duReveal")).setIcon("locate").onClick(() => this.owner.revealFile(this.app.vault.getAbstractFileByPath(arc.path))));
    menu.addItem((item) => item.setTitle(t("copyPath")).setIcon("copy").onClick(() => void this.copyPath(arc.path)));
    menu.showAtMouseEvent(e);
  }
  /** writeText реджектится при потере фокуса окна — молчать нельзя. */
  async copyPath(path) {
    try {
      await navigator.clipboard.writeText(path);
      new import_obsidian12.Notice(t("pathCopied"));
    } catch (e) {
      new import_obsidian12.Notice(t("copyFailed"));
    }
  }
  openInNewTab(path) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof import_obsidian12.TFile) void this.app.workspace.getLeaf("tab").openFile(file);
  }
  onOver(e) {
    const arc = this.arcFromEvent(e);
    if (!arc || arc.key === this.hoveredKey) return;
    this.hoveredKey = arc.key;
    this.applyHover(arc);
  }
  onOut(e) {
    const arc = this.arcFromEvent(e);
    if (arc && arc.key === this.hoveredKey) this.clearHover();
  }
  onMove(e) {
    if (!this.hoveredKey) return;
    const rect = this.chartWrap.getBoundingClientRect();
    const x = clamp(e.clientX - rect.left + 14, 0, rect.width - this.tooltipEl.offsetWidth - 4);
    const y = clamp(e.clientY - rect.top + 16, 0, rect.height - this.tooltipEl.offsetHeight - 4);
    this.tooltipEl.style.transform = `translate(${x}px, ${y}px)`;
  }
  applyHover(arc) {
    this.svg.classList.add("has-hover");
    const prefix = `${arc.path}/`;
    for (const [key, el] of this.pool) {
      const hit = arc.isRest ? key === arc.key : key === arc.key || key.startsWith(prefix);
      el.classList.toggle("is-highlighted", hit);
    }
    this.showTooltip(arc);
    this.updateCenter(arc);
  }
  clearHover() {
    this.hoveredKey = null;
    this.svg.classList.remove("has-hover");
    for (const el of this.pool.values()) el.classList.remove("is-highlighted");
    this.tooltipEl.removeClass("is-visible");
    this.updateCenter(null);
  }
  /* ------------------------------------------------------------------- UI */
  buildCenter() {
    const g = document.createElementNS(SVG_NS, "g");
    g.classList.add("column-explorer-du-center");
    this.centerCircle = document.createElementNS(SVG_NS, "circle");
    this.centerCircle.classList.add("column-explorer-du-center-circle");
    g.appendChild(this.centerCircle);
    this.centerName = document.createElementNS(SVG_NS, "text");
    this.centerName.classList.add("column-explorer-du-center-name");
    this.centerValue = document.createElementNS(SVG_NS, "text");
    this.centerValue.classList.add("column-explorer-du-center-value");
    this.centerMeta = document.createElementNS(SVG_NS, "text");
    this.centerMeta.classList.add("column-explorer-du-center-meta");
    g.appendChild(this.centerName);
    g.appendChild(this.centerValue);
    g.appendChild(this.centerMeta);
    this.svg.appendChild(g);
  }
  /** Текст в центре кегль в кегль под текущий радиус круга. */
  scaleCenterText() {
    const base = this.centerR();
    this.centerName.setAttribute("y", String(-base * 0.28));
    this.centerName.style.fontSize = `${Math.max(11, base * 0.16)}px`;
    this.centerValue.setAttribute("y", String(base * 0.08));
    this.centerValue.style.fontSize = `${Math.max(13, base * 0.22)}px`;
    this.centerMeta.setAttribute("y", String(base * 0.38));
    this.centerMeta.style.fontSize = `${Math.max(10, base * 0.13)}px`;
  }
  formatValue(value) {
    if (this.metric === "size") return humanSize(value);
    if (this.metric === "words") return tPlural("duWordCount", value);
    return tPlural("duFileCount", value);
  }
  /** Вторая строка: число файлов, а если метрика уже файлы — размер. */
  formatMeta(node) {
    return this.metric === "files" ? humanSize(node.size) : tPlural("duFileCount", node.files);
  }
  updateCenter(hovered) {
    const rootNode = this.nodeByPath.get(this.rootPath);
    if (!rootNode) return;
    const rootValue = metricValue(rootNode, this.metric);
    if (hovered == null ? void 0 : hovered.isRest) {
      this.centerName.textContent = tPlural("duSmallItem", hovered.restCount);
      this.centerValue.textContent = this.formatValue(hovered.restValue);
      this.centerMeta.textContent = formatPercent(hovered.restValue, rootValue);
      return;
    }
    const node = hovered ? this.nodeByPath.get(hovered.path) : rootNode;
    if (!node) return;
    const value = metricValue(node, this.metric);
    this.centerName.textContent = truncate(node.name, CENTER_NAME_MAX_CHARS);
    this.centerValue.textContent = this.formatValue(value);
    this.centerMeta.textContent = hovered ? `${formatPercent(value, rootValue)} \xB7 ${this.formatMeta(node)}` : this.formatMeta(node);
  }
  showTooltip(arc) {
    this.tooltipEl.empty();
    const rootNode = this.nodeByPath.get(this.rootPath);
    const rootValue = rootNode ? metricValue(rootNode, this.metric) : 0;
    if (arc.isRest) {
      this.tooltipEl.createDiv({ cls: "column-explorer-du-tip-name", text: tPlural("duSmallItem", arc.restCount) });
      this.tooltipEl.createDiv({
        cls: "column-explorer-du-tip-meta",
        text: `${this.formatValue(arc.restValue)} \xB7 ${formatPercent(arc.restValue, rootValue)}`
      });
    } else {
      const node = this.nodeByPath.get(arc.path);
      if (!node) return;
      const value = metricValue(node, this.metric);
      this.tooltipEl.createDiv({ cls: "column-explorer-du-tip-name", text: node.name });
      this.tooltipEl.createDiv({
        cls: "column-explorer-du-tip-meta",
        text: `${this.formatValue(value)} \xB7 ${formatPercent(value, rootValue)} \xB7 ${this.formatMeta(node)}`
      });
    }
    this.tooltipEl.addClass("is-visible");
  }
  updateBreadcrumbs() {
    var _a, _b;
    this.breadcrumbEl.empty();
    const vaultName = (_b = (_a = this.tree) == null ? void 0 : _a.name) != null ? _b : this.app.vault.getName();
    const segments = this.rootPath === ROOT_PATH ? [] : this.rootPath.split("/");
    const addCrumb = (label, path, isLast) => {
      const btn = this.breadcrumbEl.createEl("button", {
        cls: `column-explorer-du-crumb${isLast ? " is-current" : ""}`,
        text: label
      });
      if (!isLast) btn.addEventListener("click", () => this.zoomTo(path));
    };
    addCrumb(vaultName, ROOT_PATH, segments.length === 0);
    segments.forEach((segment, i) => {
      this.breadcrumbEl.createSpan({ cls: "column-explorer-du-crumb-sep", text: "\u203A" });
      addCrumb(segment, segments.slice(0, i + 1).join("/"), i === segments.length - 1);
    });
  }
  updateEmptyState() {
    var _a, _b;
    const total = (_b = (_a = this.layouts[this.metric]) == null ? void 0 : _a.total) != null ? _b : 0;
    if (total > 0) {
      this.emptyEl.hide();
      return;
    }
    this.emptyEl.setText(this.metric === "words" ? t("duNoWords") : t("duEmpty"));
    this.emptyEl.show();
  }
  handleResize() {
    this.updateGeometry();
    if (this.tree) this.drawStatic();
  }
};
function parentPath(path) {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? ROOT_PATH : path.slice(0, idx);
}
function truncate(text, max) {
  return text.length <= max ? text : `${text.slice(0, max - 1)}\u2026`;
}

// src/view.ts
var VIEW_TYPE_COLUMNS = "column-explorer-view";
var TYPEAHEAD_RESET_MS = 700;
var PAGE_JUMP = 10;
var RENAME_START_DELAY_MS = 100;
var ColumnExplorerView = class extends import_obsidian13.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    /** Selected path at each depth. */
    this.selection = [];
    /** Multi-selection (Ctrl/Cmd or Shift click) within one column. */
    this.multiSel = /* @__PURE__ */ new Set();
    this.multiSelDepth = -1;
    this.shiftAnchor = null;
    this.filter = "";
    this.renamingPath = null;
    /** Мобильная строка поиска под toolbar (на desktop поиск живёт в toolbar). */
    this.searchRowEl = null;
    this.searchOpen = false;
    /** Мобильный режим множественного выделения (включается long-press). */
    this.mobileSelActive = false;
    this.typeaheadBuffer = "";
    this.typeaheadTimer = 0;
    /** Отложенный старт инлайн-переименования после создания файла/папки. */
    this.renameTimer = 0;
    /** Показанный месяц календаря; null — от выбранного дня или сегодня. */
    this.calendarMonth = null;
    /** Кеш «файлы по дню создания» и отпечаток exclude-паттернов при его сборке. */
    this.filesByDayCache = null;
    this.filesByDayKey = "";
    /** Владелец markdown-превью колонки: живёт до следующего рендера. */
    this.previewOwner = null;
    /** Диаграмма «Использование диска»; создаётся при первом показе колонки. */
    this.sunburst = null;
    /**
     * Внутренний буфер Copy/Cut/Paste. Не системный clipboard: класть файлы
     * в OS-буфер из Obsidian кроссплатформенно нельзя.
     */
    this.fileClipboard = null;
    /** Стек истории навигации (снимки selection) для кнопок назад/вперёд. */
    this.history = [];
    this.historyIndex = -1;
    /** Флаг: идёт переход по истории — не писать новую запись в стек. */
    this.navigatingHistory = false;
    /** Targeted refresh: folders whose columns need re-rendering. */
    this.dirtyFolders = /* @__PURE__ */ new Set();
    this.fullRenderPending = false;
    this.flushRefresh = (0, import_obsidian13.debounce)(() => this.doRefresh(), 60, true);
    /** Дебаунс поиска: полный render на каждую букву лагает на больших vault */
    this.applyFilter = (0, import_obsidian13.debounce)(() => {
      this.filter = this.searchInput.value.trim();
      this.filterMatcher = this.filter ? (0, import_obsidian13.prepareFuzzySearch)(this.filter) : null;
      this.render();
    }, 150, true);
    /** Матчер текущего запроса; null — фильтр выключен. */
    this.filterMatcher = null;
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_COLUMNS;
  }
  getDisplayText() {
    return "Column Explorer";
  }
  getIcon() {
    return "columns-3";
  }
  /* --------- state persistence (restores selection on restart) ----- */
  getState() {
    return { selection: this.selection };
  }
  async setState(state, result) {
    if (Array.isArray(state == null ? void 0 : state.selection)) {
      this.selection = state.selection.filter((p) => typeof p === "string");
      if (this.columnsEl) this.render();
    }
    return super.setState(state, result);
  }
  persistState() {
    this.app.workspace.requestSaveLayout();
  }
  /* ------------------------------ setup ---------------------------- */
  async onOpen() {
    var _a, _b, _c, _d, _e;
    const container = this.contentEl;
    container.empty();
    container.addClass("column-explorer-container");
    const toolbar = container.createDiv({ cls: "column-explorer-toolbar" });
    if (import_obsidian13.Platform.isMobile) {
      this.updateMobileToolbar = buildMobileToolbar(this, toolbar);
    } else {
      this.addToolbarButton(toolbar, "file-plus", t("newNote"), () => void this.createNote(this.currentFolder()));
      this.addToolbarButton(toolbar, "folder-plus", t("newFolder"), () => void this.createFolder(this.currentFolder()));
      this.addToolbarButton(toolbar, "locate", t("reveal"), () => this.revealFile(this.app.workspace.getActiveFile()));
      this.addToolbarButton(toolbar, "arrow-up-narrow-wide", t("sort"), (e) => showSortMenu(this, e));
      this.addToolbarButton(toolbar, "chevrons-left", t("collapse"), () => this.collapseToRoot());
      this.lockBtn = this.addToolbarButton(toolbar, "lock-open", t("lockPanel"), () => {
        const s = this.plugin.settings;
        s.lockedColumnCount = s.lockedColumnCount === null ? this.folderColumnCount() : null;
        void this.plugin.saveSettings();
        this.render();
      });
      this.updateLockButton();
      this.widthLockBtn = toolbar.createEl("button", {
        cls: "clickable-icon column-explorer-toolbar-btn",
        attr: { type: "button", "aria-label": t("lockColumnWidths"), "data-action": "lock-column-widths" }
      });
      (0, import_obsidian13.setIcon)(this.widthLockBtn, "ruler");
      this.registerDomEvent(this.widthLockBtn, "click", () => {
        this.plugin.settings.lockColumnWidths = !this.plugin.settings.lockColumnWidths;
        void this.plugin.saveSettings();
        this.render();
      });
    }
    if (import_obsidian13.Platform.isMobile) {
      this.searchRowEl = container.createDiv({ cls: "column-explorer-search-row" });
      this.searchRowEl.hide();
    }
    this.searchInput = ((_a = this.searchRowEl) != null ? _a : toolbar).createEl("input", {
      type: "search",
      cls: "column-explorer-search",
      attr: { placeholder: t("search"), "aria-label": t("search") }
    });
    this.registerDomEvent(this.searchInput, "input", () => this.applyFilter());
    this.registerDomEvent(this.searchInput, "keydown", (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (this.searchOpen) {
        this.toggleMobileSearch();
        return;
      }
      this.clearFilter();
      this.columnsEl.focus();
    });
    this.breadcrumbsEl = container.createDiv({
      cls: "column-explorer-breadcrumbs",
      attr: { role: "navigation", "aria-label": "Breadcrumbs" }
    });
    this.columnsEl = container.createDiv({ cls: "column-explorer-columns" });
    this.columnsEl.tabIndex = 0;
    this.registerDomEvent(this.columnsEl, "keydown", (e) => this.onKeyDown(e));
    setupGlobalDnd(this);
    if (import_obsidian13.Platform.isMobile) {
      this.updateActionBar = buildActionBar(this, container);
      setupEdgeSwipe(this, this.columnsEl);
      setupViewportTracking(this, container);
      this.applyMobileScale();
      this.registerDomEvent(window, "resize", (0, import_obsidian13.debounce)(() => this.applyMobileScale(), 150, true));
    }
    this.registerEvent(this.app.vault.on("create", (f) => {
      var _a2, _b2;
      this.invalidateCalendarCache();
      this.markDirty(this.specialKind(this.selection[0]) ? null : (_b2 = (_a2 = f.parent) == null ? void 0 : _a2.path) != null ? _b2 : null);
    }));
    this.registerEvent(this.app.vault.on("delete", (f) => {
      var _a2, _b2;
      this.invalidateCalendarCache();
      const changed = this.pruneSelection(f.path);
      this.prunePathRecords(f.path);
      const fullRender = changed || this.specialKind(this.selection[0]) !== null;
      this.markDirty(fullRender ? null : (_b2 = (_a2 = f.parent) == null ? void 0 : _a2.path) != null ? _b2 : null);
    }));
    this.registerEvent(this.app.vault.on("rename", (f, oldPath) => {
      this.invalidateCalendarCache();
      this.remapSelection(oldPath, f.path);
      this.remapPathRecords(oldPath, f.path);
      this.markDirty(null);
    }));
    try {
      const app = this.app;
      const ref = (_e = (_d = (_c = (_b = app.internalPlugins) == null ? void 0 : _b.getEnabledPluginById) == null ? void 0 : _c.call(_b, "bookmarks")) == null ? void 0 : _d.on) == null ? void 0 : _e.call(_d, "changed", () => {
        if (this.selection[0] === BOOKMARKS_PATH) this.render();
      });
      if (ref) this.registerEvent(ref);
    } catch (e) {
    }
    this.render();
  }
  /**
   * Обсерверы и таймеры переживают закрытие вью: отложенный рендер попал бы
   * в оторванный DOM, а активный IntersectionObserver держит свой список
   * от сборки мусора. registerDomEvent/registerEvent Obsidian снимает сам.
   */
  async onClose() {
    this.flushRefresh.cancel();
    this.applyFilter.cancel();
    window.clearTimeout(this.typeaheadTimer);
    window.clearTimeout(this.renameTimer);
    commitActiveResize();
    clearActiveDrag();
    if (this.columnsEl) disconnectListObservers(this.columnsEl);
  }
  addToolbarButton(parent, icon, tooltip, onClick) {
    const btn = parent.createDiv({ cls: "clickable-icon column-explorer-toolbar-btn", attr: { "aria-label": tooltip } });
    (0, import_obsidian13.setIcon)(btn, icon);
    this.registerDomEvent(btn, "click", onClick);
    return btn;
  }
  updateLockButton() {
    if (!this.lockBtn) return;
    const locked = this.plugin.settings.lockedColumnCount !== null;
    (0, import_obsidian13.setIcon)(this.lockBtn, locked ? "lock" : "lock-open");
    this.lockBtn.setAttribute("aria-label", locked ? t("unlockPanel") : t("lockPanel"));
    this.lockBtn.toggleClass("is-active", locked);
  }
  /* ------------------------------ mobile --------------------------- */
  canGoBack() {
    return this.historyIndex > 0;
  }
  canGoForward() {
    return this.historyIndex < this.history.length - 1;
  }
  goBack() {
    this.navigateHistory(-1);
  }
  goForward() {
    this.navigateHistory(1);
  }
  isSearchOpen() {
    return this.searchOpen;
  }
  /** Команда «Фокус на панель»: клавиатурная навигация без мыши. */
  focusColumns() {
    this.columnsEl.focus();
  }
  isMobileSelecting() {
    return this.mobileSelActive;
  }
  /** Мобильные размеры в CSS-переменных: слайдеры настроек зовут это вместо render(). */
  applyMobileScale() {
    if (!import_obsidian13.Platform.isMobile) return;
    applyMobileScale(this, this.contentEl);
  }
  collapseToRoot() {
    this.selection = [];
    this.clearMulti();
    this.render();
  }
  /** Мобильная строка поиска: раскрыть или закрыть со сбросом фильтра. */
  toggleMobileSearch() {
    var _a, _b, _c;
    this.searchOpen = !this.searchOpen;
    if (this.searchOpen) {
      (_a = this.searchRowEl) == null ? void 0 : _a.show();
      this.searchInput.focus();
    } else {
      (_b = this.searchRowEl) == null ? void 0 : _b.hide();
      if (this.hasFilter()) this.clearFilter();
      else this.searchInput.value = "";
    }
    (_c = this.updateMobileToolbar) == null ? void 0 : _c.call(this);
  }
  /** Selection родительской колонки, либо null — уже в корне. */
  parentOfSelection() {
    return parentSelection(this.selection, (p) => this.app.vault.getAbstractFileByPath(p) instanceof import_obsidian13.TFolder);
  }
  canGoUp() {
    return this.parentOfSelection() !== null;
  }
  /** Стрелка в заголовке колонки: на уровень вверх (не путать с историей). */
  goUp() {
    const parent = this.parentOfSelection();
    if (!parent) return;
    this.selection = parent;
    this.clearMulti();
    this.persistState();
    this.render();
  }
  enterMobileSelection(f, depth) {
    if (this.multiSelDepth !== depth) this.clearMulti();
    this.multiSelDepth = depth;
    this.multiSel.add(f.path);
    this.mobileSelActive = true;
    this.syncMultiSelDom();
  }
  toggleMobileSelection(f, depth) {
    this.applyToggleMulti(f, depth);
    this.mobileSelActive = mobileSelectionMode(true, this.multiSel.size);
    this.syncMultiSelDom();
  }
  exitMobileSelection() {
    this.mobileSelActive = false;
    this.clearMulti();
    this.syncMultiSelDom();
  }
  /** Выделение меняет только классы элементов — полный render не нужен. */
  syncMultiSelDom() {
    var _a, _b;
    this.columnsEl.querySelectorAll(".column-explorer-item.is-multi-selected").forEach((el) => el.removeClass("is-multi-selected"));
    for (const path of this.multiSel) {
      (_a = this.columnsEl.querySelector(
        `.column-explorer-item[data-path="${CSS.escape(path)}"]`
      )) == null ? void 0 : _a.addClass("is-multi-selected");
    }
    (_b = this.updateActionBar) == null ? void 0 : _b.call(this);
  }
  /* -------------------------- shared accessors --------------------- */
  /** Visible (exclude-filtered, sorted, search-filtered) children of a folder. */
  childrenOf(folder) {
    const children = visibleChildren(folder, this.plugin.settings);
    return filterByMatcher(children, displayName, this.filterMatcher, (c) => c instanceof import_obsidian13.TFolder);
  }
  /** Совпадение имени с текущим запросом — для подсветки в списке. */
  matchOf(name) {
    var _a, _b;
    return (_b = (_a = this.filterMatcher) == null ? void 0 : _a.call(this, name)) != null ? _b : null;
  }
  hasFilter() {
    return this.filter.length > 0;
  }
  filterQuery() {
    return this.filter;
  }
  clearFilter() {
    this.filterMatcher = null;
    this.filter = "";
    this.searchInput.value = "";
    this.render();
  }
  isRenaming(path) {
    return this.renamingPath === path;
  }
  selectedFilePath() {
    const last = this.selection[this.selection.length - 1];
    if (!last) return null;
    const f = this.app.vault.getAbstractFileByPath(last);
    return f instanceof import_obsidian13.TFile ? f.path : null;
  }
  dragPayload(f, depth) {
    if (this.multiSelDepth === depth && this.multiSel.has(f.path)) return [...this.multiSel];
    return [f.path];
  }
  clearMulti() {
    this.multiSel.clear();
    this.multiSelDepth = -1;
    this.shiftAnchor = null;
    this.mobileSelActive = false;
  }
  /** Number of folder columns for the current selection chain (root column included). */
  folderColumnCount() {
    for (let i = this.selection.length - 1; i >= 0; i--) {
      const f = this.app.vault.getAbstractFileByPath(this.selection[i]);
      if (f instanceof import_obsidian13.TFolder) return i + 2;
    }
    return 1;
  }
  currentFolder() {
    for (let i = this.selection.length - 1; i >= 0; i--) {
      const f = this.app.vault.getAbstractFileByPath(this.selection[i]);
      if (f instanceof import_obsidian13.TFolder) return f;
      if (f instanceof import_obsidian13.TFile && f.parent) return f.parent;
    }
    return this.app.vault.getRoot();
  }
  pruneSelection(deletedPath) {
    var _a;
    const i = this.selection.findIndex((p) => p === deletedPath || p.startsWith(deletedPath + "/"));
    if (i >= 0) this.selection = this.selection.slice(0, i);
    const before = this.multiSel.size;
    this.multiSel = prunePathSet(this.multiSel, deletedPath);
    if (this.multiSel.size !== before) {
      if (this.multiSel.size === 0) this.clearMulti();
      (_a = this.updateActionBar) == null ? void 0 : _a.call(this);
    }
    return i >= 0;
  }
  remapSelection(oldPath, newPath) {
    this.selection = this.selection.map(
      (p) => p === oldPath ? newPath : p.startsWith(oldPath + "/") ? newPath + p.slice(oldPath.length) : p
    );
  }
  /** Keep folder colors and per-folder view modes in sync with renames. */
  remapPathRecords(oldPath, newPath) {
    const s = this.plugin.settings;
    s.folderColors = remapPathKeys(s.folderColors, oldPath, newPath);
    s.columnViewModes = remapPathKeys(s.columnViewModes, oldPath, newPath);
    s.pinnedPaths = remapPathKeys(s.pinnedPaths, oldPath, newPath);
    s.columnSortModes = remapPathKeys(s.columnSortModes, oldPath, newPath);
    s.folderIcons = remapPathKeys(s.folderIcons, oldPath, newPath);
    s.columnWidths = remapPathKeys(s.columnWidths, oldPath, newPath);
    this.plugin.queueSaveSettings();
  }
  prunePathRecords(deletedPath) {
    const s = this.plugin.settings;
    s.folderColors = prunePathKeys(s.folderColors, deletedPath);
    s.columnViewModes = prunePathKeys(s.columnViewModes, deletedPath);
    s.pinnedPaths = prunePathKeys(s.pinnedPaths, deletedPath);
    s.columnSortModes = prunePathKeys(s.columnSortModes, deletedPath);
    s.folderIcons = prunePathKeys(s.folderIcons, deletedPath);
    s.columnWidths = prunePathKeys(s.columnWidths, deletedPath);
    this.plugin.queueSaveSettings();
  }
  /* ------------------------------ render --------------------------- */
  applyColumnWidth() {
    this.columnsEl.style.setProperty("--ce-col-width", this.plugin.settings.columnWidth + "px");
  }
  /**
   * Свежий владелец markdown-превью колонки. Предыдущий выгружается: без
   * этого дочерние компоненты MarkdownRenderer копились бы на view до
   * закрытия вью — вместе с эмбедами, которые они держат.
   */
  newPreviewOwner() {
    if (this.previewOwner) this.removeChild(this.previewOwner);
    this.previewOwner = this.addChild(new import_obsidian13.Component());
    return this.previewOwner;
  }
  markDirty(folderPath) {
    if (folderPath === null) this.fullRenderPending = true;
    else this.dirtyFolders.add(folderPath);
    this.flushRefresh();
  }
  doRefresh() {
    var _a;
    if (this.fullRenderPending) {
      this.fullRenderPending = false;
      this.dirtyFolders.clear();
      this.render();
      return;
    }
    for (const path of this.dirtyFolders) {
      const list = this.columnsEl.querySelector(
        `.column-explorer-column[data-folder-path="${CSS.escape(path)}"] .column-explorer-list`
      );
      if (!list) continue;
      const folder = path === "/" ? this.app.vault.getRoot() : this.app.vault.getAbstractFileByPath(path);
      const col = list.closest(".column-explorer-column");
      const depth = Number((_a = col == null ? void 0 : col.dataset.depth) != null ? _a : 0);
      if (folder instanceof import_obsidian13.TFolder) {
        const prevTop = list.scrollTop;
        renderColumnList(this, list, folder, depth);
        list.scrollTop = prevTop;
      }
    }
    this.dirtyFolders.clear();
  }
  /** Vertical scroll of each column keyed by folder path — survives re-render. */
  captureScrollTops() {
    const tops = /* @__PURE__ */ new Map();
    this.columnsEl.querySelectorAll(".column-explorer-column[data-folder-path]").forEach((col) => {
      const list = col.querySelector(".column-explorer-list");
      if (list && col.dataset.folderPath !== void 0) tops.set(col.dataset.folderPath, list.scrollTop);
    });
    return tops;
  }
  restoreScrollTops(tops) {
    this.columnsEl.querySelectorAll(".column-explorer-column[data-folder-path]").forEach((col) => {
      var _a;
      const saved = tops.get((_a = col.dataset.folderPath) != null ? _a : "");
      const list = col.querySelector(".column-explorer-list");
      if (saved !== void 0 && list) list.scrollTop = saved;
    });
  }
  /** Identity of the rendered column set — to decide whether to keep horizontal scroll. */
  columnsKey() {
    return Array.from(this.columnsEl.querySelectorAll(".column-explorer-column")).map((col) => {
      var _a;
      return (_a = col.dataset.folderPath) != null ? _a : "";
    }).join("\n");
  }
  render() {
    var _a, _b;
    if (this.widthLockBtn) {
      const locked = this.plugin.settings.lockColumnWidths;
      this.widthLockBtn.setAttribute("aria-pressed", String(locked));
      this.widthLockBtn.toggleClass("is-active", locked);
    }
    clearActiveDrag();
    commitActiveResize();
    const scrollTops = this.captureScrollTops();
    const prevKey = this.columnsKey();
    const prevScrollLeft = this.columnsEl.scrollLeft;
    disconnectListObservers(this.columnsEl);
    this.columnsEl.empty();
    this.renamingPath = null;
    this.applyColumnWidth();
    const validSel = [];
    const special = this.specialKind(this.selection[0]);
    if (!this.plugin.settings.showStorage) this.dropSunburst();
    if (special === "calendar") {
      validSel.push(CALENDAR_PATH);
      const day = this.selection[1];
      if (day == null ? void 0 : day.startsWith(DAY_PATH_PREFIX)) {
        validSel.push(day);
        const filePath = this.selection[2];
        if (filePath && this.app.vault.getAbstractFileByPath(filePath) instanceof import_obsidian13.TFile) validSel.push(filePath);
      }
    } else if (special) {
      validSel.push(this.selection[0]);
      const filePath = this.selection[1];
      if (filePath && this.app.vault.getAbstractFileByPath(filePath) instanceof import_obsidian13.TFile) validSel.push(filePath);
    } else {
      let parent = this.app.vault.getRoot();
      for (const path of this.selection) {
        const f = this.app.vault.getAbstractFileByPath(path);
        if (!f || f.parent !== parent) break;
        validSel.push(path);
        if (f instanceof import_obsidian13.TFolder) parent = f;
        else break;
      }
    }
    this.selection = validSel;
    this.recordHistory();
    const lockedCount = import_obsidian13.Platform.isMobile ? 1 : this.plugin.settings.lockedColumnCount;
    const folderCols = this.folderColumnCount();
    const hasGap = lockedCount !== null && folderCols > lockedCount;
    this.updateLockButton();
    this.columnsEl.toggleClass("is-locked", hasGap);
    if (!(import_obsidian13.Platform.isMobile && special) && lockedColumnVisible(0, folderCols, lockedCount)) {
      renderColumn(this, this.columnsEl, this.app.vault.getRoot(), 0);
    }
    const previewOf = (path) => {
      if (import_obsidian13.Platform.isMobile) return;
      const f = path ? this.app.vault.getAbstractFileByPath(path) : null;
      if (f instanceof import_obsidian13.TFile && this.plugin.settings.showPreview) renderPreviewColumn(this, this.columnsEl, f);
    };
    if (special === "recents") {
      renderFileListColumn(this, this.columnsEl, t("recents"), this.recentFiles(), RECENTS_PATH, 1);
      previewOf(this.selection[1]);
    } else if (special === "bookmarks") {
      const favs = this.plugin.settings.showFavorites ? this.favoriteItems() : [];
      const favPaths = new Set(favs.map((f) => f.path));
      const core = this.plugin.settings.showBookmarks && this.bookmarksAvailable() ? this.bookmarkedItems().filter((f) => !favPaths.has(f.path)) : [];
      renderFileListColumn(this, this.columnsEl, t("bookmarks"), core, BOOKMARKS_PATH, 1, favs);
      previewOf(this.selection[1]);
    } else if (special === "storage") {
      renderStorageColumn(this, this.columnsEl);
    } else if (special === "calendar") {
      const daySentinel = this.selection[1];
      if (!import_obsidian13.Platform.isMobile || !daySentinel) renderCalendarColumn(this, this.columnsEl);
      if (daySentinel) {
        const day = daySentinel.slice(DAY_PATH_PREFIX.length);
        const title = new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8))).toLocaleDateString((0, import_obsidian13.getLanguage)(), { day: "numeric", month: "long", year: "numeric" });
        renderFileListColumn(this, this.columnsEl, title, this.filesCreatedOn(day), daySentinel, 2);
        previewOf(this.selection[2]);
      }
    } else {
      for (let depth = 0; depth < this.selection.length; depth++) {
        const f = this.app.vault.getAbstractFileByPath(this.selection[depth]);
        if (f instanceof import_obsidian13.TFolder) {
          if (!lockedColumnVisible(depth + 1, folderCols, lockedCount)) continue;
          renderColumn(this, this.columnsEl, f, depth + 1);
        } else if (f instanceof import_obsidian13.TFile && this.plugin.settings.showPreview && !import_obsidian13.Platform.isMobile) {
          renderPreviewColumn(this, this.columnsEl, f);
        }
      }
    }
    if (hasGap && !import_obsidian13.Platform.isMobile) this.markLockedColumn();
    this.renderBreadcrumbs();
    this.applyMobileScale();
    (_a = this.updateMobileToolbar) == null ? void 0 : _a.call(this);
    (_b = this.updateActionBar) == null ? void 0 : _b.call(this);
    this.restoreScrollTops(scrollTops);
    const sameColumns = this.columnsKey() === prevKey;
    window.requestAnimationFrame(() => {
      if (!this.columnsEl.isConnected) return;
      this.autoResizePanel();
      this.columnsEl.scrollLeft = sameColumns ? prevScrollLeft : this.columnsEl.scrollWidth;
    });
  }
  /** Авто-ширина панели: подгоняет ширину сайдбара под суммарную ширину колонок. */
  autoResizePanel() {
    if (this.plugin.settings.lockColumnWidths || !this.plugin.settings.autoPanelResize || import_obsidian13.Platform.isMobile) return;
    const ws = this.app.workspace;
    const root = this.leaf.getRoot();
    if (root !== ws.leftSplit && root !== ws.rightSplit) return;
    const split = root;
    if (split.collapsed || typeof split.setSize !== "function") return;
    const cols = Array.from(this.columnsEl.querySelectorAll(".column-explorer-column"));
    const contentWidth = cols.reduce((sum, col) => sum + col.offsetWidth, 0);
    if (contentWidth === 0) return;
    split.setSize(desiredPanelWidth(contentWidth, window.innerWidth, MIN_COLUMN_WIDTH));
  }
  /** Lock badge in the header of the deepest (in-place navigating) column. */
  markLockedColumn() {
    const cols = this.columnsEl.querySelectorAll(".column-explorer-column[data-folder-path]");
    const col = cols[cols.length - 1];
    const header = col == null ? void 0 : col.querySelector(".column-explorer-column-header");
    if (!col || !header) return;
    col.addClass("is-locked-root");
    const badge = createDiv({ cls: "column-explorer-lock-badge" });
    (0, import_obsidian13.setIcon)(badge, "lock");
    header.prepend(badge);
  }
  /** Записать текущий выбор в стек истории (если не идём по истории и он изменился). */
  recordHistory() {
    if (this.navigatingHistory) return;
    const HISTORY_CAP = 100;
    const last = this.history[this.historyIndex];
    if (last && last.length === this.selection.length && last.every((p, i) => p === this.selection[i])) return;
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push([...this.selection]);
    if (this.history.length > HISTORY_CAP) this.history.shift();
    this.historyIndex = this.history.length - 1;
  }
  navigateHistory(delta) {
    const next = this.historyIndex + delta;
    if (next < 0 || next >= this.history.length) return;
    this.historyIndex = next;
    this.navigatingHistory = true;
    this.selection = [...this.history[next]];
    this.clearMulti();
    this.persistState();
    this.render();
    this.navigatingHistory = false;
  }
  renderBreadcrumbs() {
    this.breadcrumbsEl.empty();
    const nav = this.breadcrumbsEl.createDiv({ cls: "column-explorer-nav-buttons" });
    const navBtn = (icon, label, enabled, onClick) => {
      const btn = nav.createDiv({
        cls: "clickable-icon column-explorer-nav-btn" + (enabled ? "" : " is-disabled"),
        attr: { "aria-label": label, role: "button" }
      });
      (0, import_obsidian13.setIcon)(btn, icon);
      if (enabled) btn.addEventListener("click", onClick);
    };
    if (!import_obsidian13.Platform.isMobile) {
      navBtn("arrow-left", t("navBack"), this.canGoBack(), () => this.goBack());
      navBtn("arrow-right", t("navForward"), this.canGoForward(), () => this.goForward());
    }
    const current = this.currentFolder();
    const isFav = this.isFavorite(current.path);
    const star = nav.createDiv({
      cls: "clickable-icon column-explorer-fav-btn" + (isFav ? " is-active" : ""),
      attr: { "aria-label": isFav ? t("removeFavorite") : t("addFavorite"), role: "button" }
    });
    (0, import_obsidian13.setIcon)(star, "star");
    star.addEventListener("click", () => this.toggleFavorite(current.path));
    const addSegment = (label, targetDepth, isLast, dropFolder) => {
      const seg = this.breadcrumbsEl.createSpan({
        cls: "column-explorer-crumb" + (isLast ? " is-current" : ""),
        text: label
      });
      if (dropFolder) setupCrumbDropTarget(this, seg, dropFolder);
      if (!isLast) {
        seg.addEventListener("click", () => {
          this.selection = this.selection.slice(0, targetDepth);
          this.clearMulti();
          this.persistState();
          this.render();
        });
        this.breadcrumbsEl.createSpan({ cls: "column-explorer-crumb-sep", text: "\u203A" });
      }
    };
    addSegment(this.app.vault.getName(), 0, this.selection.length === 0, this.app.vault.getRoot());
    this.selection.forEach((path, i) => {
      var _a;
      const f = this.app.vault.getAbstractFileByPath(path);
      const label = f ? displayName(f) : path === RECENTS_PATH ? t("recents") : path === BOOKMARKS_PATH ? t("bookmarks") : path === CALENDAR_PATH ? t("calendar") : path.startsWith(DAY_PATH_PREFIX) ? path.slice(DAY_PATH_PREFIX.length) : (_a = path.split("/").pop()) != null ? _a : path;
      addSegment(label, i + 1, i === this.selection.length - 1, f instanceof import_obsidian13.TFolder ? f : void 0);
    });
    if (import_obsidian13.Platform.isMobile) {
      window.requestAnimationFrame(() => {
        if (!this.breadcrumbsEl.isConnected) return;
        this.breadcrumbsEl.scrollLeft = this.breadcrumbsEl.scrollWidth;
      });
    }
  }
  /** Cheap highlight update on active-leaf-change — no full re-render. */
  updateActiveFileHighlight() {
    const active = this.app.workspace.getActiveFile();
    this.columnsEl.querySelectorAll(".column-explorer-item.is-active-file").forEach((el) => el.removeClass("is-active-file"));
    if (!active) return;
    const item = this.columnsEl.querySelector(
      `.column-explorer-item[data-path="${CSS.escape(active.path)}"]`
    );
    item == null ? void 0 : item.addClass("is-active-file");
  }
  /** Точечно обновить маркер непрочитанного — без ре-рендера колонки. */
  updateUnreadMarker(path) {
    if (!this.columnsEl) return;
    refreshUnreadMarker(this, this.columnsEl, path);
  }
  /* ----------------------------- actions --------------------------- */
  /** Паттерны исключений — виртуальные колонки фильтруются как обычные. */
  excludePatternsList() {
    return parseExcludePatterns(this.plugin.settings.excludePatterns);
  }
  /** Последние открытые файлы из собственного трекера (main.ts). */
  recentFiles() {
    const s = this.plugin.settings;
    const patterns = this.excludePatternsList();
    const isVisibleFile = (p) => !matchesExcludePatterns(p, patterns) && this.app.vault.getAbstractFileByPath(p) instanceof import_obsidian13.TFile;
    return takeFirstExisting(s.recentFiles, isVisibleFile, s.recentFilesCount).flatMap((p) => {
      const f = this.app.vault.getAbstractFileByPath(p);
      return f instanceof import_obsidian13.TFile ? [f] : [];
    });
  }
  /**
   * Перерисовать открытую колонку «Недавние» (файл открыли где-то ещё).
   * Если открыт как раз выбранный в ней файл — не дёргаем список под
   * курсором, он и так показан.
   */
  refreshRecentsColumn(openedPath) {
    if (this.selection[0] !== RECENTS_PATH) return;
    if (openedPath && this.selection[1] === openedPath) return;
    this.render();
  }
  /** Тип спецпункта по сентинел-пути с учётом настроек и доступности. */
  specialKind(path) {
    const s = this.plugin.settings;
    if (path === RECENTS_PATH && s.showRecents) return "recents";
    if (path === BOOKMARKS_PATH && (s.showBookmarks && this.bookmarksAvailable() || s.showFavorites && s.favorites.length > 0)) return "bookmarks";
    if (path === CALENDAR_PATH && s.showCalendar) return "calendar";
    if (path === STORAGE_PATH && s.showStorage) return "storage";
    return null;
  }
  /**
   * Контроллер диаграммы «Использование диска». Создаётся при первом
   * открытии колонки: скан хранилища слишком дорог, чтобы делать его на
   * загрузке плагина. Дальше живёт до закрытия вью — колонки
   * перерисовываются часто, а дерево и кэш словосчёта переживают рендер.
   */
  sunburstController() {
    if (!this.sunburst) {
      this.sunburst = new SunburstController(this);
      this.addChild(this.sunburst);
    }
    return this.sunburst;
  }
  /** Спецстроку выключили в настройках — диаграмма и её подписки не нужны. */
  dropSunburst() {
    if (!this.sunburst) return;
    this.removeChild(this.sunburst);
    this.sunburst = null;
  }
  selectSpecial(path) {
    this.selection = [path];
    this.clearMulti();
    this.persistState();
    this.render();
  }
  selectDay(day) {
    this.selection = [CALENDAR_PATH, DAY_PATH_PREFIX + day];
    this.clearMulti();
    this.persistState();
    this.render();
  }
  /** Выбранный день календаря ("YYYY-MM-DD") или null. */
  selectedDayKey() {
    const sentinel = this.selection[0] === CALENDAR_PATH ? this.selection[1] : void 0;
    return (sentinel == null ? void 0 : sentinel.startsWith(DAY_PATH_PREFIX)) ? sentinel.slice(DAY_PATH_PREFIX.length) : null;
  }
  currentCalendarMonth() {
    if (this.calendarMonth) return this.calendarMonth;
    const day = this.selectedDayKey();
    if (day) return { year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)) - 1 };
    const now = /* @__PURE__ */ new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }
  /** Листание месяца: ±1, а 0 — вернуться к сегодняшнему. */
  navigateCalendarMonth(delta) {
    if (delta === 0) {
      const now = /* @__PURE__ */ new Date();
      this.calendarMonth = { year: now.getFullYear(), month: now.getMonth() };
    } else {
      const cur = this.currentCalendarMonth();
      const d = new Date(cur.year, cur.month + delta, 1);
      this.calendarMonth = { year: d.getFullYear(), month: d.getMonth() };
    }
    this.render();
  }
  /**
   * Файлы vault, разложенные по дню создания. Полный скан на vault в десятки
   * тысяч файлов заметен, а рендер календаря случается на каждый клик —
   * поэтому считаем один раз и сбрасываем по событиям vault и смене настроек.
   */
  filesByDay() {
    const patterns = this.excludePatternsList();
    const key = patterns.join("\n");
    if (this.filesByDayCache && this.filesByDayKey === key) return this.filesByDayCache;
    const byDay = /* @__PURE__ */ new Map();
    for (const f of this.app.vault.getFiles()) {
      if (matchesExcludePatterns(f.path, patterns)) continue;
      const day = dayKey(f.stat.ctime);
      const bucket = byDay.get(day);
      if (bucket) bucket.push(f);
      else byDay.set(day, [f]);
    }
    this.filesByDayCache = byDay;
    this.filesByDayKey = key;
    return byDay;
  }
  /** Сбросить кеш дней: файл создан, удалён или переименован. */
  invalidateCalendarCache() {
    this.filesByDayCache = null;
  }
  /** Число созданных файлов по дням (ключ — dayKey) для бейджей календаря. */
  calendarCounts() {
    const counts = /* @__PURE__ */ new Map();
    for (const [day, files] of this.filesByDay()) counts.set(day, files.length);
    return counts;
  }
  /** Файлы, созданные в день `day` ("YYYY-MM-DD"), новые сверху. */
  filesCreatedOn(day) {
    var _a;
    return [...(_a = this.filesByDay().get(day)) != null ? _a : []].sort((a, b) => b.stat.ctime - a.stat.ctime);
  }
  bookmarksAvailable() {
    return this.bookmarkItems() !== null;
  }
  /**
   * Пункты core-плагина Bookmarks. Приватный API (internalPlugins) —
   * в try, при поломке или выключенном плагине возвращаем null
   * и спецпункт «Закладки» просто не показывается.
   */
  bookmarkItems() {
    var _a, _b, _c, _d;
    try {
      const app = this.app;
      return (_d = (_c = (_b = (_a = app.internalPlugins) == null ? void 0 : _a.getEnabledPluginById) == null ? void 0 : _b.call(_a, "bookmarks")) == null ? void 0 : _c.items) != null ? _d : null;
    } catch (e) {
      return null;
    }
  }
  /**
   * Файлы и папки из закладок; группы разворачиваются плоско, дубли
   * (закладки на заголовки/блоки одной заметки) схлопываются.
   */
  bookmarkedItems() {
    var _a;
    const flatten = (items) => items.flatMap(
      (it2) => {
        var _a2;
        return it2.type === "group" ? flatten((_a2 = it2.items) != null ? _a2 : []) : (it2.type === "file" || it2.type === "folder") && it2.path ? [it2.path] : [];
      }
    );
    const patterns = this.excludePatternsList();
    return [...new Set(flatten((_a = this.bookmarkItems()) != null ? _a : []))].flatMap((p) => {
      if (matchesExcludePatterns(p, patterns)) return [];
      const f = this.app.vault.getAbstractFileByPath(p);
      return f ? [f] : [];
    });
  }
  /** Saved favorite files/folders, invalid and excluded paths dropped, add-order kept. */
  favoriteItems() {
    const patterns = this.excludePatternsList();
    return this.plugin.settings.favorites.flatMap((p) => {
      if (matchesExcludePatterns(p, patterns)) return [];
      const f = this.app.vault.getAbstractFileByPath(p);
      return f ? [f] : [];
    });
  }
  isFavorite(path) {
    return this.plugin.settings.favorites.includes(path);
  }
  /** Add or remove a path from favorites, with a notice. */
  toggleFavorite(path) {
    const s = this.plugin.settings;
    const has = s.favorites.includes(path);
    s.favorites = has ? s.favorites.filter((p) => p !== path) : [...s.favorites, path];
    void this.plugin.saveSettings();
    new import_obsidian13.Notice(t(has ? "favoriteRemoved" : "favoriteAdded"));
    this.render();
  }
  selectItem(f, depth, e) {
    this.selection = this.selection.slice(0, depth);
    this.selection.push(f.path);
    this.shiftAnchor = f.path;
    if (f instanceof import_obsidian13.TFile) {
      void this.app.workspace.getLeaf(import_obsidian13.Keymap.isModEvent(e)).openFile(f);
    } else if (f instanceof import_obsidian13.TFolder && this.plugin.settings.openFolderNote) {
      const note = folderNoteOf(f);
      if (note) void this.app.workspace.getLeaf(import_obsidian13.Keymap.isModEvent(e)).openFile(note);
    }
    this.persistState();
    this.render();
  }
  toggleMulti(f, depth) {
    this.applyToggleMulti(f, depth);
    this.render();
  }
  /** Мутация мультивыделения без перерисовки — общая с мобильным режимом. */
  applyToggleMulti(f, depth) {
    if (this.multiSelDepth !== depth) this.clearMulti();
    this.multiSelDepth = depth;
    if (this.multiSel.has(f.path)) this.multiSel.delete(f.path);
    else this.multiSel.add(f.path);
    this.shiftAnchor = f.path;
    if (this.multiSel.size === 0) this.multiSelDepth = -1;
  }
  rangeMulti(f, depth, siblings) {
    var _a, _b;
    if (this.multiSelDepth !== depth) {
      this.clearMulti();
      this.multiSelDepth = depth;
    }
    const anchor = (_b = (_a = this.shiftAnchor) != null ? _a : this.selection[depth]) != null ? _b : f.path;
    const ai = siblings.findIndex((s) => s.path === anchor);
    const bi = siblings.findIndex((s) => s.path === f.path);
    if (ai === -1 || bi === -1) {
      this.toggleMulti(f, depth);
      return;
    }
    const [from, to] = ai < bi ? [ai, bi] : [bi, ai];
    for (let i = from; i <= to; i++) this.multiSel.add(siblings[i].path);
    this.render();
  }
  /** Cmd/Ctrl+A — multi-select every item in the active folder column. */
  selectAllAt(depth) {
    const folder = this.folderAtDepth(depth);
    if (!folder) return;
    const children = this.childrenOf(folder);
    if (children.length === 0) return;
    this.clearMulti();
    this.multiSelDepth = depth;
    for (const c of children) this.multiSel.add(c.path);
    this.render();
  }
  /* ------------------------- copy / cut / paste -------------------- */
  /** Положить пути в буфер; cut-режим затемняет исходники до вставки. */
  copyItems(paths, cut) {
    const real = paths.filter((p) => !p.startsWith("::"));
    if (real.length === 0) return;
    this.fileClipboard = { paths: real, cut };
    this.render();
  }
  hasFileClipboard() {
    return this.fileClipboard !== null;
  }
  /** Затемнение вырезанных строк — читается из buildItem при рендере. */
  isCutPath(path) {
    var _a;
    return ((_a = this.fileClipboard) == null ? void 0 : _a.cut) === true && this.fileClipboard.paths.includes(path);
  }
  /**
   * Вставить буфер в папку (по умолчанию — текущую). Copy-буфер живёт
   * дальше для повторных вставок, cut-буфер очищается после перемещения.
   */
  pasteClipboard(target = this.currentFolder()) {
    const clip = this.fileClipboard;
    if (!clip) return;
    if (clip.cut) {
      this.fileClipboard = null;
      void moveFiles(this.app, clip.paths, target).then(() => this.render());
    } else {
      void copyFiles(this.app, clip.paths, target);
    }
  }
  /** Cmd/Ctrl+C или X: мультивыделение либо текущий элемент. */
  copySelectionAt(depth, cut) {
    const paths = this.multiSel.size > 0 && this.multiSelDepth === depth ? [...this.multiSel] : [this.selection[depth]].filter((p) => Boolean(p));
    this.copyItems(paths, cut);
  }
  /** Cmd/Ctrl+D — duplicate the multi-selection, or the single selected item. */
  duplicateSelected(depth) {
    const paths = this.multiSel.size > 0 && this.multiSelDepth === depth ? [...this.multiSel] : [this.selection[depth]].filter(Boolean);
    void (async () => {
      for (const p of paths) {
        const f = this.app.vault.getAbstractFileByPath(p);
        if (f instanceof import_obsidian13.TFile) await duplicateFile(this.app, f);
        else if (f instanceof import_obsidian13.TFolder) await duplicateFolder(this.app, f);
      }
    })();
  }
  revealFile(file) {
    if (!file) return;
    if (this.hasFilter()) {
      this.filter = "";
      this.filterMatcher = null;
      this.searchInput.value = "";
    }
    const chain = [];
    let cur = file;
    while (cur && cur.parent) {
      chain.unshift(cur.path);
      cur = cur.parent;
    }
    this.selection = chain;
    this.clearMulti();
    this.persistState();
    this.render();
  }
  deleteMany(paths) {
    const doDelete = async () => {
      await trashFiles(this.app, paths);
      this.exitMobileSelection();
    };
    if (!this.plugin.settings.confirmDelete) {
      void doDelete();
      return;
    }
    const first = this.app.vault.getAbstractFileByPath(paths[0]);
    const msg = paths.length === 1 ? t("confirmDeleteOne", { name: first ? displayName(first) : paths[0] }) : t("confirmDeleteMany", { n: paths.length });
    new ConfirmModal(this.app, msg, () => void doDelete()).open();
  }
  async createNote(folder, extension = "md", initialContent = "") {
    const base = (folder.isRoot() ? "" : folder.path + "/") + t("untitled");
    let path = (0, import_obsidian13.normalizePath)(base + "." + extension);
    let n = 1;
    while (this.app.vault.getAbstractFileByPath(path)) {
      path = (0, import_obsidian13.normalizePath)(base + " " + n++ + "." + extension);
    }
    try {
      const file = await this.app.vault.create(path, initialContent);
      this.revealFile(file);
      await this.app.workspace.getLeaf(false).openFile(file);
      this.queueRename(file.path);
    } catch (err) {
      new import_obsidian13.Notice(t("createFailed", { name: path, error: errorMessage(err) }));
    }
  }
  async createFolder(folder) {
    const base = (folder.isRoot() ? "" : folder.path + "/") + t("newFolderName");
    let path = (0, import_obsidian13.normalizePath)(base);
    let n = 1;
    while (this.app.vault.getAbstractFileByPath(path)) {
      path = (0, import_obsidian13.normalizePath)(base + " " + n++);
    }
    try {
      await this.app.vault.createFolder(path);
      this.queueRename(path);
    } catch (err) {
      new import_obsidian13.Notice(t("createFailed", { name: path, error: errorMessage(err) }));
    }
  }
  /** Инлайн-переименование после того, как рендер догонит создание файла. */
  queueRename(path) {
    window.clearTimeout(this.renameTimer);
    this.renameTimer = window.setTimeout(() => this.startRenameByPath(path), RENAME_START_DELAY_MS);
  }
  startRenameByPath(path) {
    const f = this.app.vault.getAbstractFileByPath(path);
    if (f) this.startRename(f);
  }
  startRename(f) {
    this.render();
    const item = this.columnsEl.querySelector(
      `.column-explorer-item[data-path="${CSS.escape(f.path)}"]`
    );
    if (!item) return;
    const titleEl = item.querySelector(".column-explorer-item-title");
    if (!titleEl) return;
    this.renamingPath = f.path;
    const isMdFile = f instanceof import_obsidian13.TFile && f.extension === "md";
    const original = f instanceof import_obsidian13.TFile && f.extension === "md" ? f.basename : f.name;
    const input = createEl("input", { type: "text", cls: "column-explorer-rename-input", value: original });
    titleEl.replaceWith(input);
    input.focus();
    const dot = input.value.lastIndexOf(".");
    input.setSelectionRange(0, isMdFile || dot <= 0 ? input.value.length : dot);
    let finished = false;
    const finish = async (commit) => {
      if (finished) return;
      finished = true;
      this.renamingPath = null;
      const newName = input.value.trim();
      if (commit && newName && newName !== original) {
        const dir = f.parent && !f.parent.isRoot() ? f.parent.path + "/" : "";
        const finalName = isMdFile ? newName + ".md" : newName;
        try {
          await this.app.fileManager.renameFile(f, (0, import_obsidian13.normalizePath)(dir + finalName));
        } catch (err) {
          new import_obsidian13.Notice(t("renameFailed") + errorMessage(err));
        }
      }
      this.render();
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void finish(true);
      }
      if (e.key === "Escape") {
        e.preventDefault();
        void finish(false);
      }
    });
    input.addEventListener("blur", () => void finish(true));
    input.addEventListener("click", (e) => e.stopPropagation());
  }
  /* ---------------------------- keyboard --------------------------- */
  onKeyDown(e) {
    var _a;
    if (this.renamingPath) return;
    if (this.mobileSelActive && e.key === "Escape") {
      e.preventDefault();
      this.exitMobileSelection();
      return;
    }
    const depth = Math.max(0, this.selection.length - 1);
    const selectedPath = this.selection[depth];
    const children = this.siblingsAt(depth);
    const currentIdx = children.findIndex((c) => c.path === selectedPath);
    const jumpTo = (idx) => {
      if (children.length === 0) return;
      const next = children[Math.min(children.length - 1, Math.max(0, idx))];
      this.selection = this.selection.slice(0, depth);
      this.selection.push(next.path);
      this.clearMulti();
      this.persistState();
      this.render();
    };
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      jumpTo(e.key === "ArrowDown" ? Math.min(children.length - 1, currentIdx + 1) : Math.max(0, currentIdx === -1 ? 0 : currentIdx - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      jumpTo(0);
    } else if (e.key === "End") {
      e.preventDefault();
      jumpTo(children.length - 1);
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      const base = currentIdx === -1 ? 0 : currentIdx;
      jumpTo(e.key === "PageDown" ? base + PAGE_JUMP : base - PAGE_JUMP);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (this.selection.length > 0) {
        this.selection.pop();
        this.persistState();
        this.render();
      }
    } else if (e.key === "ArrowRight" || e.key === "Enter") {
      e.preventDefault();
      if (this.enterVirtual(selectedPath, depth)) return;
      const f = selectedPath ? this.app.vault.getAbstractFileByPath(selectedPath) : null;
      if (f instanceof import_obsidian13.TFolder) {
        const inner = this.childrenOf(f);
        if (inner.length > 0) {
          this.selection.push(inner[0].path);
          this.persistState();
          this.render();
        }
      } else if (f instanceof import_obsidian13.TFile && e.key === "Enter") {
        void this.app.workspace.getLeaf(false).openFile(f);
      }
    } else if (e.key === " " && !this.typeaheadBuffer) {
      e.preventDefault();
      const f = selectedPath ? this.app.vault.getAbstractFileByPath(selectedPath) : null;
      if (f instanceof import_obsidian13.TFile) new QuickLookModal(this.app, this, f).open();
    } else if (e.key === "Escape") {
      if (this.specialKind(this.selection[0]) === "storage" && ((_a = this.sunburst) == null ? void 0 : _a.zoomOut())) {
        e.preventDefault();
      } else if (this.hasFilter()) {
        e.preventDefault();
        this.clearFilter();
      }
    } else if (e.key === "F2") {
      e.preventDefault();
      const f = selectedPath ? this.app.vault.getAbstractFileByPath(selectedPath) : null;
      if (f) this.startRename(f);
    } else if (e.key === "Delete" || e.key === "Backspace" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (this.multiSel.size > 0) {
        this.deleteMany([...this.multiSel]);
        return;
      }
      if (selectedPath && !selectedPath.startsWith("::")) this.deleteMany([selectedPath]);
    } else if ((e.metaKey || e.ctrlKey) && (e.key === "a" || e.key === "A" || e.code === "KeyA")) {
      e.preventDefault();
      this.selectAllAt(depth);
    } else if ((e.metaKey || e.ctrlKey) && (e.key === "d" || e.key === "D" || e.code === "KeyD")) {
      e.preventDefault();
      this.duplicateSelected(depth);
    } else if ((e.metaKey || e.ctrlKey) && (e.key === "c" || e.key === "C" || e.code === "KeyC")) {
      e.preventDefault();
      this.copySelectionAt(depth, false);
    } else if ((e.metaKey || e.ctrlKey) && (e.key === "x" || e.key === "X" || e.code === "KeyX")) {
      e.preventDefault();
      this.copySelectionAt(depth, true);
    } else if ((e.metaKey || e.ctrlKey) && (e.key === "v" || e.key === "V" || e.code === "KeyV")) {
      e.preventDefault();
      this.pasteClipboard();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key === " ") e.preventDefault();
      this.onTypeahead(e.key, children, depth);
    }
  }
  onTypeahead(char, children, depth) {
    window.clearTimeout(this.typeaheadTimer);
    this.typeaheadBuffer += char.toLowerCase();
    this.typeaheadTimer = window.setTimeout(() => {
      this.typeaheadBuffer = "";
    }, TYPEAHEAD_RESET_MS);
    const match = children.find((c) => c.name.toLowerCase().startsWith(this.typeaheadBuffer));
    if (!match) return;
    this.selection = this.selection.slice(0, depth);
    this.selection.push(match.path);
    this.clearMulti();
    this.persistState();
    this.render();
  }
  /**
   * «Соседи» для клавиатурной навигации на данной глубине: в виртуальных
   * колонках — их файлы, в первой колонке — дети корня плюс спецпункты
   * (на той же позиции, что и на экране).
   */
  siblingsAt(depth) {
    const toEntry = (f) => ({ path: f.path, name: displayName(f) });
    const special = this.specialKind(this.selection[0]);
    if (special && depth >= 1) {
      if (special === "recents") return this.recentFiles().map(toEntry);
      if (special === "bookmarks") return this.bookmarkedItems().map(toEntry);
      if (special === "storage") return [];
      const day = this.selectedDayKey();
      return depth === 2 && day ? this.filesCreatedOn(day).map(toEntry) : [];
    }
    const parentFolder = this.folderAtDepth(depth);
    const entries = (parentFolder ? this.childrenOf(parentFolder) : []).map(toEntry);
    if (depth !== 0) return entries;
    const specials = [];
    if (this.specialKind(RECENTS_PATH)) specials.push({ path: RECENTS_PATH, name: t("recents") });
    if (this.specialKind(BOOKMARKS_PATH)) specials.push({ path: BOOKMARKS_PATH, name: t("bookmarks") });
    if (this.specialKind(CALENDAR_PATH)) specials.push({ path: CALENDAR_PATH, name: t("calendar") });
    if (this.specialKind(STORAGE_PATH)) specials.push({ path: STORAGE_PATH, name: t("diskUsage") });
    return this.plugin.settings.specialItemsPosition === "top" ? [...specials, ...entries] : [...entries, ...specials];
  }
  /** ArrowRight/Enter на спецпункте или дне календаря — вход в его колонку. */
  enterVirtual(selectedPath, depth) {
    if (!selectedPath) return false;
    if (this.specialKind(selectedPath) === "calendar") {
      this.selectDay(dayKey(Date.now()));
      return true;
    }
    if (this.specialKind(selectedPath) || selectedPath.startsWith(DAY_PATH_PREFIX)) {
      const inner = this.siblingsAt(depth + 1);
      if (inner.length > 0) {
        this.selection.push(inner[0].path);
        this.persistState();
        this.render();
      }
      return true;
    }
    return false;
  }
  folderAtDepth(depth) {
    if (depth === 0) return this.app.vault.getRoot();
    const f = this.app.vault.getAbstractFileByPath(this.selection[depth - 1]);
    return f instanceof import_obsidian13.TFolder ? f : null;
  }
};

// src/main.ts
var SAVE_DEBOUNCE_MS = 1e3;
var ColumnExplorerPlugin = class extends import_obsidian14.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    this.shouldSeedRecents = false;
    /** Плагин ещё ни разу ничего не сохранял — значит, его только что поставили. */
    this.isFirstRun = false;
    /**
     * Отложенная запись настроек для событий, приходящих пачками: открытие
     * файлов и, главное, rename/delete — при удалении папки на N файлов
     * немедленная запись означала бы N перезаписей data.json подряд.
     */
    this.saveQueued = (0, import_obsidian14.debounce)(() => void this.saveSettings(), SAVE_DEBOUNCE_MS);
  }
  async onload() {
    await this.loadSettings();
    if (this.shouldSeedRecents) {
      this.settings.recentFiles = this.app.workspace.getLastOpenFiles();
    }
    this.register(() => this.saveQueued.run());
    this.registerEvent(this.app.workspace.on("file-open", (f) => {
      var _a, _b;
      if (!f) return;
      this.settings.recentFiles = pushRecent(this.settings.recentFiles, f.path, MAX_RECENT_FILES);
      this.markSeen(f.path, Date.now());
      this.saveQueued();
      (_a = this.getView()) == null ? void 0 : _a.updateUnreadMarker(f.path);
      (_b = this.getView()) == null ? void 0 : _b.refreshRecentsColumn(f.path);
    }));
    this.registerEvent(this.app.vault.on("rename", (f, oldPath) => {
      this.settings.recentFiles = remapPathList(this.settings.recentFiles, oldPath, f.path);
      this.settings.favorites = remapPathList(this.settings.favorites, oldPath, f.path);
      this.settings.seenAt = remapPathKeys(this.settings.seenAt, oldPath, f.path);
      this.saveQueued();
    }));
    this.registerEvent(this.app.vault.on("delete", (f) => {
      const dropDeleted = (p) => p !== f.path && !p.startsWith(f.path + "/");
      this.settings.recentFiles = this.settings.recentFiles.filter(dropDeleted);
      this.settings.favorites = this.settings.favorites.filter(dropDeleted);
      this.settings.seenAt = prunePathKeys(this.settings.seenAt, f.path);
      this.saveQueued();
    }));
    this.registerEvent(this.app.vault.on("modify", (f) => {
      var _a, _b;
      if (((_a = this.app.workspace.getActiveFile()) == null ? void 0 : _a.path) !== f.path) {
        (_b = this.getView()) == null ? void 0 : _b.updateUnreadMarker(f.path);
        return;
      }
      this.markSeen(f.path, f instanceof import_obsidian14.TFile ? f.stat.mtime : Date.now());
      this.saveQueued();
    }));
    this.registerView(VIEW_TYPE_COLUMNS, (leaf) => new ColumnExplorerView(leaf, this));
    this.addSettingTab(new ColumnExplorerSettingTab(this.app, this));
    this.addRibbonIcon("columns-3", "Column Explorer", () => void this.activateView());
    this.addCommand({
      id: "open-view",
      name: t("cmdOpen"),
      callback: () => void this.activateView()
    });
    this.addCommand({
      id: "reveal-active-file",
      name: t("cmdReveal"),
      callback: async () => {
        const view = await this.activateView();
        view == null ? void 0 : view.revealFile(this.app.workspace.getActiveFile());
      }
    });
    this.addCommand({
      id: "focus-view",
      name: t("cmdFocus"),
      callback: async () => {
        const view = await this.activateView();
        view == null ? void 0 : view.focusColumns();
      }
    });
    this.addCommand({
      id: "new-note-here",
      name: t("cmdNewNote"),
      checkCallback: (checking) => {
        if (!this.getViewLeaf()) return false;
        if (!checking) void this.withView((view) => void view.createNote(view.currentFolder()));
        return true;
      }
    });
    this.addCommand({
      id: "new-folder-here",
      name: t("cmdNewFolder"),
      checkCallback: (checking) => {
        if (!this.getViewLeaf()) return false;
        if (!checking) void this.withView((view) => void view.createFolder(view.currentFolder()));
        return true;
      }
    });
    if (this.isFirstRun) {
      this.app.workspace.onLayoutReady(() => void this.activateView());
    }
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => {
      const view = this.getView();
      if (!view) return;
      view.updateActiveFileHighlight();
      if (this.settings.autoReveal) {
        const active = this.app.workspace.getActiveFile();
        if (active && view.selectedFilePath() !== active.path) view.revealFile(active);
      }
    }));
  }
  async loadSettings() {
    const data = await this.loadData();
    const merged = Object.assign({}, DEFAULT_SETTINGS, data != null ? data : {});
    this.settings = {
      ...merged,
      ...normalizeSettings(merged),
      ...normalizeMobileSettings(merged)
    };
    this.shouldSeedRecents = (data == null ? void 0 : data.recentFiles) === void 0;
    this.isFirstRun = data === null;
    const widths = this.settings.columnWidths;
    const staleDayKeys = Object.keys(widths).filter((k) => k.startsWith(DAY_PATH_PREFIX) && k !== DAY_PATH_PREFIX);
    if (staleDayKeys.length > 0) {
      this.settings.columnWidths = Object.fromEntries(
        Object.entries(widths).filter(([k]) => !staleDayKeys.includes(k))
      );
    }
    if (this.settings.unreadBaseline === 0) {
      this.settings.unreadBaseline = Date.now();
    }
    this.migratePinnedPaths();
  }
  /** v1.3.x stored pins as `true`; convert to numeric order once. */
  migratePinnedPaths() {
    const raw = this.settings.pinnedPaths;
    const entries = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? Object.entries(raw) : [];
    const isOrder = (v) => typeof v === "number" && Number.isFinite(v);
    const numeric = entries.map(([, v]) => v).filter(isOrder);
    let next = numeric.length > 0 ? Math.max(...numeric) + 1 : 0;
    const migrated = {};
    for (const [path, value] of entries) {
      if (isOrder(value)) migrated[path] = value;
      else if (value === true) migrated[path] = next++;
    }
    this.settings.pinnedPaths = migrated;
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  /** Запись настроек со склейкой — для событий, приходящих пачками. */
  queueSaveSettings() {
    this.saveQueued();
  }
  /** Отметить файл прочитанным на момент `at`. Настройки не мутируются. */
  markSeen(path, at) {
    this.settings.seenAt = { ...this.settings.seenAt, [path]: at };
  }
  /** Лист вью, даже если она ещё отложена (Obsidian 1.7.2+). */
  getViewLeaf() {
    var _a;
    return (_a = this.app.workspace.getLeavesOfType(VIEW_TYPE_COLUMNS)[0]) != null ? _a : null;
  }
  /**
   * Загруженная вью или null. Отложенную НЕ будит намеренно: подсветке
   * активного файла и настройкам нечего обновлять в незагруженной вью.
   */
  getView() {
    const leaf = this.getViewLeaf();
    return (leaf == null ? void 0 : leaf.view) instanceof ColumnExplorerView ? leaf.view : null;
  }
  /** Действие пользователя над вью: отложенную сначала догружаем. */
  async withView(fn) {
    const leaf = this.getViewLeaf();
    if (!leaf) return;
    await leaf.loadIfDeferred();
    if (leaf.view instanceof ColumnExplorerView) fn(leaf.view);
  }
  async activateView() {
    const existing = this.getViewLeaf();
    const leaf = existing != null ? existing : this.settings.openLocation === "tab" ? this.app.workspace.getLeaf("tab") : this.app.workspace.getLeftLeaf(false);
    if (!leaf) return null;
    if (!existing) await leaf.setViewState({ type: VIEW_TYPE_COLUMNS, active: true });
    await this.app.workspace.revealLeaf(leaf);
    await leaf.loadIfDeferred();
    return leaf.view instanceof ColumnExplorerView ? leaf.view : null;
  }
};
