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

// Ensure each file content starts with a header comment of its path
function enforceHeaderComments(raw: string): string {
  // Matches: `path/filename.ext` ```lang\ncontent``` blocks
  const blockRegex = /`\s*([^`\n]+?)\s*`\s*```([a-zA-Z0-9+\-]*)?\s*([\s\S]*?)```/gim;
  return raw.replace(blockRegex, (_full, fname: string, lang: string, body: string) => {
    const name = String(fname).trim();
    const content = String(body).replace(/\r\n/g, "\n");
    const lines = content.split("\n");
    // find first non-empty line
    let i = 0; while (i < lines.length && !lines[i].trim()) i++;
    const first = (lines[i] || "").trim();
    const hasHeader = /^\/(\/|\*)|^#/.test(first) && first.includes(name.split('/').pop() || "");
    if (hasHeader) return `\`${name}\`\n\n\`\`\`${lang || ''}\n${content}\n\`\`\``; // unchanged
    // inject header comment based on lang (markdown -> #, else //)
    const isMd = /md|markdown/i.test(lang || "");
    const header = isMd ? `# ${name.split('/').pop()}` : `// ${name}`;
    const injected = [header, ...lines].join("\n");
    return `\`${name}\`\n\n\`\`\`${lang || ''}\n${injected}\n\`\`\``;
  });
}

app.post("/generate", async (req, res) => {
  const { prompt } = req.body;

  try {
    const generated = await generatePlaywrightTest(prompt);
    const validated = await validateAndFixTest(generated);

  const normalized = enforceHeaderComments(normalizeLLMOutput(validated || generated));
    res.json({ code: normalized });
  } catch (err) {
    console.error("❌ Backend error:", err);
    res.status(500).json({ error: "Code generation failed" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Backend running at http://localhost:${PORT}`));
