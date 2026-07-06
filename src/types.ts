/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AudioClip {
  id: string;
  name: string;
  startOffset: number; // Seconds from timeline start where this clip begins
  audioStart: number;  // Seconds inside the source audio buffer where playback starts
  duration: number;    // Playback duration in seconds
  volume: number;      // Clip-level volume gain (0 to 1)
  fadeIn: number;      // Fade in duration in seconds
  fadeOut: number;     // Fade out duration in seconds
  url?: string;        // Optional URL of source file (for preloaded tracks)
  audioBuffer?: AudioBuffer; // Decoded client-side AudioBuffer
}

export interface AudioTrack {
  id: string;
  name: string;
  type: 'vocal' | 'music' | 'sfx';
  volume: number; // Track-level volume (0 to 1.5)
  pan: number;    // Stereo panning (-1 to 1)
  muted: boolean;
  soloed: boolean;
  clips: AudioClip[];
  color: string;  // Visual theme class/color (e.g., 'emerald', 'sky', 'violet')
}

export interface EQBand {
  id: string;
  frequency: number;
  type: 'lowshelf' | 'peaking' | 'highshelf';
  gain: number; // dB (-12 to +12)
  Q: number;    // Quality factor (0.1 to 10)
}

export interface TrackEffects {
  eqEnabled: boolean;
  eqBands: EQBand[];
  reverbEnabled: boolean;
  reverbMix: number; // 0 to 1
  reverbSize: number; // 0.1 to 0.95
  delayEnabled: boolean;
  delayMix: number; // 0 to 1
  delayTime: number; // seconds
  delayFeedback: number; // 0 to 1
  compressorEnabled: boolean;
  compressorThreshold: number; // dB (-60 to 0)
  compressorRatio: number; // 1 to 20
  compressorAttack: number; // seconds (0.001 to 0.5)
  compressorRelease: number; // seconds (0.01 to 1)
  gateEnabled: boolean;
  gateThreshold: number; // dB (-80 to -20)
}

export interface SoundEffect {
  id: string;
  name: string;
  category: 'intro' | 'sfx' | 'music';
  duration: number; // seconds
  url: string;
  icon?: string;
}

export interface Project {
  id: string;
  name: string;
  updatedAt: string;
  tracks: AudioTrack[];
}

export interface TranscriptSegment {
  speaker: string;
  text: string;
  start: number; // seconds
  end: number;   // seconds
  isFiller?: boolean;
}

export interface AIResponse {
  transcript: TranscriptSegment[];
  summary: string;
  showNotes: {
    title: string;
    description: string;
    chapters: { timestamp: string; title: string; description: string }[];
    bulletPoints: string[];
    keywords: string[];
  };
}
