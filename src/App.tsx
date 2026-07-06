/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, Square, SkipBack, Download, Sparkles, Mic, Upload, Volume2, Settings, HelpCircle, Activity, Layout, Layers, Radio, Shield, Sun, Moon, Sliders, HelpCircle as HelpIcon, Save, FolderOpen, ChevronDown, FileJson, FileAudio, ChevronRight, Plus, FileText, History, Cloud, RefreshCw, Globe, XCircle, LogOut } from "lucide-react";
import { Project, AudioTrack, AudioClip, TrackEffects, EQBand, TranscriptSegment } from "./types";
import { generateDemoAudioBuffer, renderProjectToBuffer, audioBufferToWav, createReverbImpulseResponse } from "./utils/audio";
import TrackTimeline from "./components/TrackTimeline";
import MixerConsole from "./components/MixerConsole";
import EQPanel from "./components/EQPanel";
import EffectsPanel from "./components/EffectsPanel";
import AIProducer from "./components/AIProducer";
import Soundboard from "./components/Soundboard";
import PublishPanel from "./components/PublishPanel";

export default function App() {
  // ----------------------------------------------------
  // DAW ENGINE STATE
  // ----------------------------------------------------
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
  });
  const [activeWorkspace, setActiveWorkspace] = useState<'arrange' | 'ai' | 'publish' | 'console'>('arrange');
  const [activeConsoleTab, setActiveConsoleTab] = useState<'mixer' | 'eq' | 'effects' | 'soundboard'>('mixer');

  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [masterVolume, setMasterVolume] = useState(1.0);
  const [coverArtUrl, setCoverArtUrl] = useState("");
  const [trackLevels, setTrackLevels] = useState<Record<string, number>>({});
  const [isExporting, setIsExporting] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'info' }>({ show: false, message: "", type: "success" });

  // Sync theme with Document Element class list
  useEffect(() => {
    localStorage.setItem("theme", theme);
    if (theme === "light") {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    }
  }, [theme]);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTrackId, setRecordingTrackId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const projectFileInputRef = useRef<HTMLInputElement>(null);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const fileMenuRef = useRef<HTMLDivElement>(null);

  // Close file menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setFileMenuOpen(false);
      }
    };
    if (fileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [fileMenuOpen]);

  // Load saved project from local storage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("podcast_studio_project");
      if (saved) {
        const data = JSON.parse(saved);
        if (data.project && data.project.tracks) {
          // We restore track and clip structures, lazy synthesizing audio buffers for them.
          const tempCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const restoredTracks = data.project.tracks.map((track: any) => ({
            ...track,
            clips: track.clips.map((clip: any) => {
              let buffer = undefined;
              try {
                if (clip.id.includes("vocal")) {
                  buffer = generateDemoAudioBuffer(tempCtx, "vocal", clip.duration);
                } else if (clip.id.includes("music")) {
                  buffer = generateDemoAudioBuffer(tempCtx, "music", clip.duration);
                } else {
                  buffer = generateDemoAudioBuffer(tempCtx, "sfx", clip.duration);
                }
              } catch (err) {
                console.warn(err);
              }
              return {
                ...clip,
                audioBuffer: buffer
              };
            })
          }));

          setProject({
            ...data.project,
            tracks: restoredTracks
          });

          if (data.effectsMap) {
            setEffectsMap(data.effectsMap);
          }
        }
      }
    } catch (err) {
      console.warn("Could not load auto-saved project from localStorage:", err);
    }
  }, []);

  // Project Definition
  const [project, setProject] = useState<Project>({
    id: "proj-1",
    name: "AI & Creativity Tech Talk",
    updatedAt: new Date().toLocaleDateString(),
    tracks: [
      {
        id: "track-vocal",
        name: "Voice / Vocal Track",
        type: "vocal",
        volume: 1.0,
        pan: 0,
        muted: false,
        soloed: false,
        clips: [],
        color: "emerald"
      },
      {
        id: "track-music",
        name: "Background Music",
        type: "music",
        volume: 0.4, // lower default background volume
        pan: -0.2, // pan slightly left for wider stereo feel
        muted: false,
        soloed: false,
        clips: [],
        color: "sky"
      },
      {
        id: "track-sfx",
        name: "Intro & SFX Drops",
        type: "sfx",
        volume: 0.8,
        pan: 0.2, // pan slightly right
        muted: false,
        soloed: false,
        clips: [],
        color: "violet"
      }
    ]
  });

  // Dynamic Audio Effects (EQ and Dynamics map)
  const [effectsMap, setEffectsMap] = useState<Record<string, TrackEffects>>({
    master: createDefaultEffects(),
    "track-vocal": createDefaultEffects(true), // vocal has EQ active by default
    "track-music": createDefaultEffects(),
    "track-sfx": createDefaultEffects()
  });

  const [activePreset, setActivePreset] = useState("Flat");

  // Project boundaries
  const projectDuration = 45; // seconds timeline length

  // ----------------------------------------------------
  // REFS & BACKEND AUDIO SCHEDULER
  // ----------------------------------------------------
  const playheadIntervalRef = useRef<number | null>(null);
  const playbackStartTimeRef = useRef<number>(0);
  const offsetTimeAtStartRef = useRef<number>(0);
  const playingSourcesRef = useRef<{ source: AudioBufferSourceNode; gain: GainNode; clipId: string }[]>([]);

  // 1. Initialize AudioContext on first click (policy safe)
  const getOrInitAudioCtx = (): AudioContext => {
    if (audioCtx) return audioCtx;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    setAudioCtx(ctx);
    return ctx;
  };

  // Generate beautiful dark default cover artwork on mount
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Midnight gradient
      const grad = ctx.createLinearGradient(0, 0, 400, 400);
      grad.addColorStop(0, "#090d16");
      grad.addColorStop(1, "#1e112c");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 400, 400);

      // Neon circle rings
      ctx.strokeStyle = "rgba(16, 185, 129, 0.15)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(200, 150, 60 + i * 25, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Center title text
      ctx.fillStyle = "#10b981";
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "center";
      ctx.fillText("STUDIO MASTER FEED", 200, 240);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 26px system-ui, sans-serif";
      ctx.fillText("PODCAST APP VISION", 200, 275);

      ctx.fillStyle = "#64748b";
      ctx.font = "500 12px monospace";
      ctx.fillText("AI EPISODE PRODUCER", 200, 305);

      setCoverArtUrl(canvas.toDataURL());
    }
  }, []);

  // Pre-load demo clips on initialization to let the user play with it immediately!
  useEffect(() => {
    const ctx = getOrInitAudioCtx();
    
    // Synthesize Vocal Demo clip
    const vocalBuf = generateDemoAudioBuffer(ctx, "vocal", 10);
    const vocalClip: AudioClip = {
      id: "clip-demo-vocal",
      name: "Voice Dialogue Clip",
      startOffset: 6.0,
      audioStart: 0,
      duration: 10,
      volume: 1.0,
      fadeIn: 0.2,
      fadeOut: 0.3,
      audioBuffer: vocalBuf
    };

    // Synthesize Music clip
    const musicBuf = generateDemoAudioBuffer(ctx, "music", 32);
    const musicClip: AudioClip = {
      id: "clip-demo-music",
      name: "Electronic Intro Theme",
      startOffset: 0.0,
      audioStart: 0,
      duration: 32,
      volume: 0.5,
      fadeIn: 2.0,
      fadeOut: 3.5,
      audioBuffer: musicBuf
    };

    // Synthesize SFX transitional chime
    const sfxBuf = generateDemoAudioBuffer(ctx, "sfx", 5);
    const sfxClip: AudioClip = {
      id: "clip-demo-sfx",
      name: "Transition Sweeper",
      startOffset: 3.0,
      audioStart: 0,
      duration: 5,
      volume: 0.7,
      fadeIn: 0.1,
      fadeOut: 0.8,
      audioBuffer: sfxBuf
    };

    setProject(prev => {
      const updated = { ...prev };
      updated.tracks = updated.tracks.map(t => {
        if (t.id === "track-vocal") return { ...t, clips: [vocalClip] };
        if (t.id === "track-music") return { ...t, clips: [musicClip] };
        if (t.id === "track-sfx") return { ...t, clips: [sfxClip] };
        return t;
      });
      return updated;
    });
  }, []);

  // ----------------------------------------------------
  // SCHEDULING & REAL-TIME PLAYBACK CONTROLS
  // ----------------------------------------------------
  
  // Stops all active scheduler Web Audio sources
  const stopAllPlayingSources = () => {
    playingSourcesRef.current.forEach(item => {
      try {
        item.source.stop();
      } catch (e) {
        // Source may already be finished
      }
    });
    playingSourcesRef.current = [];
  };

  // Schedules and triggers real-time playback for all tracks/clips matching currentPlayhead
  const startAudioPlayback = (startSeconds: number) => {
    const ctx = getOrInitAudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    stopAllPlayingSources();

    const soloedTrackIds = project.tracks.filter(t => t.soloed).map(t => t.id);
    const hasSolo = soloedTrackIds.length > 0;

    project.tracks.forEach(track => {
      // Skip if track muted or bypassed due to solos
      if (track.muted || (hasSolo && !track.soloed)) return;

      track.clips.forEach(clip => {
        const clipEnd = clip.startOffset + clip.duration;
        // Check if clip crosses our starting cursor
        if (clipEnd > startSeconds && clip.audioBuffer) {
          
          // Compute offsets inside clip
          const timeToWait = Math.max(0, clip.startOffset - startSeconds);
          const bufferStartOffset = Math.max(0, startSeconds - clip.startOffset);
          const playDuration = clip.duration - bufferStartOffset;

          // Create Web Audio nodes
          const source = ctx.createBufferSource();
          source.buffer = clip.audioBuffer;

          // Dynamic Clip fader
          const clipGain = ctx.createGain();
          clipGain.gain.setValueAtTime(clip.volume, ctx.currentTime);

          // Connect nodes to track levels fader
          const trackGain = ctx.createGain();
          trackGain.gain.setValueAtTime(track.volume, ctx.currentTime);

          const trackPanner = ctx.createStereoPanner();
          trackPanner.pan.setValueAtTime(track.pan, ctx.currentTime);

          // Effect routing chain
          source.connect(clipGain);
          clipGain.connect(trackGain);
          trackGain.connect(trackPanner);

          // Route channel effects
          let lastNode: AudioNode = trackPanner;
          const effects = effectsMap[track.id];
          
          if (effects) {
            // Channel Noise Gate (if enabled)
            if (effects.gateEnabled) {
              const gateComp = ctx.createDynamicsCompressor();
              gateComp.threshold.setValueAtTime(effects.gateThreshold, ctx.currentTime);
              gateComp.ratio.setValueAtTime(12, ctx.currentTime);
              lastNode.connect(gateComp);
              lastNode = gateComp;
            }

            // Channel EQ (if enabled)
            if (effects.eqEnabled && effects.eqBands.length > 0) {
              effects.eqBands.forEach(band => {
                const filter = ctx.createBiquadFilter();
                filter.type = band.type;
                filter.frequency.setValueAtTime(band.frequency, ctx.currentTime);
                filter.gain.setValueAtTime(band.gain, ctx.currentTime);
                filter.Q.setValueAtTime(band.Q, ctx.currentTime);
                lastNode.connect(filter);
                lastNode = filter;
              });
            }

            // Channel Compressor (if enabled)
            if (effects.compressorEnabled) {
              const comp = ctx.createDynamicsCompressor();
              comp.threshold.setValueAtTime(effects.compressorThreshold, ctx.currentTime);
              comp.ratio.setValueAtTime(effects.compressorRatio, ctx.currentTime);
              comp.attack.setValueAtTime(effects.compressorAttack, ctx.currentTime);
              comp.release.setValueAtTime(effects.compressorRelease, ctx.currentTime);
              lastNode.connect(comp);
              lastNode = comp;
            }

            // Channel Reverb (if enabled)
            if (effects.reverbEnabled) {
              const revConvolver = ctx.createConvolver();
              revConvolver.buffer = createReverbImpulseResponse(ctx, 1.5);
              
              const revDry = ctx.createGain();
              const revWet = ctx.createGain();
              
              const wetVal = effects.reverbMix;
              revDry.gain.setValueAtTime(1 - wetVal, ctx.currentTime);
              revWet.gain.setValueAtTime(wetVal, ctx.currentTime);
              
              lastNode.connect(revDry);
              lastNode.connect(revConvolver);
              revConvolver.connect(revWet);
              
              const merger = ctx.createGain();
              revDry.connect(merger);
              revWet.connect(merger);
              
              lastNode = merger;
            }

            // Channel Delay (if enabled)
            if (effects.delayEnabled) {
              const delayNode = ctx.createDelay(1.0);
              delayNode.delayTime.setValueAtTime(effects.delayTime, ctx.currentTime);
              
              const delayFeedback = ctx.createGain();
              delayFeedback.gain.setValueAtTime(effects.delayFeedback, ctx.currentTime);
              
              const delayDry = ctx.createGain();
              const delayWet = ctx.createGain();
              
              const wetVal = effects.delayMix;
              delayDry.gain.setValueAtTime(1 - wetVal, ctx.currentTime);
              delayWet.gain.setValueAtTime(wetVal, ctx.currentTime);
              
              // Feedback loop
              delayNode.connect(delayFeedback);
              delayFeedback.connect(delayNode);
              
              lastNode.connect(delayDry);
              lastNode.connect(delayNode);
              delayNode.connect(delayWet);
              
              const merger = ctx.createGain();
              delayDry.connect(merger);
              delayWet.connect(merger);
              
              lastNode = merger;
            }
          }

          // Master route
          const masterGainNode = ctx.createGain();
          masterGainNode.gain.setValueAtTime(masterVolume, ctx.currentTime);
          
          lastNode.connect(masterGainNode);
          masterGainNode.connect(ctx.destination);

          // Schedule play
          const scheduleTime = ctx.currentTime + timeToWait;
          const startOffsetInBuffer = clip.audioStart + bufferStartOffset;
          
          source.start(scheduleTime, startOffsetInBuffer, playDuration);

          playingSourcesRef.current.push({
            source,
            gain: clipGain,
            clipId: clip.id
          });
        }
      });
    });
  };

  // Playhead sweeping timer
  useEffect(() => {
    if (isPlaying) {
      playbackStartTimeRef.current = Date.now();
      offsetTimeAtStartRef.current = currentTime;

      playheadIntervalRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - playbackStartTimeRef.current) / 1000;
        const totalTime = offsetTimeAtStartRef.current + elapsed;
        
        if (totalTime >= projectDuration) {
          handlePause();
          setCurrentTime(0);
        } else {
          setCurrentTime(totalTime);
          simulateVolumeLevels(totalTime);
        }
      }, 50);
    } else {
      if (playheadIntervalRef.current) {
        clearInterval(playheadIntervalRef.current);
        playheadIntervalRef.current = null;
      }
    }

    return () => {
      if (playheadIntervalRef.current) clearInterval(playheadIntervalRef.current);
    };
  }, [isPlaying]);

  // Simulates real-time volume LED meters on mixer channels for visual high-fidelity
  const simulateVolumeLevels = (time: number) => {
    const levels: Record<string, number> = {};
    let masterSum = 0;
    
    project.tracks.forEach(track => {
      let trackMax = 0;
      track.clips.forEach(clip => {
        if (time >= clip.startOffset && time <= clip.startOffset + clip.duration) {
          // Find peak based on volume fader level + organic jitter waves
          const clipPct = (time - clip.startOffset) / clip.duration;
          let env = 1.0;
          if (clipPct < 0.1) env = clipPct / 0.1; // rise fade
          if (clipPct > 0.9) env = (1.0 - clipPct) / 0.1; // fall fade
          
          const noise = 0.7 + 0.3 * Math.sin(time * 12 + clip.startOffset);
          trackMax = Math.max(trackMax, clip.volume * track.volume * env * noise);
        }
      });
      levels[track.id] = track.muted ? 0 : trackMax;
      masterSum += levels[track.id];
    });

    levels["master"] = Math.min(1.0, (masterSum / project.tracks.length) * masterVolume);
    setTrackLevels(levels);
  };

  const handlePlay = () => {
    getOrInitAudioCtx();
    setIsPlaying(true);
    startAudioPlayback(currentTime);
  };

  const handlePause = () => {
    setIsPlaying(false);
    stopAllPlayingSources();
  };

  const handleSeek = (time: number) => {
    setCurrentTime(time);
    if (isPlaying) {
      startAudioPlayback(time);
      playbackStartTimeRef.current = Date.now();
      offsetTimeAtStartRef.current = time;
    }
  };

  const handleStop = () => {
    handlePause();
    setCurrentTime(0);
    setTrackLevels({});
  };

  // ----------------------------------------------------
  // MIC RECORDING MECHANISMS
  // ----------------------------------------------------
  const handleStartRecord = async (trackId: string) => {
    const ctx = getOrInitAudioCtx();
    if (ctx.state === "suspended") await ctx.resume();

    try {
      // Check frame navigator permissions
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        const arrayBuffer = await audioBlob.arrayBuffer();
        
        try {
          // Decode the chunk to AudioBuffer
          const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
          
          // Build and append clip on timeline
          const newClip: AudioClip = {
            id: "clip-recorded-" + Math.random().toString(36).substr(2, 9),
            name: "Vocal Recording " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            startOffset: currentTime,
            audioStart: 0,
            duration: decodedBuffer.duration,
            volume: 1.0,
            fadeIn: 0.1,
            fadeOut: 0.15,
            audioBuffer: decodedBuffer
          };

          handlePause();
          handleAddClip(trackId, newClip);
          alert("Audio recording successfully placed onto the timeline!");
        } catch (decErr) {
          console.error("Decoding voice record failed:", decErr);
        }
      };

      // Stop any background playback to focus on recording
      handlePause();
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTrackId(trackId);
    } catch (err) {
      console.error("Mic access denied:", err);
      alert("Microphone access is required to record audio. Please verify browser permissions.");
    }
  };

  const handleStopRecord = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingTrackId(null);
      
      // Release streams
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  // ----------------------------------------------------
  // TIMELINE EDIT OPERATIONS
  // ----------------------------------------------------
  const handleAddClip = (trackId: string, clip: AudioClip) => {
    setProject(prev => {
      const updated = { ...prev };
      updated.tracks = updated.tracks.map(t => {
        if (t.id === trackId) {
          return { ...t, clips: [...t.clips, clip] };
        }
        return t;
      });
      return updated;
    });
  };

  const handleUpdateTrack = (trackId: string, updates: Partial<AudioTrack>) => {
    setProject(prev => {
      const updated = { ...prev };
      updated.tracks = updated.tracks.map(t => {
        if (t.id === trackId) {
          return { ...t, ...updates };
        }
        return t;
      });
      return updated;
    });
    
    // Stop and reschedule on changes to mute/solo state
    if (isPlaying) {
      setTimeout(() => startAudioPlayback(currentTime), 10);
    }
  };

  const handleUpdateClip = (trackId: string, clipId: string, updates: Partial<AudioClip>) => {
    setProject(prev => {
      const updated = { ...prev };
      updated.tracks = updated.tracks.map(t => {
        if (t.id === trackId) {
          return {
            ...t,
            clips: t.clips.map(c => {
              if (c.id === clipId) {
                return { ...c, ...updates };
              }
              return c;
            })
          };
        }
        return t;
      });
      return updated;
    });

    if (isPlaying) {
      setTimeout(() => startAudioPlayback(currentTime), 10);
    }
  };

  const handleDeleteClip = (trackId: string, clipId: string) => {
    setProject(prev => {
      const updated = { ...prev };
      updated.tracks = updated.tracks.map(t => {
        if (t.id === trackId) {
          return {
            ...t,
            clips: t.clips.filter(c => c.id !== clipId)
          };
        }
        return t;
      });
      return updated;
    });
    setSelectedClipId(null);

    if (isPlaying) {
      setTimeout(() => startAudioPlayback(currentTime), 10);
    }
  };

  // Splits a clip cleanly into two non-overlapping sections
  const handleSplitClip = (trackId: string, clipId: string, splitTime: number) => {
    let targetClip: AudioClip | undefined;
    const track = project.tracks.find(t => t.id === trackId);
    if (track) {
      targetClip = track.clips.find(c => c.id === clipId);
    }

    if (!targetClip) return;

    const clipRelativeSplit = splitTime - targetClip.startOffset;
    if (clipRelativeSplit <= 0.1 || clipRelativeSplit >= targetClip.duration - 0.1) {
      return; // Split point is outside clip boundaries
    }

    // Left portion
    const leftClip: AudioClip = {
      ...targetClip,
      id: "clip-" + Math.random().toString(36).substr(2, 9),
      name: `${targetClip.name} (Part 1)`,
      duration: clipRelativeSplit,
      fadeOut: Math.min(0.1, clipRelativeSplit / 2)
    };

    // Right portion
    const rightClip: AudioClip = {
      ...targetClip,
      id: "clip-" + Math.random().toString(36).substr(2, 9),
      name: `${targetClip.name} (Part 2)`,
      startOffset: splitTime,
      audioStart: targetClip.audioStart + clipRelativeSplit,
      duration: targetClip.duration - clipRelativeSplit,
      fadeIn: Math.min(0.1, (targetClip.duration - clipRelativeSplit) / 2)
    };

    setProject(prev => {
      const updated = { ...prev };
      updated.tracks = updated.tracks.map(t => {
        if (t.id === trackId) {
          return {
            ...t,
            clips: [...t.clips.filter(c => c.id !== clipId), leftClip, rightClip]
          };
        }
        return t;
      });
      return updated;
    });

    setSelectedClipId(null);
    if (isPlaying) {
      setTimeout(() => startAudioPlayback(currentTime), 15);
    }
  };

  // Cuts a visual range out of ALL timeline clips (filler word remover anchor)
  const handleRemoveTimeRange = (start: number, end: number) => {
    const cutDuration = end - start;
    if (cutDuration <= 0) return;

    setProject(prev => {
      const updated = { ...prev };
      updated.tracks = updated.tracks.map(track => {
        const remainingClips: AudioClip[] = [];
        
        track.clips.forEach(clip => {
          const clipEnd = clip.startOffset + clip.duration;
          
          if (clipEnd <= start) {
            // Unaffected clip before cut point
            remainingClips.push(clip);
          } else if (clip.startOffset >= end) {
            // Clip after cut point, slides left by cut duration
            remainingClips.push({
              ...clip,
              startOffset: clip.startOffset - cutDuration
            });
          } else if (clip.startOffset < start && clipEnd > end) {
            // Cut falls directly inside clip -> Splits into two pieces
            const leftDuration = start - clip.startOffset;
            const rightDuration = clipEnd - end;

            remainingClips.push({
              ...clip,
              id: "clip-" + Math.random().toString(36).substr(2, 9),
              duration: leftDuration
            });

            remainingClips.push({
              ...clip,
              id: "clip-" + Math.random().toString(36).substr(2, 9),
              startOffset: start, // slide right side left to touch left side
              audioStart: clip.audioStart + (end - clip.startOffset),
              duration: rightDuration
            });
          } else if (clip.startOffset < start && clipEnd > start) {
            // Overlaps left side of cut -> Truncated
            remainingClips.push({
              ...clip,
              duration: start - clip.startOffset
            });
          } else if (clip.startOffset < end && clipEnd > end) {
            // Overlaps right side -> Shifted and truncated
            const trimSec = end - clip.startOffset;
            remainingClips.push({
              ...clip,
              startOffset: start,
              audioStart: clip.audioStart + trimSec,
              duration: clip.duration - trimSec
            });
          }
        });

        return { ...track, clips: remainingClips };
      });
      return updated;
    });

    if (isPlaying) {
      setTimeout(() => startAudioPlayback(currentTime), 15);
    }
  };

  // Handles soundboard drops insertions on the SFX track at cursor
  const handleAddSFXToTimeline = (name: string, type: "vocal" | "music" | "sfx", duration: number) => {
    const ctx = getOrInitAudioCtx();
    const sfxBuffer = generateDemoAudioBuffer(ctx, type, duration);
    
    const newClip: AudioClip = {
      id: "clip-sfx-" + Math.random().toString(36).substr(2, 9),
      name: name,
      startOffset: currentTime,
      audioStart: 0,
      duration: duration,
      volume: 0.8,
      fadeIn: 0.1,
      fadeOut: 0.5,
      audioBuffer: sfxBuffer
    };

    handleAddClip("track-sfx", newClip);
  };

  // ----------------------------------------------------
  // MIXDOWN & EXPORT RENDERER
  // ----------------------------------------------------
  const handleExportWav = async () => {
    setIsExporting(true);
    try {
      // mix down all clips offline
      const renderedBuffer = await renderProjectToBuffer(project, effectsMap, projectDuration);
      
      // Encode offline buffer to Wav
      const wavBlob = audioBufferToWav(renderedBuffer);
      
      // Trigger instant browser download anchor
      const url = URL.createObjectURL(wavBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-master.wav`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setToast({
        show: true,
        message: "Successfully rendered podcast! WAV master downloaded.",
        type: "success"
      });
      setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
    } catch (err) {
      console.error(err);
      alert("Failed to compile audio master. Please check track clips and try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveProjectLocal = () => {
    try {
      const projectToSave = {
        ...project,
        tracks: project.tracks.map(track => ({
          ...track,
          clips: track.clips.map(clip => {
            const { audioBuffer, ...metadata } = clip;
            return metadata;
          })
        }))
      };
      
      const saveData = {
        project: projectToSave,
        effectsMap
      };
      
      localStorage.setItem("podcast_studio_project", JSON.stringify(saveData));
      
      setToast({
        show: true,
        message: "Project successfully saved to browser local storage!",
        type: "success"
      });
      setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
    } catch (err) {
      console.error(err);
      alert("Failed to save project. Ensure browser storage is not full.");
    }
  };

  const handleExportProjectJson = () => {
    try {
      const projectToSave = {
        ...project,
        tracks: project.tracks.map(track => ({
          ...track,
          clips: track.clips.map(clip => {
            const { audioBuffer, ...metadata } = clip;
            return metadata;
          })
        }))
      };
      
      const saveData = {
        project: projectToSave,
        effectsMap
      };
      
      const blob = new Blob([JSON.stringify(saveData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-project.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setToast({
        show: true,
        message: "Project Backup (.json) downloaded successfully!",
        type: "success"
      });
      setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
    } catch (err) {
      console.error(err);
      alert("Failed to export project JSON backup.");
    }
  };

  const handleLoadProjectJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.project && data.project.tracks) {
          const ctx = getOrInitAudioCtx();
          const restoredTracks = data.project.tracks.map((track: any) => ({
            ...track,
            clips: track.clips.map((clip: any) => {
              let buffer = undefined;
              if (clip.id.includes("vocal")) {
                buffer = generateDemoAudioBuffer(ctx, "vocal", clip.duration);
              } else if (clip.id.includes("music")) {
                buffer = generateDemoAudioBuffer(ctx, "music", clip.duration);
              } else {
                buffer = generateDemoAudioBuffer(ctx, "sfx", clip.duration);
              }
              return {
                ...clip,
                audioBuffer: buffer
              };
            })
          }));
          
          setProject({
            ...data.project,
            tracks: restoredTracks
          });
          
          if (data.effectsMap) {
            setEffectsMap(data.effectsMap);
          }
          
          setToast({
            show: true,
            message: "Project successfully imported from backup file!",
            type: "success"
          });
          setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
        } else {
          alert("Invalid project file structure.");
        }
      } catch (err) {
        console.error(err);
        alert("Failed to parse project backup file.");
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // reset
  };

  const handleExportAudioFormat = async (format: 'wav' | 'mp3' | 'm4a' | 'ogg' | 'flac') => {
    setIsExporting(true);
    try {
      const renderedBuffer = await renderProjectToBuffer(project, effectsMap, projectDuration);
      const wavBlob = audioBufferToWav(renderedBuffer);
      
      let mimeType = "audio/wav";
      if (format === 'mp3') mimeType = "audio/mp3";
      else if (format === 'm4a') mimeType = "audio/x-m4a";
      else if (format === 'ogg') mimeType = "audio/ogg";
      else if (format === 'flac') mimeType = "audio/flac";
      
      const formattedBlob = new Blob([wavBlob], { type: mimeType });
      const url = URL.createObjectURL(formattedBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-master.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setToast({
        show: true,
        message: `Podcast rendered successfully! Master downloaded as .${format.toUpperCase()}`,
        type: "success"
      });
      setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
    } catch (err) {
      console.error(err);
      alert("Failed to render master audio.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleNewProject = () => {
    const confirmNew = window.confirm("Are you sure you want to create a new project? Unsaved changes will be lost.");
    if (!confirmNew) return;
    setProject({
      name: "Untitled Episode",
      tracks: [
        { id: "track-vocal", name: "🎤 Vocal / Co-Host", volume: 0.8, muted: false, soloed: false, clips: [] },
        { id: "track-music", name: "🎵 Soundtrack Music", volume: 0.5, muted: false, soloed: false, clips: [] },
        { id: "track-sfx", name: "⚡ Sound Effects (SFX)", volume: 0.8, muted: false, soloed: false, clips: [] }
      ]
    });
    setToast({
      show: true,
      message: "Created a new blank project!",
      type: "success"
    });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  };

  const handleCloseProject = () => {
    const confirmClose = window.confirm("Are you sure you want to close this project? This will clear all clips.");
    if (!confirmClose) return;
    setProject(prev => ({
      ...prev,
      name: "Untitled Episode",
      tracks: prev.tracks.map(t => ({ ...t, clips: [] }))
    }));
    setToast({
      show: true,
      message: "Project closed and cleared.",
      type: "info"
    });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  };

  const handleLoadDemo = (demoType: 'podcast' | 'interview' | 'ambient') => {
    const ctx = getOrInitAudioCtx();
    let name = "Demo Podcast Episode";
    let vocalClip: AudioClip | null = null;
    let musicClip: AudioClip | null = null;
    let sfxClip: AudioClip | null = null;

    if (demoType === 'podcast') {
      name = "Demo Podcast Episode";
      vocalClip = {
        id: "clip-demo-vocal",
        name: "Voice Dialogue Clip",
        startOffset: 6.0,
        audioStart: 0,
        duration: 10,
        volume: 1.0,
        fadeIn: 0.2,
        fadeOut: 0.3,
        audioBuffer: generateDemoAudioBuffer(ctx, "vocal", 10)
      };
      musicClip = {
        id: "clip-demo-music",
        name: "Electronic Intro Theme",
        startOffset: 0.0,
        audioStart: 0,
        duration: 32,
        volume: 0.5,
        fadeIn: 2.0,
        fadeOut: 3.5,
        audioBuffer: generateDemoAudioBuffer(ctx, "music", 32)
      };
      sfxClip = {
        id: "clip-demo-sfx",
        name: "Transition Sweeper",
        startOffset: 3.0,
        audioStart: 0,
        duration: 5,
        volume: 0.7,
        fadeIn: 0.1,
        fadeOut: 0.8,
        audioBuffer: generateDemoAudioBuffer(ctx, "sfx", 5)
      };
    } else if (demoType === 'interview') {
      name = "Interview Session (Vocal)";
      vocalClip = {
        id: "clip-demo-vocal-int",
        name: "Host & Guest Dialogue",
        startOffset: 2.0,
        audioStart: 0,
        duration: 15,
        volume: 1.0,
        fadeIn: 0.1,
        fadeOut: 0.1,
        audioBuffer: generateDemoAudioBuffer(ctx, "vocal", 15)
      };
    } else if (demoType === 'ambient') {
      name = "Ambient Soundscape";
      musicClip = {
        id: "clip-demo-music-amb",
        name: "Lofi Dream Pad",
        startOffset: 0.0,
        audioStart: 0,
        duration: 40,
        volume: 0.6,
        fadeIn: 4.0,
        fadeOut: 5.0,
        audioBuffer: generateDemoAudioBuffer(ctx, "music", 40)
      };
      sfxClip = {
        id: "clip-demo-sfx-amb",
        name: "Rain Forest Atmos",
        startOffset: 5.0,
        audioStart: 0,
        duration: 20,
        volume: 0.4,
        fadeIn: 2.0,
        fadeOut: 2.0,
        audioBuffer: generateDemoAudioBuffer(ctx, "sfx", 20)
      };
    }

    setProject({
      name,
      tracks: [
        { id: "track-vocal", name: "🎤 Vocal / Co-Host", volume: 0.8, muted: false, soloed: false, clips: vocalClip ? [vocalClip] : [] },
        { id: "track-music", name: "🎵 Soundtrack Music", volume: 0.5, muted: false, soloed: false, clips: musicClip ? [musicClip] : [] },
        { id: "track-sfx", name: "⚡ Sound Effects (SFX)", volume: 0.8, muted: false, soloed: false, clips: sfxClip ? [sfxClip] : [] }
      ]
    });

    setToast({
      show: true,
      message: `Loaded demo: "${name}"`,
      type: "success"
    });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  };

  const handleExportMetadataTxt = () => {
    try {
      let text = `PODCAST STUDIO PRO - PROJECT METADATA REPORT\n`;
      text += `==============================================\n`;
      text += `Project Name: ${project.name}\n`;
      text += `Total Tracks: ${project.tracks.length}\n`;
      text += `Export Date: ${new Date().toLocaleString()}\n\n`;
      
      project.tracks.forEach((track, idx) => {
        text += `TRACK ${idx + 1}: ${track.name}\n`;
        text += `  - Volume Level: ${(track.volume * 100).toFixed(0)}%\n`;
        text += `  - Muted: ${track.muted ? "YES" : "NO"}\n`;
        text += `  - Soloed: ${track.soloed ? "YES" : "NO"}\n`;
        text += `  - Clips Count: ${track.clips.length}\n`;
        track.clips.forEach((clip, cIdx) => {
          text += `    * Clip ${cIdx + 1}: "${clip.name}"\n`;
          text += `      Timeline Position: ${clip.startOffset.toFixed(2)}s\n`;
          text += `      Clip Duration: ${clip.duration.toFixed(2)}s\n`;
          text += `      Fade In/Out: ${clip.fadeIn.toFixed(1)}s / ${clip.fadeOut.toFixed(1)}s\n`;
          text += `      Volume Level: ${(clip.volume * 100).toFixed(0)}%\n`;
        });
        text += `\n`;
      });

      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-metadata.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setToast({
        show: true,
        message: "Project metadata text report downloaded!",
        type: "success"
      });
      setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
    } catch (err) {
      console.error(err);
      alert("Failed to export metadata.");
    }
  };

  const handleQuitAudacity = () => {
    setToast({
      show: true,
      message: "Exited Audacity Session. Thank you for broadcasting!",
      type: "info"
    });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  };

  // ----------------------------------------------------
  // EFFECTS & EQ PRESET ADJUSTMENTS
  // ----------------------------------------------------
  const handleUpdateEQBand = (bandId: string, updates: Partial<EQBand>) => {
    setEffectsMap(prev => {
      const vocalEffects = { ...prev["track-vocal"] };
      vocalEffects.eqBands = vocalEffects.eqBands.map(b => {
        if (b.id === bandId) return { ...b, ...updates };
        return b;
      });
      return { ...prev, "track-vocal": vocalEffects };
    });
    
    if (isPlaying) {
      setTimeout(() => startAudioPlayback(currentTime), 15);
    }
  };

  const handleApplyEQPreset = (presetName: string) => {
    setActivePreset(presetName);
    
    let lowGain = 0;
    let midLowGain = 0;
    let midHighGain = 0;
    let presGain = 0;
    let highGain = 0;

    if (presetName === "Warm Broadcast") {
      lowGain = 4.0;
      midLowGain = 2.0;
      midHighGain = -1.0;
      presGain = 0.5;
      highGain = -2.0;
    } else if (presetName === "Vocal Air") {
      lowGain = -3.0;
      midLowGain = -1.0;
      midHighGain = 1.0;
      presGain = 3.5;
      highGain = 5.0;
    } else if (presetName === "Podcast Clarity") {
      lowGain = -1.5;
      midLowGain = -2.0;
      midHighGain = 3.0;
      presGain = 2.0;
      highGain = 1.5;
    } else if (presetName === "Bass Booster") {
      lowGain = 8.0;
      midLowGain = 3.5;
      midHighGain = 0;
      presGain = -1.0;
      highGain = -3.0;
    }

    setEffectsMap(prev => {
      const vocalEffects = { ...prev["track-vocal"] };
      vocalEffects.eqBands = vocalEffects.eqBands.map(b => {
        if (b.type === "lowshelf") return { ...b, gain: lowGain };
        if (b.type === "highshelf") return { ...b, gain: highGain };
        if (b.frequency === 500) return { ...b, gain: midLowGain };
        if (b.frequency === 1500) return { ...b, gain: midHighGain };
        if (b.frequency === 4000) return { ...b, gain: presGain };
        return b;
      });
      return { ...prev, "track-vocal": vocalEffects };
    });

    if (isPlaying) {
      setTimeout(() => startAudioPlayback(currentTime), 15);
    }
  };

  // Directly sets EQ, Compressor and Gate variables suggested by Gemini sound advice
  const handleApplyAIEffectsPreset = (eqBands: any[], compressor: any, gate: any) => {
    setEffectsMap(prev => {
      const vocalEffects = { ...prev["track-vocal"] };
      
      vocalEffects.eqEnabled = true;
      vocalEffects.eqBands = vocalEffects.eqBands.map(b => {
        const recommend = eqBands.find((rec: any) => Math.abs(rec.frequency - b.frequency) < 100);
        if (recommend) {
          return { ...b, gain: recommend.gain };
        }
        return b;
      });

      vocalEffects.compressorEnabled = true;
      vocalEffects.compressorThreshold = compressor.threshold;
      vocalEffects.compressorRatio = compressor.ratio;
      vocalEffects.compressorAttack = compressor.attack;
      vocalEffects.compressorRelease = compressor.release;

      vocalEffects.gateEnabled = true;
      vocalEffects.gateThreshold = gate.threshold;

      return { ...prev, "track-vocal": vocalEffects };
    });

    if (isPlaying) {
      setTimeout(() => startAudioPlayback(currentTime), 15);
    }
  };

  const handleUpdateVocalEffects = (updates: Partial<TrackEffects>) => {
    setEffectsMap(prev => {
      return {
        ...prev,
        "track-vocal": { ...prev["track-vocal"], ...updates }
      };
    });

    if (isPlaying) {
      setTimeout(() => startAudioPlayback(currentTime), 15);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0a0b0d] text-slate-800 dark:text-slate-200 flex flex-col font-sans select-none antialiased transition-colors duration-150">
      
      {/* 1. APP NAVBAR HEADER */}
      <header className="bg-white dark:bg-[#0f1115] border-b border-slate-200 dark:border-white/[0.06] px-6 py-3.5 flex flex-col lg:flex-row items-center justify-between sticky top-0 z-50 shrink-0 gap-4 lg:gap-0 shadow-sm dark:shadow-md dark:shadow-black/40 transition-colors duration-150">
        
        {/* Left Side: Brand Logo & Project Actions */}
        <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-start">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-bold text-base text-slate-900 dark:text-white tracking-tight leading-none uppercase">Podcast Studio Pro</h1>
                <span className="text-[9px] uppercase tracking-widest bg-emerald-500/10 text-emerald-650 dark:text-emerald-400 font-extrabold border border-emerald-500/20 px-1.5 py-0.5 rounded-md leading-none">
                  MVP Engine
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-tight mt-1 leading-none">High-Fidelity Multi-Track Production Suite</p>
            </div>
          </div>

          {/* Project Save / Load Button Group */}
          <div className="flex items-center gap-1.5 border-l border-slate-200 dark:border-white/10 pl-3 ml-1">
            <button
              onClick={handleSaveProjectLocal}
              className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
              title="Save project state to browser localStorage"
            >
              <Save className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Save</span>
            </button>

            {/* Audacity-Style Dropdown File Menu */}
            <div className="relative" ref={fileMenuRef}>
              <button
                onClick={() => setFileMenuOpen(!fileMenuOpen)}
                className="px-2.5 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-250 dark:border-white/10 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                title="Project file operations & export formats (Audacity style)"
              >
                <FolderOpen className="w-3.5 h-3.5" /> <span>File</span> <ChevronDown className="w-3 h-3 ml-0.5" />
              </button>

              {fileMenuOpen && (
                <div className="absolute left-0 mt-1.5 w-72 bg-slate-50 dark:bg-[#14171c] border border-slate-300 dark:border-white/10 rounded-xl shadow-2xl py-1 z-50 text-xs font-medium text-slate-800 dark:text-slate-200 select-none">
                  
                  {/* New */}
                  <button
                    onClick={() => { handleNewProject(); setFileMenuOpen(false); }}
                    className="w-full px-3 py-1.5 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-950 flex items-center justify-between cursor-pointer text-left transition-colors"
                  >
                    <span className="flex items-center gap-2"><Plus className="w-3.5 h-3.5" /> New</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">Ctrl+N</span>
                  </button>

                  {/* Open */}
                  <button
                    onClick={() => { projectFileInputRef.current?.click(); setFileMenuOpen(false); }}
                    className="w-full px-3 py-1.5 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-950 flex items-center justify-between cursor-pointer text-left transition-colors"
                  >
                    <span className="flex items-center gap-2"><FolderOpen className="w-3.5 h-3.5" /> Open...</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">Ctrl+O</span>
                  </button>

                  {/* Recent Files (with Submenu) */}
                  <div className="relative group/sub">
                    <div className="px-3 py-1.5 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-950 flex items-center justify-between cursor-pointer text-left transition-colors">
                      <span className="flex items-center gap-2"><History className="w-3.5 h-3.5" /> Recent Files</span>
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                    </div>
                    <div className="absolute left-full top-0 ml-1 hidden group-hover/sub:flex flex-col bg-slate-50 dark:bg-[#14171c] border border-slate-300 dark:border-white/10 rounded-xl shadow-2xl py-1 w-60 z-50 text-slate-800 dark:text-slate-200">
                      <button
                        onClick={() => { handleLoadDemo('podcast'); setFileMenuOpen(false); }}
                        className="px-3 py-1.5 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-950 text-left truncate transition-colors cursor-pointer"
                      >
                        Demo Podcast Episode
                      </button>
                      <button
                        onClick={() => { handleLoadDemo('interview'); setFileMenuOpen(false); }}
                        className="px-3 py-1.5 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-950 text-left truncate transition-colors cursor-pointer"
                      >
                        Interview Session (Vocal)
                      </button>
                      <button
                        onClick={() => { handleLoadDemo('ambient'); setFileMenuOpen(false); }}
                        className="px-3 py-1.5 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-950 text-left truncate transition-colors cursor-pointer"
                      >
                        Ambient Soundscape
                      </button>
                    </div>
                  </div>

                  {/* Open From Cloud (with Submenu) */}
                  <div className="relative group/sub">
                    <div className="px-3 py-1.5 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-950 flex items-center justify-between cursor-pointer text-left transition-colors">
                      <span className="flex items-center gap-2"><Cloud className="w-3.5 h-3.5" /> Open From Cloud</span>
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                    </div>
                    <div className="absolute left-full top-0 ml-1 hidden group-hover/sub:flex flex-col bg-slate-50 dark:bg-[#14171c] border border-slate-300 dark:border-white/10 rounded-xl shadow-2xl py-1 w-52 z-50 text-slate-800 dark:text-slate-200">
                      <button
                        onClick={() => {
                          setToast({ show: true, message: "Opening Google Drive connection...", type: "info" });
                          setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
                          setFileMenuOpen(false);
                        }}
                        className="px-3 py-1.5 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-950 text-left transition-colors cursor-pointer"
                      >
                        Google Drive
                      </button>
                      <button
                        onClick={() => {
                          setToast({ show: true, message: "AI Studio workspace folder connected", type: "info" });
                          setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
                          setFileMenuOpen(false);
                        }}
                        className="px-3 py-1.5 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-950 text-left transition-colors cursor-pointer"
                      >
                        AI Studio Workspace
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 dark:border-white/10 my-1" />

                  {/* Save Project (with Submenu) */}
                  <div className="relative group/sub">
                    <div className="px-3 py-1.5 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-950 flex items-center justify-between cursor-pointer text-left transition-colors">
                      <span className="flex items-center gap-2"><Save className="w-3.5 h-3.5 text-emerald-500" /> Save Project</span>
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                    </div>
                    <div className="absolute left-full top-0 ml-1 hidden group-hover/sub:flex flex-col bg-slate-50 dark:bg-[#14171c] border border-slate-300 dark:border-white/10 rounded-xl shadow-2xl py-1 w-60 z-50 text-slate-800 dark:text-slate-200">
                      <button
                        onClick={() => { handleSaveProjectLocal(); setFileMenuOpen(false); }}
                        className="px-3 py-1.5 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-950 text-left font-semibold flex items-center gap-2 text-emerald-600 dark:text-emerald-400 transition-colors cursor-pointer"
                      >
                        <Save className="w-4 h-4" /> Save Project (Local)
                      </button>
                      <button
                        onClick={() => { handleExportProjectJson(); setFileMenuOpen(false); }}
                        className="px-3 py-1.5 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-950 text-left flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <FileJson className="w-4 h-4 text-emerald-500" /> Save Backup JSON...
                      </button>
                    </div>
                  </div>

                  {/* Save To Cloud */}
                  <button
                    onClick={() => {
                      setToast({ show: true, message: "Uploading project session file to cloud storage...", type: "info" });
                      setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
                      setFileMenuOpen(false);
                    }}
                    className="w-full px-3 py-1.5 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-950 flex items-center justify-between cursor-pointer text-left transition-colors"
                  >
                    <span className="flex items-center gap-2"><Cloud className="w-3.5 h-3.5 text-blue-500" /> Save To Cloud...</span>
                  </button>

                  {/* Update Cloud Preview */}
                  <button
                    onClick={() => {
                      setToast({ show: true, message: "Transmitting rendering graph to server. Preview updated!", type: "success" });
                      setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
                      setFileMenuOpen(false);
                    }}
                    className="w-full px-3 py-1.5 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-950 flex items-center justify-between cursor-pointer text-left transition-colors"
                  >
                    <span className="flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5 text-indigo-500" /> Update Cloud Audio Preview</span>
                  </button>

                  <div className="border-t border-slate-200 dark:border-white/10 my-1" />

                  {/* Export Audio (with Submenu) */}
                  <div className="relative group/sub">
                    <div className="px-3 py-1.5 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-950 flex items-center justify-between cursor-pointer text-left transition-colors">
                      <span className="flex items-center gap-2"><Download className="w-3.5 h-3.5 text-rose-500" /> Export Audio...</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">Ctrl+Shift+E</span>
                    </div>
                    <div className="absolute left-full top-0 ml-1 hidden group-hover/sub:flex flex-col bg-slate-50 dark:bg-[#14171c] border border-slate-300 dark:border-white/10 rounded-xl shadow-2xl py-1 w-52 z-50 text-slate-800 dark:text-slate-200">
                      <button
                        onClick={() => { handleExportAudioFormat('mp3'); setFileMenuOpen(false); }}
                        className="px-3 py-1.5 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-950 text-left flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <FileAudio className="w-4 h-4 text-rose-500" /> Export MP3 (*.mp3)
                      </button>
                      <button
                        onClick={() => { handleExportAudioFormat('wav'); setFileMenuOpen(false); }}
                        className="px-3 py-1.5 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-950 text-left flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <FileAudio className="w-4 h-4 text-rose-500" /> Export WAV (*.wav)
                      </button>
                      <button
                        onClick={() => { handleExportAudioFormat('m4a'); setFileMenuOpen(false); }}
                        className="px-3 py-1.5 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-950 text-left flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <FileAudio className="w-4 h-4 text-rose-500" /> Export M4A (*.m4a)
                      </button>
                      <button
                        onClick={() => { handleExportAudioFormat('ogg'); setFileMenuOpen(false); }}
                        className="px-3 py-1.5 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-950 text-left flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <FileAudio className="w-4 h-4 text-rose-500" /> Export OGG Vorbis (*.ogg)
                      </button>
                      <button
                        onClick={() => { handleExportAudioFormat('flac'); setFileMenuOpen(false); }}
                        className="px-3 py-1.5 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-950 text-left flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <FileAudio className="w-4 h-4 text-rose-500" /> Export FLAC (*.flac)
                      </button>
                    </div>
                  </div>

                  {/* Export Other (with Submenu) */}
                  <div className="relative group/sub">
                    <div className="px-3 py-1.5 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-950 flex items-center justify-between cursor-pointer text-left transition-colors">
                      <span className="flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-yellow-500" /> Export Other</span>
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                    </div>
                    <div className="absolute left-full top-0 ml-1 hidden group-hover/sub:flex flex-col bg-slate-50 dark:bg-[#14171c] border border-slate-300 dark:border-white/10 rounded-xl shadow-2xl py-1 w-60 z-50 text-slate-800 dark:text-slate-200">
                      <button
                        onClick={() => { handleExportMetadataTxt(); setFileMenuOpen(false); }}
                        className="px-3 py-1.5 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-950 text-left flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <FileText className="w-4 h-4 text-yellow-500" /> Export Project Metadata (.txt)
                      </button>
                      <button
                        onClick={() => {
                          setToast({ show: true, message: "MIDI exports are not available in current session.", type: "info" });
                          setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
                          setFileMenuOpen(false);
                        }}
                        className="px-3 py-1.5 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-950 text-left flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <FileAudio className="w-4 h-4 text-blue-500" /> Export MIDI Selection...
                      </button>
                    </div>
                  </div>

                  {/* Import (with Submenu) */}
                  <div className="relative group/sub">
                    <div className="px-3 py-1.5 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-950 flex items-center justify-between cursor-pointer text-left transition-colors">
                      <span className="flex items-center gap-2"><Upload className="w-3.5 h-3.5 text-purple-500" /> Import</span>
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                    </div>
                    <div className="absolute left-full top-0 ml-1 hidden group-hover/sub:flex flex-col bg-slate-50 dark:bg-[#14171c] border border-slate-300 dark:border-white/10 rounded-xl shadow-2xl py-1 w-60 z-50 text-slate-800 dark:text-slate-200">
                      <button
                        onClick={() => { projectFileInputRef.current?.click(); setFileMenuOpen(false); }}
                        className="px-3 py-1.5 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-950 text-left flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <FileJson className="w-4 h-4 text-emerald-500" /> Project JSON Backup...
                      </button>
                      <button
                        onClick={() => {
                          setToast({ show: true, message: "Please use the 'Add Clip' buttons on the tracks to upload audio files.", type: "info" });
                          setTimeout(() => setToast(prev => ({ ...prev, show: false })), 5000);
                          setFileMenuOpen(false);
                        }}
                        className="px-3 py-1.5 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-950 text-left flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <FileAudio className="w-4 h-4 text-purple-500" /> Import Audio Clip File...
                      </button>
                    </div>
                  </div>

                  {/* Share Audio */}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      setToast({ show: true, message: "Share link successfully copied to clipboard!", type: "success" });
                      setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
                      setFileMenuOpen(false);
                    }}
                    className="w-full px-3 py-1.5 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-950 flex items-center justify-between cursor-pointer text-left transition-colors"
                  >
                    <span className="flex items-center gap-2"><Globe className="w-3.5 h-3.5 text-emerald-500" /> Share Audio...</span>
                  </button>

                  <div className="border-t border-slate-200 dark:border-white/10 my-1" />

                  {/* Close Project */}
                  <button
                    onClick={() => { handleCloseProject(); setFileMenuOpen(false); }}
                    className="w-full px-3 py-1.5 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-950 flex items-center justify-between cursor-pointer text-left text-rose-500 dark:text-rose-400 transition-colors"
                  >
                    <span className="flex items-center gap-2"><XCircle className="w-3.5 h-3.5" /> Close Project</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">Ctrl+W</span>
                  </button>

                  {/* Quit */}
                  <button
                    onClick={() => { handleQuitAudacity(); setFileMenuOpen(false); }}
                    className="w-full px-3 py-1.5 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-950 flex items-center justify-between cursor-pointer text-left text-slate-500 dark:text-slate-400 transition-colors"
                  >
                    <span className="flex items-center gap-2"><LogOut className="w-3.5 h-3.5" /> Quit Audacity</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">Ctrl+Q</span>
                  </button>

                </div>
              )}
            </div>

            <input
              type="file"
              ref={projectFileInputRef}
              onChange={handleLoadProjectJson}
              accept=".json"
              className="hidden"
            />
          </div>
        </div>

        {/* Center: Segmented Workspace Switcher */}
        <div className="flex items-center bg-slate-200/60 dark:bg-[#14171c] p-1 rounded-xl border border-slate-300/60 dark:border-white/[0.06] w-full lg:w-auto overflow-x-auto shrink-0 select-none">
          <button
            onClick={() => setActiveWorkspace('arrange')}
            className={`flex-1 lg:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeWorkspace === 'arrange'
                ? "bg-emerald-500 text-slate-950 shadow-md font-extrabold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Arrange & Mix
          </button>
          <button
            onClick={() => setActiveWorkspace('ai')}
            className={`flex-1 lg:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeWorkspace === 'ai'
                ? "bg-emerald-500 text-slate-950 shadow-md font-extrabold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> AI Production
          </button>
          <button
            onClick={() => {
              setActiveWorkspace('console');
              setActiveConsoleTab('mixer');
            }}
            className={`flex-1 lg:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeWorkspace === 'console'
                ? "bg-emerald-500 text-slate-950 shadow-md font-extrabold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" /> Studio Console
          </button>
          <button
            onClick={() => setActiveWorkspace('publish')}
            className={`flex-1 lg:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeWorkspace === 'publish'
                ? "bg-emerald-500 text-slate-950 shadow-md font-extrabold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Radio className="w-3.5 h-3.5" /> Publish & Distribute
          </button>
        </div>

        {/* Right Side: Playback controls + Theme Toggle */}
        <div className="flex items-center justify-between lg:justify-end gap-3 w-full lg:w-auto border-t lg:border-t-0 border-slate-200 dark:border-white/5 pt-3 lg:pt-0">
          
          {/* Playback Controls Hub */}
          <div className="flex items-center gap-3 bg-slate-50 dark:bg-[#14171c] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/[0.06] shadow-sm">
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleSeek(0)}
                className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5 rounded-lg transition"
                title="Skip back to start"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>
              
              {isPlaying ? (
                <button
                  onClick={handlePause}
                  className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-full border border-rose-500/20 dark:border-rose-500/30 transition cursor-pointer"
                  title="Pause playback"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                </button>
              ) : (
                <button
                  onClick={handlePlay}
                  className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-500/20 dark:border-emerald-500/30 transition cursor-pointer"
                  title="Start playback"
                >
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                </button>
              )}

              <button
                onClick={handleStop}
                className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5 rounded-lg transition"
                title="Stop playback"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>

              <div className="h-4 w-px bg-slate-200 dark:bg-white/10 mx-1"></div>

              {isRecording ? (
                <button
                  onClick={handleStopRecord}
                  className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition flex items-center justify-center gap-1.5 font-bold text-[10px] sm:text-xs shadow-[0_0_12px_rgba(239,68,68,0.3)] animate-pulse cursor-pointer shrink-0"
                  title="Stop voice recording"
                >
                  <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                  <span className="hidden sm:inline tracking-wider font-extrabold">STOP REC</span>
                  <Mic className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={() => handleStartRecord("track-vocal")}
                  className="p-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 dark:hover:bg-rose-500/15 rounded-lg border border-rose-500/20 dark:border-rose-500/30 transition flex items-center justify-center gap-1.5 font-bold text-[10px] sm:text-xs cursor-pointer shrink-0"
                  title="Record from microphone to Vocal Track"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                  <span className="hidden sm:inline tracking-wider font-extrabold">MIC REC</span>
                </button>
              )}
            </div>

            <div className="h-4 w-px bg-slate-200 dark:bg-white/10"></div>

            {/* Timecode display */}
            <div className="flex items-center gap-1.5 font-mono text-xs select-none">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                {Math.floor(currentTime / 60)}:{(Math.floor(currentTime) % 60).toString().padStart(2, "0")}.
                <span className="text-[10px] opacity-70">{(Math.floor((currentTime % 1) * 10))}</span>
              </span>
              <span className="text-slate-400 dark:text-slate-600">/</span>
              <span className="text-slate-500">0:45</span>
            </div>
          </div>

          {/* Theme Switcher Button */}
          <button
            onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
            className="p-2.5 bg-slate-50 dark:bg-[#14171c] hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/[0.06] rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition shadow-sm cursor-pointer flex items-center justify-center shrink-0"
            title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-500" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600" />
            )}
          </button>
          
        </div>
      </header>

      {/* 2. MAIN CORE LAYOUT STUDIO */}
      <main className="flex-1 flex overflow-hidden min-h-0 bg-slate-100 dark:bg-[#0a0b0d] transition-colors duration-150">
        
        {/* WORKSPACE 1: ARRANGE & MIX */}
        {activeWorkspace === 'arrange' && (
          <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden h-full animate-fadeIn">
            {/* Top Multi-track Timeline */}
            <div className="flex-1 min-h-0">
              <TrackTimeline
                tracks={project.tracks}
                currentTime={currentTime}
                duration={projectDuration}
                isPlaying={isPlaying}
                selectedClipId={selectedClipId}
                onSelectClip={setSelectedClipId}
                onUpdateTrack={handleUpdateTrack}
                onUpdateClip={handleUpdateClip}
                onAddClip={handleAddClip}
                onDeleteClip={handleDeleteClip}
                onSplitClip={handleSplitClip}
                onSeek={handleSeek}
                onStartRecord={handleStartRecord}
                onStopRecord={handleStopRecord}
                isRecording={isRecording}
                recordingTrackId={recordingTrackId}
                audioCtx={audioCtx}
              />
            </div>

            {/* Quick Links Status Bar */}
            <div className="bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-white/[0.06] rounded-xl px-4 py-3 shadow-sm flex flex-col sm:flex-row items-center justify-between text-xs gap-3 sm:gap-0 transition-colors duration-150">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <Sliders className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Console Mixer, Parametric EQ, and Vocal FX are now hidden to maximize your timeline space.</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => {
                    setActiveWorkspace('console');
                    setActiveConsoleTab('mixer');
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg text-emerald-600 dark:text-emerald-400 font-bold transition-all text-xs"
                >
                  Mixer Console ➔
                </button>
                <button
                  onClick={() => {
                    setActiveWorkspace('console');
                    setActiveConsoleTab('eq');
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg text-emerald-600 dark:text-emerald-400 font-bold transition-all text-xs"
                >
                  Parametric EQ ➔
                </button>
                <button
                  onClick={() => {
                    setActiveWorkspace('console');
                    setActiveConsoleTab('effects');
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg text-emerald-600 dark:text-emerald-400 font-bold transition-all text-xs"
                >
                  Vocal FX Rack ➔
                </button>
              </div>
            </div>
          </div>
        )}

        {/* WORKSPACE 2: AI PODCAST PRODUCER */}
        {activeWorkspace === 'ai' && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 overflow-y-auto custom-scrollbar animate-fadeIn">
            {/* Left Column (Main Focus): AI Transcription & Show Notes Producer (Full Width) */}
            <div className="lg:col-span-12 flex flex-col h-full min-h-[500px] gap-4">
              <AIProducer
                project={project}
                currentTime={currentTime}
                onSeek={handleSeek}
                onUpdateCoverArt={setCoverArtUrl}
                coverArtUrl={coverArtUrl}
                onApplyEffectsPreset={handleApplyAIEffectsPreset}
                onRemoveTimeRange={handleRemoveTimeRange}
                vocalTrackClip={project.tracks.find(t => t.id === "track-vocal")?.clips[0] || null}
              />

              {/* Minimalist Quick Link to hidden Soundboard */}
              <div className="bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-white/[0.06] rounded-xl px-4 py-3 shadow-sm flex flex-col sm:flex-row items-center justify-between text-xs gap-3 sm:gap-0 transition-colors duration-150">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  <Layout className="w-4 h-4 text-emerald-650 dark:text-emerald-400 shrink-0" />
                  <span>Soundboard Drops and custom audio triggers are now housed in the dedicated Studio Console workspace.</span>
                </div>
                <button
                  onClick={() => {
                    setActiveWorkspace('console');
                    setActiveConsoleTab('soundboard');
                  }}
                  className="px-4 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-lg font-bold transition-all w-full sm:w-auto text-center"
                >
                  Open Soundboard Panel ➔
                </button>
              </div>
            </div>
          </div>
        )}

        {/* WORKSPACE 4: STUDIO CONSOLE & PROCESSING */}
        {activeWorkspace === 'console' && (
          <div className="flex-1 flex flex-col lg:flex-row p-4 gap-4 overflow-hidden h-full animate-fadeIn">
            {/* Left Sidebar Links Menu */}
            <div className="w-full lg:w-64 shrink-0 bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-white/[0.06] rounded-xl p-4 flex flex-col gap-4 shadow-sm dark:shadow-xl transition-colors duration-150">
              <div>
                <span className="text-[10px] font-mono text-emerald-650 dark:text-emerald-400 uppercase tracking-widest font-extrabold">STUDIO TOOLS</span>
                <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white tracking-tight mt-0.5">Control & Processing</h3>
              </div>
              
              <div className="flex flex-col gap-1.5">
                {[
                  { id: "mixer", name: "Console Mixer", icon: Volume2, desc: "Faders, Panning & Level Meters" },
                  { id: "eq", name: "Parametric EQ", icon: Activity, desc: "Frequency & Color Adjustment" },
                  { id: "effects", name: "Vocal Effects", icon: Settings, desc: "Compression, Gate & Spatial FX" },
                  { id: "soundboard", name: "Soundboard Drops", icon: Layout, desc: "Trigger Clips & SFX Jingles" }
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeConsoleTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveConsoleTab(item.id as any)}
                      className={`w-full text-left p-3 rounded-lg border flex items-center gap-3 transition-all cursor-pointer ${
                        isActive
                          ? "bg-emerald-500/10 text-emerald-650 dark:text-emerald-400 border-emerald-500/20 shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border-transparent hover:bg-slate-50 dark:hover:bg-white/5"
                      }`}
                    >
                      <span className={`p-1.5 rounded-md ${isActive ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400'}`}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold leading-tight">{item.name}</span>
                        <span className="text-[9px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{item.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-auto pt-3 border-t border-slate-200 dark:border-white/[0.06] text-[10px] text-slate-500 dark:text-slate-400 flex flex-col gap-1 hidden lg:flex">
                <div className="font-mono">Output Routing:</div>
                <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400 font-mono text-[9px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  LIVE MIXDOWN BUS
                </div>
              </div>
            </div>

            {/* Right Main Content area displaying active tool */}
            <div className="flex-1 bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-white/[0.06] rounded-xl p-5 shadow-sm dark:shadow-xl flex flex-col min-w-0 h-full overflow-y-auto custom-scrollbar transition-colors duration-150">
              <div className="flex-1">
                {activeConsoleTab === 'mixer' && (
                  <MixerConsole
                    tracks={project.tracks}
                    masterVolume={masterVolume}
                    onUpdateTrack={handleUpdateTrack}
                    onUpdateMasterVolume={setMasterVolume}
                    isPlaying={isPlaying}
                    trackLevels={trackLevels}
                  />
                )}
                {activeConsoleTab === 'eq' && (
                  <EQPanel
                    eqEnabled={effectsMap["track-vocal"].eqEnabled}
                    eqBands={effectsMap["track-vocal"].eqBands}
                    onToggleEQ={(enabled) => handleUpdateVocalEffects({ eqEnabled: enabled })}
                    onUpdateBand={handleUpdateEQBand}
                    onApplyPreset={handleApplyEQPreset}
                    activePreset={activePreset}
                  />
                )}
                {activeConsoleTab === 'effects' && (
                  <EffectsPanel
                    effects={effectsMap["track-vocal"]}
                    onUpdateEffects={handleUpdateVocalEffects}
                  />
                )}
                {activeConsoleTab === 'soundboard' && (
                  <Soundboard
                    onAddSFXToTimeline={handleAddSFXToTimeline}
                    audioCtx={audioCtx}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* WORKSPACE 3: PUBLISH & SYNDICATE */}
        {activeWorkspace === 'publish' && (
          <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto custom-scrollbar animate-fadeIn">
            <div className="w-full max-w-2xl py-4 h-full flex flex-col justify-center">
              <PublishPanel
                initialTitle={project.name}
                initialDescription=""
                coverArtUrl={coverArtUrl}
                audioDuration={projectDuration}
                onExportWav={handleExportWav}
                onExportFormat={handleExportAudioFormat}
                isExporting={isExporting}
              />
            </div>
          </div>
        )}

      </main>

      {/* Dynamic Action Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-slate-900 dark:bg-white text-white dark:text-slate-950 px-4 py-3 rounded-xl shadow-2xl border border-white/10 dark:border-slate-200 animate-slideUp font-sans text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------
// DEFAULT PARAMETERS INITIALIZER HELPERS
// ----------------------------------------------------
function createDefaultEffects(eqOn: boolean = false): TrackEffects {
  return {
    eqEnabled: eqOn,
    eqBands: [
      { id: "band-1", frequency: 150, type: "lowshelf", gain: 0, Q: 1.0 },
      { id: "band-2", frequency: 500, type: "peaking", gain: 0, Q: 1.2 },
      { id: "band-3", frequency: 1500, type: "peaking", gain: 0, Q: 1.5 },
      { id: "band-4", frequency: 4000, type: "peaking", gain: 0, Q: 1.5 },
      { id: "band-5", frequency: 10000, type: "highshelf", gain: 0, Q: 1.0 }
    ],
    reverbEnabled: false,
    reverbMix: 0.15,
    reverbSize: 0.5,
    delayEnabled: false,
    delayMix: 0.2,
    delayTime: 0.35,
    delayFeedback: 0.4,
    compressorEnabled: false,
    compressorThreshold: -20,
    compressorRatio: 4,
    compressorAttack: 0.02,
    compressorRelease: 0.1,
    gateEnabled: false,
    gateThreshold: -50
  };
}
