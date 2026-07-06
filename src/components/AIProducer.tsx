/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Sparkles, Languages, FileText, Image, Play, Scissors, RefreshCw, CheckCircle, Volume2, AlertCircle } from "lucide-react";
import { Project, AudioClip, TranscriptSegment, AIResponse } from "../types";
import { audioBufferToWav } from "../utils/audio";

interface AIProducerProps {
  project: Project;
  currentTime: number;
  onSeek: (time: number) => void;
  onUpdateCoverArt: (url: string) => void;
  coverArtUrl: string;
  onApplyEffectsPreset: (eqBands: any[], compressor: any, gate: any) => void;
  onRemoveTimeRange: (start: number, end: number) => void;
  vocalTrackClip: AudioClip | null;
}

export default function AIProducer({
  project,
  currentTime,
  onSeek,
  onUpdateCoverArt,
  coverArtUrl,
  onApplyEffectsPreset,
  onRemoveTimeRange,
  vocalTrackClip
}: AIProducerProps) {
  const [activeTab, setActiveTab] = useState<'transcribe' | 'cover' | 'enhance'>('transcribe');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState<AIResponse | null>(null);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);

  // Cover Art Generator State
  const [coverPrompt, setCoverPrompt] = useState("");
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);

  // AI Voice Enhance Advisor State
  const [vocalProfile, setVocalProfile] = useState("Warm Broadcast");
  const [isEnhancingAdvice, setIsEnhancingAdvice] = useState(false);
  const [adviceResult, setAdviceResult] = useState<any | null>(null);

  // Helper to read file as base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(",")[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Trigger Gemini speech-to-text transcription and show notes
  const handleAITranscribe = async () => {
    setIsTranscribing(true);
    setTranscribeError(null);
    try {
      let audioData = null;
      let mimeType = null;

      // If there is an active vocal recording, encode it to WAV and send it to the server
      if (vocalTrackClip && vocalTrackClip.audioBuffer) {
        const wavBlob = audioBufferToWav(vocalTrackClip.audioBuffer);
        audioData = await blobToBase64(wavBlob);
        mimeType = "audio/wav";
      }

      const res = await fetch("/api/ai/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioData,
          mimeType,
          projectName: project.name,
          durationSeconds: 30 // Mix limit
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Server failed to transcribe audio.");
      }

      setTranscriptionResult(data);
    } catch (err: any) {
      console.error(err);
      setTranscribeError(err.message || "Failed to process transcription.");
    } finally {
      setIsTranscribing(false);
    }
  };

  // Cuts any identified verbal filler word directly out of the timeline
  const handleRemoveFillerWord = (segment: TranscriptSegment) => {
    onRemoveTimeRange(segment.start, segment.end);
    
    // Visually remove from current local transcript state to update UI
    if (transcriptionResult) {
      setTranscriptionResult({
        ...transcriptionResult,
        transcript: transcriptionResult.transcript.filter(s => s.start !== segment.start)
      });
    }
  };

  // Cuts ALL filler words from the timeline with a single click
  const handleAutoCleanAllFillers = () => {
    if (!transcriptionResult) return;
    
    const fillers = transcriptionResult.transcript.filter(s => s.isFiller);
    if (fillers.length === 0) return;

    // Apply cuts in reverse order (back-to-front) to prevent shifting subsequent cut offsets!
    const sortedFillers = [...fillers].sort((a, b) => b.start - a.start);
    
    sortedFillers.forEach(filler => {
      onRemoveTimeRange(filler.start, filler.end);
    });

    // Filter local state
    setTranscriptionResult({
      ...transcriptionResult,
      transcript: transcriptionResult.transcript.filter(s => !s.isFiller)
    });
    
    alert(`Successfully removed ${fillers.length} filler word segments from your podcast tracks!`);
  };

  // Trigger Cover Art Generation via Gemini Image
  const handleGenerateCover = async () => {
    if (!coverPrompt.trim()) return;
    setIsGeneratingCover(true);
    setCoverError(null);
    try {
      const res = await fetch("/api/ai/generate-cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: coverPrompt })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate image.");
      }

      if (data.base64) {
        onUpdateCoverArt(`data:image/png;base64,${data.base64}`);
      }
    } catch (err: any) {
      console.error(err);
      setCoverError(err.message || "Failed to generate. Using high-end artistic procedural fallback cover.");
      
      // Fallback: draw a beautiful styled procedural thumbnail
      generateProceduralFallbackCover(coverPrompt);
    } finally {
      setIsGeneratingCover(false);
    }
  };

  // Fallback visual designer
  const generateProceduralFallbackCover = (topic: string) => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background gradient based on topic string
    const index = topic.length % 5;
    const gradients = [
      ["#0a0b0d", "#1e1b4b"],
      ["#0a0b0d", "#4c0519"],
      ["#0a0b0d", "#064e3b"],
      ["#0a0b0d", "#1e293b"],
      ["#0a0b0d", "#311042"]
    ];
    const grad = ctx.createLinearGradient(0, 0, 400, 400);
    grad.addColorStop(0, gradients[index][0]);
    grad.addColorStop(1, gradients[index][1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 400, 400);

    // Dynamic graphic lines
    ctx.strokeStyle = "rgba(16, 185, 129, 0.25)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.arc(200, 200, 40 + i * 35, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Centered Microphone Emblem Glow
    ctx.fillStyle = "rgba(16, 185, 129, 0.1)";
    ctx.beginPath();
    ctx.arc(200, 160, 45, 0, Math.PI * 2);
    ctx.fill();

    // Draw stylized title letters
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 4;
    
    // Split topic into multiple lines
    const words = topic.toUpperCase().split(" ").slice(0, 4);
    words.forEach((word, idx) => {
      ctx.fillText(word, 200, 260 + idx * 30);
    });

    onUpdateCoverArt(canvas.toDataURL());
  };

  // Get professional AI advisor mixing recommendations
  const handleGetMixingAdvice = async () => {
    setIsEnhancingAdvice(true);
    setAdviceResult(null);
    try {
      const res = await fetch("/api/ai/enhance-advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileName: vocalProfile,
          currentSettings: {}
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to retrieve AI advice.");
      }

      setAdviceResult(data);
    } catch (err) {
      console.error(err);
      alert("Could not load AI mixing advice. Please check your Gemini connection.");
    } finally {
      setIsEnhancingAdvice(false);
    }
  };

  // Apply advice EQ & Compressor variables directly into the actual project DAW engine
  const handleApplyAIEffects = () => {
    if (!adviceResult) return;
    onApplyEffectsPreset(
      adviceResult.eqBands,
      adviceResult.compressor,
      adviceResult.gate
    );
    alert("AI advice presets have been mapped directly into your Vocal channel!");
  };

  return (
    <div className="bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-white/[0.06] rounded-xl p-4 shadow-sm dark:shadow-xl flex flex-col h-full overflow-hidden transition-colors duration-150">
      {/* AI Header tabs */}
      <div className="flex border-b border-slate-200 dark:border-white/[0.06] pb-2 mb-4 shrink-0 gap-1 overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setActiveTab('transcribe')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition border cursor-pointer ${
            activeTab === 'transcribe'
              ? "bg-emerald-500/10 text-emerald-650 dark:text-emerald-400 border-emerald-500/20"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-450 dark:hover:text-slate-200 border-transparent hover:bg-slate-50 dark:hover:bg-white/5"
          }`}
        >
          <Languages className="w-3.5 h-3.5" /> AI Production Suite
        </button>
        <button
          onClick={() => setActiveTab('cover')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition border cursor-pointer ${
            activeTab === 'cover'
              ? "bg-emerald-500/10 text-emerald-650 dark:text-emerald-400 border-emerald-500/20"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-450 dark:hover:text-slate-200 border-transparent hover:bg-slate-50 dark:hover:bg-white/5"
          }`}
        >
          <Image className="w-3.5 h-3.5" /> Cover Generator
        </button>
        <button
          onClick={() => setActiveTab('enhance')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition border cursor-pointer ${
            activeTab === 'enhance'
              ? "bg-emerald-500/10 text-emerald-650 dark:text-emerald-400 border-emerald-500/20"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-450 dark:hover:text-slate-200 border-transparent hover:bg-slate-50 dark:hover:bg-white/5"
          }`}
        >
          <Volume2 className="w-3.5 h-3.5" /> Vocal Enhancer
        </button>
      </div>

      {/* Main Tab Views Scroll Body */}
      <div className="flex-1 overflow-y-auto pr-1 min-h-0">
        
        {/* TAB 1: SPEECH TO TEXT & SHOW NOTES */}
        {activeTab === 'transcribe' && (
          <div className="flex flex-col gap-4">
            
            {/* Action launcher card */}
            <div className="bg-slate-50 dark:bg-[#13161c] border border-slate-200 dark:border-white/[0.04] rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <span className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4" />
                </span>
                <div className="flex flex-col gap-1">
                  <h4 className="font-display font-semibold text-xs text-slate-800 dark:text-white">AI Multimodal Production Engine</h4>
                  <p className="text-[11px] text-slate-550 dark:text-slate-400 leading-relaxed">
                    {vocalTrackClip 
                      ? "Your recorded vocal track will be securely sent to Gemini to generate high-fidelity speech-to-text transcripts, bullet summaries, dynamic chapter marks, and show notes."
                      : "No vocal recording detected on timeline. You can still click Transcribe to generate a beautifully structured, highly realistic demo project to experience our editor's features!"}
                  </p>
                </div>
              </div>

              {transcribeError && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-650 dark:text-red-400 text-xs p-2.5 rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{transcribeError}</span>
                </div>
              )}

              <button
                onClick={handleAITranscribe}
                disabled={isTranscribing}
                className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 text-slate-950 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 shadow transition-all duration-155 cursor-pointer"
              >
                {isTranscribing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Analyzing Recording & Compiling Notes...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" /> {vocalTrackClip ? "Transcribe My Recording" : "Generate Demo Project"}
                  </>
                )}
              </button>
            </div>

            {/* AI Results Output */}
            {transcriptionResult && (
              <div className="flex flex-col gap-4 animate-fadeIn">
                
                {/* Transcript Box with Filler word cuts */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/[0.06] pb-1.5">
                    <span className="text-xs font-semibold text-slate-800 dark:text-white flex items-center gap-1">
                      <Languages className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Interactive Transcript
                    </span>
                    
                    {transcriptionResult.transcript.some(s => s.isFiller) && (
                      <button
                        onClick={handleAutoCleanAllFillers}
                        className="text-[10px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <Scissors className="w-3 h-3" /> Auto-Cut Um/Uh's
                      </button>
                    )}
                  </div>

                  <div className="bg-slate-100/50 dark:bg-[#0a0b0d] border border-slate-200 dark:border-white/[0.04] rounded-lg p-3 max-h-56 overflow-y-auto flex flex-col gap-3 custom-scrollbar text-xs">
                    {transcriptionResult.transcript.map((seg, i) => (
                      <div
                        key={i}
                        className={`group p-2 rounded transition border border-transparent ${
                          currentTime >= seg.start && currentTime <= seg.end 
                            ? "bg-emerald-500/5 dark:bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-medium" 
                            : "hover:bg-slate-200/50 dark:hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-[10px] text-emerald-600 dark:text-emerald-400">{seg.speaker}</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => onSeek(seg.start)}
                              className="font-mono text-[9px] text-slate-500 dark:text-slate-450 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-0.5 cursor-pointer"
                              title="Jump playhead to this section"
                            >
                              <Play className="w-2.5 h-2.5 fill-current" /> {Math.floor(seg.start / 60)}:{(Math.floor(seg.start) % 60).toString().padStart(2, "0")}
                            </button>
                            {seg.isFiller && (
                              <button
                                onClick={() => handleRemoveFillerWord(seg)}
                                className="px-1.5 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-red-500 hover:text-white rounded text-[8px] font-extrabold transition flex items-center gap-0.5 cursor-pointer"
                                title="Click to cut this filler word from audio timeline"
                              >
                                <Scissors className="w-2 h-2" /> Cut word
                              </button>
                            )}
                          </div>
                        </div>
                        <p className={`leading-relaxed ${seg.isFiller ? "text-amber-700 dark:text-amber-400/80 bg-amber-500/5 px-1 py-0.5 rounded border border-dashed border-amber-500/20 font-bold" : "text-slate-650 dark:text-slate-300"}`}>
                          {seg.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Show Notes Metadata block */}
                <div className="bg-slate-50 dark:bg-[#13161c]/40 border border-slate-200 dark:border-white/[0.04] rounded-lg p-3.5 flex flex-col gap-3">
                  <span className="text-xs font-semibold text-slate-800 dark:text-white border-b border-slate-200 dark:border-white/[0.04] pb-1.5 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" /> Compiled Episode Show Notes
                  </span>

                  <div>
                    <h5 className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">SEO Title</h5>
                    <p className="text-xs text-slate-800 dark:text-slate-200 font-bold leading-snug mt-0.5">{transcriptionResult.showNotes.title}</p>
                  </div>

                  <div>
                    <h5 className="text-[10px] text-slate-550 uppercase font-bold tracking-wide">Overview Summary</h5>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mt-1">{transcriptionResult.showNotes.description}</p>
                  </div>

                  {/* Chapters timestamp list */}
                  <div>
                    <h5 className="text-[10px] text-slate-550 uppercase font-bold tracking-wide mb-1.5">Chapter Markers</h5>
                    <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                      {transcriptionResult.showNotes.chapters.map((chap, i) => {
                        // Parse MM:SS to seconds
                        const parts = chap.timestamp.split(":");
                        const sec = parseInt(parts[0]) * 60 + parseInt(parts[1]);
                        return (
                          <div
                            key={i}
                            onClick={() => onSeek(sec)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200/60 dark:bg-[#0a0b0d] dark:hover:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 rounded flex items-start gap-2 cursor-pointer transition"
                          >
                            <span className="font-mono text-[9px] bg-slate-200 dark:bg-[#13161c] text-sky-600 dark:text-sky-400 border border-sky-500/10 px-1.5 py-0.5 rounded shrink-0">
                              {chap.timestamp}
                            </span>
                            <div className="flex flex-col">
                              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">{chap.title}</span>
                              <span className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">{chap.description}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Takeaways */}
                  <div>
                    <h5 className="text-[10px] text-slate-550 uppercase font-bold tracking-wide mb-1">Key Takeaways</h5>
                    <ul className="list-disc list-inside text-xs text-slate-650 dark:text-slate-300 leading-relaxed flex flex-col gap-1">
                      {transcriptionResult.showNotes.bulletPoints.map((pt, i) => (
                        <li key={i} className="pl-1 text-[11px]">{pt}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Keywords tags */}
                  <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-slate-200 dark:border-white/5">
                    {transcriptionResult.showNotes.keywords.map((word, i) => (
                      <span key={i} className="text-[8px] uppercase tracking-wide bg-slate-200 dark:bg-[#0a0b0d] text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-white/5 px-1.5 py-0.5 rounded font-bold">
                        #{word}
                      </span>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* TAB 2: COVER ART GENERATOR */}
        {activeTab === 'cover' && (
          <div className="flex flex-col gap-4">
            <div className="bg-slate-50 dark:bg-[#13161c] border border-slate-200 dark:border-white/[0.04] rounded-xl p-4 flex flex-col gap-3">
              <span className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg w-fit">
                <Image className="w-4 h-4" />
              </span>
              <div className="flex flex-col">
                <h4 className="font-display font-semibold text-xs text-slate-800 dark:text-white">Generate Visual Branding</h4>
                <p className="text-[11px] text-slate-550 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Enter an episode prompt or theme details, and our generative design suite will construct custom 1:1 square cover art ready to bind to your RSS feeds.
                </p>
              </div>

              <div className="flex flex-col gap-1.5 mt-1">
                <input
                  type="text"
                  placeholder="e.g. Minimalist neon geometric layout with audio waves"
                  value={coverPrompt}
                  onChange={(e) => setCoverPrompt(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-[#0a0b0d] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500/50 font-sans shadow-inner placeholder:text-slate-400 dark:placeholder:text-slate-600"
                />
              </div>

              {coverError && (
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs p-2.5 rounded-lg">
                  <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                  <span>{coverError}</span>
                </div>
              )}

              <button
                onClick={handleGenerateCover}
                disabled={isGeneratingCover || !coverPrompt.trim()}
                className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-100 dark:disabled:bg-white/5 disabled:text-slate-400 dark:disabled:text-slate-600 text-slate-950 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow"
              >
                {isGeneratingCover ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Painting Dynamic Art...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" /> Generate Cover Artwork
                  </>
                )}
              </button>
            </div>

            {/* Display active Cover Art frame */}
            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-[#0a0b0d] border border-slate-200 dark:border-white/[0.04] rounded-xl gap-2 shadow-inner">
              <div className="w-44 h-44 rounded-lg overflow-hidden border border-slate-200 dark:border-white/10 shadow-md dark:shadow-lg relative bg-white dark:bg-[#13161c] group">
                {coverArtUrl ? (
                  <img
                    src={coverArtUrl}
                    alt="Podcast Cover Art"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#090d16] to-[#1e112c]" />
                )}
              </div>
              <span className="text-[9px] font-mono text-slate-500 dark:text-slate-450 uppercase tracking-widest font-bold">Active Artwork Bound</span>
            </div>
          </div>
        )}

        {/* TAB 3: VOCAL ENHANCER MIX ADVISOR */}
        {activeTab === 'enhance' && (
          <div className="flex flex-col gap-4">
            <div className="bg-slate-50 dark:bg-[#13161c] border border-slate-200 dark:border-white/[0.04] rounded-xl p-4 flex flex-col gap-3">
              <span className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg w-fit">
                <Volume2 className="w-4 h-4" />
              </span>
              <div className="flex flex-col">
                <h4 className="font-display font-semibold text-xs text-slate-800 dark:text-white">AI Sound Engineer Assistant</h4>
                <p className="text-[11px] text-slate-550 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Select your targeted vocal delivery tone profile, and Gemini will generate precise custom parametric equalizer frequencies and compression thresholds to perfect your mix.
                </p>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <select
                  value={vocalProfile}
                  onChange={(e) => setVocalProfile(e.target.value)}
                  className="flex-1 bg-slate-100 dark:bg-[#0a0b0d] border border-slate-250 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-emerald-500/50 focus:outline-none"
                >
                  <option value="Warm Broadcast">Warm Broadcast (FM Radio)</option>
                  <option value="Vocal Air">Vocal Air (Crisp Crisp Detail)</option>
                  <option value="Dialogue Clarity">Dialogue Clarity (Podcast Intelligibility)</option>
                  <option value="De-noise & Level">Aggressive Leveler & Gate</option>
                </select>

                <button
                  onClick={handleGetMixingAdvice}
                  disabled={isEnhancingAdvice}
                  className="px-4 py-1.5 bg-slate-100 dark:bg-[#0a0b0d] hover:bg-slate-200 dark:hover:bg-white/5 border border-slate-250 dark:border-white/10 rounded-lg text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 cursor-pointer transition shadow-sm"
                >
                  {isEnhancingAdvice ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Consult"}
                </button>
              </div>
            </div>

            {/* Mixing Advice results */}
            {adviceResult && (
              <div className="bg-slate-50 dark:bg-[#13161c] border border-slate-200 dark:border-white/[0.04] rounded-lg p-3 flex flex-col gap-3 animate-fadeIn text-xs">
                <span className="text-xs font-semibold text-slate-800 dark:text-white border-b border-slate-200 dark:border-white/[0.04] pb-1.5 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Sound Engineer Advice Ready
                </span>

                <div className="flex flex-col gap-1 text-[11px]">
                  <span className="text-slate-500 dark:text-slate-455 uppercase font-bold">Pro Tip:</span>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-sans">{adviceResult.engineeringTip}</p>
                </div>

                {/* Grid details of mapping parameters */}
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-slate-100 dark:bg-[#0a0b0d] p-2.5 rounded-lg border border-slate-200 dark:border-white/[0.04]">
                  <div className="flex flex-col gap-1 border-r border-slate-200 dark:border-white/5 pr-2">
                    <span className="text-slate-500 dark:text-slate-450 font-bold uppercase text-[8px]">EQ Map:</span>
                    {adviceResult.eqBands.map((b: any, i: number) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">{b.frequency >= 1000 ? `${b.frequency / 1000}kHz` : `${b.frequency}Hz`}</span>
                        <span className="text-emerald-650 dark:text-emerald-400 font-bold">{b.gain > 0 ? "+" : ""}{b.gain}dB</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-1 pl-1">
                    <span className="text-slate-550 dark:text-slate-450 font-bold uppercase text-[8px]">Dynamics:</span>
                    <div className="flex justify-between">
                      <span className="text-slate-650 dark:text-slate-400">Thresh</span>
                      <span className="text-emerald-650 dark:text-emerald-400 font-bold">{adviceResult.compressor.threshold}dB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-650 dark:text-slate-400">Ratio</span>
                      <span className="text-emerald-650 dark:text-emerald-400 font-bold">{adviceResult.compressor.ratio}:1</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-650 dark:text-slate-400">Gate</span>
                      <span className="text-emerald-650 dark:text-emerald-400 font-bold">{adviceResult.gate.threshold}dB</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleApplyAIEffects}
                  className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg flex items-center justify-center gap-1 cursor-pointer transition shadow"
                >
                  Apply AI Mixing Preset
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
