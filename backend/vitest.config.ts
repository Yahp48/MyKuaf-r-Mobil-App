import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./test/global-setup.ts"],
    setupFiles: ["./test/setup-env.ts"],
    // Testler aynı veritabanını paylaşır; dosyalar sırayla çalışır.
    fileParallelism: false,
    pool: "forks",
    maxWorkers: 1,
    isolate: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
