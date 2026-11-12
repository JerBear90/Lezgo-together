import { expect, test } from "@playwright/test";
import { createSet, shot, uploadPages } from "./support";

test("creates a set", async ({ page }, testInfo) => {
  await createSet(page, "Weekend tug");
  await page.goto("/");
  await expect(page.getByTestId("set-card")).toContainText("Weekend tug");
  await shot(page, testInfo, "set-list");
});

test("uploads instruction page images", async ({ page }, testInfo) => {
  await createSet(page);
  await uploadPages(page);
  await expect(page.getByTestId("page-card").first()).toContainText("2 steps");
  await shot(page, testInfo, "page-upload");
});

test("steps next and back and checks off parts", async ({ page }, testInfo) => {
  await createSet(page);
  await uploadPages(page);
  await page.getByTestId("nav-play").click();
  await expect(page.getByTestId("step-heading")).toHaveText("Step 1");
  const firstPart = page.getByTestId("part-check").first();
  await firstPart.click();
  await expect(firstPart).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("step-next").click();
  await expect(page.getByTestId("step-heading")).toHaveText("Step 2");
  await page.getByTestId("step-back").click();
  await expect(page.getByTestId("step-heading")).toHaveText("Step 1");
  await expect(page.getByTestId("part-check").first()).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByTestId("step-heading")).toHaveText("Step 1");
  await expect(page.getByTestId("part-check").first()).toHaveAttribute("aria-pressed", "true");
  await shot(page, testInfo, "step-player");
});

test("shows an unsure icon on uncertain parts", async ({ page }, testInfo) => {
  await createSet(page);
  await uploadPages(page);
  await page.getByTestId("nav-play").click();
  await page.getByTestId("step-next").click();
  await expect(page.getByTestId("step-heading")).toHaveText("Step 2");
  await expect(page.getByTestId("unsure-badge").first()).toBeVisible();
  await expect(page.locator("span.text-unsure", { hasText: "Unsure: color and quantity" })).toBeVisible();
  await shot(page, testInfo, "unsure-part");
});

test("shows a retake photo prompt", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByTestId("load-sample").click();
  await page.getByTestId("set-card").click();
  await page.getByTestId("nav-pages").click();
  const banner = page.getByTestId("retake-banner");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("Retake this photo");
  await expect(banner).toContainText("Too blurry.");
  await expect(banner).toContainText("Step 9 cut off.");
  await shot(page, testInfo, "retake-prompt");

  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByTestId("retake-button").click();
  const chooser = await chooserPromise;
  await chooser.setFiles("e2e/fixtures/page-1.png");
  await expect(page.getByTestId("retake-banner")).toHaveCount(0);
  await expect(page.getByTestId("page-status").filter({ hasText: "Ready" })).toHaveCount(4, { timeout: 20_000 });
});

test("shows the whole-set parts list", async ({ page }, testInfo) => {
  await createSet(page);
  await uploadPages(page);
  await page.goto("/");
  await page.getByTestId("set-card").click();
  await page.getByTestId("nav-parts").click();
  const list = page.getByTestId("parts-list");
  await expect(list).toContainText("Red");
  await expect(list).toContainText("2x4");
  await expect(list).toContainText("×4");
  await expect(list).toContainText("Unclear");
  await expect(list).toContainText("×?");
  await expect(list.getByTestId("unsure-badge")).toBeVisible();
  await shot(page, testInfo, "parts-list");
});
