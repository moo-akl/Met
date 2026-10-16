import { expect, test, type Locator } from "@playwright/test";

const templatesPath = "/api/admin/venue-owner/email-templates";
const templateId = "browser-test-template";

async function selectText(
  editor: Locator,
  text: string,
  options: { endText?: string; collapseAtEnd?: boolean } = {},
) {
  await editor.evaluate((element, selection) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
    const startNode = textNodes.find((node) => node.data.includes(selection.text));
    if (!startNode) throw new Error(`Could not find editor text: ${selection.text}`);

    const range = document.createRange();
    const startOffset = startNode.data.indexOf(selection.text);
    range.setStart(startNode, startOffset);
    if (selection.collapseAtEnd) {
      range.setStart(startNode, startOffset + selection.text.length);
      range.collapse(true);
    } else {
      const endValue = selection.endText ?? selection.text;
      const endNode = [...textNodes].reverse().find((node) => node.data.includes(endValue));
      if (!endNode) throw new Error(`Could not find editor end text: ${endValue}`);
      range.setEnd(endNode, endNode.data.indexOf(endValue) + endValue.length);
    }

    const browserSelection = window.getSelection();
    browserSelection?.removeAllRanges();
    browserSelection?.addRange(range);
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  }, { text, ...options });
}

test("formatted and personalized email templates survive saving and reopening", async ({ page }) => {
  let savedTemplate: (Record<string, unknown> & { id: string; builtin: boolean }) | undefined;
  const unexpectedApiRequests: string[] = [];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname;

    if (path === templatesPath && method === "GET") {
      await route.fulfill({ json: savedTemplate ? [savedTemplate] : [] });
      return;
    }
    if (path === templatesPath && method === "POST") {
      savedTemplate = {
        ...request.postDataJSON(),
        id: templateId,
        builtin: false,
      };
      await route.fulfill({ status: 201, json: savedTemplate });
      return;
    }
    unexpectedApiRequests.push(`${method} ${path}`);
    await route.fulfill({ status: 501, json: { message: "Unexpected API request in browser test" } });
  });

  await page.goto("/venue-admin/browser-tests/email-template-editor.html");
  await page.getByRole("heading", { name: "Email templates" }).waitFor();
  await page.getByTestId("button-new-email-template").click();
  await page.getByTestId("input-email-template-name").fill("Formatting regression test");
  await page.getByTestId("input-email-template-subject").fill("Your next visit");

  const editor = page.getByRole("textbox", { name: "Email body" });
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("Welcome to Met");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Get started with these steps:");
  await page.keyboard.press("Enter");
  await page.keyboard.type("First visit");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Second visit");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Read the guide");

  await selectText(editor, "Welcome to Met");
  await page.getByRole("button", { name: "Bold" }).click();
  await selectText(editor, "Welcome to Met");
  await page.getByLabel("Text style").selectOption("h2");

  await selectText(editor, "First visit", { endText: "Second visit" });
  await page.getByRole("button", { name: "Bulleted list" }).click();

  await selectText(editor, "Read the guide");
  page.once("dialog", (dialog) => dialog.accept("https://example.com/venue-guide"));
  await page.getByRole("button", { name: "Insert link" }).click();

  await selectText(editor, "Get started with these steps:", { collapseAtEnd: true });
  await page.getByLabel("Insert personalization").selectOption("businessName");

  const saveResponse = page.waitForResponse((response) =>
    response.url().includes(templatesPath) && response.request().method() === "POST",
  );
  await page.getByTestId("button-save-email-template").click();
  await saveResponse;
  await expect(page.getByTestId(`button-edit-template-${templateId}`)).toBeVisible();

  expect(savedTemplate).toBeDefined();
  const savedHtml = String(savedTemplate?.body);
  expect(savedHtml).toMatch(/<(?:b|strong)\b[^>]*>Welcome to Met<\/(?:b|strong)>/i);
  expect(savedHtml).toMatch(/<h2\b[^>]*>/i);
  expect(savedHtml).toMatch(/<ul\b[^>]*>[\s\S]*First visit[\s\S]*Second visit[\s\S]*<\/ul>/i);
  expect(savedHtml).toMatch(/<a\b[^>]*href="https:\/\/example\.com\/venue-guide"[^>]*>Read the guide<\/a>/i);
  expect(savedHtml).toContain("{{businessName}}");

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open template manager" }).click();
  await page.getByTestId(`button-edit-template-${templateId}`).click();

  await expect(editor.locator("h2")).toContainText("Welcome to Met");
  await expect(editor.locator("b, strong")).toContainText("Welcome to Met");
  await expect(editor.locator("ul li")).toHaveText(["First visit", "Second visit"]);
  await expect(editor.locator('a[href="https://example.com/venue-guide"]')).toHaveText("Read the guide");
  await expect(editor).toContainText("{{businessName}}");
  expect(unexpectedApiRequests).toEqual([]);
});

