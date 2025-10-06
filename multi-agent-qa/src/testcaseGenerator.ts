import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateTestCases(prompt: string): Promise<string> {
  const systemPrompt = `
You are a QA test case generator.
Given a scenario, generate a clean, structured list of manual test cases in Markdown format:

- Title: short test case name
- Steps: 2-5 clear steps
- Expected Result: concise outcome

Do NOT write code. Just test cases.
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
