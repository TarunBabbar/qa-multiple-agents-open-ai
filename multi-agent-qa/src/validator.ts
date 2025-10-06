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

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Review and improve this code:\n\n${code}` }
    ],
  });

  return response.choices[0].message?.content || "";
}
