import React, { useMemo, useState } from "react";

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readImageMeta(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || 0;
      const height = img.naturalHeight || 0;
      const ratio = height === 0 ? 0 : width / height;
      const orientation = ratio >= 1 ? "horizontal" : "vertical";
      resolve({ width, height, ratio, orientation });
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function clsx(...xs) {
  return xs.filter(Boolean).join(" ");
}

const defaultAnchor = `Realistic corporate stock footage look. Clean neutral daylight, soft shadows, shallow depth of field, high quality. Stable camera (tripod/gimbal), no jitter. Keep subject as hero, natural acting, no exaggerated gestures. No logos, no text overlays.`;

const referenceShotTemplates = [
  "Establishing wide shot",
  "Medium contextual shot",
  "Closer character shot",
  "Detail/insert shot",
  "Motion/transition shot",
];

function inferFramingFromRatio(ratio = 1) {
  if (ratio > 1.7) return "ultra wide";
  if (ratio > 1.3) return "wide";
  if (ratio > 1.05) return "medium";
  if (ratio > 0.8) return "close";
  return "portrait close";
}

async function runVisionAnalysis({ apiKey, model, mode, idea, firstPreview, lastPreview, referenceScenes }) {
  const promptForSingle = `
Analyze the visual content deeply and return ONLY valid JSON.
Language: Spanish.
Task:
- Describe first_frame_description (plano, encuadre, personaje, acción, intención/motivación, luz, props).
- Describe last_frame_description with same depth.
- Create continuity_notes between both frames.
- Create enhanced_idea based on user idea, adding cinematic detail and natural behavior.
- Suggest camera_suggestions (array of short items) and naturality_suggestions (array).
JSON schema:
{
  "first_frame_description": "...",
  "last_frame_description": "...",
  "continuity_notes": "...",
  "enhanced_idea": "...",
  "camera_suggestions": ["..."],
  "naturality_suggestions": ["..."]
}
User idea:
${idea}
`;

  const promptForReferences = `
Analyze the reference images deeply and return ONLY valid JSON.
Language: Spanish.
Task:
- For each reference image, provide:
  - shot_type
  - framing
  - character
  - action
  - motivation
  - camera_behavior
- Create enhanced_idea from user idea with richer narrative and visual continuity.
- Suggest camera_suggestions and naturality_suggestions.
JSON schema:
{
  "references": [
    {
      "index": 1,
      "shot_type": "...",
      "framing": "...",
      "character": "...",
      "action": "...",
      "motivation": "...",
      "camera_behavior": "..."
    }
  ],
  "enhanced_idea": "...",
  "camera_suggestions": ["..."],
  "naturality_suggestions": ["..."]
}
User idea:
${idea}
`;

  const content = [
    {
      type: "input_text",
      text: mode === "single" ? promptForSingle : promptForReferences,
    },
  ];

  if (mode === "single") {
    if (firstPreview) content.push({ type: "input_image", image_url: firstPreview });
    if (lastPreview) content.push({ type: "input_image", image_url: lastPreview });
  } else {
    referenceScenes.forEach((scene) => {
      content.push({ type: "input_image", image_url: scene.preview });
    });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [{ role: "user", content }],
      text: { format: { type: "text" } },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || "AI request failed");
  }

  const data = await response.json();
  const raw = data.output_text || "";
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  const jsonText =
    firstBrace >= 0 && lastBrace > firstBrace ? raw.slice(firstBrace, lastBrace + 1) : raw;

  return JSON.parse(jsonText);
}

