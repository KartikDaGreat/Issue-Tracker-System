"use client";

import { useState, useCallback, useEffect, Fragment } from "react";
import { toast } from "sonner";
import Fuse from "fuse.js";
import * as XLSX from "xlsx";
import { apiFetch, errorMessage } from "@/lib/fetcher";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ───────────────────────────────────────────────────────────────────

const SUBJECTS = ["Eng", "Sci", "Soc", "Mat", "Tam"] as const;
type Subject = (typeof SUBJECTS)[number];

type Band =
  | "Intervention"
  | "Mild Concern"
  | "Average"
  | "Appreciate"
  | "Amazing";

interface BandThresholds {
  intervention: number;
  mildConcern: number;
  average: number;
  appreciate: number;
}

interface StudentRow {
  name: string;
  section: string;
  scores: Partial<Record<Subject, number>>;
}

interface MatchedStudent {
  name: string;
  matchedName: string;
  section: string;
  subjects: Record<
    Subject,
    {
      year1: number | null;
      year2: number | null;
      change: number | null;
      band: Band | null;
    }
  >;
}

interface SubjectSummary {
  subject: Subject;
  total: number;
  bands: Record<Band, number>;
}

interface SavedFile {
  id: string;
  name: string;
  createdTime: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SUBJECT_ALIASES: Record<Subject, string[]> = {
  Eng: ["eng", "english", "lang", "language"],
  Sci: ["sci", "science", "phy", "physics", "che", "chemistry", "bio", "biology", "general science"],
  Soc: ["soc", "social", "social science", "social studies", "ss", "history", "geography", "civics"],
  Mat: ["mat", "math", "maths", "mathematics"],
  Tam: ["tam", "tamil"],
};

const BAND_CONFIG: Record<Band, { color: string; label: string }> = {
  Intervention: { color: "bg-red-100 text-red-800 ring-red-600/20", label: "Intervention" },
  "Mild Concern": { color: "bg-orange-100 text-orange-800 ring-orange-600/20", label: "Mild Concern" },
  Average: { color: "bg-yellow-100 text-yellow-800 ring-yellow-600/20", label: "Average" },
  Appreciate: { color: "bg-blue-100 text-blue-800 ring-blue-600/20", label: "Appreciate" },
  Amazing: { color: "bg-green-100 text-green-800 ring-green-600/20", label: "Amazing" },
};

const DEFAULT_THRESHOLDS: BandThresholds = {
  intervention: -5,
  mildConcern: -3,
  average: 3,
  appreciate: 5,
};

// ─── Excel Helpers ───────────────────────────────────────────────────────────

function detectSubjectColumn(headers: string[]): Partial<Record<Subject, string>> {
  const mapping: Partial<Record<Subject, string>> = {};
  const claimed = new Set<string>();
  const orderedSubjects: Subject[] = ["Tam", "Eng", "Mat", "Soc", "Sci"];

  for (const subject of orderedSubjects) {
    const aliases = SUBJECT_ALIASES[subject];
    let match = headers.find(
      (h) => !claimed.has(h) && aliases.some((a) => h.toLowerCase().trim() === a)
    );
    if (!match) {
      match = headers.find(
        (h) =>
          !claimed.has(h) &&
          aliases.some((a) => {
            const lower = h.toLowerCase().trim();
            return lower.includes(a) || a.includes(lower);
          })
      );
    }
    if (match) {
      mapping[subject] = match;
      claimed.add(match);
    }
  }
  return mapping;
}

function detectNameColumn(headers: string[]): string | null {
  const nameAliases = ["name", "student name", "student", "pupil", "learner"];
  return headers.find((h) =>
    nameAliases.some((a) => h.toLowerCase().trim() === a || h.toLowerCase().trim().includes(a))
  ) || null;
}

function detectSectionColumn(headers: string[]): string | null {
  const sectionAliases = ["section", "sec", "class", "division", "div"];
  return headers.find((h) =>
    sectionAliases.some((a) => h.toLowerCase().trim() === a || h.toLowerCase().trim().includes(a))
  ) || null;
}

function parseExcelBuffer(buffer: ArrayBuffer): StudentRow[] {
  const data = new Uint8Array(buffer);
  const workbook = XLSX.read(data, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  if (json.length === 0) throw new Error("Empty spreadsheet");

  const headers = Object.keys(json[0]);
  const nameCol = detectNameColumn(headers);
  const sectionCol = detectSectionColumn(headers);
  const subjectMap = detectSubjectColumn(headers);

  if (!nameCol) throw new Error(`Could not find a "Name" column. Found: ${headers.join(", ")}`);

  const detectedSubjects = Object.keys(subjectMap) as Subject[];
  if (detectedSubjects.length === 0)
    throw new Error(`Could not detect any subject columns. Found: ${headers.join(", ")}`);

  return json
    .filter((row) => row[nameCol] && String(row[nameCol]).trim())
    .map((row) => {
      const scores: Partial<Record<Subject, number>> = {};
      for (const subject of detectedSubjects) {
        const col = subjectMap[subject]!;
        const raw = String(row[col] ?? "").trim().toUpperCase();
        if (raw === "AB" || raw === "ABSENT") {
          scores[subject] = 0;
        } else {
          const val = parseFloat(raw);
          if (!isNaN(val)) scores[subject] = val;
        }
      }
      return {
        name: String(row[nameCol]).trim(),
        section: sectionCol ? String(row[sectionCol] ?? "").trim() : "",
        scores,
      };
    });
}

async function parseExcelFile(file: File): Promise<StudentRow[]> {
  const buffer = await file.arrayBuffer();
  return parseExcelBuffer(buffer);
}

async function fetchAndParseFromDrive(fileId: string): Promise<StudentRow[]> {
  const res = await fetch(`/api/performance/files/${fileId}`);
  if (!res.ok) throw new Error("Failed to download file from saved files");
  const buffer = await res.arrayBuffer();
  return parseExcelBuffer(buffer);
}

// ─── Analysis Helpers ────────────────────────────────────────────────────────

function getBand(change: number, thresholds: BandThresholds): Band {
  if (change <= thresholds.intervention) return "Intervention";
  if (change <= thresholds.mildConcern) return "Mild Concern";
  if (change <= thresholds.average) return "Average";
  if (change <= thresholds.appreciate) return "Appreciate";
  return "Amazing";
}

function matchStudents(
  year1: StudentRow[],
  year2: StudentRow[],
  thresholds: BandThresholds
): MatchedStudent[] {
  const fuse = new Fuse(year1, { keys: ["name"], threshold: 0.4, includeScore: true });
  const matched: MatchedStudent[] = [];

  for (const s2 of year2) {
    const results = fuse.search(s2.name);
    const best = results[0];
    if (!best || (best.score !== undefined && best.score > 0.4)) continue;

    const s1 = best.item;
    const subjects = {} as MatchedStudent["subjects"];
    for (const sub of SUBJECTS) {
      const y1 = s1.scores[sub] ?? null;
      const y2 = s2.scores[sub] ?? null;
      const change = y1 !== null && y2 !== null ? y2 - y1 : null;
      subjects[sub] = { year1: y1, year2: y2, change, band: change !== null ? getBand(change, thresholds) : null };
    }
    matched.push({
      name: s2.name,
      matchedName: s1.name !== s2.name ? s1.name : "",
      section: s2.section || s1.section,
      subjects,
    });
  }
  return matched.sort((a, b) => a.name.localeCompare(b.name));
}

function computeSummary(students: MatchedStudent[]): SubjectSummary[] {
  return SUBJECTS.map((subject) => {
    const bands: Record<Band, number> = { Intervention: 0, "Mild Concern": 0, Average: 0, Appreciate: 0, Amazing: 0 };
    let total = 0;
    for (const s of students) {
      const b = s.subjects[subject].band;
      if (b) { bands[b]++; total++; }
    }
    return { subject, total, bands };
  });
}

// ─── File Source Picker ──────────────────────────────────────────────────────

function FileSourcePicker({
  label,
  savedFiles,
  onFileReady,
  onSaveFile,
  saving,
}: {
  label: string;
  savedFiles: SavedFile[];
  onFileReady: (file: File | null, savedId: string | null) => void;
  onSaveFile: (file: File, label: string) => Promise<void>;
  saving: boolean;
}) {
  const [mode, setMode] = useState<"upload" | "saved">(savedFiles.length > 0 ? "saved" : "upload");
  const [selectedSavedId, setSelectedSavedId] = useState<string>("");
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [saveLabel, setSaveLabel] = useState("");
  const [wantSave, setWantSave] = useState(false);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>

      {/* Mode toggle */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5">
        <button
          type="button"
          className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${mode === "saved" ? "bg-white shadow-sm" : "text-muted-foreground"}`}
          onClick={() => { setMode("saved"); onFileReady(null, selectedSavedId || null); }}
        >
          Saved Files
        </button>
        <button
          type="button"
          className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${mode === "upload" ? "bg-white shadow-sm" : "text-muted-foreground"}`}
          onClick={() => { setMode("upload"); onFileReady(localFile, null); }}
        >
          Upload New
        </button>
      </div>

      {mode === "saved" && (
        <>
          {savedFiles.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No saved files yet. Upload and save one first.</p>
          ) : (
            <Select
              value={selectedSavedId}
              onValueChange={(v) => {
                setSelectedSavedId(v ?? "");
                onFileReady(null, v || null);
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select a saved file..." />
              </SelectTrigger>
              <SelectContent>
                {savedFiles.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name.replace(/\.xlsx$/i, "")}
                    <span className="ml-2 text-[10px] text-muted-foreground">
                      {new Date(f.createdTime).toLocaleDateString()}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </>
      )}

      {mode === "upload" && (
        <>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="w-full rounded-md border px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-xs file:font-medium file:text-primary hover:file:bg-primary/20"
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              setLocalFile(f);
              onFileReady(f, null);
            }}
          />
          {localFile && (
            <div className="space-y-2">
              <p className="text-xs text-green-600">Loaded: {localFile.name}</p>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wantSave}
                    onChange={(e) => setWantSave(e.target.checked)}
                    className="rounded"
                  />
                  Save to Drive for reuse
                </label>
              </div>
              {wantSave && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 rounded-md border px-3 py-1.5 text-sm"
                    placeholder="Name (e.g., 9th Grade SA1 2025)"
                    value={saveLabel}
                    onChange={(e) => setSaveLabel(e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!saveLabel.trim() || saving}
                    onClick={() => onSaveFile(localFile, saveLabel.trim())}
                  >
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PerformanceClient() {
  const [activeTab, setActiveTab] = useState<"9-10" | "11-12">("9-10");

  // Saved files from Drive
  const [savedFiles, setSavedFiles] = useState<SavedFile[]>([]);
  const [academicYear, setAcademicYear] = useState("");
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [savingFile, setSavingFile] = useState(false);

  // File sources (either local File or Drive ID)
  const [source1, setSource1] = useState<{ file: File | null; savedId: string | null }>({ file: null, savedId: null });
  const [source2, setSource2] = useState<{ file: File | null; savedId: string | null }>({ file: null, savedId: null });

  // Labels for display
  const [year1Label, setYear1Label] = useState("Year 1 (Previous)");
  const [year2Label, setYear2Label] = useState("Year 2 (Current)");

  // Results
  const [results, setResults] = useState<MatchedStudent[] | null>(null);
  const [summary, setSummary] = useState<SubjectSummary[] | null>(null);
  const [unmatchedCount, setUnmatchedCount] = useState(0);
  const [processing, setProcessing] = useState(false);

  // View state
  const [viewMode, setViewMode] = useState<"summary" | "details">("summary");
  const [filterSubject, setFilterSubject] = useState<Subject | "all">("all");
  const [filterBand, setFilterBand] = useState<Band | "all">("all");
  const [filterSection, setFilterSection] = useState<string>("all");

  // Thresholds
  const [thresholds, setThresholds] = useState<BandThresholds>(DEFAULT_THRESHOLDS);
  const [showThresholds, setShowThresholds] = useState(false);

  const sections = results
    ? [...new Set(results.map((r) => r.section).filter(Boolean))].sort()
    : [];

  const fetchSavedFiles = useCallback(async () => {
    try {
      const data = await apiFetch<{
        files: SavedFile[];
        academicYear: string;
      }>("/api/performance/files");
      setSavedFiles(data.files);
      setAcademicYear(data.academicYear);
    } catch {
      // Saved files are an optional convenience; a failure here should not
      // block the analysis workflow.
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    // Declared inline rather than calling the shared callback: the lint rule
    // treats any effect that invokes a setState-containing function as a
    // synchronous state update.
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<{
          files: SavedFile[];
          academicYear: string;
        }>("/api/performance/files");
        if (cancelled) return;
        setSavedFiles(data.files);
        setAcademicYear(data.academicYear);
      } catch {
        // Saved files are an optional convenience.
      } finally {
        if (!cancelled) setLoadingFiles(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSaveFile(file: File, label: string) {
    setSavingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("label", label);

      await apiFetch("/api/performance/files", {
        method: "POST",
        body: formData,
      });

      toast.success(`Saved "${label}" to Drive`);
      await fetchSavedFiles();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSavingFile(false);
    }
  }

  const hasSource1 = !!(source1.file || source1.savedId);
  const hasSource2 = !!(source2.file || source2.savedId);

  const handleAnalyze = useCallback(async () => {
    if (!hasSource1 || !hasSource2) {
      toast.error("Please select or upload both files");
      return;
    }

    setProcessing(true);
    try {
      const [year1Data, year2Data] = await Promise.all([
        source1.file ? parseExcelFile(source1.file) : fetchAndParseFromDrive(source1.savedId!),
        source2.file ? parseExcelFile(source2.file) : fetchAndParseFromDrive(source2.savedId!),
      ]);

      if (year1Data.length === 0 || year2Data.length === 0) {
        toast.error("One or both files contain no student data");
        setProcessing(false);
        return;
      }

      const matched = matchStudents(year1Data, year2Data, thresholds);
      const unmatched = year2Data.length - matched.length;

      setResults(matched);
      setSummary(computeSummary(matched));
      setUnmatchedCount(unmatched);
      setViewMode("summary");
      setFilterSubject("all");
      setFilterBand("all");
      setFilterSection("all");

      toast.success(
        `Analyzed ${matched.length} students.${unmatched > 0 ? ` ${unmatched} unmatched.` : ""}`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to process files");
    }
    setProcessing(false);
  }, [source1, source2, hasSource1, hasSource2, thresholds]);

  const handleReset = () => {
    setSource1({ file: null, savedId: null });
    setSource2({ file: null, savedId: null });
    setResults(null);
    setSummary(null);
    setUnmatchedCount(0);
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]');
    inputs.forEach((input) => (input.value = ""));
  };

  const filteredResults = results?.filter((student) => {
    if (filterSection !== "all" && student.section !== filterSection) return false;
    if (filterBand !== "all") {
      if (filterSubject === "all") {
        return SUBJECTS.some((s) => student.subjects[s].band === filterBand);
      }
      return student.subjects[filterSubject as Subject]?.band === filterBand;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Performance Analysis</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Year-on-year student performance comparison
            {academicYear && (
              <span className="ml-2 inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {academicYear}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "9-10" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-gray-700"}`}
          onClick={() => setActiveTab("9-10")}
        >
          9th & 10th Grade
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "11-12" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-gray-700"}`}
          onClick={() => setActiveTab("11-12")}
        >
          11th & 12th Grade
        </button>
      </div>

      {activeTab === "11-12" && (
        <Card className="flex items-center justify-center py-16 border-0 shadow-sm ring-1 ring-black/5">
          <div className="text-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-muted-foreground/40"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>
            <p className="mt-3 text-lg font-medium text-gray-700">Coming Soon</p>
            <p className="mt-1 text-sm text-muted-foreground">11th & 12th grade analysis will be available in a future update</p>
          </div>
        </Card>
      )}

      {activeTab === "9-10" && (
        <>
          {/* Upload Section */}
          <Card className="border-0 shadow-sm ring-1 ring-black/5 p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Score Sheets</h2>
                <div className="flex items-center gap-3">
                  {loadingFiles && (
                    <span className="text-xs text-muted-foreground">Loading saved files...</span>
                  )}
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={() => setShowThresholds(!showThresholds)}
                  >
                    {showThresholds ? "Hide" : "Adjust"} Thresholds
                  </button>
                </div>
              </div>

              {showThresholds && (
                <div className="rounded-lg bg-gray-50 p-4 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Band Thresholds (% change)
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Intervention (&le;)</label>
                      <input type="number" className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
                        value={thresholds.intervention}
                        onChange={(e) => setThresholds({ ...thresholds, intervention: parseFloat(e.target.value) || -5 })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Mild Concern (&le;)</label>
                      <input type="number" className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
                        value={thresholds.mildConcern}
                        onChange={(e) => setThresholds({ ...thresholds, mildConcern: parseFloat(e.target.value) || -3 })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Average (&le;)</label>
                      <input type="number" className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
                        value={thresholds.average}
                        onChange={(e) => setThresholds({ ...thresholds, average: parseFloat(e.target.value) || 3 })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Appreciate (&le;)</label>
                      <input type="number" className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
                        value={thresholds.appreciate}
                        onChange={(e) => setThresholds({ ...thresholds, appreciate: parseFloat(e.target.value) || 5 })}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Intervention: &le;{thresholds.intervention}% | Mild Concern: {thresholds.intervention}% to {thresholds.mildConcern}% | Average: {thresholds.mildConcern}% to {thresholds.average}% | Appreciate: {thresholds.average}% to {thresholds.appreciate}% | Amazing: &gt;{thresholds.appreciate}%
                  </p>
                </div>
              )}

              {/* Year labels */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Display Label</label>
                  <input type="text" className="w-full rounded-md border px-3 py-1.5 text-sm"
                    placeholder="e.g., 9th Grade 2024" value={year1Label}
                    onChange={(e) => setYear1Label(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Display Label</label>
                  <input type="text" className="w-full rounded-md border px-3 py-1.5 text-sm"
                    placeholder="e.g., 10th Grade 2025" value={year2Label}
                    onChange={(e) => setYear2Label(e.target.value)}
                  />
                </div>
              </div>

              {/* File source pickers */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FileSourcePicker
                  label={year1Label}
                  savedFiles={savedFiles}
                  saving={savingFile}
                  onFileReady={(file, savedId) => setSource1({ file, savedId })}
                  onSaveFile={handleSaveFile}
                />
                <FileSourcePicker
                  label={year2Label}
                  savedFiles={savedFiles}
                  saving={savingFile}
                  onFileReady={(file, savedId) => setSource2({ file, savedId })}
                  onSaveFile={handleSaveFile}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleAnalyze} disabled={!hasSource1 || !hasSource2 || processing} className="gap-2">
                  {processing ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
                      Analyze Performance
                    </>
                  )}
                </Button>
                {results && (
                  <Button variant="outline" onClick={handleReset}>Reset</Button>
                )}
              </div>
            </div>
          </Card>

          {/* Results Section */}
          {results && summary && (
            <>
              {/* Stats bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="border-0 shadow-sm ring-1 ring-black/5 p-4">
                  <p className="text-xs text-muted-foreground">Students Matched</p>
                  <p className="text-2xl font-bold">{results.length}</p>
                </Card>
                <Card className="border-0 shadow-sm ring-1 ring-black/5 p-4">
                  <p className="text-xs text-muted-foreground">Unmatched</p>
                  <p className="text-2xl font-bold text-orange-600">{unmatchedCount}</p>
                </Card>
                <Card className="border-0 shadow-sm ring-1 ring-black/5 p-4">
                  <p className="text-xs text-muted-foreground">Need Intervention</p>
                  <p className="text-2xl font-bold text-red-600">{summary.reduce((a, s) => a + s.bands["Intervention"], 0)}</p>
                </Card>
                <Card className="border-0 shadow-sm ring-1 ring-black/5 p-4">
                  <p className="text-xs text-muted-foreground">Amazing</p>
                  <p className="text-2xl font-bold text-green-600">{summary.reduce((a, s) => a + s.bands["Amazing"], 0)}</p>
                </Card>
              </div>

              {/* View toggle */}
              <div className="flex items-center gap-3">
                <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
                  <button className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === "summary" ? "bg-white shadow-sm" : "text-muted-foreground hover:text-gray-700"}`} onClick={() => setViewMode("summary")}>Summary</button>
                  <button className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === "details" ? "bg-white shadow-sm" : "text-muted-foreground hover:text-gray-700"}`} onClick={() => setViewMode("details")}>Student Details</button>
                </div>
              </div>

              {/* Summary View */}
              {viewMode === "summary" && (
                <div className="space-y-4">
                  {summary.map((s) => (
                    <Card key={s.subject} className="border-0 shadow-sm ring-1 ring-black/5 p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-base font-semibold">
                          {s.subject === "Eng" ? "English" : s.subject === "Sci" ? "Science" : s.subject === "Soc" ? "Social Science" : s.subject === "Mat" ? "Mathematics" : "Tamil"}
                        </h3>
                        <span className="text-xs text-muted-foreground">{s.total} students analyzed</span>
                      </div>

                      {s.total > 0 && (
                        <div className="mb-3 flex h-6 overflow-hidden rounded-full">
                          {(["Intervention", "Mild Concern", "Average", "Appreciate", "Amazing"] as Band[]).map((band) => {
                            const pct = (s.bands[band] / s.total) * 100;
                            if (pct === 0) return null;
                            const colors: Record<Band, string> = { Intervention: "bg-red-400", "Mild Concern": "bg-orange-400", Average: "bg-yellow-400", Appreciate: "bg-blue-400", Amazing: "bg-green-400" };
                            return (
                              <div key={band} className={`${colors[band]} flex items-center justify-center text-[10px] font-bold text-white transition-all`}
                                style={{ width: `${pct}%` }} title={`${band}: ${s.bands[band]} (${pct.toFixed(1)}%)`}>
                                {pct >= 8 ? s.bands[band] : ""}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {(["Intervention", "Mild Concern", "Average", "Appreciate", "Amazing"] as Band[]).map((band) => (
                          <button key={band} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-gray-50 transition-colors"
                            onClick={() => { setViewMode("details"); setFilterSubject(s.subject); setFilterBand(band); }}>
                            <Badge className={`ring-1 text-[10px] ${BAND_CONFIG[band].color}`}>{band}</Badge>
                            <span className="font-semibold">{s.bands[band]}</span>
                            <span className="text-muted-foreground">({s.total > 0 ? ((s.bands[band] / s.total) * 100).toFixed(1) : 0}%)</span>
                          </button>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Details View */}
              {viewMode === "details" && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Select value={filterSubject} onValueChange={(v) => setFilterSubject(v as Subject | "all")}>
                      <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="All Subjects" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Subjects</SelectItem>
                        {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>

                    <Select value={filterBand} onValueChange={(v) => setFilterBand(v as Band | "all")}>
                      <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="All Bands" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Bands</SelectItem>
                        {(Object.keys(BAND_CONFIG) as Band[]).map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                      </SelectContent>
                    </Select>

                    {sections.length > 0 && (
                      <Select value={filterSection} onValueChange={(v) => setFilterSection(v ?? "all")}>
                        <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="All Sections" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Sections</SelectItem>
                          {sections.map((s) => <SelectItem key={s} value={s}>Section {s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}

                    {(filterSubject !== "all" || filterBand !== "all" || filterSection !== "all") && (
                      <Button variant="ghost" size="sm" className="h-9 text-xs"
                        onClick={() => { setFilterSubject("all"); setFilterBand("all"); setFilterSection("all"); }}>
                        Clear Filters
                      </Button>
                    )}
                  </div>

                  <Card className="border-0 shadow-sm ring-1 ring-black/5 overflow-hidden">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="pl-4 sticky left-0 bg-white z-10">Student</TableHead>
                            <TableHead className="sticky left-[140px] bg-white z-10">Section</TableHead>
                            {(filterSubject === "all" ? SUBJECTS : [filterSubject as Subject]).map((sub) => (
                              <TableHead key={sub} className="text-center" colSpan={3}>
                                <span className="font-semibold">{sub}</span>
                              </TableHead>
                            ))}
                          </TableRow>
                          <TableRow className="hover:bg-transparent border-b-2">
                            <TableHead className="pl-4 sticky left-0 bg-white z-10" />
                            <TableHead className="sticky left-[140px] bg-white z-10" />
                            {(filterSubject === "all" ? SUBJECTS : [filterSubject as Subject]).map((sub) => (
                              <Fragment key={sub}>
                                <TableHead className="text-center text-[10px] px-2">{year1Label.length > 10 ? "Y1" : year1Label}</TableHead>
                                <TableHead className="text-center text-[10px] px-2">{year2Label.length > 10 ? "Y2" : year2Label}</TableHead>
                                <TableHead className="text-center text-[10px] px-2">Band</TableHead>
                              </Fragment>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredResults && filteredResults.length > 0 ? (
                            filteredResults.map((student) => (
                              <TableRow key={student.name}>
                                <TableCell className="pl-4 sticky left-0 bg-white z-10">
                                  <div>
                                    <p className="font-medium text-sm">{student.name}</p>
                                    {student.matchedName && <p className="text-[10px] text-muted-foreground">Matched: {student.matchedName}</p>}
                                  </div>
                                </TableCell>
                                <TableCell className="sticky left-[140px] bg-white z-10 text-sm">{student.section || "-"}</TableCell>
                                {(filterSubject === "all" ? SUBJECTS : [filterSubject as Subject]).map((sub) => {
                                  const d = student.subjects[sub];
                                  return (
                                    <Fragment key={sub}>
                                      <TableCell className="text-center text-sm px-2">{d.year1 !== null ? d.year1 : "-"}</TableCell>
                                      <TableCell className="text-center text-sm px-2">
                                        <div>
                                          {d.year2 !== null ? d.year2 : "-"}
                                          {d.change !== null && (
                                            <span className={`ml-1 text-[10px] font-medium ${d.change > 0 ? "text-green-600" : d.change < 0 ? "text-red-600" : "text-gray-500"}`}>
                                              ({d.change > 0 ? "+" : ""}{d.change})
                                            </span>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-center px-2">
                                        {d.band ? (
                                          <Badge className={`ring-1 text-[10px] whitespace-nowrap ${BAND_CONFIG[d.band].color}`}>{d.band}</Badge>
                                        ) : (
                                          <span className="text-xs text-muted-foreground">-</span>
                                        )}
                                      </TableCell>
                                    </Fragment>
                                  );
                                })}
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={20} className="text-center py-8 text-sm text-muted-foreground">
                                No students match the current filters
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    {filteredResults && (
                      <div className="border-t px-4 py-2 text-xs text-muted-foreground">
                        Showing {filteredResults.length} of {results.length} students
                      </div>
                    )}
                  </Card>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
