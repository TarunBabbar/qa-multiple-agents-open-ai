// File: multi-agent-qa/src/validator.ts
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function validateAndFixTest(code: string): Promise<string> {
  const systemPrompt = `
You are a Senior QA Automation Code Validator & Refiner.

Your job:
- Review provided Playwright TypeScript code.
- Ensure code follows **POM** and **SOLID** principles.
- Split code into separate files if needed (e.g., page classes, test files, utils).
- Improve naming, assertions, structure, and readability.
- Fix anti-patterns and use best practices.

⚙️ Output format:
\`<FILENAME>.ts\`
\`\`\`typescript
// improved code
\`\`\`

Do NOT explain your changes.
`;

  // Extended instruction: include runnable project files
  const extendedInstruction = `
When returning improved code, also return a runnable project skeleton using the same multi-file format. Include the following files (with exact filenames), and enforce the following STRICT rules:

- README.md (markdown) — list the test cases included and exact commands to run locally: npm install, npx playwright install, npm test.
- package.json — minimal package.json with Playwright and TypeScript devDependencies and scripts (test, test:headed).
- playwright.config.ts — full Playwright config (use chromium, default timeouts, retries, reporter, testDir).
- tsconfig.json — TypeScript config sufficient for Playwright + Node.

Return these files in their proper formats (README as markdown, package.json/tsconfig/playwright.config as JSON/TS content) inside the same "<FILENAME>" / codeblock format used for TypeScript files.

CRITICAL NAMING & PATH RULES:
- Always include folder structure in filenames where appropriate (e.g., \`src/tests/homePage.spec.ts\`, \`src/pages/HomePage.ts\`).
- The FIRST CONTENT LINE inside every file must repeat the full relative path as a comment header for discoverability:
  - TypeScript/JavaScript/JSON/etc: begin with: \`// <relative-path>\` (example: \`// src/tests/homePage.spec.ts\`)
  - Markdown: begin with: \`# README.md\`
This header comment MUST be the first non-empty line of the file content.
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt + "\n" + extendedInstruction },
      { role: "user", content: `Review and improve this code:\n\n${code}` }
    ],
  });

  return response.choices[0].message?.content || "";
}
