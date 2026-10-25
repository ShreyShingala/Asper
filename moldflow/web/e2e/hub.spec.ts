import { expect, test } from "@playwright/test";

/** The hub hero loop in the browser: instant answer -> estimate rescue -> memory -> customer conversations. AI agents fall back to
 *  rule-based templates in e2e (MOLDFLOW_E2E_STUB=1), so this runs offline and deterministically. */
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => { await request.post("/api/admin/reset"); });

test("hub: instant reply, estimate rescue, new fact, conversation approval", async ({ page, request }, info) => {
  test.skip(info.project.name !== "desktop-chrome", "the hub is a staff (desktop) screen");
  await page.goto("/hub");
  await expect(page.getByRole("heading", { name: /Approve or deny/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Customer conversations" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "On-site reviews" })).toBeVisible();
  await expect(page.getByText("Money on the table")).toBeVisible();

  // 1. 11 PM text from a new number: health question answered instantly with the fixed reply.
  await page.getByRole("button", { name: "Send text" }).click();
  await expect(page.getByRole("status").filter({ hasText: /reply (sent|approved) instantly/ })).toBeVisible();  // night runs: held for quiet hours

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
  await expect(page.getByRole("status").filter({ hasText: /Kanata client/ })).toBeVisible();

  // 3. The customer says yes and mentions a baby: estimate accepted, fact waits for approval, nursery moment for a person.
  const r = await request.post("/api/webhooks/inbound", { data: { contact_id: "c-job1", channel: "sms", body: "ok let's do it. Also we're expecting a baby in March!" } });
  expect((await r.json()).accepted.amount).toBe(4181);
  await page.goto("/people/c-job1");
  await expect(page.getByText("Expecting a baby in March", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Approve", exact: true }).first().click();
  await expect(page.getByText("for a person to bring up")).toBeVisible();

  // 4. Customer conversation pillar: an AI reply drafted from the customer's own case, approved from the hub.
  await page.goto("/hub");
  await page.getByRole("button", { name: "Approve", exact: true }).first().click();
  await expect(page.getByRole("status").filter({ hasText: "Approved and sent" })).toBeVisible();

  // 5. The hub shows the money recovered.
  await page.goto("/hub");
  await expect(page.getByText("$4,181.00").first()).toBeVisible();
  await expect(page.getByText(/^\d+ → \d+ → 1$/)).toBeVisible();  // chased → replied (incl. seeded conversations) → accepted
});
