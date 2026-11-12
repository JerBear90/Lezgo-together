import fs from "node:fs/promises";
import path from "node:path";
import { expect, type Page, type TestInfo } from "@playwright/test";

export async function shot(page: Page, testInfo: TestInfo, name: string) {
  const dir = path.join("e2e-screenshots", testInfo.project.name);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await testInfo.attach(name, { path: file, contentType: "image/png" });
}

export async function createSet(page: Page, name = "Weekend tug") {
  await page.goto("/");
  await page.getByTestId("create-set").click();
  await page.getByTestId("set-name").fill(name);
  await page.getByTestId("save-set").click();
  await expect(page.getByTestId("upload-input")).toBeAttached();
}

export async function uploadPages(page: Page) {
  await page.getByTestId("upload-input").setInputFiles(["e2e/fixtures/page-1.png", "e2e/fixtures/page-2.png"]);
  await expect(page.getByTestId("page-card")).toHaveCount(2);
  await expect(page.getByTestId("page-status").filter({ hasText: "Ready" })).toHaveCount(2, { timeout: 20_000 });
  const pages = page.locator("main").filter({ has: page.getByTestId("page-list") });
  await expect(pages.getByTestId("demo-banner")).toBeVisible();
}
