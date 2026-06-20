import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";
import path from "node:path";

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, "migrations"));
  return {
    test: {
      poolOptions: {
        workers: {
          singleWorker: true,
          miniflare: {
            compatibilityDate: "2026-06-19",
            compatibilityFlags: ["nodejs_compat"],
            d1Databases: ["DB"],
            r2Buckets: ["PHOTOS"],
            bindings: {
              TEST_MIGRATIONS: migrations,
              ADMIN_PASSWORD: "test-password",
              AI_MODEL: "claude-opus-4-8",
              ANTHROPIC_API_KEY: "test-key",
              PUBLIC_WHATSAPP: "+16199448759",
              PUBLIC_SMS: "+16199448759",
              PUBLIC_INSTAGRAM_URL: "https://instagram.com/test",
              OWNER_EMAIL: "owner@example.com",
            },
          },
        },
      },
    },
  };
});
