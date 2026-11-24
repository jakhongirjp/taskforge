import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./test/global-setup.ts"],
    testTimeout: 20_000,
    // Cheap scrypt cost keeps the suite fast; production uses N=2^17.
    env: { SCRYPT_N: "1024" },
  },
});
