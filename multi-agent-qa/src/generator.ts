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

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt }
    ],
  });

  return response.choices[0].message?.content || "";
}
