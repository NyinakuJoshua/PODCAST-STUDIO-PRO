/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Play, Plus, Volume2 } from "lucide-react";
import { generateDemoAudioBuffer } from "../utils/audio";

interface SoundboardProps {
  onAddSFXToTimeline: (name: string, type: "vocal" | "music" | "sfx", duration: number) => void;
  audioCtx: AudioContext | null;
}

export default function Soundboard({
  onAddSFXToTimeline,
  audioCtx
}: SoundboardProps) {

  // List of preloaded premium soundboard assets with updated Immersive theme border glow hints
  const sfxList: { name: string; type: "vocal" | "music" | "sfx"; duration: number; icon: string; desc: string; color: string }[] = [
    {
      name: "Intro Music Loop",
      type: "music",
      duration: 8,
      icon: "🎵",
      desc: "Upbeat synth-pop loop to establish podcast branding",
      color: "hover:border-sky-500/30 text-sky-650 dark:text-sky-400"
    },
    {
      name: "Episode Transition",
      type: "sfx",
      duration: 3,
      icon: "✨",
      desc: "Fast frequency sweep with chime release",
      color: "hover:border-emerald-500/30 text-emerald-650 dark:text-emerald-400"
    },
    {
      name: "Electronic Beat Drop",
      type: "music",
      duration: 6,
      icon: "🥁",
      desc: "Fast hi-hat and kick syncopation loop",
      color: "hover:border-purple-500/30 text-purple-650 dark:text-purple-400"
    },
    {
      name: "Voice Sweeper",
      type: "vocal",
      duration: 4,
      icon: "🗣️",
      desc: "Rhythmic vocoder synthesizer vowel drop",
      color: "hover:border-violet-500/30 text-violet-650 dark:text-violet-400"
    },
    {
      name: "Outro Chimes",
      type: "sfx",
      duration: 5,
      icon: "🔔",
      desc: "Descending bell ringers for credits rollout",
      color: "hover:border-rose-500/30 text-rose-650 dark:text-rose-400"
    }
  ];

  // Plays the SFX immediately in the browser via AudioContext for active previewing
  const handlePlaySFX = (name: string, type: "vocal" | "music" | "sfx", duration: number) => {
    if (!audioCtx) return;

    try {
      // Resume AudioContext if suspended
      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }

      // Synthesize sound on the fly
      const buffer = generateDemoAudioBuffer(audioCtx, type, duration);
      
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.4, audioCtx.currentTime); // keep volume comfortable
      
      source.connect(gain);
      gain.connect(audioCtx.destination);
      
      source.start();
    } catch (err) {
      console.error("Failed to play soundboard trigger:", err);
    }
  };

  return (
    <div className="bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-white/[0.06] rounded-xl p-4 shadow-sm dark:shadow-xl flex flex-col h-full overflow-hidden transition-colors duration-150">
      {/* Soundboard Header */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/[0.06] pb-3 mb-4 shrink-0">
        <span className="p-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md">
          <Volume2 className="w-4 h-4" />
        </span>
        <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white tracking-tight">Soundboard & Drops</h3>
      </div>

      {/* Grid of drop pads */}
      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 custom-scrollbar">
        {sfxList.map((sfx, i) => (
          <div
            key={i}
            className={`p-3 rounded-lg border border-slate-200 dark:border-white/[0.04] bg-slate-50 dark:bg-[#13161c] flex items-center justify-between gap-3 transition-all duration-150 group ${sfx.color}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              {/* Icon badge */}
              <span className="text-xl shrink-0 filter drop-shadow select-none">{sfx.icon}</span>
              
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-800 dark:text-white truncate">{sfx.name}</span>
                <span className="text-[9px] text-slate-500 dark:text-slate-400 leading-snug truncate mt-0.5">{sfx.desc}</span>
                <span className="text-[8px] font-mono text-slate-400 dark:text-slate-500 uppercase mt-0.5 tracking-wider font-semibold">
                  {sfx.duration}s • {sfx.type} Channel
                </span>
              </div>
            </div>

            {/* Quick Action triggers */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => handlePlaySFX(sfx.name, sfx.type, sfx.duration)}
                className="p-1.5 bg-slate-100 dark:bg-[#0a0b0d] hover:bg-emerald-500 hover:text-slate-950 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-250 dark:border-white/5 hover:border-emerald-500 transition-all flex items-center justify-center cursor-pointer shadow-md"
                title="Preview sound drop"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
              </button>
              <button
                onClick={() => onAddSFXToTimeline(sfx.name, sfx.type, sfx.duration)}
                className="p-1.5 bg-slate-100 dark:bg-[#0a0b0d] hover:bg-sky-500 hover:text-slate-950 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-250 dark:border-white/5 hover:border-sky-500 transition-all flex items-center justify-center cursor-pointer shadow-md"
                title="Insert onto timeline playhead"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
