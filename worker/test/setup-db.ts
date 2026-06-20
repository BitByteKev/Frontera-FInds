import { env, applyD1Migrations } from "cloudflare:test";
import { beforeAll } from "vitest";

beforeAll(async () => {
  // TEST_MIGRATIONS is injected by vitest.config.ts via readD1Migrations.
  await applyD1Migrations(env.DB, (env as any).TEST_MIGRATIONS);
});
