/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Volume2, VolumeX, Sliders } from "lucide-react";
import { AudioTrack } from "../types";

interface MixerConsoleProps {
  tracks: AudioTrack[];
  masterVolume: number;
  onUpdateTrack: (trackId: string, updates: Partial<AudioTrack>) => void;
  onUpdateMasterVolume: (volume: number) => void;
  isPlaying: boolean;
  trackLevels: Record<string, number>; // Live volume levels (0 to 1) from Web Audio Analyser
}

export default function MixerConsole({
  tracks,
  masterVolume,
  onUpdateTrack,
  onUpdateMasterVolume,
  isPlaying,
  trackLevels
}: MixerConsoleProps) {
  
  // Renders a vertical peak meter LED bar
  const PeakMeter = ({ level }: { level: number }) => {
    const numSteps = 16;
    const activeSteps = Math.min(numSteps, Math.ceil(level * numSteps));
    
    return (
      <div className="w-2 bg-slate-200 dark:bg-[#0a0b0d] rounded-sm overflow-hidden flex flex-col justify-end gap-[1px] h-32 p-[1px] border border-slate-300 dark:border-white/5 shadow-inner">
        {Array.from({ length: numSteps }).map((_, index) => {
          const stepNum = numSteps - index; // count down from top
          const isActive = stepNum <= activeSteps;
          
          let ledColor = "bg-slate-300/30 dark:bg-emerald-500/10";
          if (isActive) {
            if (stepNum > 13) ledColor = "bg-red-500 shadow-[0_0_4px_#ef4444]";
            else if (stepNum > 10) ledColor = "bg-amber-500 shadow-[0_0_4px_#f59e0b]";
            else ledColor = "bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_4px_#34d399]";
          }
          
          return (
            <div
              key={index}
              className={`flex-1 rounded-sm transition-all duration-75 ${ledColor}`}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-white/[0.06] rounded-xl p-4 shadow-sm dark:shadow-xl flex flex-col h-full transition-colors duration-150">
      {/* Mixer Header */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/[0.06] pb-3 mb-4 shrink-0">
        <span className="p-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md">
          <Sliders className="w-4 h-4" />
        </span>
        <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white tracking-tight">Console Mixer</h3>
      </div>

      {/* Mixer Channels Grid */}
      <div className="flex-1 flex gap-4 overflow-x-auto select-none custom-scrollbar items-stretch pb-2">
        {tracks.map((track) => {
          const currentLevel = isPlaying ? (trackLevels[track.id] || 0) : 0;
          
          return (
            <div
              key={track.id}
              className="w-24 bg-slate-50 dark:bg-[#13161c] rounded-lg p-2.5 border border-slate-200 dark:border-white/[0.04] flex flex-col items-center justify-between gap-3 text-center transition group hover:border-slate-300 dark:hover:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-[#161920]"
            >
              {/* Channel Label Header */}
              <div className="w-full truncate">
                <span className={`text-[10px] font-bold tracking-wider uppercase ${
                  track.type === 'vocal' ? 'text-emerald-600 dark:text-emerald-400' : track.type === 'music' ? 'text-sky-600 dark:text-sky-400' : 'text-violet-600 dark:text-violet-400'
                }`}>
                  {track.name}
                </span>
                <p className="text-[8px] text-slate-500 tracking-tight">Channel</p>
              </div>

              {/* Panning Pot Knob */}
              <div className="flex flex-col items-center gap-1 w-full">
                <span className="text-[8px] text-slate-500 font-mono">PAN</span>
                <div className="relative flex items-center justify-center">
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.1"
                    value={track.pan}
                    onChange={(e) => onUpdateTrack(track.id, { pan: parseFloat(e.target.value) })}
                    className="w-14 h-1 bg-slate-200 dark:bg-[#0a0b0d] rounded appearance-none cursor-pointer accent-emerald-400"
                    title={`Panning: ${track.pan === 0 ? 'Center' : track.pan < 0 ? `Left ${Math.abs(track.pan * 100).toFixed(0)}%` : `Right ${(track.pan * 100).toFixed(0)}%`}`}
                  />
                  <div className="absolute -bottom-3 text-[7px] font-mono text-slate-500">
                    {track.pan === 0 ? "C" : track.pan < 0 ? `L${Math.abs(track.pan * 10).toFixed(0)}` : `R${(track.pan * 10).toFixed(0)}`}
                  </div>
                </div>
              </div>

              {/* Volume Meter & Fader Pair */}
              <div className="flex items-center gap-2 mt-2 h-34 justify-center w-full">
                {/* Visual Level indicator */}
                <PeakMeter level={currentLevel} />

                {/* Vertical Gain Slider */}
                <div className="relative h-32 flex items-center justify-center">
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.05"
                    value={track.volume}
                    onChange={(e) => onUpdateTrack(track.id, { volume: parseFloat(e.target.value) })}
                    className="vertical-slider w-1 h-28 bg-slate-200 dark:bg-[#0a0b0d] rounded-lg appearance-none cursor-pointer accent-emerald-400"
                    style={{ writingMode: "bt-lr", WebkitAppearance: "slider-vertical" } as any}
                  />
                </div>
              </div>

              {/* Fader Value display */}
              <span className="text-[9px] font-mono text-slate-600 dark:text-slate-400 font-bold tracking-tighter">
                {(track.volume * 100).toFixed(0)}%
              </span>

              {/* Quick Cut Keys Mute/Solo */}
              <div className="flex gap-1 w-full">
                <button
                  onClick={() => onUpdateTrack(track.id, { muted: !track.muted })}
                  className={`flex-1 py-1 text-[8px] rounded font-bold transition-all duration-150 border cursor-pointer ${
                    track.muted 
                      ? "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/35" 
                      : "bg-slate-100 dark:bg-[#0a0b0d] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:text-slate-700 hover:bg-slate-200 dark:hover:text-slate-300 dark:hover:bg-white/5"
                  }`}
                >
                  MUTE
                </button>
                <button
                  onClick={() => onUpdateTrack(track.id, { soloed: !track.soloed })}
                  className={`flex-1 py-1 text-[8px] rounded font-bold transition-all duration-150 border cursor-pointer ${
                    track.soloed 
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/35 font-extrabold" 
                      : "bg-slate-100 dark:bg-[#0a0b0d] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:text-slate-700 hover:bg-slate-200 dark:hover:text-slate-300 dark:hover:bg-white/5"
                  }`}
                >
                  SOLO
                </button>
              </div>
            </div>
          );
        })}

        {/* Master Divider separator line */}
        <div className="w-px bg-slate-200 dark:bg-white/[0.08] self-stretch my-2"></div>

        {/* MASTER CHANNEL STRIP */}
        <div className="w-24 bg-slate-50 dark:bg-[#13161c] border border-slate-200 dark:border-white/[0.06] shadow-sm dark:shadow-md rounded-lg p-2.5 flex flex-col items-center justify-between gap-3 text-center">
          <div className="w-full">
            <span className="text-[10px] font-extrabold tracking-wider text-rose-500 dark:text-rose-400 block uppercase font-display">
              MASTER
            </span>
            <p className="text-[8px] text-slate-500 tracking-tight">Main Stereo</p>
          </div>

          {/* Dummy Panning for master - locked middle */}
          <div className="flex flex-col items-center gap-1 w-full opacity-40">
            <span className="text-[8px] text-slate-500 font-mono">PAN</span>
            <div className="w-10 h-1 bg-slate-200 dark:bg-[#0a0b0d] rounded"></div>
            <span className="text-[7px] font-mono text-slate-500">C</span>
          </div>

          {/* Master volume meter and slider */}
          <div className="flex items-center gap-2 mt-2 h-34 justify-center w-full">
            {/* Master meter level averages playing channels */}
            <PeakMeter level={isPlaying ? (trackLevels["master"] || 0) : 0} />

            {/* Vertical slider */}
            <div className="relative h-32 flex items-center justify-center">
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.05"
                value={masterVolume}
                onChange={(e) => onUpdateMasterVolume(parseFloat(e.target.value))}
                className="vertical-slider w-1 h-28 bg-slate-200 dark:bg-[#0a0b0d] rounded-lg appearance-none cursor-pointer accent-rose-450"
                style={{ writingMode: "bt-lr", WebkitAppearance: "slider-vertical" } as any}
              />
            </div>
          </div>

          {/* Gain readout */}
          <span className="text-[10px] font-mono text-rose-600 dark:text-rose-400 font-bold tracking-tighter">
            {(masterVolume * 100).toFixed(0)}%
          </span>

          {/* Master Volume Icon indicator */}
          <div className="w-full flex justify-center py-1">
            {masterVolume === 0 ? (
              <VolumeX className="w-3.5 h-3.5 text-rose-550 dark:text-rose-450" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
