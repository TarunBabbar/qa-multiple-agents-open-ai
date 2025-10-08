// File: multi-agent-qa/src/generator.ts
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generatePlaywrightTest(prompt: string): Promise<string> {
  const systemPrompt = `
You are a Senior QA Automation Code Generator.

🎯 Your goal:
Generate enterprise-grade Playwright + TypeScript test automation code that follows:
- **Page Object Model (POM)**: Each page should have its own class and expose only actions and locators.
- **SOLID principles**: 
  - S: Single responsibility for each class/file
  - O: Open for extension, closed for modification
  - L: Page classes must be replaceable by subclasses without breaking tests
  - I: Keep interfaces small and focused
  - D: Depend on abstractions (interfaces) not concretions

📁 File structure:
- Page classes: \`<PageName>.ts\`
- Test files: \`<TestName>.spec.ts\`
- Shared utilities (if needed): \`utils.ts\` or \`BasePage.ts\`

⚙️ Return ONLY valid TypeScript code in this format:

\`<FILENAME>.ts\`
\`\`\`typescript
// code content
\`\`\`

❌ Do NOT include explanations, commentary, markdown headings, or bullet points.
✅ Just the files and their TypeScript code as shown above.
`;

  // Extended instruction: include runnable project files
  const extendedInstruction = `
Additionally, provide the following files to make the generated code runnable as a Playwright + TypeScript project when downloaded and installed, and follow these STRICT formatting rules:

- README.md  -> A plain markdown README that lists the generated test cases, and clear commands to run locally (e.g., npm install, npx playwright install, npm test).
- package.json -> A minimal package.json configured for Playwright + TypeScript (scripts: test, test:headed, build if needed) with devDependencies listed.
- playwright.config.ts -> Playwright configuration with browser settings, timeouts, retries, testDir, reporter, and use settings.
- tsconfig.json -> TypeScript config for Node/ESNext suitable for Playwright.

Return these files in the same exact multi-file code block format used above. Filenames should be exact (README.md, package.json, playwright.config.ts, tsconfig.json). Do NOT include extra explanatory text.

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
      { role: "user", content: prompt }
    ],
  });

  return response.choices[0].message?.content || "";
}
