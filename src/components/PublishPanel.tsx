/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { CheckCircle, Rss, ShieldCheck, RefreshCw, Radio, Copy, Check, Podcast, Headphones, ArrowUpRight } from "lucide-react";

interface PublishPanelProps {
  initialTitle: string;
  initialDescription: string;
  coverArtUrl: string;
  audioDuration: number;
  onExportWav: () => void;
  onExportFormat: (format: 'wav' | 'mp3' | 'm4a' | 'ogg' | 'flac') => void;
  isExporting: boolean;
}

export default function PublishPanel({
  initialTitle,
  initialDescription,
  coverArtUrl,
  audioDuration,
  onExportWav,
  onExportFormat,
  isExporting
}: PublishPanelProps) {
  const [title, setTitle] = useState(initialTitle || "");
  const [description, setDescription] = useState(initialDescription || "");
  const [hostName, setHostName] = useState("Joshua Nyinaku");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStep, setPublishStep] = useState(0);
  const [isPublished, setIsPublished] = useState(false);
  const [copiedFeed, setCopiedFeed] = useState(false);
  const [exportFormat, setExportFormat] = useState<'wav' | 'mp3' | 'm4a' | 'ogg' | 'flac'>('mp3');

  // Sync title and description with parents when AI fills them
  useEffect(() => {
    if (initialTitle) setTitle(initialTitle);
    if (initialDescription) setDescription(initialDescription);
  }, [initialTitle, initialDescription]);

  const steps = [
    "Mixing down timeline and compressing audio...",
    "Transcoding master file to 192kbps stereo AAC...",
    "Generating XML RSS podcast payload...",
    "Submitting feed endpoints to distribution hubs...",
    "Validating index directories and metadata bounds..."
  ];

  const handlePublish = () => {
    if (!title.trim()) {
      alert("Please enter an episode title before publishing.");
      return;
    }
    setIsPublishing(true);
    setPublishStep(0);
  };

  // Simulates the upload progress sequence
  useEffect(() => {
    if (!isPublishing) return;

    if (publishStep < steps.length) {
      const timer = setTimeout(() => {
        setPublishStep(prev => prev + 1);
      }, 1600); // 1.6 seconds per step looks realistic and dramatic
      return () => clearTimeout(timer);
    } else {
      setIsPublishing(false);
      setIsPublished(true);
    }
  }, [isPublishing, publishStep]);

  const handleCopyFeed = () => {
    navigator.clipboard.writeText(`https://rss.podcaststudiopro.com/feed/${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.xml`);
    setCopiedFeed(true);
    setTimeout(() => setCopiedFeed(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-white/[0.06] rounded-xl p-4 shadow-sm dark:shadow-xl flex flex-col h-full overflow-y-auto custom-scrollbar transition-colors duration-150">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/[0.06] pb-3 mb-4 shrink-0">
        <span className="p-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md">
          <Podcast className="w-4 h-4" />
        </span>
        <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white tracking-tight">Export & Distribution</h3>
      </div>

      {/* Main publishing flow control states */}
      {!isPublishing && !isPublished ? (
        <div className="flex flex-col gap-4">
          
          {/* Cover Art and metadata overview row */}
          <div className="flex gap-4 p-3 bg-slate-50 dark:bg-[#13161c] border border-slate-200 dark:border-white/[0.04] rounded-xl items-center">
            <div className="w-20 h-20 bg-slate-100 dark:bg-[#0a0b0d] rounded-lg overflow-hidden border border-slate-200 dark:border-white/10 shrink-0 shadow-md">
              {coverArtUrl ? (
                <img src={coverArtUrl} alt="Cover Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#090d16] to-[#1e112c]" />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold">Metadata Binding</span>
              <span className="text-xs font-bold text-slate-800 dark:text-white truncate mt-1 font-display">{title || "Untitled Episode"}</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">Hosted by: {hostName}</span>
              <span className="text-[10px] text-slate-500 font-mono mt-0.5">Duration: {Math.floor(audioDuration / 60)}:{(Math.floor(audioDuration) % 60).toString().padStart(2, "0")}s</span>
            </div>
          </div>

          {/* Publishing details form */}
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wide">Episode Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter catchy headline title"
                className="w-full bg-slate-100 dark:bg-[#0a0b0d] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500/50 font-sans shadow-inner placeholder:text-slate-400 dark:placeholder:text-slate-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wide">Main Host</label>
                <input
                  type="text"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder="Host name"
                  className="w-full bg-slate-100 dark:bg-[#0a0b0d] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500/50 font-sans shadow-inner placeholder:text-slate-400 dark:placeholder:text-slate-700"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wide">Audio Bitrate</label>
                <select className="w-full bg-slate-100 dark:bg-[#0a0b0d] border border-slate-250 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:border-emerald-500/50 focus:outline-none cursor-pointer">
                  <option>192 kbps (Standard)</option>
                  <option>256 kbps (High Quality)</option>
                  <option>320 kbps (Broadcast Master)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wide">Episode Show Notes / Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Write markdown or structured notes details for podcatchers"
                rows={4}
                className="w-full bg-slate-100 dark:bg-[#0a0b0d] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500/50 font-sans shadow-inner resize-none placeholder:text-slate-400 dark:placeholder:text-slate-700 custom-scrollbar"
              />
            </div>
          </div>

          {/* Action launcher buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="col-span-2 flex flex-col gap-1.5 bg-slate-50 dark:bg-black/15 p-3 rounded-lg border border-slate-200 dark:border-white/[0.04] mb-1">
              <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wide">Export Audio Format (Save As)</label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as any)}
                className="w-full bg-slate-100 dark:bg-[#0a0b0d] border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500/50 cursor-pointer font-sans"
              >
                <option value="mp3">MP3 Audio (*.mp3) - Highly Compatible</option>
                <option value="wav">WAVE Audio (*.wav) - Lossless Master Quality</option>
                <option value="m4a">M4A Audio (*.m4a) - High-Fidelity AAC</option>
                <option value="ogg">OGG Vorbis (*.ogg) - Web Standard</option>
                <option value="flac">FLAC Audio (*.flac) - Free Lossless</option>
              </select>
            </div>

            <button
              onClick={() => onExportFormat(exportFormat)}
              disabled={isExporting}
              className="py-2.5 bg-slate-100 dark:bg-[#0a0b0d] hover:bg-slate-200 dark:hover:bg-white/5 disabled:bg-[#0a0b0d]/20 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white disabled:text-slate-400 border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/15 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
            >
              {isExporting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Rendering...
                </>
              ) : (
                <>
                  <Headphones className="w-3.5 h-3.5" /> Download .{exportFormat.toUpperCase()} Master
                </>
              )}
            </button>

            <button
              onClick={handlePublish}
              className="py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer shadow-lg hover:shadow-emerald-500/10"
            >
              <Rss className="w-3.5 h-3.5" /> Distribute Episode
            </button>
          </div>

        </div>
      ) : isPublishing ? (
        /* PUBLISHING PROGRESS OVERLAY TIMER SCREEN */
        <div className="flex-1 flex flex-col items-center justify-center py-8 text-center gap-5 select-none animate-fadeIn">
          {/* Animated radar spinner */}
          <div className="relative w-16 h-16 flex items-center justify-center">
            <span className="absolute w-full h-full border-4 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin"></span>
            <span className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full">
              <Radio className="w-6 h-6 animate-pulse" />
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 uppercase tracking-widest font-extrabold">Active Deployment</span>
            <h4 className="text-sm font-bold text-slate-800 dark:text-white font-display">Pushing to Global Directories</h4>
          </div>

          {/* Progress sequence tracker */}
          <div className="w-full max-w-xs flex flex-col gap-2.5 mt-2 text-left">
            {steps.map((st, idx) => {
              const isCurrent = idx === publishStep;
              const isDone = idx < publishStep;
              
              return (
                <div key={idx} className={`flex items-start gap-2 text-[10px] font-mono leading-relaxed transition-all duration-300 ${isCurrent ? 'text-emerald-650 dark:text-emerald-400 scale-[1.02] font-semibold' : isDone ? 'text-slate-400 dark:text-slate-550' : 'text-slate-350 dark:text-slate-700'}`}>
                  {isDone ? (
                    <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                  ) : isCurrent ? (
                    <RefreshCw className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5 animate-spin" />
                  ) : (
                    <div className="w-3 h-3 border border-slate-200 dark:border-white/10 rounded-full shrink-0 mt-0.5"></div>
                  )}
                  <span className="truncate">{st}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* SUCCESS CONCLUDED EMBED PANEL */
        <div className="flex flex-col gap-4 text-xs animate-fadeIn">
          
          <div className="flex flex-col items-center justify-center text-center p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl gap-2.5">
            <span className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-500/25">
              <ShieldCheck className="w-8 h-8" />
            </span>
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 uppercase tracking-widest font-extrabold">EPISODE LIVE</span>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 font-display">Successfully Broadcasted!</h4>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed text-center">
              Your podcast XML feed is compiled and successfully syndicated across global catchers.
            </p>
          </div>

          {/* Directory Status List */}
          <div className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-[#13161c] border border-slate-200 dark:border-white/[0.04] rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Directory Feeds Status</span>
            
            <div className="grid grid-cols-2 gap-2 mt-1">
              {[
                { name: "Spotify for Podcasters", desc: "Active & Syndicated" },
                { name: "Apple Podcasts Directory", desc: "Index Registered" },
                { name: "Amazon Music Core", desc: "Feeds Matching" },
                { name: "Google Indexer Hub", desc: "Pings Dispatched" }
              ].map((dir, i) => (
                <div key={i} className="p-2 bg-slate-100 dark:bg-[#0a0b0d] border border-slate-200 dark:border-white/[0.04] rounded-lg flex flex-col gap-0.5">
                  <span className="font-bold text-[10px] text-slate-800 dark:text-slate-200 truncate">{dir.name}</span>
                  <span className="text-[8px] text-emerald-600 dark:text-emerald-400 font-mono font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {dir.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* RSS feed url bar */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wide">Syndicated RSS Feed URL</span>
            <div className="flex gap-2">
              <div className="flex-1 bg-slate-100 dark:bg-[#0a0b0d] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 font-mono text-[9px] text-slate-500 dark:text-slate-400 truncate flex items-center">
                https://rss.podcaststudiopro.com/feed/{title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.xml
              </div>
              <button
                onClick={handleCopyFeed}
                className="p-1.5 bg-slate-100 dark:bg-[#0a0b0d] hover:bg-slate-200 dark:hover:bg-[#13161c] text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-white/10 flex items-center justify-center cursor-pointer transition"
                title="Copy XML RSS Link"
              >
                {copiedFeed ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Embedded audio player mock */}
          <div className="p-3.5 bg-slate-50 dark:bg-[#0a0b0d] border border-slate-200 dark:border-white/[0.04] rounded-xl flex items-center gap-3.5 mt-1 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-1.5 text-slate-400 hover:text-emerald-500 dark:text-slate-700 dark:hover:text-emerald-400 transition cursor-pointer">
              <ArrowUpRight className="w-4 h-4" />
            </div>
            
            <div className="w-14 h-14 bg-white dark:bg-[#13161c] rounded border border-slate-200 dark:border-white/10 shrink-0 shadow overflow-hidden relative">
              {coverArtUrl ? (
                <img src={coverArtUrl} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#090d16] to-[#1e112c]" />
              )}
            </div>

            <div className="flex-1 min-h-0 flex flex-col gap-1">
              <span className="text-[8px] font-mono text-emerald-600 dark:text-emerald-400 uppercase tracking-widest font-extrabold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> PLAYER EMBED
              </span>
              <span className="font-bold text-slate-800 dark:text-white truncate text-xs leading-none font-display">{title}</span>
              <span className="text-[10px] text-slate-550 dark:text-slate-400 truncate">Episode 1 • Joshua Nyinaku</span>
              
              {/* Fake player timeline progress */}
              <div className="w-full bg-slate-200 dark:bg-[#13161c] h-1 rounded-full overflow-hidden mt-1.5 flex">
                <div className="bg-emerald-400 h-full w-[40%] rounded-full shadow-[0_0_4px_#34d399]"></div>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setIsPublished(false);
              setTitle("");
              setDescription("");
            }}
            className="w-full py-2 border border-dashed border-slate-300 dark:border-white/10 hover:border-slate-400 dark:hover:border-white/15 bg-slate-50 dark:bg-[#0a0b0d] text-slate-550 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-bold text-xs rounded-lg transition text-center cursor-pointer mt-2"
          >
            Create Another Episode
          </button>

        </div>
      )}
    </div>
  );
}
