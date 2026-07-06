/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from "react";
import { Mic, Upload, Scissors, Trash2, Volume2, Plus, Play, Pause, Square, ZoomIn, ZoomOut, Maximize, ArrowRight, Activity } from "lucide-react";
import { AudioTrack, AudioClip } from "../types";

interface TrackTimelineProps {
  tracks: AudioTrack[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  selectedClipId: string | null;
  onSelectClip: (clipId: string | null) => void;
  onUpdateTrack: (trackId: string, updates: Partial<AudioTrack>) => void;
  onUpdateClip: (trackId: string, clipId: string, updates: Partial<AudioClip>) => void;
  onAddClip: (trackId: string, clip: AudioClip) => void;
  onDeleteClip: (trackId: string, clipId: string) => void;
  onSplitClip: (trackId: string, clipId: string, splitTime: number) => void;
  onSeek: (time: number) => void;
  onStartRecord: (trackId: string) => void;
  onStopRecord: () => void;
  isRecording: boolean;
  recordingTrackId: string | null;
  audioCtx: AudioContext | null;
}

export default function TrackTimeline({
  tracks,
  currentTime,
  duration,
  isPlaying,
  selectedClipId,
  onSelectClip,
  onUpdateTrack,
  onUpdateClip,
  onAddClip,
  onDeleteClip,
  onSplitClip,
  onSeek,
  onStartRecord,
  onStopRecord,
  isRecording,
  recordingTrackId,
  audioCtx
}: TrackTimelineProps) {
  const [zoom, setZoom] = useState(15); // pixels per second
  const [activeTool, setActiveTool] = useState<'cursor' | 'cut' | 'trim' | 'fade'>('cursor');
  const [hoverCut, setHoverCut] = useState<{ clipId: string; x: number } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingToTrackId, setUploadingToTrackId] = useState<string | null>(null);

  // Auto-scroll timeline to keep playhead visible
  useEffect(() => {
    if (isPlaying && timelineRef.current) {
      const scrollPos = currentTime * zoom;
      const containerWidth = timelineRef.current.clientWidth;
      const scrollLeft = timelineRef.current.scrollLeft;
      
      if (scrollPos > scrollLeft + containerWidth - 100) {
        timelineRef.current.scrollLeft = scrollPos - 100;
      } else if (scrollPos < scrollLeft) {
        timelineRef.current.scrollLeft = scrollPos;
      }
    }
  }, [currentTime, isPlaying, zoom]);

  // Handle click on timeline to seek
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    
    // Check if user clicked a clip or the background timeline ruler
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left + timelineRef.current.scrollLeft;
    