function buildPrompt({
  mode,
  shots,
  includeHeroFinal,
  heroLabel,
  finalLabel,
  idea,
  anchor,
  cameraMove,
  pace,
  avoid,
  referenceScenes,
  totalScenes,
  aiSingleAnalysis,
  aiReferenceAnalysis,
  enhanceWithAI,
}) {
  const lines = [];

  const ideaToUse = enhanceWithAI
    ? aiSingleAnalysis?.enhanced_idea || aiReferenceAnalysis?.enhanced_idea || idea
    : idea;

  const idLine =
    mode === "single"
      ? "Higgsfield + Kling 3.0 – Single Shot"
      : mode === "multishot-references"
        ? `Kling 3.0 Multishot (Referencias) – ${totalScenes} Scenes`
        : `Kling 3.0 Multishot (Higgsfield) – ${shots} Shots`;

  lines.push(`${idLine} – Stock Style`);
  lines.push("");

  if (anchor?.trim()) {
    lines.push("GLOBAL ANCHOR:");
    lines.push(anchor.trim());
    lines.push("");
  }

  if (includeHeroFinal) {
    lines.push(`${heroLabel} (start frame / First Frame):`);
    if (enhanceWithAI && aiSingleAnalysis?.first_frame_description && mode === "single") {
      lines.push(aiSingleAnalysis.first_frame_description);
    } else {
      lines.push(
        "Describe the start exactly like the first image: framing, subject position, props, lighting. Keep it concise and accurate."
      );
    }
    lines.push("");

    lines.push(`${finalLabel} (end frame / Last Frame):`);
    if (enhanceWithAI && aiSingleAnalysis?.last_frame_description && mode === "single") {
      lines.push(aiSingleAnalysis.last_frame_description);
    } else {
      lines.push(
        "Describe the end exactly like the last image: final framing, subject state, props, lighting. Keep it consistent."
      );
    }
    lines.push("");
  }

  lines.push("IDEA BASE (user input):");
  lines.push((ideaToUse || "").trim() || "(Add your base idea here)");
  lines.push("");

  if (mode === "single") {
    lines.push("ACTION / BEHAVIOR (continuous):");
    lines.push(
      "Natural micro-movements (blink, breath, subtle head tilt). Keep gestures controlled and professional."
    );

    if (enhanceWithAI && aiSingleAnalysis?.naturality_suggestions?.length) {
      aiSingleAnalysis.naturality_suggestions.forEach((n) => lines.push(`- ${n}`));
    }
    lines.push("");

    lines.push("CAMERA:");
    lines.push(
      `${(cameraMove || "One continuous simple camera move").trim()} at a ${pace} pace. No speed ramps. Keep the hero subject centered.`
    );
    if (enhanceWithAI && aiSingleAnalysis?.camera_suggestions?.length) {
      lines.push("AI camera suggestions:");
      aiSingleAnalysis.camera_suggestions.forEach((s) => lines.push(`- ${s}`));
    }
    if (enhanceWithAI && aiSingleAnalysis?.continuity_notes) {
      lines.push("");
      lines.push("AI continuity notes:");
      lines.push(aiSingleAnalysis.continuity_notes);
    }
    lines.push("");
  } else if (mode === "multishot-references") {
    lines.push("REFERENCE ANALYSIS (up to 5 images):");

    if (enhanceWithAI && aiReferenceAnalysis?.references?.length) {
      aiReferenceAnalysis.references.forEach((scene) => {
        lines.push(
          `Ref ${scene.index}: shot=${scene.shot_type}; framing=${scene.framing}; personaje=${scene.character}; acción=${scene.action}; motivación=${scene.motivation}; cámara=${scene.camera_behavior}`
        );
      });
    } else if (referenceScenes.length === 0) {
      lines.push("No reference images uploaded. Add up to 5 reference images.");
    } else {
      referenceScenes.forEach((scene) => {
        lines.push(
          `Ref ${scene.index}: ${scene.fileName} | ${scene.width}x${scene.height} | ${scene.orientation} | suggested framing: ${scene.framing}`
        );
      });
    }
    lines.push("");

    lines.push("SCENE PLAN:");
    for (let i = 1; i <= totalScenes; i++) {
      if (i <= referenceScenes.length) {
        const base = referenceScenes[i - 1];
        lines.push(`Scene ${i} (from reference ${base.index}):`);
        lines.push(
          `Use the uploaded reference as visual anchor (${base.fileName}). Keep composition close to a ${base.framing} shot and preserve continuity.`
        );
      } else {
        lines.push(`Scene ${i} (generated continuation):`);
        lines.push(
          "Expand from the idea base and previous references. Define framing, action, and camera move while preserving subject, props, and lighting continuity."
        );
      }
      lines.push("");
    }

    if (enhanceWithAI && aiReferenceAnalysis?.camera_suggestions?.length) {
      lines.push("AI camera suggestions:");
      aiReferenceAnalysis.camera_suggestions.forEach((s) => lines.push(`- ${s}`));
      lines.push("");
    }

    if (enhanceWithAI && aiReferenceAnalysis?.naturality_suggestions?.length) {
      lines.push("AI naturality suggestions:");
      aiReferenceAnalysis.naturality_suggestions.forEach((s) => lines.push(`- ${s}`));
      lines.push("");
    }
  } else {
    for (let i = 1; i <= shots; i++) {
      lines.push(`Shot ${i}:`);
      lines.push(
        "Focus on the hero subject. Specify framing (wide/medium/close/OTS/insert), what she does, and a simple camera behavior."
      );
      lines.push("");
    }
  }

  lines.push("CONTINUITY LOCKS:");
  lines.push(
    "Same subject, same outfit, same environment, same props and positions, consistent lighting and color. No object movement unless explicitly requested."
  );
  lines.push("");

  lines.push("AVOID:");
  lines.push(
    avoid ||
      "No glitches, no warped hands/face, no flicker, no random objects appearing/disappearing, no dramatic lighting shifts, no unreadable text mush."
  );

  return lines.join("\n");
}

