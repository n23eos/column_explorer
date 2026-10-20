import { Component, Keymap, MarkdownRenderer, Platform, TFile, setIcon } from "obsidian";
import { t } from "./i18n";
import { humanSize } from "./pure";
import { displayName, iconFor, isImageFile } from "./utils";
import type { ColumnExplorerView } from "./view";

const MARKDOWN_PREVIEW_CHARS = 1000;
const AUDIO_EXTENSIONS = ["mp3", "wav", "ogg", "flac", "m4a"];
const VIDEO_EXTENSIONS = ["mp4", "mov", "webm", "ogv"];

export function renderPreviewColumn(view: ColumnExplorerView, container: HTMLElement, file: TFile) {
	const col = container.createDiv({ cls: "column-explorer-column column-explorer-preview" });
	const inner = col.createDiv({ cls: "column-explorer-preview-inner" });
	renderPreviewContent(view, inner, file, view.newPreviewOwner());
}

/**
 * Shared preview body — used by the preview column and the Quick Look modal.
 * `owner` управляет жизнью отрисованного markdown (эмбеды, ссылки): его
 * выгрузка снимает всё, что отрисовал MarkdownRenderer.
 */
export function renderPreviewContent(
	view: ColumnExplorerView,
	inner: HTMLElement,
	file: TFile,
	owner: Component,
	isCurrent: () => boolean = () => inner.isConnected,
) {
	if (!renderMediaPreview(view, inner, file)) {
		const big = inner.createDiv({ cls: "column-explorer-preview-icon" });
		setIcon(big, iconFor(file));
	}

	inner.createDiv({ cls: "column-explorer-preview-name", text: displayName(file) });
	const meta = inner.createDiv({ cls: "column-explorer-preview-meta" });
	meta.createDiv({ text: file.extension.toUpperCase() + " · " + humanSize(file.stat.size) });
	meta.createDiv({ text: t("modified") + ": " + new Date(file.stat.mtime).toLocaleString() });
	meta.createDiv({ text: t("created") + ": " + new Date(file.stat.ctime).toLocaleString() });

	const btn = inner.createEl("button", { text: t("open"), cls: "mod-cta" });
	btn.addEventListener("click", (e) => {
		void view.app.workspace.getLeaf(Keymap.isModEvent(e)).openFile(file);
	});

	if (file.extension === "md" && view.plugin.settings.showMarkdownPreview) {
		void renderMarkdownSnippet(view, inner, file, owner, isCurrent);
	}
}

/** Rich preview for images, audio, video and PDF. Returns false when the file has none. */
function renderMediaPreview(view: ColumnExplorerView, inner: HTMLElement, file: TFile): boolean {
	const src = view.app.vault.getResourcePath(file);
	if (isImageFile(file)) {
		inner.createEl("img", { cls: "column-explorer-preview-image", attr: { src, alt: displayName(file) } });
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
	if (file.extension === "pdf" && Platform.isDesktopApp) {
		inner.createEl("iframe", {
			cls: "column-explorer-preview-pdf",
			attr: { src, title: `${t("preview")}: ${displayName(file)}` },
		});
		return true;
	}
	return false;
}

async function renderMarkdownSnippet(
	view: ColumnExplorerView,
	inner: HTMLElement,
	file: TFile,
	owner: Component,
	isCurrent: () => boolean,
) {
	try {
		const content = await view.app.vault.cachedRead(file);
		// Колонку или Quick Look могли перерисовать, пока шло чтение.
		if (!isCurrent()) return;
		let snippet = content.slice(0, MARKDOWN_PREVIEW_CHARS);
		if (content.length > MARKDOWN_PREVIEW_CHARS) snippet += "…";
		if (!snippet.trim()) return;
		const box = inner.createDiv({ cls: "column-explorer-preview-md markdown-rendered" });
		await MarkdownRenderer.render(view.app, snippet, box, file.path, owner);
		if (!isCurrent()) {
			box.detach();
			// Renderer мог зарегистрировать детей после первой выгрузки owner.
			owner.unload();
		}
	} catch { /* превью — best effort, ошибок чтения не показываем */ }
}
