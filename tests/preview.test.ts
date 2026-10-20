import { beforeEach, describe, expect, test, vi } from "vitest";
import { Component, MarkdownRenderer, Platform, TFile } from "obsidian";
import { renderPreviewColumn, renderPreviewContent } from "../src/preview";
import { makeVault } from "./setup/vault";
import { makeView } from "./setup/view";

function setup(paths: string[], settings = {}) {
	const vault = makeVault(paths);
	const view = makeView(vault, { settings });
	// Превью markdown читает файл — отдаём содержимое из карты
	const contents = new Map<string, string>();
	(view.app.vault as unknown as { cachedRead: (f: TFile) => Promise<string> })
		.cachedRead = (f) => Promise.resolve(contents.get(f.path) ?? "");
	(view as unknown as { newPreviewOwner: () => Component }).newPreviewOwner = () => new Component();
	const host = document.createElement("div");
	document.body.appendChild(host);
	return { vault, view, host, contents };
}

const fileOf = (vault: ReturnType<typeof makeVault>, path: string) =>
	vault.getAbstractFileByPath(path) as TFile;

beforeEach(() => {
	document.body.innerHTML = "";
});

describe("renderPreviewContent", () => {
	test("shows the name, size and an open button", () => {
		const { view, host, vault } = setup(["a.md"]);

		renderPreviewContent(view, host, fileOf(vault, "a.md"), new Component());

		expect(host.querySelector(".column-explorer-preview-name")?.textContent).toBe("a");
		expect(host.querySelector(".column-explorer-preview-meta")).not.toBeNull();
		expect(host.querySelector("button")?.textContent).toBeTruthy();
	});

	test("renders an <img> for image files", () => {
		const { view, host, vault } = setup(["pic.png"]);

		renderPreviewContent(view, host, fileOf(vault, "pic.png"), new Component());

		const image = host.querySelector("img.column-explorer-preview-image");
		expect(image?.getAttribute("src")).toBe("app://pic.png");
		expect(image?.getAttribute("alt")).toBe("pic.png");
	});

	test("renders an <audio> player for audio files", () => {
		const { view, host, vault } = setup(["song.mp3"]);

		renderPreviewContent(view, host, fileOf(vault, "song.mp3"), new Component());

		expect(host.querySelector("audio.column-explorer-preview-audio")).not.toBeNull();
	});

	test("renders a <video> player for video files", () => {
		const { view, host, vault } = setup(["clip.mp4"]);

		renderPreviewContent(view, host, fileOf(vault, "clip.mp4"), new Component());

		expect(host.querySelector("video.column-explorer-preview-video")).not.toBeNull();
	});

	test("gives the desktop PDF frame an accessible title", () => {
		const { view, host, vault } = setup(["report.pdf"]);
		const wasDesktopApp = Platform.isDesktopApp;
		Platform.isDesktopApp = true;
		host.remove();

		renderPreviewContent(view, host, fileOf(vault, "report.pdf"), new Component());
		Platform.isDesktopApp = wasDesktopApp;

		expect(host.querySelector("iframe.column-explorer-preview-pdf")?.getAttribute("title")).toContain("report");
	});

	test("falls back to a generic icon for files with no media preview", () => {
		const { view, host, vault } = setup(["notes.txt"]);

		renderPreviewContent(view, host, fileOf(vault, "notes.txt"), new Component());

		expect(host.querySelector(".column-explorer-preview-icon")).not.toBeNull();
	});

	test("the open button opens the previewed file", () => {
		const { view, host, vault } = setup(["a.md"]);
		const opened: string[] = [];
		(view.app.workspace as unknown as { getLeaf: () => { openFile: (f: TFile) => Promise<void> } })
			.getLeaf = () => ({ openFile: (f) => { opened.push(f.path); return Promise.resolve(); } });

		renderPreviewContent(view, host, fileOf(vault, "a.md"), new Component());
		host.querySelector("button")?.dispatchEvent(new MouseEvent("click"));

		expect(opened).toEqual(["a.md"]);
	});

	test("renders a markdown snippet when the setting is on", async () => {
		const { view, host, vault, contents } = setup(["a.md"], { showMarkdownPreview: true });
		contents.set("a.md", "# Heading");

		renderPreviewContent(view, host, fileOf(vault, "a.md"), new Component());

		await vi.waitFor(() => expect(host.querySelector(".column-explorer-preview-md")).not.toBeNull());
	});

	test("removes a late markdown render and unloads its stale owner", async () => {
		const { view, host, vault, contents } = setup(["a.md"], { showMarkdownPreview: true });
		contents.set("a.md", "# Heading");
		const owner = new Component();
		const unload = vi.spyOn(owner, "unload");
		let finishRender: (() => void) | undefined;
		const render = vi.spyOn(MarkdownRenderer, "render").mockImplementation(() =>
			new Promise<void>((resolve) => { finishRender = resolve; }));
		let current = true;

		renderPreviewContent(view, host, fileOf(vault, "a.md"), owner, () => current);
		await vi.waitFor(() => expect(render).toHaveBeenCalledOnce());
		current = false;
		finishRender?.();

		await vi.waitFor(() => expect(host.querySelector(".column-explorer-preview-md")).toBeNull());
		expect(unload).toHaveBeenCalledOnce();
		render.mockRestore();
	});

	test("skips the markdown snippet when the setting is off", async () => {
		const { view, host, vault, contents } = setup(["a.md"], { showMarkdownPreview: false });
		contents.set("a.md", "# Heading");

		renderPreviewContent(view, host, fileOf(vault, "a.md"), new Component());
		await Promise.resolve();

		expect(host.querySelector(".column-explorer-preview-md")).toBeNull();
	});

	test("skips an empty markdown file instead of rendering a blank block", async () => {
		const { view, host, vault, contents } = setup(["a.md"], { showMarkdownPreview: true });
		contents.set("a.md", "   \n  ");

		renderPreviewContent(view, host, fileOf(vault, "a.md"), new Component());
		await Promise.resolve();
		await Promise.resolve();

		expect(host.querySelector(".column-explorer-preview-md")).toBeNull();
	});
});

describe("renderPreviewColumn", () => {
	test("adds a preview column to the container", () => {
		const { view, host, vault } = setup(["a.md"]);

		renderPreviewColumn(view, host, fileOf(vault, "a.md"));

		expect(host.querySelector(".column-explorer-column.column-explorer-preview")).not.toBeNull();
	});
});
