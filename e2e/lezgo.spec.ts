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
  testInfo.setTimeout(120_000);
  testInfo.skip(testInfo.project.name !== "phone", "phone viewport only");
  const phones = [
    { width: 360, height: 740 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ];
  for (const viewport of phones) {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent: testInfo.project.use.userAgent,
    });
    const page = await context.newPage();
    await page.goto(`${baseURL}/`);
    await page.getByTestId("load-sample").click();
    await page.getByTestId("set-card").click();
    await page.getByTestId("nav-play").click();
    for (let step = 1; step <= 6; step += 1) {
      await expect(page.getByTestId("step-heading")).toHaveText(`Step ${step}`, { timeout: 15_000 });
      await expectFit(page, step === 2);
      await expectNoticeFullyVisible(page);
      await expectChipsVisible(page);
      await expectPinnedToBottom(page);
      await expectZoomClear(page);
      await expectNotesUnclipped(page);
      if (step === 5) await expectCalloutClear(page);
      if (step < 6) await page.getByTestId("step-next").click();
    }
    await context.close();
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

async function expectFit(page: Page, flat: boolean) {
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
  const widthFill = (fit.right - fit.left) / fit.stageW;
  const heightFill = (fit.bottom - fit.top) / fit.stageH;
  expect(Math.max(widthFill, heightFill)).toBeGreaterThanOrEqual(0.55);
  if (flat) expect(widthFill).toBeGreaterThanOrEqual(0.65);
  const tools = await page.getByTestId("zoom-controls").boundingBox();
  if (!tools) throw new Error("The zoom controls have no box.");
  const stageTop = (await page.getByTestId("step-diagram").boundingBox())?.y ?? 0;
  const usableTop = tools.y + tools.height - stageTop;
  const usableMid = usableTop + (fit.stageH - usableTop) / 2;
  const mid = (fit.top + fit.bottom) / 2;
  expect(fit.top).toBeGreaterThanOrEqual(usableTop - 2);
  expect(Math.abs(mid - usableMid)).toBeLessThan(fit.stageH * 0.16);
}

async function expectNoticeFullyVisible(page: Page) {
  const notice = page.getByTestId("placement-retake");
  if ((await notice.count()) === 0) return;
  const box = await notice.boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) throw new Error("The retake notice has no box.");
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  const covered = await notice.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const samples = [
      [rect.left + 8, rect.top + 8],
      [rect.right - 8, rect.top + 8],
      [rect.left + 8, rect.bottom - 8],
      [rect.right - 8, rect.bottom - 8],
      [(rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2],
    ];
    return samples.some(([x, y]) => {
      const hit = document.elementFromPoint(x, y);
      return !hit || (hit !== el && !el.contains(hit));
    });
  });
  expect(covered).toBe(false);
  const back = await page.getByTestId("step-back").boundingBox();
  const next = await page.getByTestId("step-next").boundingBox();
  if (!back || !next) throw new Error("The step buttons have no box.");
  expect(overlaps(bounds(box), bounds(back))).toBe(false);
  expect(overlaps(bounds(box), bounds(next))).toBe(false);
}

function bounds(box: { x: number; y: number; width: number; height: number }) {
  return { left: box.x, top: box.y, right: box.x + box.width, bottom: box.y + box.height };
}

async function expectPinnedToBottom(page: Page) {
  const gap = await page.evaluate(() => {
    const slider = document.querySelector(".stage-slider");
    if (!slider) return 999;
    return window.innerHeight - slider.getBoundingClientRect().bottom;
  });
  expect(gap).toBeGreaterThanOrEqual(0);
  expect(gap).toBeLessThan(40);
}

async function expectZoomClear(page: Page) {
  const hit = await page.evaluate(() => {
    const tools = document.querySelector("[data-testid='zoom-controls']");
    const diagram = document.querySelector("[data-testid='step-diagram']");
    if (!tools || !diagram) return true;
    const stage = diagram.getBoundingClientRect();
    const tool = tools.getBoundingClientRect();
    const model = {
      left: stage.left + Number(diagram.getAttribute("data-model-left")),
      top: stage.top + Number(diagram.getAttribute("data-model-top")),
      right: stage.left + Number(diagram.getAttribute("data-model-right")),
      bottom: stage.top + Number(diagram.getAttribute("data-model-bottom")),
    };
    const boxes = [
      model,
      ...[...document.querySelectorAll("[data-testid='arrow-label']")].map((node) => {
        const box = node.getBoundingClientRect();
        return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
      }),
    ];
    const toolBox = { left: tool.left, top: tool.top, right: tool.right, bottom: tool.bottom };
    return boxes.some(
      (box) => box.left < toolBox.right - 2 && box.right > toolBox.left + 2 && box.top < toolBox.bottom - 2 && box.bottom > toolBox.top + 2,
    );
  });
  expect(hit).toBe(false);
}

async function expectNotesUnclipped(page: Page) {
  const clipped = await page.evaluate(() => {
    const notes = document.querySelector("[data-testid='step-notes']");
    if (!notes) return true;
    const box = notes.getBoundingClientRect();
    return notes.scrollHeight > notes.clientHeight + 2 || box.top < 0 || box.bottom > window.innerHeight + 1;
  });
  expect(clipped).toBe(false);
}

async function expectChipsVisible(page: Page) {
  const clipped = await page.evaluate(() => {
    const chips = [...document.querySelectorAll(".stage-slider .section-chip")];
    const width = window.innerWidth;
    const height = window.innerHeight;
    return chips.some((chip) => {
      const rect = chip.getBoundingClientRect();
      return rect.left < 0 || rect.top < 0 || rect.right > width - 1 || rect.bottom > height - 1;
    });
  });
  expect(clipped).toBe(false);
}

async function expectCalloutClear(page: Page) {
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
  expect(inside(layout.callout!, layout.stage!, 2)).toBe(true);
  expect(overlaps(layout.callout!, layout.model!)).toBe(false);
  expect(overlaps(layout.notes!, layout.back!)).toBe(false);
  expect(overlaps(layout.notes!, layout.next!)).toBe(false);
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
