/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from "react";
import { Activity, Sparkles } from "lucide-react";
import { EQBand } from "../types";

interface EQPanelProps {
  eqEnabled: boolean;
  eqBands: EQBand[];
  onToggleEQ: (enabled: boolean) => void;
  onUpdateBand: (bandId: string, updates: Partial<EQBand>) => void;
  onApplyPreset: (presetName: string) => void;
  activePreset: string;
}

export default function EQPanel({
  eqEnabled,
  eqBands,
  onToggleEQ,
  onUpdateBand,
  onApplyPreset,
  activePreset
}: EQPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Redraw EQ frequency curve on canvas whenever bands change or EQ is toggled
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background to matches container dark
    const isLight = document.documentElement.classList.contains("light");
    ctx.fillStyle = isLight ? "#f8fafc" : "#0d0f12";
    ctx.fillRect(0, 0, width, height);

    // Draw horizontal grid lines (dB markers: +12, +6, 0, -6, -12)
    ctx.strokeStyle = isLight ? "rgba(15, 23, 42, 0.05)" : "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1;
    const dbLines = [12, 6, 0, -6, -12];
    dbLines.forEach((db) => {
      const y = height / 2 - (db / 12) * (height / 2.2);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();

      // Add text label
      ctx.fillStyle = isLight ? "rgba(71, 85, 105, 0.6)" : "rgba(100, 116, 139, 0.4)";
      ctx.font = "8px monospace";
      ctx.fillText(`${db > 0 ? "+" : ""}${db}dB`, 5, y - 2);
    });

    // Draw vertical frequency grid lines (100Hz, 1kHz, 10kHz)
    const freqLines = [100, 500, 1000, 4000, 10000];
    freqLines.forEach((freq) => {
      // Logarithmic spacing
      const logFreq = Math.log10(freq);
      const minLog = Math.log10(20);
      const maxLog = Math.log10(20000);
      const x = ((logFreq - minLog) / (maxLog - minLog)) * width;

      ctx.strokeStyle = isLight ? "rgba(15, 23, 42, 0.05)" : "rgba(255, 255, 255, 0.04)";
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();

      // Label
      ctx.fillStyle = isLight ? "rgba(71, 85, 105, 0.6)" : "rgba(100, 116, 139, 0.4)";
      ctx.fillText(freq >= 1000 ? `${freq / 1000}kHz` : `${freq}Hz`, x + 3, height - 6);
    });

    // If EQ is disabled, draw a flat grey line and return
    if (!eqEnabled) {
      ctx.strokeStyle = isLight ? "rgba(100, 116, 139, 0.4)" : "rgba(100, 116, 139, 0.3)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      return;
    }

    // Draw the frequency response curve!
    ctx.strokeStyle = isLight ? "rgba(5, 150, 105, 1)" : "rgba(16, 185, 129, 0.9)"; // emerald-600 in light, emerald-500 in dark
    ctx.lineWidth = 3.5;
    ctx.shadowColor = isLight ? "rgba(5, 150, 105, 0.15)" : "rgba(16, 185, 129, 0.4)";
    ctx.shadowBlur = isLight ? 4 : 8;
    ctx.beginPath();

    const minLog = Math.log10(20);
    const maxLog = Math.log10(20000);

    for (let x = 0; x < width; x++) {
      // Calculate frequency at this pixel (logarithmic scale)
      const pct = x / width;
      const logFreq = minLog + pct * (maxLog - minLog);
      const freq = Math.pow(10, logFreq);

      // Sum response of all filters at this frequency
      let totalGainDb = 0;

      for (const band of eqBands) {
        // Simple mathematical approximations of standard filter curves:
        const f0 = band.frequency;
        const g = band.gain;
        const Q = band.Q;

        if (band.type === "lowshelf") {
          // Low shelf filter response approximation
          const normFreq = freq / f0;
          const H = g / (1 + Math.pow(normFreq, 2));
          totalGainDb += H;
        } else if (band.type === "highshelf") {
          // High shelf response
          const normFreq = f0 / freq;
          const H = g / (1 + Math.pow(normFreq, 2));
          totalGainDb += H;
        } else if (band.type === "peaking") {
          // Bell curve peaking filter
          const octaveBandwidth = 1 / Q;
          const normFreq = Math.log2(freq / f0);
          const exponent = -Math.pow(normFreq / (octaveBandwidth * 0.7), 2);
          const H = g * Math.exp(exponent);
          totalGainDb += H;
        }
      }

      // Convert summed dB back to pixels
      const y = height / 2 - (totalGainDb / 12) * (height / 2.2);
      
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.shadowBlur = 0; // reset
  }, [eqBands, eqEnabled]);

  return (
    <div className="bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-white/[0.06] rounded-xl p-4 shadow-sm dark:shadow-xl flex flex-col h-full transition-colors duration-150">
      {/* EQ Header controls */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/[0.06] pb-3 mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md">
            <Activity className="w-4 h-4" />
          </span>
          <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white tracking-tight">Parametric EQ</h3>
        </div>

        {/* EQ Bypass toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Bypass</span>
          <button
            onClick={() => onToggleEQ(!eqEnabled)}
            className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${eqEnabled ? "bg-emerald-500" : "bg-slate-200 dark:bg-[#0a0b0d]"}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${eqEnabled ? "translate-x-4" : "translate-x-0"}`} />
          </button>
        </div>
      </div>

      {/* Preset Profiles */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4 shrink-0">
        <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wide mr-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-emerald-500 dark:text-emerald-400" /> Presets:
        </span>
        {["Flat", "Warm Broadcast", "Vocal Air", "Podcast Clarity", "Bass Booster"].map((preset) => (
          <button
            key={preset}
            disabled={!eqEnabled}
            onClick={() => onApplyPreset(preset)}
            className={`px-2 py-0.5 text-xs font-semibold rounded transition border cursor-pointer ${
              activePreset === preset && eqEnabled
                ? "bg-emerald-500 text-slate-950 border-emerald-500 font-bold"
                : "bg-slate-100 dark:bg-[#0a0b0d] hover:bg-slate-250 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-slate-200 dark:border-white/5 disabled:opacity-30 disabled:pointer-events-none"
            }`}
          >
            {preset}
          </button>
        ))}
      </div>

      {/* Frequency Response Graph canvas container */}
      <div className="h-28 rounded-lg overflow-hidden border border-slate-200 dark:border-white/[0.05] relative mb-4 shrink-0 shadow-inner">
        <canvas
          ref={canvasRef}
          width={360}
          height={112}
          className="w-full h-full block"
        />
        {!eqEnabled && (
          <div className="absolute inset-0 bg-white/70 dark:bg-black/70 flex items-center justify-center backdrop-blur-[1px]">
            <span className="text-xs text-slate-600 dark:text-slate-500 uppercase tracking-widest font-mono font-bold border border-slate-200 dark:border-white/10 bg-slate-50/95 dark:bg-[#0a0b0d]/90 px-3 py-1.5 rounded-md shadow-sm">
              EQ BYPASSED
            </span>
          </div>
        )}
      </div>

      {/* Band Controllers */}
      <div className="flex-1 flex gap-3 overflow-y-auto pr-1 items-stretch min-h-0 select-none">
        {eqBands.map((band) => {
          // Label translation for bands
          let label = "Mid";
          if (band.type === "lowshelf") label = "Bass";
          else if (band.type === "highshelf") label = "Treble";
          else if (band.frequency < 1000) label = "Lo-Mid";
          else if (band.frequency > 3000) label = "Pres";

          return (
            <div
              key={band.id}
              className={`flex-1 flex flex-col items-center justify-between p-2 rounded-lg border text-center transition ${
                eqEnabled 
                  ? "bg-slate-50 dark:bg-[#13161c] border-slate-200 dark:border-white/[0.04]" 
                  : "bg-slate-50/50 dark:bg-[#13161c]/30 border-slate-150 dark:border-white/[0.02] opacity-45 pointer-events-none"
              }`}
            >
              <div className="w-full">
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 block">{label}</span>
                <span className="text-[8px] font-mono text-slate-500 block">
                  {band.frequency >= 1000 ? `${band.frequency / 1000}kHz` : `${band.frequency}Hz`}
                </span>
              </div>

              {/* Slider track container */}
              <div className="relative flex-1 flex items-center justify-center my-2 h-24">
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="0.5"
                  value={band.gain}
                  disabled={!eqEnabled}
                  onChange={(e) => onUpdateBand(band.id, { gain: parseFloat(e.target.value) })}
                  className="vertical-slider w-1 h-20 bg-slate-250 dark:bg-[#0a0b0d] rounded-lg appearance-none cursor-pointer accent-emerald-400"
                  style={{ writingMode: "bt-lr", WebkitAppearance: "slider-vertical" } as any}
                />
              </div>

              {/* Value readout */}
              <div>
                <span className={`text-[10px] font-bold font-mono block ${band.gain > 0 ? "text-emerald-600 dark:text-emerald-400" : band.gain < 0 ? "text-amber-500" : "text-slate-400"}`}>
                  {band.gain > 0 ? "+" : ""}{band.gain.toFixed(1)}
                  <span className="text-[8px] text-slate-500">dB</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
