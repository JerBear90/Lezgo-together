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

test("shows a reconstructed step with arrows and stud text", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByTestId("load-sample").click();
  await page.getByTestId("set-card").click();
  await page.getByTestId("nav-play").click();
  await expect(page.getByTestId("step-heading")).toHaveText("Step 1");
  await expect(page.getByTestId("step-diagram")).toHaveAttribute("data-mode", /3d|flat/);
  await expect(page.getByTestId("placement-arrow").first()).toBeVisible();
  await expect(page.getByTestId("stud-text")).toContainText(
    "Red 2x4: place 3 studs in from the left edge, 2nd row from the front.",
  );
  await expect(page.getByTestId("part-id")).toContainText("3001");
  await shot(page, testInfo, "reconstructed-step");
});

test("shows an unsure ghost instead of an arrow", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByTestId("load-sample").click();
  await page.getByTestId("set-card").click();
  await page.getByTestId("nav-play").click();
  for (let step = 0; step < 4; step += 1) await page.getByTestId("step-next").click();
  await expect(page.getByTestId("step-heading")).toHaveText("Step 5");
  await expect(page.getByTestId("placement-arrow")).toHaveCount(0);
  await expect(page.getByTestId("ghost-part")).toBeVisible();
  await expect(page.getByTestId("ghost-part")).toContainText("can't count studs, photo angle");
  await expect(page.getByTestId("placement-retake")).toBeVisible();
  await shot(page, testInfo, "ghost-part");
});

test("compares the reconstructed step with the booklet photo", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByTestId("load-sample").click();
  await page.getByTestId("set-card").click();
  await page.getByTestId("nav-play").click();
  await page.getByTestId("show-photo").click();
  await expect(page.getByTestId("step-image")).toBeVisible();
  await expect(page.getByTestId("photo-arrow").first()).toBeVisible();
  await shot(page, testInfo, "photo-compare");
  await page.getByTestId("show-diagram").click();
  await expect(page.getByTestId("step-diagram")).toBeVisible();
});

test("keeps a dragged arrow after reload", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("load-sample").click();
  await page.getByTestId("set-card").click();
  await page.getByTestId("nav-play").click();
  await expect(page.getByTestId("step-diagram")).toHaveAttribute("data-mode", /3d|flat/);
  const target = page.locator("[data-testid='placement-target'][data-pose='0']");
  const before = await target.getAttribute("data-x");
  const box = await target.boundingBox();
  if (!box || before == null) throw new Error("The arrow handle is not on the step.");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(target).not.toHaveAttribute("data-x", before);
  const after = await target.getAttribute("data-x");
  await page.reload();
  await expect(page.getByTestId("step-heading")).toHaveText("Step 1");
  await expect(page.locator("[data-testid='placement-target'][data-pose='0']")).toHaveAttribute("data-x", after ?? "");
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
