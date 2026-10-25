import { expect, test } from "@playwright/test";

/** Demo texting sandbox: send a text as a customer, see the agent's reply and what it learned, with no page errors. */
test("demo texts: send as a customer, reply + learned fact appear", async ({ page, request }, info) => {
  test.skip(info.project.name !== "desktop-chrome", "staff screen");
  await request.post("/api/admin/reset");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|DevTools|tile\.openstreetmap/.test(m.text())) errors.push(m.text()); });
  await page.goto("/demo-texts");
  await page.getByLabel("Your text").fill("We just found out we're expecting a baby in May! Can you text me back next week?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("What it just did")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Expecting a baby/).first()).toBeVisible();
  expect(errors).toEqual([]);
});
