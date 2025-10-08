"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import dynamic from "next/dynamic";
import axios from "axios";
import { FileCode2, ClipboardList, WandSparkles } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";
// PreferencesPopover removed for now

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type GeneratedFile = { name: string; content: string };

type ParsedCase = {
  title: string;
  steps: string[];
  expected?: string;
  preconditions?: string[];
};

export default function Home() {
  // UI state
  const [scenario, setScenario] = useState("");
  const [testCasesRaw, setTestCasesRaw] = useState("");

  const [parsedTestCases, setParsedTestCases] = useState<ParsedCase[]>([]);
  // filter removed — we show the full list
  const [selectedTestIndex, setSelectedTestIndex] = useState<number | null>(null);

  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [activeFile, setActiveFile] = useState<string>("");

  const [loadingCases, setLoadingCases] = useState(false);
  const [loadingCode, setLoadingCode] = useState(false);

  const [editorFontSize] = useState(13);
  const [themeMode, setThemeMode] = useState<"dark" | "light">("dark");

  // Resizable columns state (% widths for left, middle, right)
  const [colSizes, setColSizes] = useState<[number, number, number]>([28, 36, 36]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragInfo = useRef<{ startX: number; idx: 0 | 1; startSizes: [number, number, number] } | null>(null);

  const startDrag = (idx: 0 | 1) => (e: React.MouseEvent) => {
    dragInfo.current = { startX: e.clientX, idx, startSizes: [...colSizes] as [number, number, number] };
    window.addEventListener("mousemove", onDrag);
    window.addEventListener("mouseup", endDrag);
    e.preventDefault();
  };

  const onDrag = (e: MouseEvent) => {
    if (!dragInfo.current || !containerRef.current) return;
    const { startX, idx, startSizes } = dragInfo.current;
    const rect = containerRef.current.getBoundingClientRect();
    const total = rect.width;
    if (!total) return;
    const deltaPx = e.clientX - startX;
    const deltaPct = (deltaPx / total) * 100;
    const min = [18, 24, 24];
    const next: [number, number, number] = [...startSizes] as [number, number, number];
    if (idx === 0) {
      let a = startSizes[0] + deltaPct;
      let b = startSizes[1] - deltaPct;
      a = Math.max(min[0], a);
      b = Math.max(min[1], b);
      const diff = a + b - (startSizes[0] + startSizes[1]);
      // keep total roughly same by adjusting in the opposite direction
      if (diff !== 0) {
        if (diff > 0) a -= diff; else b += -diff;
      }
      next[0] = a; next[1] = b; next[2] = startSizes[2];
    } else {
      let b = startSizes[1] + deltaPct;
      let c = startSizes[2] - deltaPct;
      b = Math.max(min[1], b);
      c = Math.max(min[2], c);
      const diff = b + c - (startSizes[1] + startSizes[2]);
      if (diff !== 0) {
        if (diff > 0) b -= diff; else c += -diff;
      }
      next[0] = startSizes[0]; next[1] = b; next[2] = c;
    }
    // ensure sum ~ 100
    const sum = next[0] + next[1] + next[2];
    if (Math.abs(sum - 100) > 0.01) {
      const k = 100 / sum;
      next[0] *= k; next[1] *= k; next[2] *= k;
    }
    setColSizes(next);
  };

  const endDrag = () => {
    window.removeEventListener("mousemove", onDrag);
    window.removeEventListener("mouseup", endDrag);
    dragInfo.current = null;
  };

  // THEME — persist + apply to <html> + keep Monaco in sync
  const applyTheme = (theme: "dark" | "light") => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("qa_theme", theme);
    setThemeMode(theme);
  };

  useEffect(() => {
    const saved = (localStorage.getItem("qa_theme") as "dark" | "light" | null) || "dark";
    applyTheme(saved);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { theme: "dark" | "light" } | undefined;
      if (detail?.theme) applyTheme(detail.theme);
    };
    window.addEventListener("qa:theme-change", handler as EventListener);
    return () => window.removeEventListener("qa:theme-change", handler as EventListener);
  }, []);

  // ACTIONS
  const generateTestCases = async () => {
    setLoadingCases(true);
    setParsedTestCases([]);
    setSelectedTestIndex(null);
    try {
      const res = await axios.post("http://localhost:3001/testcases", { prompt: scenario });
      const raw = String(res.data?.testCases || "").replace(/\r\n/g, "\n");
      setTestCasesRaw(raw);
      const parsed = parseTestCasesRobust(raw).filter(
        (p) => !/^test cases?\s+for\b/i.test((p.title || "").trim())
      );
      setParsedTestCases(parsed);
      setSelectedTestIndex(parsed.length ? 0 : null);
    } catch (e) {
      console.error(e);
      alert("Failed to generate test cases.");
    } finally {
      setLoadingCases(false);
    }
  };

  const generateCode = async () => {
    setLoadingCode(true);
    setFiles([]);
    setActiveFile("");
    try {
      const res = await axios.post("http://localhost:3001/generate", {
        prompt: `Generate Playwright test code for these test cases:\n${testCasesRaw}`,
      });
      const allFiles = parseFilesFromResponse(String(res.data?.code || ""));
      setFiles(allFiles);
      if (allFiles.length) setActiveFile(allFiles[0].name);
    } catch (e) {
      console.error(e);
      alert("Failed to generate code.");
    } finally {
      setLoadingCode(false);
    }
  };

  // DOWNLOADS
  const downloadBlob = (filename: string, blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadTestCasesCSV = () => {
    if (!parsedTestCases || !parsedTestCases.length) {
      alert("No test cases to download");
      return;
    }
    const esc = (s?: string) => {
      if (!s) return "";
      return '"' + String(s).replace(/"/g, '""') + '"';
    };
    const rows: string[] = [];
    rows.push(["Title", "Preconditions", "Steps", "Expected"].map(esc).join(","));
    for (const tc of parsedTestCases) {
      const pre = (tc.preconditions || []).join(" | ");
      const steps = (tc.steps || []).map((s, i) => `${i + 1}. ${s}`).join(" || ");
      const exp = tc.expected || "";
      rows.push([tc.title || "", pre, steps, exp].map(esc).join(","));
    }
    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    downloadBlob("test-cases.csv", blob);
  };

  const downloadCodeZip = async () => {
    if (!files || !files.length) {
      alert("No generated code to download");
      return;
    }
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const f of files) {
        // ensure file name safe
        const name = f.name || "file.txt";
        zip.file(name, f.content || "");
      }
      const content = await zip.generateAsync({ type: "blob" });
      downloadBlob("automation-code.zip", content);
    } catch (err) {
      console.error(err);
      alert("Failed to create zip for download. Make sure 'jszip' is installed.");
    }
  };

  // PARSERS
  const parseFilesFromResponse = (raw: string): GeneratedFile[] => {
    const cleaned = raw.replace(/\r\n/g, "\n").trim();
    if (!cleaned) return [];

    const files: GeneratedFile[] = [];
    
    // Split the content by header patterns like "// src/tests/homePage.spec.ts" or "# README.md"
    const headerPattern = /^(\/\/|#)\s+([\w./-]+\.[a-zA-Z0-9]+)\s*$/gm;
    
    let lastIndex = 0;
    let match;
    let firstFile = true;
    
    while ((match = headerPattern.exec(cleaned)) !== null) {
      // If this isn't the first match, extract the previous file's content
      if (!firstFile) {
        const prevContent = cleaned.substring(lastIndex, match.index).trim();
        if (files.length > 0) {
          files[files.length - 1].content = cleanFileContent(prevContent);
        }
      }
      
      // Extract filename from the header
      const filename = match[2].trim();
      const normalizedName = filename.replace(/\\/g, "/").replace(/^\.*\/?/, "");
      
      // Add the new file (content will be filled in next iteration or at the end)
      files.push({ name: normalizedName, content: "" });
      
      // Update position after this header line
      lastIndex = match.index + match[0].length;
      // Skip to next line
      const nextLineIndex = cleaned.indexOf('\n', lastIndex);
      if (nextLineIndex !== -1) {
        lastIndex = nextLineIndex + 1;
      }
      
      firstFile = false;
    }
    
    // Handle the case where we have no headers but do have content
    if (files.length === 0 && cleaned.trim()) {
      return [{ name: "src/pages/HomePage.ts", content: cleanFileContent(cleaned) }];
    }
    
    // Handle the last file's content
    if (files.length > 0) {
      const lastContent = cleaned.substring(lastIndex).trim();
      files[files.length - 1].content = cleanFileContent(lastContent);
    }
    
    // If we still have no files but have content, create a default file
    if (files.length === 0 && cleaned.trim()) {
      return [{ name: "GeneratedOutput.ts", content: cleanFileContent(cleaned) }];
    }

    return files.filter(f => f.name && f.content.trim());
  };

  // Helper function to clean unwanted markers from file content
  const cleanFileContent = (content: string): string => {
    return content
      // Remove code block markers at the end
      .replace(/```\s*\w*\s*$/gm, '')
      // Remove code block markers at the beginning
      .replace(/^```\s*\w*\s*\n?/gm, '')
      // Remove any trailing backticks
      .replace(/`{3,}\s*$/gm, '')
      // Clean up extra whitespace
      .trim();
  };

  const parseTestCasesRobust = (raw: string): ParsedCase[] => {
    const text = raw.replace(/\r\n/g, "\n").trim();
    if (!text) return [];

    const blocks: { title: string; body: string }[] = [];
    const tcRegex =
      /(?:^|\n)Test Case\s*\d*[:\-]?\s*(.+?)\n([\s\S]*?)(?=(?:\nTest Case\s*\d*[:\-]?|\n#|\n##|$))/gim;
    let m: RegExpExecArray | null;
    while ((m = tcRegex.exec(text)) !== null) blocks.push({ title: clean(m[1]), body: (m[2] || "").trim() });

    if (!blocks.length) {
      const mdRegex = /(?:^|\n)#{1,3}\s+(.+?)\n([\s\S]*?)(?=(?:\n#{1,3}\s+|$))/g;
      while ((m = mdRegex.exec(text)) !== null) blocks.push({ title: clean(m[1]), body: (m[2] || "").trim() });
    }
    if (!blocks.length) blocks.push({ title: text.split("\n")[0] || "Test Case", body: text });

    const cases = blocks.map(({ title, body }) => {
      const pre = capture(body, /(Pre\-?conditions?)\s*[:\-]?\s*/i, /(?:Steps|Expected|#|##|$)/i);
      const steps = capture(body, /(Steps?)\s*[:\-]?\s*/i, /(?:Expected|Pre\-?conditions?|#|##|$)/i);
      const exp = capture(body, /(Expected Result|Expected)\s*[:\-]?\s*/i, /(?:Pre\-?conditions?|Steps|#|##|$)/i);

      const preconditions = toList(pre);
      let stepsList = toList(steps);

      if (!stepsList.length) {
        const sentences = body
          .replace(/\s+/g, " ")
          .split(/(?<=[.!?])\s+/)
          .map((s) => s.trim())
          .filter(Boolean);
        const action = /^(Navigate|Go to|Open|Click|Enter|Type|Select|Choose|Verify|Assert|Check|Fill|Press|Tap|Wait|Add|Remove|Login|Log in|Logout|Log out)\b/i;
        stepsList = sentences.filter((s) => action.test(s));
      }

  // remove any stray asterisks (single or multiple) and backticks from expected
  const expected = exp?.replace(/\*+/g, "").replace(/`/g, "").trim();

      return {
        title: title || "Untitled Test",
        preconditions: preconditions.length ? preconditions : undefined,
        steps: stepsList,
        expected: expected || undefined,
      };
    });

    // Filter out generic headings (e.g., "Manual Test Cases...") and entries without steps
    return cases.filter((tc) => {
      const t = (tc.title || "").toLowerCase();
      const isHeading = /manual\s+test\s+cases|^test\s*cases\b/.test(t);
      return !isHeading && tc.steps && tc.steps.length > 0;
    });
  };

  const clean = (s: string) => s.replace(/[*_#`]/g, "").trim();
  const capture = (src: string, start: RegExp, end: RegExp) => {
    const s = start.exec(src);
    if (!s) return undefined;
    const tail = src.slice(s.index + s[0].length);
    const e = end.exec(tail);
    return e ? tail.slice(0, e.index).trim() : tail.trim();
  };
  const toList = (raw?: string): string[] =>
    (raw || "")
      .split(/\n/)
      .map((l) =>
        l
          .replace(/^\s*[-*•]\s*/, "")
          .replace(/^\s*\d+[.)]\s*/, "")
          // strip any asterisks (single or multiple) and inline backticks
          .replace(/\*+/g, "")
          .replace(/`/g, "")
          .trim()
      )
      .map((s) => s.trim())
      .filter(Boolean);

  // Derived
  const visible = useMemo(() => parsedTestCases.map((tc, i) => ({ ...tc, __i: i })), [parsedTestCases]);

  const activeFileContent = useMemo(() => files.find((f) => f.name === activeFile)?.content || "", [files, activeFile]);

  // UI
  return (
    <div className="page-wrap">
      {/* Header */}
      <header className="header">
        <div className="header__left">
          <h1 className="headline">🤖 QA Multi-Agent Assistant</h1>
        </div>
        <div className="header__right">
          <ThemeToggle />
        </div>
      </header>

      {/* Top controls: scenario input + generate button */}
      <div className="top-controls card p-4">
        <div style={{ display: "flex", gap: 12, alignItems: "center", width: '100%' }}>
          <input
            className="input-field scenario-input"
            placeholder="Describe your scenario..."
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={generateTestCases}
              disabled={loadingCases || !scenario.trim()}
              aria-busy={loadingCases}
              aria-live="polite"
              className={`btn btn-primary h-12 ${loadingCases ? "is-loading" : ""}`}
            >
              {loadingCases ? <span style={{ width: 20 }} /> : <WandSparkles className="h-5 w-5" />}
              {loadingCases ? "Generating Test Cases…" : "Generate Test Cases"}
            </button>

            <button
              onClick={generateCode}
              disabled={loadingCode || !testCasesRaw.trim()}
              aria-busy={loadingCode}
              aria-live="polite"
              className={`btn btn-success h-12 ${loadingCode ? "is-loading" : ""}`}
            >
              {loadingCode ? <span style={{ width: 20 }} /> : <FileCode2 className="h-5 w-5" />}
              {loadingCode ? "Generating Automation Code…" : "Generate Test Code"}
            </button>

            <button onClick={downloadTestCasesCSV} className="btn btn-download-primary h-12" disabled={!parsedTestCases.length}>
              📥 Download Test Cases
            </button>

            <button onClick={downloadCodeZip} className="btn btn-download-zip h-12" disabled={!files.length}>
              📦 Download Code
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <main className="panel-row" ref={containerRef}>
        {/* Left: Titles */}
        <div className="col" style={{ width: `${colSizes[0]}%` }}>
          <aside className="stack">
          <section className="card p-6 flex flex-col">
            <div className="mb-2">
              <h2 className="section-title flex items-center gap-2">
                <ClipboardList className="h-5 w-5" /> Generated Test Cases
              </h2>
            </div>
            <div className="list flex-1 min-h-0">
              {visible.length ? (
                visible.map((tc) => (
                  <button
                    key={tc.__i}
                    onClick={() => setSelectedTestIndex(tc.__i)}
                    className={`list-item ${selectedTestIndex === tc.__i ? "is-active" : ""}`}
                    title={tc.title}
                  >
                    {tc.title}
                  </button>
                ))
              ) : (
                <div/>
                )}
            </div>

            {/* Generate Test Code now in the top controls */}
          </section>
          </aside>
        </div>

        {/* Handle between left and middle */}
        <div className="resize-handle" onMouseDown={startDrag(0)} />

        {/* Middle: Preview */}
        <div className="col" style={{ width: `${colSizes[1]}%` }}>
        <section className="card p-6">
          <div className="mb-4">
            <h2 className="section-title">📋 Test Case Preview</h2>
          </div>

          {selectedTestIndex !== null && parsedTestCases[selectedTestIndex] ? (
            <div className="preview">
              <h3 className="preview__title">{parsedTestCases[selectedTestIndex].title}</h3>

              {parsedTestCases[selectedTestIndex].preconditions && (
                <div className="preview__block">
                  <div className="preview__heading">Preconditions</div>
                  <ul>
                    {parsedTestCases[selectedTestIndex].preconditions!.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="preview__block">
                <div className="preview__heading">Steps</div>
                {parsedTestCases[selectedTestIndex].steps.length ? (
                  <ol>
                    {parsedTestCases[selectedTestIndex].steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="muted">No steps parsed.</p>
                )}
              </div>

              <div className="preview__block">
                <div className="preview__heading">Expected Result</div>
                <p>{parsedTestCases[selectedTestIndex].expected || "—"}</p>
              </div>
            </div>
          ) : (
            <div/>
          )}
        </section>
        </div>

        {/* Handle between middle and right */}
        <div className="resize-handle" onMouseDown={startDrag(1)} />

        {/* Right: Editor with VS Code Tabs */}
        <div className="col" style={{ width: `${colSizes[2]}%` }}>
        <section className="card p-0 editor">
          <div className="editor__header">
            <div>
              <h2 className="section-title">💻 Automation Code Output</h2>
            </div>
          </div>

          <div className="code-tab-bar">
            {files.length
              ? files.map((f) => (
                  <button
                    key={f.name}
                    onClick={() => setActiveFile(f.name)}
                    className={`code-tab ${activeFile === f.name ? "active" : ""}`}
                    title={f.name}
                  >
                    {f.name}
                  </button>
                ))
              : null}
          </div>

          <div className="editor__body">
            <MonacoEditor
              height="100%"
              language="typescript"
              value={activeFileContent}
              theme={themeMode === "light" ? "vs-light" : "vs-dark"}
              options={{
                fontSize: editorFontSize,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: "on",
                automaticLayout: true,
              }}
            />
          </div>
        </section>
        </div>
      </main>
    </div>
  );
}
