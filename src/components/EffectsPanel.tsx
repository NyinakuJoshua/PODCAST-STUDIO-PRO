/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Radio } from "lucide-react";
import { TrackEffects } from "../types";

interface EffectsPanelProps {
  effects: TrackEffects;
  onUpdateEffects: (updates: Partial<TrackEffects>) => void;
}

export default function EffectsPanel({
  effects,
  onUpdateEffects
}: EffectsPanelProps) {
  
  return (
    <div className="bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-white/[0.06] rounded-xl p-4 shadow-sm dark:shadow-xl flex flex-col h-full overflow-y-auto custom-scrollbar transition-colors duration-150">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/[0.06] pb-3 mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md">
            <Radio className="w-4 h-4" />
          </span>
          <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white tracking-tight">Vocal Effects & Dynamics</h3>
        </div>
      </div>

      {/* Effects Grid Section */}
      <div className="flex flex-col gap-4">
        {/* 1. STUDIO COMPRESSOR */}
        <div className="bg-slate-50 dark:bg-[#13161c] border border-slate-200 dark:border-white/[0.04] rounded-lg p-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/[0.04] pb-2 mb-2.5">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-tight">Studio Compressor</span>
              <span className="text-[8px] text-slate-500 uppercase tracking-wide">Dynamic Level Leveling</span>
            </div>
            {/* Toggle */}
            <button
              onClick={() => onUpdateEffects({ compressorEnabled: !effects.compressorEnabled })}
              className={`w-8 h-4.5 rounded-full p-0.5 transition-colors focus:outline-none cursor-pointer ${effects.compressorEnabled ? "bg-emerald-500" : "bg-slate-250 dark:bg-[#0a0b0d]"}`}
            >
              <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform ${effects.compressorEnabled ? "translate-x-3.5" : "translate-x-0"}`} />
            </button>
          </div>

          <div className={`flex flex-col gap-2.5 transition-opacity duration-150 ${effects.compressorEnabled ? "opacity-100" : "opacity-30 pointer-events-none"}`}>
            {/* Threshold slider */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-slate-500 dark:text-slate-400">Threshold</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{effects.compressorThreshold} dB</span>
              </div>
              <input
                type="range"
                min="-60"
                max="0"
                step="1"
                value={effects.compressorThreshold}
                onChange={(e) => onUpdateEffects({ compressorThreshold: parseInt(e.target.value) })}
                className="w-full h-1 bg-slate-200 dark:bg-[#0a0b0d] rounded appearance-none cursor-pointer accent-emerald-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Ratio slider */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-500 dark:text-slate-400">Ratio</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">{effects.compressorRatio}:1</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="0.5"
                  value={effects.compressorRatio}
                  onChange={(e) => onUpdateEffects({ compressorRatio: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-slate-200 dark:bg-[#0a0b0d] rounded appearance-none cursor-pointer accent-emerald-400"
                />
              </div>

              {/* Release slider */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-500 dark:text-slate-400">Release</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">{(effects.compressorRelease * 1000).toFixed(0)}ms</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.05"
                  value={effects.compressorRelease}
                  onChange={(e) => onUpdateEffects({ compressorRelease: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-slate-200 dark:bg-[#0a0b0d] rounded appearance-none cursor-pointer accent-emerald-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 2. BACKGROUND NOISE GATE */}
        <div className="bg-slate-50 dark:bg-[#13161c] border border-slate-200 dark:border-white/[0.04] rounded-lg p-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/[0.04] pb-2 mb-2.5">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-tight">Noise Gate</span>
              <span className="text-[8px] text-slate-500 uppercase tracking-wide">Background Hum Removal</span>
            </div>
            {/* Toggle */}
            <button
              onClick={() => onUpdateEffects({ gateEnabled: !effects.gateEnabled })}
              className={`w-8 h-4.5 rounded-full p-0.5 transition-colors focus:outline-none cursor-pointer ${effects.gateEnabled ? "bg-emerald-500" : "bg-slate-250 dark:bg-[#0a0b0d]"}`}
            >
              <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform ${effects.gateEnabled ? "translate-x-3.5" : "translate-x-0"}`} />
            </button>
          </div>

          <div className={`flex flex-col gap-2 transition-opacity duration-150 ${effects.gateEnabled ? "opacity-100" : "opacity-30 pointer-events-none"}`}>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-slate-500 dark:text-slate-400">Gate Threshold</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{effects.gateThreshold} dB</span>
              </div>
              <input
                type="range"
                min="-80"
                max="-20"
                step="1"
                value={effects.gateThreshold}
                onChange={(e) => onUpdateEffects({ gateThreshold: parseInt(e.target.value) })}
                className="w-full h-1 bg-slate-200 dark:bg-[#0a0b0d] rounded appearance-none cursor-pointer accent-emerald-400"
              />
            </div>
          </div>
        </div>

        {/* 3. PLATE REVERB */}
        <div className="bg-slate-50 dark:bg-[#13161c] border border-slate-200 dark:border-white/[0.04] rounded-lg p-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/[0.04] pb-2 mb-2.5">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-tight">Plate Reverb</span>
              <span className="text-[8px] text-slate-500 uppercase tracking-wide">Atmosphere & Space</span>
            </div>
            {/* Toggle */}
            <button
              onClick={() => onUpdateEffects({ reverbEnabled: !effects.reverbEnabled })}
              className={`w-8 h-4.5 rounded-full p-0.5 transition-colors focus:outline-none cursor-pointer ${effects.reverbEnabled ? "bg-emerald-500" : "bg-slate-250 dark:bg-[#0a0b0d]"}`}
            >
              <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform ${effects.reverbEnabled ? "translate-x-3.5" : "translate-x-0"}`} />
            </button>
          </div>

          <div className={`grid grid-cols-2 gap-3 transition-opacity duration-150 ${effects.reverbEnabled ? "opacity-100" : "opacity-30 pointer-events-none"}`}>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-slate-500 dark:text-slate-400">Room Size</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{(effects.reverbSize * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.95"
                step="0.05"
                value={effects.reverbSize}
                onChange={(e) => onUpdateEffects({ reverbSize: parseFloat(e.target.value) })}
                className="w-full h-1 bg-slate-200 dark:bg-[#0a0b0d] rounded appearance-none cursor-pointer accent-emerald-400"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-slate-500 dark:text-slate-400">Mix (Wet)</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{(effects.reverbMix * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={effects.reverbMix}
                onChange={(e) => onUpdateEffects({ reverbMix: parseFloat(e.target.value) })}
                className="w-full h-1 bg-slate-200 dark:bg-[#0a0b0d] rounded appearance-none cursor-pointer accent-emerald-400"
              />
            </div>
          </div>
        </div>

        {/* 4. ECHO DELAY */}
        <div className="bg-slate-50 dark:bg-[#13161c] border border-slate-200 dark:border-white/[0.04] rounded-lg p-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/[0.04] pb-2 mb-2.5">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-tight">Echo Delay</span>
              <span className="text-[8px] text-slate-500 uppercase tracking-wide">Stereo Ping-Pong Delay</span>
            </div>
            {/* Toggle */}
            <button
              onClick={() => onUpdateEffects({ delayEnabled: !effects.delayEnabled })}
              className={`w-8 h-4.5 rounded-full p-0.5 transition-colors focus:outline-none cursor-pointer ${effects.delayEnabled ? "bg-emerald-500" : "bg-slate-250 dark:bg-[#0a0b0d]"}`}
            >
              <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform ${effects.delayEnabled ? "translate-x-3.5" : "translate-x-0"}`} />
            </button>
          </div>

          <div className={`flex flex-col gap-2.5 transition-opacity duration-150 ${effects.delayEnabled ? "opacity-100" : "opacity-30 pointer-events-none"}`}>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-500 dark:text-slate-400">Time</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">{(effects.delayTime * 1000).toFixed(0)}ms</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={effects.delayTime}
                  onChange={(e) => onUpdateEffects({ delayTime: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-slate-200 dark:bg-[#0a0b0d] rounded appearance-none cursor-pointer accent-emerald-400"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-500 dark:text-slate-400">Feedback</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">{(effects.delayFeedback * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.95"
                  step="0.05"
                  value={effects.delayFeedback}
                  onChange={(e) => onUpdateEffects({ delayFeedback: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-slate-200 dark:bg-[#0a0b0d] rounded appearance-none cursor-pointer accent-emerald-400"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-slate-500 dark:text-slate-400">Delay Mix</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{(effects.delayMix * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={effects.delayMix}
                onChange={(e) => onUpdateEffects({ delayMix: parseFloat(e.target.value) })}
                className="w-full h-1 bg-slate-200 dark:bg-[#0a0b0d] rounded appearance-none cursor-pointer accent-emerald-400"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
