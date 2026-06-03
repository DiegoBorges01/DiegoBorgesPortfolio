"use client";

import { useEffect, useRef, useState } from "react";
import type { BaseCfg, CamCfg } from "./KeyboardScene";

// ─── Recalibrate button ──────────────────────────────────────────────────────
// Activated via ?calibrate=1. Runs a grid search seeded from the current
// (locked) values and atomically commits the best-scoring config.
export default function RecalibrateButton({
  cam, setCam, wrapRef, baseCfg, setBaseCfg,
}: {
  cam: CamCfg;
  setCam: (c: CamCfg) => void;
  wrapRef: React.RefObject<HTMLDivElement>;
  baseCfg: BaseCfg;
  setBaseCfg: (b: BaseCfg) => void;
}) {
  const [refImg, setRefImg] = useState<HTMLImageElement | null>(null);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string>("");
  const seedRef = useRef<CamCfg>(cam);
  // Keep the seed pinned to the locked values present when recalibration starts
  useEffect(() => { seedRef.current = cam; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefFile = (f: File | undefined) => {
    if (!f) return;
    const img = new Image();
    img.onload = () => setRefImg(img);
    img.src = URL.createObjectURL(f);
  };

  const sample = (src: HTMLCanvasElement | HTMLImageElement, w: number, h: number) => {
    const SAMPLE = 160;
    const aspect = h / w;
    const sw = SAMPLE, sh = Math.max(8, Math.round(SAMPLE * aspect));
    const c = document.createElement("canvas");
    c.width = sw; c.height = sh;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(src, 0, 0, w, h, 0, 0, sw, sh);
    return ctx.getImageData(0, 0, sw, sh);
  };

  const score = (): number | null => {
    const gl = wrapRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!gl || !refImg) return null;
    const cur = sample(gl, gl.width, gl.height);
    const ref = sample(refImg, refImg.naturalWidth, refImg.naturalHeight);
    let sum = 0;
    const n = cur.data.length / 4;
    for (let i = 0; i < cur.data.length; i += 4) {
      const dr = cur.data[i] - ref.data[i];
      const dg = cur.data[i + 1] - ref.data[i + 1];
      const db = cur.data[i + 2] - ref.data[i + 2];
      sum += Math.sqrt(dr * dr + dg * dg + db * db) / Math.SQRT2;
    }
    return 1 - sum / n / 255;
  };

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const recalibrate = async () => {
    if (!refImg) { setStatus("envie a imagem de referência primeiro"); return; }
    setRunning(true);
    setStatus("rodando…");
    const seed = seedRef.current;
    const off3 = (v: number, d: number) => [v - d, v, v + d];
    const off5 = (v: number, d: number) => [v - 2*d, v - d, v, v + d, v + 2*d];
    const yaws    = off5(seed.yaw,   0.08);
    const pitches = off3(seed.pitch, 0.08);
    const camYs   = off5(seed.camY,  0.5);
    const camZs   = off5(seed.camZ,  0.5);
    const total = yaws.length * pitches.length * camYs.length * camZs.length;
    let best = { s: -Infinity, c: seed };
    let tested = 0;
    for (const y of yaws) for (const p of pitches)
      for (const cy of camYs) for (const cz of camZs) {
        const c = { ...seed, yaw: y, pitch: p, camY: cy, camZ: cz };
        setCam(c);
        await wait(60);
        const s = score();
        tested++;
        if (s !== null && s > best.s) best = { s, c };
        if (tested % 10 === 0)
          setStatus(`testado ${tested}/${total} — melhor ${(best.s*100).toFixed(1)}%`);
      }
    setCam(best.c);
    seedRef.current = best.c;
    setRunning(false);
    setStatus(`travado — ${(best.s*100).toFixed(2)}% (yaw ${best.c.yaw.toFixed(2)}, pitch ${best.c.pitch.toFixed(2)}, camY ${best.c.camY.toFixed(2)}, camZ ${best.c.camZ.toFixed(2)})`);
  };

  return (
    <div className="absolute right-3 top-3 z-20 w-64 rounded-xl border border-white/10 bg-black/85 p-3 backdrop-blur space-y-2">
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-violet-300">
        Recalibrar
      </span>
      <input
        type="file" accept="image/*"
        onChange={(e) => onRefFile(e.target.files?.[0])}
        className="block w-full text-[10px] text-white/60 file:mr-2 file:rounded file:border-0 file:bg-white/10 file:px-2 file:py-0.5 file:text-white/80"
      />
      <button
        onClick={recalibrate}
        disabled={!refImg || running}
        className="w-full rounded bg-violet-600/80 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
      >
        {running ? "otimizando…" : "recalibrar"}
      </button>
      <button
        onClick={() => navigator.clipboard?.writeText(JSON.stringify(cam, null, 2))}
        className="w-full rounded bg-white/10 py-1 text-[10px] text-white/70 hover:bg-white/20"
      >
        copiar valores
      </button>
      {status && <div className="text-[9px] leading-tight text-white/55">{status}</div>}

      <div className="border-t border-white/10 pt-2 space-y-2">
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-violet-300">
          Base material
        </span>

        <div className="flex items-center gap-2">
          <input
            type="color"
            value={baseCfg.color}
            onChange={(e) => setBaseCfg({ ...baseCfg, color: e.target.value })}
            className="h-7 w-10 cursor-pointer rounded border border-white/10 bg-transparent"
          />
          <span className="text-[10px] font-mono uppercase text-white/70">
            {baseCfg.color}
          </span>
        </div>

        <div className="flex flex-wrap gap-1">
          {["#111111","#161616","#1F1F1F","#242424","#2A2A2A","#303030"].map((c) => (
            <button
              key={c}
              onClick={() => setBaseCfg({ ...baseCfg, color: c })}
              title={c}
              className="h-5 w-5 rounded border border-white/15 hover:scale-110 transition"
              style={{ background: c }}
            />
          ))}
        </div>

        {([
          ["Roughness",       "roughness",       0.15, 0.80, 0.01],
          ["Metalness",       "metalness",       0,    0.30, 0.01],
          ["Clearcoat",       "clearcoat",       0,    1,    0.01],
          ["Reflection",      "envMapIntensity", 0,    2,    0.05],
        ] as const).map(([label, key, min, max, step]) => (
          <div key={key} className="space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-white/70">{label}</span>
              <span className="text-[10px] font-mono text-violet-300">
                {baseCfg[key].toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={min} max={max} step={step}
              value={baseCfg[key]}
              onChange={(e) => setBaseCfg({ ...baseCfg, [key]: parseFloat(e.target.value) })}
              className="w-full accent-violet-500"
            />
          </div>
        ))}

        <button
          onClick={() => {
            const out = `baseMaterial = {
  color: "${baseCfg.color}",
  roughness: ${baseCfg.roughness.toFixed(2)},
  metalness: ${baseCfg.metalness.toFixed(2)},
  clearcoat: ${baseCfg.clearcoat.toFixed(2)},
  envMapIntensity: ${baseCfg.envMapIntensity.toFixed(2)}
}`;
            navigator.clipboard?.writeText(out);
          }}
          className="w-full rounded bg-white/10 py-1 text-[10px] text-white/80 hover:bg-white/20"
        >
          copiar valores da base
        </button>
      </div>
    </div>
  );
}