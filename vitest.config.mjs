// Browser-free unit tests for new frontend modules.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["ui/src/**/*.test.js", "tests/ui/**/*.test.js", "tests/unit/**/*.test.js"],
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    testTimeout: 10_000,
  },
});