    // Timeline track left offset (where audio starts, usually 200px for track controls)
    const audioStartX = 200;
    if (clickX >= audioStartX) {
      const time = (clickX - audioStartX) / zoom;
      onSeek(Math.max(0, Math.min(duration, time)));
    }
  };

  // Waveform Renderer Canvas Component
  const WaveformCanvas = ({ clip }: { clip: AudioClip }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      const buffer = clip.audioBuffer;
      if (!buffer) {
        // Draw elegant placeholder flat waveform
        ctx.strokeStyle = "rgba(156, 163, 175, 0.4)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        return;
      }

      const channelData = buffer.getChannelData(0);
      const sampleRate = buffer.sampleRate;
      
      // Calculate start and end samples based on clip start inside buffer
      const startSample = Math.floor(clip.audioStart * sampleRate);
      const endSample = Math.floor((clip.audioStart + clip.duration) * sampleRate);
      const clipLengthSamples = endSample - startSample;

      ctx.fillStyle = "rgba(16, 185, 129, 0.7)"; // emerald-500 equivalent
      ctx.beginPath();

      const sliceWidth = width / 120; // draw bars
      const gap = 1;

      for (let i = 0; i < 120; i++) {
        // Find peak amplitude in this chunk
        const chunkStart = startSample + Math.floor((i / 120) * clipLengthSamples);
        const chunkEnd = startSample + Math.floor(((i + 1) / 120) * clipLengthSamples);
        
        let maxVal = 0;
        for (let j = chunkStart; j < chunkEnd; j++) {
          if (j < channelData.length && j >= 0) {
            const val = Math.abs(channelData[j]);
            if (val > maxVal) maxVal = val;
          }
        }

        // Draw symmetrical audio bars
        const barHeight = Math.max(2, maxVal * (height - 8));
        const x = i * (sliceWidth + gap);
        const y = (height - barHeight) / 2;

        ctx.fillRect(x, y, sliceWidth, barHeight);
      }
    }, [clip.audioBuffer, clip.audioStart, clip.duration]);

    return <canvas ref={canvasRef} width={280} height={44} className="w-full h-full opacity-80" />;
  };

  // Upload sound file and decode to buffer
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, trackId: string) => {
    const file = e.target.files?.[0];
    if (!file || !audioCtx) return;

    setUploadingToTrackId(trackId);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      // Create new clip from decoded file
      const newClip: AudioClip = {
        id: "clip-" + Math.random().toString(36).substr(2, 9),
        name: file.name.replace(/\.[^/.]+$/, ""), // remove extension
        startOffset: currentTime,
        audioStart: 0,
        duration: decodedBuffer.duration,
        volume: 1.0,
        fadeIn: 0.1,
        fadeOut: 0.2,
        audioBuffer: decodedBuffer
      };

      onAddClip(trackId, newClip);
    } catch (err) {
      console.error("Failed to decode audio file:", err);
      alert("Could not process this audio file. Please ensure it is a valid MP3, WAV, or OGG file.");
    } finally {
      setUploadingToTrackId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const triggerUpload = (trackId: string) => {
    setUploadingToTrackId(trackId);
    fileInputRef.current?.click();
  };

  return (
    <div className="bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-white/[0.06] rounded-xl p-4 flex flex-col shadow-sm dark:shadow-xl overflow-hidden h-full transition-colors duration-150">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={(e) => uploadingToTrackId && handleFileUpload(e, uploadingToTrackId)}
        className="hidden"
      />

      {/* Timeline Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-white/[0.06] pb-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md">
            <Activity className="w-4 h-4" />
          </span>
          <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white tracking-tight">Timeline Editor</h3>
        </div>

        {/* Tools */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#0a0b0d] p-1 rounded-lg border border-slate-200 dark:border-white/[0.04]">
          <button
            onClick={() => setActiveTool('cursor')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-all duration-150 ${activeTool === 'cursor' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-850 dark:text-slate-400 dark:hover:text-slate-200'}`}
          >
            Cursor
          </button>
          <button
            onClick={() => setActiveTool('cut')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-all duration-150 flex items-center gap-1 ${activeTool === 'cut' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-850 dark:text-slate-400 dark:hover:text-slate-200'}`}
          >
            <Scissors className="w-3.5 h-3.5" /> Cut / Split
          </button>
          <button
            onClick={() => setActiveTool('trim')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-all duration-150 ${activeTool === 'trim' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-850 dark:text-slate-400 dark:hover:text-slate-200'}`}
          >
            Trim
          </button>
          <button
            onClick={() => setActiveTool('fade')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-all duration-150 ${activeTool === 'fade' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-850 dark:text-slate-400 dark:hover:text-slate-200'}`}
          >
            Fades
          </button>
        </div>

        {/* Zoom & Dimensions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(Math.max(5, zoom - 3))}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-white/5 transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-mono text-slate-400 dark:text-slate-550 px-1">{zoom} px/s</span>
          <button
            onClick={() => setZoom(Math.min(60, zoom + 3))}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-white/5 transition"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Editor Main Content Area */}
      <div
        ref={timelineRef}
        onClick={handleTimelineClick}
        className="flex-1 overflow-x-auto overflow-y-auto relative min-h-[320px] bg-slate-50 dark:bg-[#0d0f12] rounded-lg border border-slate-200 dark:border-white/[0.05] custom-scrollbar select-none cursor-pointer transition-colors duration-150"
      >
        <div className="min-w-max relative pb-4" style={{ width: `${(duration * zoom) + 240}px` }}>
          {/* Timeline Ruler Header */}
          <div className="h-8 border-b border-slate-200 dark:border-white/[0.06] flex relative text-slate-450 dark:text-slate-500 font-mono text-[10px]">
            {/* Left label space */}
            <div className="w-[200px] h-full border-r border-slate-200 dark:border-white/[0.06] bg-slate-100 dark:bg-[#13161c] sticky left-0 z-30 flex items-center px-4 font-sans font-medium text-slate-650 dark:text-slate-400 transition-colors duration-150">
              TRACK CONFIG
            </div>
            
            {/* Tick marks */}
            <div className="flex-1 relative h-full">
              {Array.from({ length: Math.ceil(duration) + 1 }).map((_, index) => {
                const left = index * zoom;
                const isMajor = index % 5 === 0;
                return (
                  <div
                    key={index}
                    className="absolute bottom-0 flex flex-col items-center"
                    style={{ left: `${left}px` }}
                  >
                    <span className={`h-${isMajor ? '3' : '1.5'} w-px bg-slate-300 dark:bg-white/10`}></span>
                    {isMajor && (
                      <span className="absolute bottom-3 text-slate-400 dark:text-slate-555 tracking-tight whitespace-nowrap font-medium">
                        {Math.floor(index / 60)}:{(index % 60).toString().padStart(2, "0")}s
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tracks Area */}
          <div className="flex flex-col gap-2 mt-2 relative">
            {tracks.map((track) => {
              const isRecordingThisTrack = isRecording && recordingTrackId === track.id;
              
              return (
                <div key={track.id} className="flex relative items-stretch h-18 border-b border-slate-200 dark:border-white/[0.04]">
                  {/* Sticky Track Controller Controls Block */}
                  <div className="w-[200px] shrink-0 bg-slate-100 dark:bg-[#13161c] border-r border-slate-200 dark:border-white/[0.06] p-3 sticky left-0 z-20 flex flex-col justify-between shadow-sm dark:shadow-md transition-colors duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 tracking-tight flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${track.type === 'vocal' ? 'bg-emerald-500' : track.type === 'music' ? 'bg-sky-500' : 'bg-violet-500'}`}></span>
                        {track.name}
                      </span>
                      
                      {/* Upload / Record Button Action triggers */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); triggerUpload(track.id); }}
                          className="p-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white bg-slate-200/50 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 rounded border border-slate-300 dark:border-white/10 transition"
                          title="Import audio file"
                        >
                          <Upload className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            isRecordingThisTrack ? onStopRecord() : onStartRecord(track.id);
                          }}
                          className={`p-1 rounded border transition ${isRecordingThisTrack ? 'bg-red-600 border-red-500 text-white animate-pulse' : 'text-red-500 bg-red-500/10 border-red-500/20 dark:border-red-500/20 hover:bg-red-500/20'}`}
                          title={isRecordingThisTrack ? "Stop Recording" : "Record into this track"}
                        >
                          {isRecordingThisTrack ? <Square className="w-3 h-3 fill-current" /> : <Mic className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>

                    {/* Track Level Slider Mute/Solo */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); onUpdateTrack(track.id, { muted: !track.muted }); }}
                        className={`px-1.5 py-0.5 text-[10px] rounded font-bold transition ${track.muted ? 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30' : 'bg-slate-200 dark:bg-[#0a0b0d] text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-white/5'}`}
                      >
                        MUTE
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onUpdateTrack(track.id, { soloed: !track.soloed }); }}
                        className={`px-1.5 py-0.5 text-[10px] rounded font-bold transition ${track.soloed ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30' : 'bg-slate-200 dark:bg-[#0a0b0d] text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-white/5'}`}
                      >
                        SOLO
                      </button>
                      
                      {/* Compact volume meter/slider representation */}
                      <div className="flex-1 flex items-center gap-1.5">
                        <Volume2 className="w-3 h-3 text-slate-500" />
                        <input
                          type="range"
                          min="0"
                          max="1.5"
                          step="0.05"
                          value={track.volume}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => onUpdateTrack(track.id, { volume: parseFloat(e.target.value) })}
                          className="w-full h-1 bg-slate-300 dark:bg-[#0a0b0d] rounded-lg appearance-none cursor-pointer accent-emerald-550 dark:accent-emerald-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Waveform Clips Timeline Row */}
                  <div className="flex-1 relative bg-slate-100/50 dark:bg-black/15 overflow-hidden">
                    {/* Live recording waveform preview placeholder */}
                    {isRecordingThisTrack && (
                      <div
                        className="absolute h-[52px] top-1 bg-red-500/10 border border-red-500/40 rounded flex items-center px-4 animate-pulse"
                        style={{
                          left: `${currentTime * zoom}px`,
                          right: 0
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
                          <span className="text-[10px] font-mono text-red-400 uppercase tracking-wider font-semibold">Capturing Live Input...</span>
                        </div>
                      </div>
                    )}

                    {/* Render existing clips */}
                    {track.clips.map((clip) => {
                      const left = clip.startOffset * zoom;
                      const width = clip.duration * zoom;
                      const isSelected = selectedClipId === clip.id;
                      
                      return (
                        <div
                          key={clip.id}
                          className={`absolute h-[52px] top-1.5 rounded border flex flex-col justify-between group overflow-hidden transition-all duration-150 ${
                            isSelected 
                              ? "bg-slate-200 dark:bg-[#1e232b] border-emerald-500 dark:border-emerald-400 shadow-md dark:shadow-[0_0_12px_rgba(16,185,129,0.15)] z-10" 
                              : "bg-white dark:bg-[#14171c] border-slate-250 dark:border-white/[0.06] hover:border-slate-350 dark:hover:border-white/10"
                          }`}
                          style={{
                            left: `${left}px`,
                            width: `${width}px`
                          }}
                        >
                          {/* Clip Header Details */}
                          <div className="px-2 py-0.5 bg-slate-100 dark:bg-black/40 border-b border-slate-200 dark:border-b-transparent flex items-center justify-between text-[10px]">
                            <span className="font-medium text-slate-700 dark:text-slate-300 truncate pr-2" title={clip.name}>
                              {clip.name}
                            </span>
                            <span className="font-mono text-slate-500 dark:text-slate-550 text-[9px] shrink-0">
                              {clip.duration.toFixed(1)}s
                            </span>
                          </div>

                          {/* Waveform Drawing Visual */}
                          <div className="flex-1 min-h-0 relative pointer-events-none">
                            <WaveformCanvas clip={clip} />
                            
                            {/* Visual Fade-in Indicator */}
                            {clip.fadeIn > 0 && (
                              <div
                                className="absolute top-0 bottom-0 left-0 bg-gradient-to-tr from-emerald-500/5 to-transparent pointer-events-none border-r border-dashed border-emerald-500/20"
                                style={{ width: `${clip.fadeIn * zoom}px` }}
                              />
                            )}
                            {/* Visual Fade-out Indicator */}
                            {clip.fadeOut > 0 && (
                              <div
                                className="absolute top-0 bottom-0 right-0 bg-gradient-to-tl from-emerald-500/5 to-transparent pointer-events-none border-l border-dashed border-emerald-500/20"
                                style={{ width: `${clip.fadeOut * zoom}px` }}
                              />
                            )}
                          </div>

                          {/* -------------------------------------------------- */}
                          {/* TOOL INTERACTIVITY OVERLAYS */}
                          {/* -------------------------------------------------- */}

                          {/* 1. CURSOR TOOL */}
                          {activeTool === "cursor" && (
                            <div
                              className="absolute inset-0 cursor-grab active:cursor-grabbing z-10"
                              title="Drag to slide clip position / Click to select"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                let startX = e.clientX;
                                let hasDragged = false;
                                const initialStartOffset = clip.startOffset;
                                
                                const handleMouseMove = (mvEvent: MouseEvent) => {
                                  hasDragged = true;
                                  const dx = mvEvent.clientX - startX;
                                  const timeChange = dx / zoom;
                                  onUpdateClip(track.id, clip.id, {
                                    startOffset: Math.max(0, initialStartOffset + timeChange)
                                  });
                                };
                                
                                const handleMouseUp = () => {
                                  window.removeEventListener("mousemove", handleMouseMove);
                                  window.removeEventListener("mouseup", handleMouseUp);
                                  if (!hasDragged) {
                                    onSelectClip(isSelected ? null : clip.id);
                                  }
                                };
                                
                                window.addEventListener("mousemove", handleMouseMove);
                                window.addEventListener("mouseup", handleMouseUp);
                              }}
                            />
                          )}

                          {/* 2. CUT / SPLIT TOOL */}
                          {activeTool === "cut" && (
                            <div
                              className="absolute inset-0 cursor-crosshair z-10"
                              title="Click to split clip here"
                              onMouseMove={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const x = e.clientX - rect.left;
                                setHoverCut({ clipId: clip.id, x });
                              }}
                              onMouseLeave={() => setHoverCut(null)}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!timelineRef.current) return;
                                const rect = timelineRef.current.getBoundingClientRect();
                                const clickX = e.clientX - rect.left + timelineRef.current.scrollLeft;
                                const clickTime = (clickX - 200) / zoom;
                                onSplitClip(track.id, clip.id, clickTime);
                                setHoverCut(null);
                              }}
                            />
                          )}

                          {/* Scissors Split Guide Line visual */}
                          {activeTool === "cut" && hoverCut?.clipId === clip.id && (
                            <div 
                              className="absolute top-0 bottom-0 border-l border-dashed border-red-500 z-30 pointer-events-none flex flex-col items-center justify-start"
                              style={{ left: `${hoverCut.x}px` }}
                            >
                              <span className="bg-red-500 text-white p-0.5 rounded shadow-lg -mt-1 scale-75">
                                <Scissors className="w-3.5 h-3.5" />
                              </span>
                            </div>
                          )}

                          {/* 3. TRIM TOOL */}
                          {activeTool === "trim" && (
                            <div className="absolute inset-0 z-10 flex justify-between">
                              {/* Left Trim Handle */}
                              <div
                                className="w-3 h-full bg-sky-500/20 hover:bg-sky-500/40 border-r border-sky-500/50 cursor-ew-resize flex items-center justify-center transition-all pointer-events-auto"
                                title="Trim clip start"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  let startX = e.clientX;
                                  const initialStartOffset = clip.startOffset;
                                  const initialDuration = clip.duration;
                                  const initialAudioStart = clip.audioStart;
                                  
                                  const handleMouseMove = (mvEvent: MouseEvent) => {
                                    const dx = mvEvent.clientX - startX;
                                    const dt = dx / zoom;
                                    const newOffset = Math.max(0, initialStartOffset + dt);
                                    const consumed = newOffset - initialStartOffset;
                                    const newDuration = Math.max(0.1, initialDuration - consumed);
                                    const newAudioStart = Math.max(0, initialAudioStart + consumed);
                                    
                                    onUpdateClip(track.id, clip.id, {
                                      startOffset: newOffset,
                                      duration: newDuration,
                                      audioStart: newAudioStart
                                    });
                                  };
                                  
                                  const handleMouseUp = () => {
                                    window.removeEventListener("mousemove", handleMouseMove);
                                    window.removeEventListener("mouseup", handleMouseUp);
                                  };
                                  window.addEventListener("mousemove", handleMouseMove);
                                  window.addEventListener("mouseup", handleMouseUp);
                                }}
                              >
                                <span className="w-0.5 h-4 bg-sky-500/60 rounded"></span>
                              </div>

                              {/* Center area allows dragging clip position */}
                              <div
                                className="flex-1 h-full cursor-grab active:cursor-grabbing pointer-events-auto"
                                title="Drag to slide clip position"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  let startX = e.clientX;
                                  const initialStartOffset = clip.startOffset;
                                  
                                  const handleMouseMove = (mvEvent: MouseEvent) => {
                                    const dx = mvEvent.clientX - startX;
                                    const dt = dx / zoom;
                                    onUpdateClip(track.id, clip.id, {
                                      startOffset: Math.max(0, initialStartOffset + dt)
                                    });
                                  };
                                  
                                  const handleMouseUp = () => {
                                    window.removeEventListener("mousemove", handleMouseMove);
                                    window.removeEventListener("mouseup", handleMouseUp);
                                  };
                                  window.addEventListener("mousemove", handleMouseMove);
                                  window.addEventListener("mouseup", handleMouseUp);
                                }}
                              />

                              {/* Right Trim Handle */}
                              <div
                                className="w-3 h-full bg-sky-500/20 hover:bg-sky-500/40 border-l border-sky-500/50 cursor-ew-resize flex items-center justify-center transition-all pointer-events-auto"
                                title="Trim clip end"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  let startX = e.clientX;
                                  const initialDuration = clip.duration;
                                  
                                  const handleMouseMove = (mvEvent: MouseEvent) => {
                                    const dx = mvEvent.clientX - startX;
                                    const dt = dx / zoom;
                                    onUpdateClip(track.id, clip.id, {
                                      duration: Math.max(0.1, initialDuration + dt)
                                    });
                                  };
                                  
                                  const handleMouseUp = () => {
                                    window.removeEventListener("mousemove", handleMouseMove);
                                    window.removeEventListener("mouseup", handleMouseUp);
                                  };
                                  window.addEventListener("mousemove", handleMouseMove);
                                  window.addEventListener("mouseup", handleMouseUp);
                                }}
                              >
                                <span className="w-0.5 h-4 bg-sky-500/60 rounded"></span>
                              </div>
                            </div>
                          )}

                          {/* 4. FADES TOOL */}
                          {activeTool === "fade" && (
                            <div className="absolute inset-0 z-10 pointer-events-none">
                              {/* Left Fade In Handle */}
                              <div
                                className="absolute top-1 w-4 h-4 bg-violet-600 hover:bg-violet-500 border border-white rounded-full cursor-ew-resize pointer-events-auto flex items-center justify-center shadow-lg transform -translate-x-1/2"
                                style={{ left: `${clip.fadeIn * zoom}px` }}
                                title={`Fade In: ${clip.fadeIn.toFixed(1)}s`}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  let startX = e.clientX;
                                  const initialFadeIn = clip.fadeIn;
                                  
                                  const handleMouseMove = (mvEvent: MouseEvent) => {
                                    const dx = mvEvent.clientX - startX;
                                    const dt = dx / zoom;
                                    onUpdateClip(track.id, clip.id, {
                                      fadeIn: Math.max(0, Math.min(clip.duration, initialFadeIn + dt))
                                    });
                                  };
                                  
                                  const handleMouseUp = () => {
                                    window.removeEventListener("mousemove", handleMouseMove);
                                    window.removeEventListener("mouseup", handleMouseUp);
                                  };
                                  window.addEventListener("mousemove", handleMouseMove);
                                  window.addEventListener("mouseup", handleMouseUp);
                                }}
                              >
                                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                              </div>

                              {/* Right Fade Out Handle */}
                              <div
                                className="absolute top-1 w-4 h-4 bg-violet-600 hover:bg-violet-500 border border-white rounded-full cursor-ew-resize pointer-events-auto flex items-center justify-center shadow-lg transform translate-x-1/2"
                                style={{ right: `${clip.fadeOut * zoom}px` }}
                                title={`Fade Out: ${clip.fadeOut.toFixed(1)}s`}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  let startX = e.clientX;
                                  const initialFadeOut = clip.fadeOut;
                                  
                                  const handleMouseMove = (mvEvent: MouseEvent) => {
                                    const dx = mvEvent.clientX - startX;
                                    const dt = dx / zoom;
                                    onUpdateClip(track.id, clip.id, {
                                      fadeOut: Math.max(0, Math.min(clip.duration, initialFadeOut - dt))
                                    });
                                  };
                                  
                                  const handleMouseUp = () => {
                                    window.removeEventListener("mousemove", handleMouseMove);
                                    window.removeEventListener("mouseup", handleMouseUp);
                                  };
                                  window.addEventListener("mousemove", handleMouseMove);
                                  window.addEventListener("mouseup", handleMouseUp);
                                }}
                              >
                                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                              </div>
                            </div>
                          )}

                          {/* Quick Actions overlay on hover */}
                          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                            {activeTool === 'cut' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSplitClip(track.id, clip.id, currentTime);
                                }}
                                className="p-0.5 bg-slate-100 dark:bg-[#0a0b0d] hover:bg-emerald-600 rounded text-slate-600 hover:text-white dark:text-slate-300 border border-slate-300 dark:border-white/10 hover:border-emerald-500 transition"
                                title="Split clip at Playhead"
                              >
                                <Scissors className="w-2.5 h-2.5" />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteClip(track.id, clip.id);
                              }}
                              className="p-0.5 bg-slate-100 dark:bg-[#0a0b0d] hover:bg-red-600 rounded text-red-600 hover:text-white dark:text-red-400 border border-slate-300 dark:border-white/10 hover:border-red-500 transition"
                              title="Delete clip"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Vertical Playhead Marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-40 pointer-events-none"
            style={{
              left: `${(currentTime * zoom) + 200}px`
            }}
          >
            {/* Playhead Handle triangular point */}
            <div className="absolute top-0 -left-1.5 w-3.5 h-3.5 bg-rose-500 rounded-full border border-white flex items-center justify-center shadow">
              <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Clip Detail Inspector Panel */}
      {selectedClipId && (
        <div className="mt-4 bg-slate-50 dark:bg-[#14171c] p-3 rounded-lg border border-slate-200 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-4 animate-fadeIn shadow-md dark:shadow-lg dark:shadow-black/30">
          {(() => {
            // Find selected clip object
            let foundClip: AudioClip | null = null;
            let foundTrackId = "";
            for (const t of tracks) {
              const c = t.clips.find(clip => clip.id === selectedClipId);
              if (c) {
                foundClip = c;
                foundTrackId = t.id;
                break;
              }
            }
            if (!foundClip) return null;
            
            return (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Selected Clip:</span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 bg-emerald-500/5 rounded font-mono">
                    {foundClip.name}
                  </span>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 dark:text-slate-550 font-medium">Timeline At:</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={foundClip.startOffset.toFixed(1)}
                      onChange={(e) => onUpdateClip(foundTrackId, foundClip!.id, { startOffset: parseFloat(e.target.value) || 0 })}
                      className="w-14 bg-slate-100 dark:bg-[#0a0b0d] border border-slate-200 dark:border-white/10 rounded px-1.5 py-0.5 text-center text-slate-700 dark:text-slate-200 font-mono"
                    />
                    <span className="text-slate-500 dark:text-slate-550">s</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 dark:text-slate-550 font-medium">Fade In:</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      value={foundClip.fadeIn.toFixed(1)}
                      onChange={(e) => onUpdateClip(foundTrackId, foundClip!.id, { fadeIn: parseFloat(e.target.value) || 0 })}
                      className="w-12 bg-slate-100 dark:bg-[#0a0b0d] border border-slate-200 dark:border-white/10 rounded px-1.5 py-0.5 text-center text-slate-700 dark:text-slate-200 font-mono"
                    />
                    <span className="text-slate-500 dark:text-slate-550">s</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 dark:text-slate-550 font-medium">Fade Out:</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      value={foundClip.fadeOut.toFixed(1)}
                      onChange={(e) => onUpdateClip(foundTrackId, foundClip!.id, { fadeOut: parseFloat(e.target.value) || 0 })}
                      className="w-12 bg-slate-100 dark:bg-[#0a0b0d] border border-slate-200 dark:border-white/10 rounded px-1.5 py-0.5 text-center text-slate-700 dark:text-slate-200 font-mono"
                    />
                    <span className="text-slate-500 dark:text-slate-550">s</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 dark:text-slate-550 font-medium">Gain:</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={foundClip.volume}
                      onChange={(e) => onUpdateClip(foundTrackId, foundClip!.id, { volume: parseFloat(e.target.value) })}
                      className="w-20 accent-emerald-550 dark:accent-emerald-400"
                    />
                    <span className="text-slate-500 dark:text-slate-400 font-mono">{(foundClip.volume * 100).toFixed(0)}%</span>
                  </div>

                  <button
                    onClick={() => onDeleteClip(foundTrackId, foundClip!.id)}
                    className="p-1.5 bg-red-550/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded transition"
                    title="Delete clip"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
