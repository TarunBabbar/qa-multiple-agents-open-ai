// File: multi-agent-qa/src/server.ts
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { generatePlaywrightTest } from "./generator";
import { validateAndFixTest } from "./validator";
import { generateTestCases } from "./testcaseGenerator";

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post("/testcases", async (req, res) => {
  const { prompt } = req.body;
  try {
    const cases = await generateTestCases(prompt);
    res.json({ testCases: cases });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to generate test cases" });
  }
});

// ✅ Utility: normalize LLM output to strict multi-file format
function normalizeLLMOutput(raw: string): string {
  return raw
    // convert things like "### File: LoginPage.ts" to `LoginPage.ts`
    .replace(/###\s*File:\s*/gi, "`")
    // ensure code block language tag is correct
    .replace(/\.ts\s*```/gi, ".ts`\n```typescript")
    // remove common explanation words
    .replace(/(Here('|’)s|Below is|Refactored version).*?:/gi, "")
    .trim();
}

app.post("/generate", async (req, res) => {
  const { prompt } = req.body;

  try {
    const generated = await generatePlaywrightTest(prompt);
    const validated = await validateAndFixTest(generated);

    const normalized = normalizeLLMOutput(validated || generated);
    res.json({ code: normalized });
  } catch (err) {
    console.error("❌ Backend error:", err);
    res.status(500).json({ error: "Code generation failed" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Backend running at http://localhost:${PORT}`));
