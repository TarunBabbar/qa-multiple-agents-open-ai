import "dotenv/config";
import { generatePlaywrightTest } from "./generator";
import { validateAndFixTest } from "./validator";

async function runWorkflow() {
  console.log("🤖 Multi-Agent QA Workflow Started...");

  // Step 1: Generate initial test
  const rawTestCode = await generatePlaywrightTest(
    "Generate a Playwright test for login page verification using POM structure."
  );
  console.log("\n✅ Generated Test Code:\n");
  console.log(rawTestCode);

  // Step 2: Validate and improve it
  const improvedCode = await validateAndFixTest(rawTestCode);
  console.log("\n🛠️ Validator Suggestions (Improved Code):\n");
  console.log(improvedCode);
}

runWorkflow().catch(console.error);
