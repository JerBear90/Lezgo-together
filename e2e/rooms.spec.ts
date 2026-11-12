import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { shot } from "./support";

async function open(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByTestId("active-player")).toBeVisible();
  return page;
}

test("two phones share a room and resume by code", async ({ browser }, testInfo) => {
  const device = {
    viewport: testInfo.project.use.viewport,
    isMobile: testInfo.project.use.isMobile,
    hasTouch: testInfo.project.use.hasTouch,
    userAgent: testInfo.project.use.userAgent,
  };
  const hostContext = await browser.newContext(device);
  const guestContext = await browser.newContext(device);
  const host = await open(hostContext);
  await host.getByTestId("load-sample").click();
  await host.getByTestId("set-card").click();
  await host.getByTestId("share-room").click();
  const code = (await host.getByTestId("room-code").textContent())?.trim() ?? "";
  expect(code).toMatch(/^[A-Z0-9]{5}$/);
  await shot(host, testInfo, "create-room");

  const guest = await open(guestContext);
  await guest.goto("/join");
  await guest.getByTestId("join-code").fill(code);
  await guest.getByTestId("join-name").fill("Bea");
  await guest.getByTestId("join-submit").click();
  await expect(guest.getByRole("heading", { name: "Harbor Tug 214" })).toBeVisible();
  await shot(guest, testInfo, "join-by-code");

  await host.goto("/sets/demo-harbor-tug/together");
  await expect(host.getByLabel("Assign Cabin")).toContainText("Bea", { timeout: 15_000 });
  await host.getByLabel("Assign Hull").selectOption({ label: "Builder" });
  await host.getByLabel("Assign Cabin").selectOption({ label: "Bea" });
  await host.goto("/sets/demo-harbor-tug/play");
  await expect(host.getByTestId("step-heading")).toHaveText("Step 1");
  await host.getByTestId("part-check").first().click();
  await host.getByTestId("step-next").click();
  await expect(host.getByTestId("step-heading")).toHaveText("Step 2");

  await guest.getByTestId("nav-play").click();
  await expect(guest.getByTestId("step-heading")).toHaveText("Step 4", { timeout: 15_000 });
  await guest.getByTestId("part-check").first().click();
  await expect(guest.getByTestId("part-check").first()).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(async () => {
      const body = await (await guest.request.get(`/api/rooms/${code}`)).json();
      return JSON.stringify(body.room.set.progressByPlayer);
    })
    .toContain("demo-step-4-p1");

  await host.goto("/sets/demo-harbor-tug/together");
  await expect(host.getByTestId("shared-progress")).toContainText("Bea is on step 4", { timeout: 15_000 });
  await shot(host, testInfo, "shared-progress");

  await guestContext.close();
  const returned = await browser.newContext(device);
  const again = await returned.newPage();
  await again.goto("/join");
  await again.getByTestId("join-code").fill(code);
  await again.getByTestId("join-name").fill("Bea");
  await again.getByTestId("join-submit").click();
  await again.getByTestId("nav-play").click();
  await expect(again.getByTestId("step-heading")).toHaveText("Step 4");
  await expect(again.getByTestId("part-check").first()).toHaveAttribute("aria-pressed", "true");
  await shot(again, testInfo, "resume-room");

  await hostContext.close();
  await returned.close();
});
