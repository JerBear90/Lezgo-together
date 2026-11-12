import { expect, test, type Page } from "@playwright/test";
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

test("fits the step model inside the stage at phone pixel ratios", async ({ browser, baseURL }, testInfo) => {
  testInfo.skip(testInfo.project.name !== "phone", "phone viewport only");
  const phones = [
    { width: 360, height: 740 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ];
  for (const viewport of phones) {
    for (const deviceScaleFactor of [2, 3]) {
      const context = await browser.newContext({
        viewport,
        deviceScaleFactor,
        isMobile: true,
        hasTouch: true,
        userAgent: testInfo.project.use.userAgent,
      });
      const page = await context.newPage();
      await page.goto(`${baseURL}/`);
      await page.getByTestId("load-sample").click();
      await page.getByTestId("set-card").click();
      await page.getByTestId("nav-play").click();
      await page.getByTestId("step-next").click();
      await expect(page.getByTestId("step-heading")).toHaveText("Step 2");
      await expectFit(page);
      for (let step = 0; step < 3; step += 1) await page.getByTestId("step-next").click();
      await expect(page.getByTestId("step-heading")).toHaveText("Step 5");
      await expectFit(page);
      const layout = await page.evaluate(() => {
        const rect = (node: Element | null) => {
          if (!node) return null;
          const box = node.getBoundingClientRect();
          return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
        };
        const diagram = document.querySelector("[data-testid='step-diagram']");
        const stage = diagram?.getBoundingClientRect();
        const model = diagram
          ? {
              left: (stage?.left ?? 0) + Number(diagram.getAttribute("data-model-left")),
              top: (stage?.top ?? 0) + Number(diagram.getAttribute("data-model-top")),
              right: (stage?.left ?? 0) + Number(diagram.getAttribute("data-model-right")),
              bottom: (stage?.top ?? 0) + Number(diagram.getAttribute("data-model-bottom")),
            }
          : null;
        return {
          stage: rect(diagram),
          callout: rect(document.querySelector("[data-testid='ghost-part']")),
          notes: rect(document.querySelector("[data-testid='step-notes']")),
          back: rect(document.querySelector("[data-testid='step-back']")),
          next: rect(document.querySelector("[data-testid='step-next']")),
          model,
        };
      });
      expect(layout.callout).toBeTruthy();
      expect(inside(layout.callout!, layout.stage!, 4)).toBe(true);
      expect(overlaps(layout.callout!, layout.model!)).toBe(false);
      expect(overlaps(layout.notes!, layout.back!)).toBe(false);
      expect(overlaps(layout.notes!, layout.next!)).toBe(false);
      expect(layout.notes!.bottom).toBeLessThanOrEqual(layout.back!.top - 8);
      await context.close();
    }
  }
});

function overlaps(
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number },
) {
  return a.left < b.right - 2 && a.right > b.left + 2 && a.top < b.bottom - 2 && a.bottom > b.top + 2;
}

function inside(
  inner: { left: number; top: number; right: number; bottom: number },
  outer: { left: number; top: number; right: number; bottom: number },
  pad: number,
) {
  return inner.left >= outer.left + pad && inner.top >= outer.top + pad && inner.right <= outer.right - pad && inner.bottom <= outer.bottom - pad;
}

async function expectFit(page: Page) {
  const diagram = page.getByTestId("step-diagram");
  await expect(diagram).toHaveAttribute("data-fit-ready", "true");
  const fit = await diagram.evaluate((el) => {
    const stage = el.getBoundingClientRect();
    const canvas = el.querySelector("canvas")?.getBoundingClientRect();
    return {
      stageW: stage.width,
      stageH: stage.height,
      canvasW: canvas?.width ?? 0,
      canvasH: canvas?.height ?? 0,
      left: Number(el.getAttribute("data-fit-left")),
      top: Number(el.getAttribute("data-fit-top")),
      right: Number(el.getAttribute("data-fit-right")),
      bottom: Number(el.getAttribute("data-fit-bottom")),
    };
  });
  expect(Math.abs(fit.canvasW - fit.stageW)).toBeLessThan(2);
  expect(Math.abs(fit.canvasH - fit.stageH)).toBeLessThan(2);
  const margin = 4;
  expect(fit.left).toBeGreaterThanOrEqual(margin);
  expect(fit.top).toBeGreaterThanOrEqual(margin);
  expect(fit.right).toBeLessThanOrEqual(fit.stageW - margin);
  expect(fit.bottom).toBeLessThanOrEqual(fit.stageH - margin);
  const fill = Math.max((fit.right - fit.left) / fit.stageW, (fit.bottom - fit.top) / fit.stageH);
  expect(fill).toBeGreaterThanOrEqual(0.55);
}

test("draws a black part as readable charcoal", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("load-sample").click();
  await page.getByTestId("set-card").click();
  await page.getByTestId("nav-play").click();
  await page.getByTestId("step-next").click();
  await expect(page.getByTestId("step-heading")).toHaveText("Step 2");
  const glyph = page.locator(".part-glyph").first();
  await expect(glyph).toHaveAttribute("data-dark", "true");
  await expect(glyph).toHaveCSS("background-color", "rgb(58, 58, 58)");
  await page.getByTestId("step-slider").fill("4");
  await expect(page.getByTestId("step-heading")).toHaveText("Preview 5");
  await expect(page.getByTestId("ghost-part")).toBeVisible();
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

test("opens the harbor tug sample from a direct link", async ({ page }) => {
  await page.goto("/sets/demo-harbor-tug");
  await expect(page.getByRole("heading", { name: "Harbor Tug 214" })).toBeVisible();
  await expect(page.getByText("Missing set")).toHaveCount(0);
  await expect(page.getByText("That set is not on this device")).toHaveCount(0);
  await expect(page.getByTestId("nav-play")).toBeVisible();

  await page.goto("/sets/not-a-real-set");
  await expect(page.getByRole("heading", { name: "Missing set" })).toBeVisible();
  await expect(page.getByTestId("try-sample")).toBeVisible();
  await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
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
