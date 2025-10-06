"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import axios from "axios";
import { Loader2, FileCode2, ClipboardList } from "lucide-react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export default function Home() {
  const [scenario, setScenario] = useState("");
  const [testCases, setTestCases] = useState("");
  const [files, setFiles] = useState<{ name: string; content: string }[]>([]);
  const [activeFile, setActiveFile] = useState<string>("");
  const [loadingCases, setLoadingCases] = useState(false);
  const [loadingCode, setLoadingCode] = useState(false);

  const generateTestCases = async () => {
    setLoadingCases(true);
    setTestCases("");
    try {
      const res = await axios.post("http://localhost:3001/testcases", { prompt: scenario });
      setTestCases(res.data.testCases || "");
    } catch (e) {
      console.error(e);
      alert("❌ Failed to generate test cases");
    }
    setLoadingCases(false);
  };

  const parseFilesFromResponse = (raw: string) => {
  const cleaned = raw.replace(/\r\n/g, "\n"); 

  // Enhanced regex to match filenames even if wrapped differently
  const fileRegex = /`?([\w\-.]+\.ts)`?\s*```(?:typescript|ts)?\s*([\s\S]*?)```/gim;
  const results: { name: string; content: string }[] = [];

  let match;
  while ((match = fileRegex.exec(cleaned)) !== null) {
    const name = match[1].trim();
    const content = match[2].trim();
    results.push({ name, content });
  }

  if (results.length === 0 && raw.trim()) {
    results.push({
      name: "GeneratedTest.ts",
      content: raw.trim(),
    });
  }

  return results;
};

  const generateCode = async () => {
    setLoadingCode(true);
    try {
      const res = await axios.post("http://localhost:3001/generate", {
        prompt: `Generate Playwright test code for these test cases:\n${testCases}`,
      });

      const allFiles = parseFilesFromResponse(res.data.code);
      setFiles(allFiles);
      if (allFiles.length > 0) setActiveFile(allFiles[0].name);
    } catch (e) {
      console.error(e);
      alert("❌ Failed to generate code");
    }
    setLoadingCode(false);
  };

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      <header className="bg-gradient-to-r from-indigo-700 to-purple-700 p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">🤖 QA Multi-Agent Assistant</h1>
        <span className="opacity-75 text-sm">Powered by OpenAI + Playwright</span>
      </header>

      <main className="flex flex-1">
        {/* Left panel */}
        <div className="w-1/3 border-r border-gray-800 p-6 space-y-6 bg-gray-850">
          {/* Step 1 */}
          <section>
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-2">
              🧠 Describe Your Scenario
            </h2>
            <textarea
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              placeholder="e.g. Add test cases for saucedemo.com"
              className="w-full h-32 p-3 rounded-lg text-black"
            />
            <button
              onClick={generateTestCases}
              disabled={loadingCases || !scenario}
              className="w-full bg-indigo-600 hover:bg-indigo-700 rounded-lg py-2 mt-3 font-semibold disabled:opacity-60"
            >
              {loadingCases ? <Loader2 className="animate-spin inline mr-2" /> : "📋 Generate Test Cases"}
            </button>
          </section>

          {/* Step 2 */}
          {testCases && (
            <section>
              <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <ClipboardList size={20} /> Generated Test Cases
              </h2>
              <pre className="bg-gray-800 p-3 rounded-lg max-h-64 overflow-auto text-sm whitespace-pre-wrap">
                {testCases}
              </pre>
              <button
                onClick={generateCode}
                disabled={loadingCode}
                className="w-full bg-green-600 hover:bg-green-700 rounded-lg py-2 mt-3 font-semibold disabled:opacity-60"
              >
                {loadingCode ? <Loader2 className="animate-spin inline mr-2" /> : "⚡ Generate Test Code"}
              </button>
            </section>
          )}
        </div>

        {/* Right panel */}
        <div className="flex-1 grid grid-cols-[250px_1fr]">
          {/* File explorer */}
          <aside className="bg-gray-850 p-4 border-r border-gray-800">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
              📁 Generated Files
            </h2>
            <ul className="space-y-1">
              {files.map((file) => (
                <li
                  key={file.name}
                  onClick={() => setActiveFile(file.name)}
                  className={`cursor-pointer flex items-center gap-2 p-2 rounded-lg transition ${
                    activeFile === file.name
                      ? "bg-indigo-700 text-white"
                      : "hover:bg-gray-700"
                  }`}
                >
                  <FileCode2 size={16} /> {file.name}
                </li>
              ))}
            </ul>
          </aside>

          {/* Monaco Editor */}
          <section className="p-4 bg-gray-900">
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              🧑‍💻 {activeFile || "No file selected"}
            </h2>
            <div className="border border-gray-700 rounded-lg overflow-hidden">
              <MonacoEditor
                height="85vh"
                language="typescript"
                value={files.find((f) => f.name === activeFile)?.content || ""}
                theme="vs-dark"
                options={{
                  fontSize: 14,
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                }}
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
