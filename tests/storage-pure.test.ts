/**
 * Чистые модули колонки «Использование диска»: геометрия дуг, палитра,
 * раскладка углов, сбор дуг под окно зума, скан хранилища и словосчёт.
 */
import { describe, expect, test } from "vitest";
import { TFile, TFolder, Vault } from "obsidian";
import { arcColor } from "../src/storage/color";
import { makeExclusionFilter } from "../src/storage/exclude";
import { TAU, arcPath, clamp, easeInOutCubic, lerp } from "../src/storage/geometry";
import { computeLayout, metricValue, pathDepth } from "../src/storage/layout";
import { collectArcs } from "../src/storage/render";
import { WordCacheEntry, buildTree, countVaultWords, indexTree } from "../src/storage/scan";
import type { TreeNode } from "../src/storage/types";
import { countWords } from "../src/storage/words";
import { makeVault } from "./setup/vault";

const file = (name: string, path: string, size: number, words = 0): TreeNode => ({
	name, path, isFolder: false, size, words, files: 1, children: [],
});

const folder = (name: string, path: string, children: TreeNode[]): TreeNode => ({
	name,
	path,
	isFolder: true,
	size: children.reduce((s, c) => s + c.size, 0),
	words: children.reduce((s, c) => s + c.words, 0),
	files: children.reduce((s, c) => s + c.files, 0),
	children,
});

describe("countWords", () => {
	test("counts plain russian and english words", () => {
		expect(countWords("Привет мир, hello world!")).toBe(4);
	});

	test("hyphenated and apostrophe words count as one", () => {
		expect(countWords("какой-то don't")).toBe(2);
	});

	test("returns zero for empty or symbol-only text", () => {
		expect(countWords("")).toBe(0);
		expect(countWords("--- ### ***")).toBe(0);
	});

	test("CJK characters count individually, korean by spaces", () => {
		expect(countWords("你好世界")).toBe(4);
		expect(countWords("日本語のテキスト")).toBe(8);
		expect(countWords("안녕하세요 세계")).toBe(2);
		expect(countWords("mixed 中文 text")).toBe(4);
	});
});

describe("makeExclusionFilter", () => {
	test("matches exact paths and nested children", () => {
		const excluded = makeExclusionFilter(["attachments", "/daily/"]);
		expect(excluded("attachments")).toBe(true);
		expect(excluded("attachments/img.png")).toBe(true);
		expect(excluded("daily/2026.md")).toBe(true);
		expect(excluded("notes/attachments.md")).toBe(false);
	});

	test("empty settings exclude nothing", () => {
		const excluded = makeExclusionFilter(["", "  "]);
		expect(excluded("anything")).toBe(false);
	});
});

describe("geometry", () => {
	test("clamp, lerp and easing bounds", () => {
		expect(clamp(5, 0, 1)).toBe(1);
		expect(lerp(0, 10, 0.25)).toBe(2.5);
		expect(easeInOutCubic(0)).toBe(0);
		expect(easeInOutCubic(1)).toBe(1);
	});

	test("arcPath returns empty for degenerate sectors", () => {
		expect(arcPath(0, 0, 10, 20)).toBe("");
		expect(arcPath(0, 1, 20, 10)).toBe("");
	});

	test("arcPath builds a sector with two arcs", () => {
		const d = arcPath(0, Math.PI / 2, 50, 100, 1);
		expect(d.startsWith("M ")).toBe(true);
		expect(d.match(/A /g)?.length).toBe(2);
		expect(d.endsWith("Z")).toBe(true);
	});

	test("full circle renders as double annulus path", () => {
		const d = arcPath(0, TAU, 50, 100);
		expect(d.match(/M /g)?.length).toBe(2);
	});
});

describe("arcColor", () => {
	test("returns valid hsl and fades with depth", () => {
		const c1 = arcColor(0.25, 1, false);
		const c5 = arcColor(0.25, 5, false);
		expect(c1).toMatch(/^hsl\(\d+ \d+% \d+(\.\d+)?%\)$/);
		const sat = (c: string) => Number(c.split(" ")[1].replace("%", ""));
		expect(sat(c5)).toBeLessThan(sat(c1));
	});
});

