import { expect, test } from "@playwright/test";

/** The hub hero loop in the browser: instant answer -> estimate rescue -> memory -> storm check-ins. AI agents fall back to
 *  rule-based templates in e2e (MOLDFLOW_E2E_STUB=1), so this runs offline and deterministically. */
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => { await request.post("/api/admin/reset"); });

test("hub: instant reply, estimate rescue, new fact, storm check-ins", async ({ page, request }, info) => {
  test.skip(info.project.name !== "desktop-chrome", "the hub is a staff (desktop) screen");
  await page.goto("/hub");
  await expect(page.getByRole("heading", { name: /what needs you/i })).toBeVisible();
  await expect(page.getByText("Money on the table")).toBeVisible();

  // 1. 11 PM text from a new number: health question answered instantly with the fixed reply.
  await page.getByRole("button", { name: "Send text" }).click();
  await expect(page.getByRole("status").filter({ hasText: "reply sent instantly" })).toBeVisible();

  // 2. Estimate rescue on job 1: draft is locked (has $), approve shows the amount.
  await page.goto("/people/c-job1");
  await expect(page.getByText("Talking points for your next call")).toBeVisible();
  await page.getByRole("button", { name: "Draft estimate follow-up" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Follow-up drafted" })).toBeVisible();
  await page.goto("/outreach");
  const approve = page.getByRole("button", { name: /Approve & send \(\$4,181\.00\)/ });
  await expect(approve).toBeVisible();
  await expect(page.getByLabel("Message text").first()).toHaveValue(/washroom/);
  await approve.click();
  await expect(page.getByRole("status").filter({ hasText: /Sample Client 01/ })).toBeVisible();

  // 3. The customer says yes and mentions a baby: estimate accepted, fact waits for approval, nursery moment for a person.
  const r = await request.post("/api/webhooks/inbound", { data: { contact_id: "c-job1", channel: "sms", body: "ok let's do it. Also we're expecting a baby in March!" } });
  expect((await r.json()).accepted.amount).toBe(4181);
  await page.goto("/people/c-job1");
  await expect(page.getByText("Expecting a baby in March", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Approve", exact: true }).first().click();
  await expect(page.getByText("for a person to bring up")).toBeVisible();

  // 4. Storm: simulated rainfall warning over Gatineau -> offer only with consent, safety-only otherwise, French where preferred.
  await page.goto("/alerts");
  await page.getByRole("button", { name: "Simulate rainfall warning" }).click();
  await expect(page.getByText("asked for storm check-ins").first()).toBeVisible();
  await page.getByRole("button", { name: "Draft check-ins" }).first().click();
  await expect(page.getByRole("status").filter({ hasText: "safety-only" })).toBeVisible();
  await page.goto("/outreach");
  await expect(page.getByText(/Storm check-in \(offer\)/)).toBeVisible();
  await expect(page.getByLabel("Message text").filter({ hasText: /pluie/ }).first()).toBeVisible();
  await page.getByRole("button", { name: /Approve all without money/ }).click();
  await expect(page.getByRole("status").filter({ hasText: /sent/ })).toBeVisible();

  // 5. The hub shows the money recovered.
  await page.goto("/hub");
  await expect(page.getByText("$4,181.00").first()).toBeVisible();
  await expect(page.getByText("1 → 1 → 1")).toBeVisible();
});