test("editing an existing formatted template preserves formatting and personalization after reload", async ({ page }) => {
  const originalBody = [
    "<h2>Welcome to Met</h2>",
    "<p><strong>Your venue: {{businessName}}</strong></p>",
    "<ul><li>First visit</li><li>Second visit</li></ul>",
    '<p><a href="https://example.com/venue-guide">Read the guide</a></p>',
  ].join("");
  let savedTemplate: Record<string, unknown> & { id: string; builtin: boolean } = {
    id: templateId,
    name: "Existing formatted template",
    subject: "A note for {{businessName}}",
    body: originalBody,
    format: "html",
    builtin: false,
  };
  const unexpectedApiRequests: string[] = [];
  const updateRequests: Array<{ method: string; body: Record<string, unknown> }> = [];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname;

    if (path === templatesPath && method === "GET") {
      await route.fulfill({ json: [savedTemplate] });
      return;
    }
    if (path === `${templatesPath}/${templateId}` && method === "PUT") {
      const body = request.postDataJSON() as Record<string, unknown>;
      updateRequests.push({ method, body });
      savedTemplate = { ...body, id: templateId, builtin: false };
      await route.fulfill({ json: savedTemplate });
      return;
    }
    unexpectedApiRequests.push(`${method} ${path}`);
    await route.fulfill({ status: 501, json: { message: "Unexpected API request in browser test" } });
  });

  await page.goto("/venue-admin/browser-tests/email-template-editor.html");
  await page.getByRole("heading", { name: "Email templates" }).waitFor();
  await page.getByTestId(`button-edit-template-${templateId}`).click();

  const editor = page.getByRole("textbox", { name: "Email body" });
  await expect(editor.locator("h2")).toHaveText("Welcome to Met");
  await selectText(editor, "Welcome to Met");
  await page.keyboard.type("Welcome back to Met");

  const updateResponse = page.waitForResponse((response) =>
    response.url().includes(`${templatesPath}/${templateId}`) && response.request().method() === "PUT",
  );
  await page.getByTestId("button-save-email-template").click();
  await updateResponse;
  await expect(page.getByTestId(`button-edit-template-${templateId}`)).toBeVisible();

  expect(updateRequests).toHaveLength(1);
  expect(updateRequests[0]?.method).toBe("PUT");
  expect(updateRequests[0]?.body.body).toContain("Welcome back to Met");
  expect(savedTemplate.body).toMatch(/<h2\b[^>]*>Welcome back to Met<\/h2>/i);
  expect(savedTemplate.body).toMatch(/<strong\b[^>]*>Your venue: \{\{businessName\}\}<\/strong>/i);
  expect(savedTemplate.body).toMatch(/<ul\b[^>]*>[\s\S]*First visit[\s\S]*Second visit[\s\S]*<\/ul>/i);
  expect(savedTemplate.body).toMatch(/<a\b[^>]*href="https:\/\/example\.com\/venue-guide"[^>]*>Read the guide<\/a>/i);
  expect(savedTemplate.body).toContain("{{businessName}}");

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open template manager" }).click();
  await page.getByTestId(`button-edit-template-${templateId}`).click();

  await expect(editor.locator("h2")).toHaveText("Welcome back to Met");
  await expect(editor.locator("strong")).toContainText("{{businessName}}");
  await expect(editor.locator("ul li")).toHaveText(["First visit", "Second visit"]);
  await expect(editor.locator('a[href="https://example.com/venue-guide"]')).toHaveText("Read the guide");
  await expect(editor).toContainText("{{businessName}}");
  expect(unexpectedApiRequests).toEqual([]);
});