describe("computeLayout", () => {
	const tree = folder("root", "/", [
		folder("a", "a", [file("a1.md", "a/a1.md", 300, 30), file("a2.md", "a/a2.md", 100, 10)]),
		file("b.md", "b.md", 600, 0),
	]);

	test("angles are proportional to metric and cover the full circle", () => {
		const layout = computeLayout(tree, "size");
		expect(layout.total).toBe(1000);
		expect(layout.angles.get("/")).toEqual({ x0: 0, x1: 1 });
		const b = layout.angles.get("b.md")!;
		expect(b.x1 - b.x0).toBeCloseTo(0.6);
		const a = layout.angles.get("a")!;
		expect(a.x1 - a.x0).toBeCloseTo(0.4);
	});

	test("children are sorted descending by value", () => {
		const layout = computeLayout(tree, "size");
		const kids = layout.order.get("/")!;
		expect(kids.map((k) => k.path)).toEqual(["b.md", "a"]);
	});

	test("zero-value nodes are excluded in words metric", () => {
		const layout = computeLayout(tree, "words");
		expect(layout.total).toBe(40);
		expect(layout.angles.has("b.md")).toBe(false);
		const a = layout.angles.get("a")!;
		expect(a.x1 - a.x0).toBeCloseTo(1);
	});

	test("empty tree produces empty layout", () => {
		const layout = computeLayout(folder("root", "/", []), "size");
		expect(layout.total).toBe(0);
		expect(layout.angles.size).toBe(0);
	});

	test("metricValue picks the right field", () => {
		expect(metricValue(tree, "size")).toBe(1000);
		expect(metricValue(tree, "words")).toBe(40);
		expect(metricValue(tree, "files")).toBe(3);
	});

	test("files metric splits by file count", () => {
		const layout = computeLayout(tree, "files");
		expect(layout.total).toBe(3);
		const a = layout.angles.get("a")!;
		expect(a.x1 - a.x0).toBeCloseTo(2 / 3);
	});
});

describe("pathDepth", () => {
	test("root and nested depths", () => {
		expect(pathDepth("/")).toBe(0);
		expect(pathDepth("a")).toBe(1);
		expect(pathDepth("a/b/c")).toBe(3);
	});
});

describe("collectArcs", () => {
	const tiny = Array.from({ length: 20 }, (_, i) => file(`t${i}.md`, `t/t${i}.md`, 1));
	const tree = folder("root", "/", [
		folder("big", "big", [file("x.md", "big/x.md", 5000)]),
		folder("t", "t", tiny),
	]);
	const layout = computeLayout(tree, "size");
	const fullView = { x0: 0, x1: 1, depth: 0 };
	const valueOf = (n: TreeNode) => n.size;
	const angleOf = (p: string) => layout.angles.get(p);

	test("renders visible arcs and merges tiny tail into rest", () => {
		const arcs = collectArcs(tree, layout.order, angleOf, fullView, valueOf);
		const keys = arcs.map((a) => a.key);
		expect(keys).toContain("big");
		expect(keys).toContain("big/x.md");
		expect(keys).toContain("t");
		// 20 файлов по 1 байту в круге на 5020 байт — каждый тоньше порога,
		// поэтому все схлопываются в одну дугу «мелкие элементы»
		const rest = arcs.find((a) => a.key === "t::rest");
		expect(rest).toBeDefined();
		expect(rest!.restCount).toBe(20);
		expect(rest!.restValue).toBe(20);
		expect(keys).not.toContain("t/t0.md");
	});

	test("zoomed view expands tiny files into real arcs", () => {
		const t = layout.angles.get("t")!;
		const zoomed = { x0: t.x0, x1: t.x1, depth: 1 };
		const arcs = collectArcs(tree, layout.order, angleOf, zoomed, valueOf);
		const keys = arcs.map((a) => a.key);
		expect(keys).toContain("t/t0.md");
		expect(keys).not.toContain("t::rest");
		// Соседнее поддерево осталось за окном зума
		expect(keys).not.toContain("big/x.md");
	});

	test("rings deeper than the limit are not emitted", () => {
		const deep = folder("root", "/", [
			folder("l1", "l1", [
				folder("l2", "l1/l2", [
					folder("l3", "l1/l2/l3", [
						folder("l4", "l1/l2/l3/l4", [
							folder("l5", "l1/l2/l3/l4/l5", [
								folder("l6", "l1/l2/l3/l4/l5/l6", [
									file("deep.md", "l1/l2/l3/l4/l5/l6/deep.md", 100),
								]),
							]),
						]),
					]),
				]),
			]),
		]);
		const deepLayout = computeLayout(deep, "size");
		const arcs = collectArcs(
			deep,
			deepLayout.order,
			(p) => deepLayout.angles.get(p),
			fullView,
			valueOf,
		);
		const maxRing = Math.max(...arcs.map((a) => a.ring));
		expect(maxRing).toBeLessThanOrEqual(6);
		expect(arcs.map((a) => a.key)).not.toContain("l1/l2/l3/l4/l5/l6/deep.md");
	});
});

/**
 * Скан работает поверх настоящего Vault; в тестах хватает фейкового дерева
 * с чтением файлов из карты содержимого.
 */
