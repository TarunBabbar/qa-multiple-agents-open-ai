"use client";

import { useEffect, useState } from "react";
import { Settings, Download, Upload } from "lucide-react";

type SettingsShape = {
  theme?: "dark" | "light";
  editorFontSize?: number;
};

export default function PreferencesPopover({
  onChange,
  initialFontSize = 13,
}: {
  onChange?: (s: SettingsShape) => void;
  initialFontSize?: number;
}) {
  const [open, setOpen] = useState(false);
  const [editorFontSize, setEditorFontSize] = useState<number>(initialFontSize);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("qa_settings");
      if (saved) {
        const parsed = JSON.parse(saved) as SettingsShape;
        if (parsed.editorFontSize) setEditorFontSize(parsed.editorFontSize);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "qa_settings",
        JSON.stringify({ editorFontSize }, null, 2)
      );
    } catch {
      // ignore
    }
    onChange?.({ editorFontSize });
  }, [editorFontSize, onChange]);

  const exportSettings = () => {
    const data = { editorFontSize };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "qa-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importSettings = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as SettingsShape;
        if (parsed.editorFontSize) setEditorFontSize(parsed.editorFontSize);
      } catch {
        // ignore
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="relative">
      <button className="btn btn-ghost p-2" onClick={() => setOpen((s) => !s)} aria-expanded={open}>
        <Settings className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 p-3 card z-50">
          <div className="flex items-center justify-between mb-2">
            <strong>Preferences</strong>
            <div className="flex items-center gap-2">
              <button className="btn btn-ghost p-1" onClick={exportSettings} title="Export settings">
                <Download className="h-4 w-4" />
              </button>
              <label className="btn btn-ghost p-1">
                <Upload className="h-4 w-4" />
                <input
                  type="file"
                  accept="application/json"
                  onChange={(e) => importSettings(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <label className="text-sm block mb-2">Editor font size: {editorFontSize}px</label>
          <input
            type="range"
            min={10}
            max={20}
            value={editorFontSize}
            onChange={(e) => setEditorFontSize(Number(e.target.value))}
            className="w-full"
          />

          <div className="mt-3 text-xs text-muted">Settings persist in localStorage and can be exported/imported.</div>
        </div>
      )}
    </div>
  );
}
