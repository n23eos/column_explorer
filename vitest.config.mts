import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			// В npm-пакете obsidian только типы, рантайма нет. Для instanceof
			// в src/utils.ts подставляем мок с классами TFile/TFolder.
			obsidian: fileURLToPath(new URL("./tests/__mocks__/obsidian.ts", import.meta.url)),
		},
	},
	test: {
		environment: "happy-dom",
		// Хелперы Obsidian на прототипах DOM (createDiv/addClass/...) и стаб
		// IntersectionObserver — без них модули, рисующие DOM, не грузятся.
		setupFiles: ["./tests/setup/obsidian-dom.ts"],
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
			// Таблицы локалей — данные, а не логика: их полноту проверяет
			// i18n.test.ts, покрытие построчно тут ничего не говорит.
			exclude: ["src/locales/**"],
			reporter: ["text", "html"],
			// Пороги чуть ниже текущих значений: страхуют от отката покрытия,
			// но не краснеют от одной удалённой ветки
			thresholds: { lines: 88, statements: 84, functions: 78, branches: 75 },
		},
	},
});