function scanVault(paths: string[], contents: Record<string, string> = {}) {
	const fake = makeVault(paths);
	const files: TFile[] = [];
	const walk = (f: TFolder) => {
		for (const child of f.children) {
			if (child instanceof TFolder) walk(child);
			else if (child instanceof TFile) files.push(child);
		}
	};
	walk(fake.root);
	for (const f of files) f.stat = { ...f.stat, size: (contents[f.path] ?? "").length };

	return {
		fake,
		vault: {
			getName: () => "vault",
			getRoot: () => fake.root,
			getMarkdownFiles: () => files.filter((f) => f.extension === "md"),
			cachedRead: (f: TFile) => Promise.resolve(contents[f.path] ?? ""),
		} as unknown as Vault,
	};
}

describe("buildTree", () => {
	test("aggregates size, words and file counts up the tree", () => {
		const { vault } = scanVault(["a/one.md", "a/two.md", "b.md"], {
			"a/one.md": "hello world",
			"a/two.md": "x",
			"b.md": "yyy",
		});
		const tree = buildTree(vault, new Map([["a/one.md", 2], ["a/two.md", 1]]));
		expect(tree.name).toBe("vault");
		expect(tree.files).toBe(3);
		expect(tree.words).toBe(3);
		expect(tree.size).toBe("hello world".length + 1 + 3);
		const a = tree.children.find((c) => c.path === "a")!;
		expect(a.isFolder).toBe(true);
		expect(a.files).toBe(2);
	});

	test("excluded paths and empty folders are dropped", () => {
		const { vault } = scanVault(["attachments/img.png", "empty/", "note.md"]);
		const tree = buildTree(vault, new Map(), makeExclusionFilter(["attachments"]));
		expect(tree.children.map((c) => c.path)).toEqual(["note.md"]);
	});
});

describe("countVaultWords", () => {
	test("counts markdown files and reuses the cache by mtime", async () => {
		const { vault } = scanVault(["a.md", "b.md", "img.png"], {
			"a.md": "one two three",
			"b.md": "four",
		});
		const cache = new Map<string, WordCacheEntry>();
		const first = await countVaultWords(vault, cache);
		expect(first.get("a.md")).toBe(3);
		expect(first.get("b.md")).toBe(1);
		expect(first.has("img.png")).toBe(false);
		expect(cache.size).toBe(2);

		// Второй проход не читает файлы: чтение бросает, но кэш по mtime спасает
		const throwing = { ...vault, cachedRead: () => Promise.reject(new Error("no read")) } as unknown as Vault;
		const second = await countVaultWords(throwing, cache);
		expect(second.get("a.md")).toBe(3);
	});

	test("unreadable file counts as zero words", async () => {
		const { vault } = scanVault(["a.md"]);
		const failing = { ...vault, cachedRead: () => Promise.reject(new Error("boom")) } as unknown as Vault;
		const words = await countVaultWords(failing, new Map());
		expect(words.get("a.md")).toBe(0);
	});

	test("forgets cached files that the scan no longer sees", async () => {
		const { vault } = scanVault(["a.md", "b.md"], { "a.md": "one", "b.md": "two" });
		const cache = new Map<string, WordCacheEntry>();
		await countVaultWords(vault, cache);
		expect(cache.size).toBe(2);

		await countVaultWords(vault, cache, undefined, makeExclusionFilter(["b.md"]));

		expect([...cache.keys()]).toEqual(["a.md"]);
	});

	test("reports progress on the last file", async () => {
		const { vault } = scanVault(["a.md"], { "a.md": "word" });
		const progress: [number, number][] = [];
		await countVaultWords(vault, new Map(), (done, total) => progress.push([done, total]));
		expect(progress).toEqual([[1, 1]]);
	});

	test("keeps the mtime captured before an asynchronous read", async () => {
		const { fake, vault } = scanVault(["a.md"], { "a.md": "old" });
		const file = fake.getAbstractFileByPath("a.md") as TFile;
		const originalMtime = file.stat.mtime;
		let finishRead: ((content: string) => void) | undefined;
		let reads = 0;
		const delayed = {
			...vault,
			cachedRead: () => {
				reads++;
				if (reads === 1) return new Promise<string>((resolve) => { finishRead = resolve; });
				return Promise.resolve("new words");
			},
		} as unknown as Vault;
		const cache = new Map<string, WordCacheEntry>();

		const first = countVaultWords(delayed, cache);
		await Promise.resolve();
		file.stat = { ...file.stat, mtime: originalMtime + 1 };
		finishRead?.("old");
		await first;

		expect(cache.get("a.md")?.mtime).toBe(originalMtime);
		const second = await countVaultWords(delayed, cache);
		expect(reads).toBe(2);
		expect(second.get("a.md")).toBe(2);
	});
});

describe("indexTree", () => {
	test("indexes every node by path", () => {
		const tree = folder("root", "/", [folder("a", "a", [file("x.md", "a/x.md", 1)])]);
		const index = indexTree(tree);
		expect([...index.keys()].sort()).toEqual(["/", "a", "a/x.md"]);
		expect(index.get("a/x.md")!.size).toBe(1);
	});
});