export default function KlingPromptBuilder() {
  const [firstPreview, setFirstPreview] = useState("");
  const [lastPreview, setLastPreview] = useState("");
  const [mode, setMode] = useState("multishot");
  const [shots, setShots] = useState(4);
  const [totalScenes, setTotalScenes] = useState(5);
  const [includeHeroFinal, setIncludeHeroFinal] = useState(true);
  const [heroLabel, setHeroLabel] = useState("HERO FRAME");
  const [finalLabel, setFinalLabel] = useState("FINAL FRAME");
  const [idea, setIdea] = useState("");
  const [anchor, setAnchor] = useState(defaultAnchor);
  const [cameraMove, setCameraMove] = useState(
    "One continuous slow orbital move to the left (counterclockwise arc) around the subject"
  );
  const [pace, setPace] = useState("slow");
  const [avoid, setAvoid] = useState(
    "No text overlays, no logos, no camera shake, no warping hands/face, no extra people, no flicker, no sudden lighting changes."
  );
  const [referenceScenes, setReferenceScenes] = useState([]);

  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4.1-mini");
  const [enhanceWithAI, setEnhanceWithAI] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [aiSingleAnalysis, setAiSingleAnalysis] = useState(null);
  const [aiReferenceAnalysis, setAiReferenceAnalysis] = useState(null);

  const [out, setOut] = useState("");
  const [copied, setCopied] = useState(false);

  const canGenerate = useMemo(() => {
    if (!idea.trim()) return false;
    if (mode === "multishot-references") return referenceScenes.length > 0;
    return true;
  }, [idea, mode, referenceScenes]);

  async function onPickFirst(file) {
    if (!file) return setFirstPreview("");
    try {
      setFirstPreview(await readFileAsDataURL(file));
    } catch {
      setFirstPreview("");
    }
  }

  async function onPickLast(file) {
    if (!file) return setLastPreview("");
    try {
      setLastPreview(await readFileAsDataURL(file));
    } catch {
      setLastPreview("");
    }
  }

  async function onPickReferences(filesList) {
    const files = Array.from(filesList || []).slice(0, 5);
    if (files.length === 0) return setReferenceScenes([]);

    const analyzed = await Promise.all(
      files.map(async (file, idx) => {
        const preview = await readFileAsDataURL(file);
        const meta = await readImageMeta(preview);
        return {
          index: idx + 1,
          fileName: file.name,
          preview,
          width: meta.width,
          height: meta.height,
          orientation: meta.orientation,
          framing: inferFramingFromRatio(meta.ratio),
          suggestion: referenceShotTemplates[idx] || "Reference shot",
        };
      })
    );

    setReferenceScenes(analyzed);
    setTotalScenes((prev) => Math.min(10, Math.max(analyzed.length, prev)));
  }

  async function analyzeWithAI() {
    setAnalysisError("");
    if (!apiKey.trim()) return setAnalysisError("Agrega tu API key para ejecutar el análisis con IA.");
    if (mode === "single" && (!firstPreview || !lastPreview)) {
      return setAnalysisError("En Single Shot necesitas subir First Frame y Last Frame para analizar.");
    }
    if (mode === "multishot-references" && referenceScenes.length === 0) {
      return setAnalysisError("En Multishot (Referencias) necesitas al menos una imagen de referencia.");
    }

    setIsAnalyzing(true);
    try {
      const result = await runVisionAnalysis({
        apiKey,
        model,
        mode,
        idea,
        firstPreview,
        lastPreview,
        referenceScenes,
      });
      if (mode === "single") setAiSingleAnalysis(result);
      if (mode === "multishot-references") setAiReferenceAnalysis(result);
    } catch (err) {
      setAnalysisError(String(err?.message || err));
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function generate() {
    if (enhanceWithAI && apiKey.trim()) {
      const needsSingle = mode === "single" && !aiSingleAnalysis;
      const needsRef = mode === "multishot-references" && !aiReferenceAnalysis;
      if (needsSingle || needsRef) await analyzeWithAI();
    }

    setOut(
      buildPrompt({
        mode,
        shots,
        includeHeroFinal,
        heroLabel,
        finalLabel,
        idea,
        anchor,
        cameraMove,
        pace,
        avoid,
        referenceScenes,
        totalScenes,
        aiSingleAnalysis,
        aiReferenceAnalysis,
        enhanceWithAI,
      })
    );
    setCopied(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(out);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen w-full bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Kling 3.0 Prompt Builder</h1>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium">First Frame</span>
                  <input type="file" accept="image/*" onChange={(e) => onPickFirst(e.target.files?.[0] || null)} className="block w-full text-sm" />
                  <div className="aspect-video overflow-hidden rounded-xl bg-neutral-100">
                    {firstPreview ? <img src={firstPreview} alt="First" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-neutral-500">Preview</div>}
                  </div>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium">Last Frame</span>
                  <input type="file" accept="image/*" onChange={(e) => onPickLast(e.target.files?.[0] || null)} className="block w-full text-sm" />
                  <div className="aspect-video overflow-hidden rounded-xl bg-neutral-100">
                    {lastPreview ? <img src={lastPreview} alt="Last" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-neutral-500">Preview</div>}
                  </div>
                </label>
              </div>

              <div className="rounded-xl bg-neutral-50 p-3 ring-1 ring-neutral-200">
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => setMode("multishot")} className={clsx("rounded px-3 py-1 ring-1", mode === "multishot" ? "bg-black text-white" : "bg-white")}>Multi-shot</button>
                  <button onClick={() => setMode("single")} className={clsx("rounded px-3 py-1 ring-1", mode === "single" ? "bg-black text-white" : "bg-white")}>Single shot</button>
                  <button onClick={() => setMode("multishot-references")} className={clsx("rounded px-3 py-1 ring-1", mode === "multishot-references" ? "bg-black text-white" : "bg-white")}>Multishot (Referencias)</button>
                </div>

                {mode === "multishot" && (
                  <select value={shots} onChange={(e) => setShots(parseInt(e.target.value, 10))} className="mt-3 rounded bg-white px-3 py-2 text-sm ring-1 ring-neutral-200">
                    {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                )}

                {mode === "single" && (
                  <div className="mt-3 flex flex-col gap-2">
                    <input value={cameraMove} onChange={(e) => setCameraMove(e.target.value)} className="rounded bg-white px-3 py-2 text-sm ring-1 ring-neutral-200" />
                    <select value={pace} onChange={(e) => setPace(e.target.value)} className="rounded bg-white px-3 py-2 text-sm ring-1 ring-neutral-200">
                      <option value="slow">slow</option><option value="medium">medium</option><option value="fast">fast</option>
                    </select>
                  </div>
                )}

                {mode === "multishot-references" && (
                  <div className="mt-3 flex flex-col gap-3">
                    <input type="file" accept="image/*" multiple onChange={(e) => onPickReferences(e.target.files)} className="block w-full text-sm" />
                    <select value={totalScenes} onChange={(e) => setTotalScenes(parseInt(e.target.value, 10))} className="rounded bg-white px-3 py-2 text-sm ring-1 ring-neutral-200">
                      {Array.from({ length: 10 }, (_, i) => i + 1).filter((n) => n >= Math.max(referenceScenes.length, 1)).map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-neutral-50 p-3 ring-1 ring-neutral-200">
                <div className="mb-2 text-sm font-medium">Análisis con IA (Enhance)</div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="OpenAI API key" className="rounded bg-white px-3 py-2 text-sm ring-1 ring-neutral-200" />
                  <input value={model} onChange={(e) => setModel(e.target.value)} className="rounded bg-white px-3 py-2 text-sm ring-1 ring-neutral-200" />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-xs"><input type="checkbox" checked={enhanceWithAI} onChange={(e) => setEnhanceWithAI(e.target.checked)} /> Aplicar Enhance IA</label>
                  <button onClick={analyzeWithAI} disabled={isAnalyzing || !idea.trim()} className="rounded px-3 py-1 text-xs ring-1">{isAnalyzing ? "Analizando..." : "Analizar con IA"}</button>
                </div>
                {analysisError && <div className="mt-2 text-xs text-red-700">{analysisError}</div>}
              </div>

              <textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={5} className="rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-neutral-200" placeholder="Idea base" />
              <textarea value={anchor} onChange={(e) => setAnchor(e.target.value)} rows={3} className="rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-neutral-200" />
              <textarea value={avoid} onChange={(e) => setAvoid(e.target.value)} rows={3} className="rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-neutral-200" />

              <button onClick={generate} disabled={!canGenerate || isAnalyzing} className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white">{isAnalyzing ? "Procesando..." : "Crear prompt"}</button>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Prompt generado</h2>
              <button onClick={copy} disabled={!out} className="rounded-lg px-3 py-1.5 text-sm ring-1">{copied ? "Copiado" : "Copiar"}</button>
            </div>
            <div className="mt-3 rounded-xl bg-neutral-50 p-3 ring-1 ring-neutral-200">
              <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-neutral-900">{out || "Aquí aparecerá tu prompt."}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
