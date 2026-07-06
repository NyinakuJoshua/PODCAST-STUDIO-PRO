/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Project, TrackEffects, AudioClip } from "../types";

/**
 * Encodes an AudioBuffer into a standard, playable WAV file Blob.
 */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // 1 = 16-bit PCM
  const bitDepth = 16;
  
  let result: Float32Array;
  if (numChannels === 2) {
    result = interleaveChannels(buffer.getChannelData(0), buffer.getChannelData(1));
  } else {
    result = buffer.getChannelData(0);
  }
  
  const bufferLength = result.length * 2;
  const wavBuffer = new ArrayBuffer(44 + bufferLength);
  const view = new DataView(wavBuffer);
  
  // RIFF identifier
  writeString(view, 0, "RIFF");
  // file length
  view.setUint32(4, 36 + bufferLength, true);
  // RIFF type
  writeString(view, 8, "WAVE");
  // format chunk identifier
  writeString(view, 12, "fmt ");
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw PCM)
  view.setUint16(20, format, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, numChannels * (bitDepth / 8), true);
  // bits per sample
  view.setUint16(34, bitDepth, true);
  // data chunk identifier
  writeString(view, 36, "data");
  // data chunk length
  view.setUint32(40, bufferLength, true);
  
  // Write the PCM audio samples
  floatTo16BitPCM(view, 44, result);
  
  return new Blob([wavBuffer], { type: "audio/wav" });
}

function interleaveChannels(inputL: Float32Array, inputR: Float32Array): Float32Array {
  const length = inputL.length + inputR.length;
  const result = new Float32Array(length);
  let index = 0;
  let inputIndex = 0;
  
  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
}

function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Creates a synthetic demo audio buffer inside the browser.
 */
export function generateDemoAudioBuffer(
  ctx: AudioContext | OfflineAudioContext,
  type: "vocal" | "music" | "sfx",
  duration: number = 5
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const numSamples = sampleRate * duration;
  const buffer = ctx.createBuffer(type === "music" ? 2 : 1, numSamples, sampleRate);
  
  if (type === "music") {
    // Generate a beautiful, upbeat electronic synth beat
    const chL = buffer.getChannelData(0);
    const chR = buffer.getChannelData(1);
    const bpm = 120;
    const beatSec = 60 / bpm;
    
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      
      // Kick drum simulation: descending sine wave
      const beatNum = Math.floor(t / beatSec);
      const tBeat = t % beatSec;
      const kickFreq = 150 * Math.exp(-20 * tBeat) + 40;
      const kick = Math.sin(2 * Math.PI * kickFreq * tBeat) * Math.exp(-5 * tBeat);
      
      // Synthesizer melody (arpeggio)
      const notes = [261.63, 329.63, 392.00, 523.25, 440.00, 392.00, 349.23, 329.63]; // C, E, G, C, A, G, F, E
      const stepIndex = Math.floor(t / (beatSec / 2)) % notes.length;
      const freq = notes[stepIndex];
      const gate = (t % (beatSec / 2)) < (beatSec * 0.4) ? 1 : 0;
      const synth = Math.sin(2 * Math.PI * freq * t) * 0.15 * gate * Math.exp(-2 * (t % (beatSec / 2)));
      
      // Hi-hat noise burst on offbeats
      const hatBeat = (t + beatSec / 2) % beatSec;
      const noise = (Math.random() - 0.5) * 0.05 * Math.exp(-40 * hatBeat);
      
      // Spatial panning
      const pan = Math.sin(2 * Math.PI * 0.5 * t); // slow panning
      chL[i] = (kick + synth * (1 - pan) * 0.7 + noise) * 0.3;
      chR[i] = (kick + synth * (1 + pan) * 0.7 - noise) * 0.3;
    }
  } else if (type === "vocal") {
    // Generate a rhythmic voice-like synth sweep (formant "wah-wah" voice)
    const ch = buffer.getChannelData(0);
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      // Fundamental vocal pitch
      const baseFreq = 120 + 20 * Math.sin(2 * Math.PI * 1 * t); // vibrating pitch
      // Synthesizer voice (buzz wave)
      let buzz = 0;
      for (let harmonic = 1; harmonic <= 5; harmonic++) {
        buzz += (1 / harmonic) * Math.sin(2 * Math.PI * baseFreq * harmonic * t);
      }
      // Formant filtering sweep (vowel shift "aaah" to "oooh")
      const lfo = 0.5 + 0.5 * Math.sin(2 * Math.PI * 1.5 * t);
      const filterFreq = 400 + 1200 * lfo;
      const voice = buzz * Math.exp(-Math.pow((baseFreq - filterFreq) / 500, 2)) * 0.25;
      
      // Add speech envelope pauses
      const speechEnvelope = Math.max(0, Math.sin(2 * Math.PI * 0.4 * t));
      ch[i] = voice * speechEnvelope * 0.35;
    }
  } else {
    // sfx: Sweep, chimes or transitional record scratch / sound rise
    const ch = buffer.getChannelData(0);
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      // Pitch sweep up for an elegant chime/transitional effect
      const freq = 300 + 1500 * (t / duration);
      const chime = Math.sin(2 * Math.PI * freq * t) * Math.exp(-1.5 * t);
      // Gentle noise background
      const noise = (Math.random() - 0.5) * 0.01 * (1 - t / duration);
      ch[i] = (chime * 0.4 + noise) * 0.3;
    }
  }
  
  return buffer;
}

/**
 * Renders an entire project using OfflineAudioContext.
 * Mixes all tracks, clips, trims, faders, panning, and active effects into a single buffer.
 */
export async function renderProjectToBuffer(
  project: Project,
  effectsMap: Record<string, TrackEffects>, // Key is track ID, or "master"
  duration: number = 30
): Promise<AudioBuffer> {
  const sampleRate = 44100;
  const offlineCtx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);
  
  // Create a Reverb Impulse response for offline convolution
  const reverbImpulse = createReverbImpulseResponse(offlineCtx, 1.5);
  
  // Set up Master node chain
  const masterEffects = effectsMap["master"] || {
    compressorEnabled: false,
    compressorThreshold: -15,
    compressorRatio: 4,
    compressorAttack: 0.03,
    compressorRelease: 0.1,
    eqEnabled: false,
    eqBands: [],
    reverbEnabled: false,
    reverbMix: 0,
    reverbSize: 0,
    delayEnabled: false,
    delayMix: 0,
    delayTime: 0.3,
    delayFeedback: 0.3,
    gateEnabled: false,
    gateThreshold: -50
  };
  
  const masterGain = offlineCtx.createGain();
  masterGain.gain.setValueAtTime(1.0, 0);
  
  let lastMasterNode: AudioNode = masterGain;
  
  // Master EQ (if enabled)
  if (masterEffects.eqEnabled && masterEffects.eqBands.length > 0) {
    for (const band of masterEffects.eqBands) {
      const filter = offlineCtx.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.setValueAtTime(band.frequency, 0);
      filter.gain.setValueAtTime(band.gain, 0);
      filter.Q.setValueAtTime(band.Q, 0);
      lastMasterNode.connect(filter);
      lastMasterNode = filter;
    }
  }
  
  // Master Compressor
  if (masterEffects.compressorEnabled) {
    const comp = offlineCtx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(masterEffects.compressorThreshold, 0);
    comp.ratio.setValueAtTime(masterEffects.compressorRatio, 0);
    comp.attack.setValueAtTime(masterEffects.compressorAttack, 0);
    comp.release.setValueAtTime(masterEffects.compressorRelease, 0);
    lastMasterNode.connect(comp);
    lastMasterNode = comp;
  }
  
  // Connect master channel to destination
  lastMasterNode.connect(offlineCtx.destination);
  
  // Process individual tracks
  const soloedTrackIds = project.tracks.filter(t => t.soloed).map(t => t.id);
  const hasSolo = soloedTrackIds.length > 0;
  
  for (const track of project.tracks) {
    // Skip if muted, or if solo exists and this track isn't soloed
    if (track.muted || (hasSolo && !track.soloed)) {
      continue;
    }
    
    // Create Track Nodes
    const trackGain = offlineCtx.createGain();
    trackGain.gain.setValueAtTime(track.volume, 0);
    
    const panner = offlineCtx.createStereoPanner();
    panner.pan.setValueAtTime(track.pan, 0);
    
    // Route track faders
    trackGain.connect(panner);
    let lastTrackNode: AudioNode = panner;
    
    // Fetch track effects
    const effects = effectsMap[track.id] || {
      eqEnabled: false,
      eqBands: [],
      reverbEnabled: false,
      reverbMix: 0.2,
      reverbSize: 0.5,
      delayEnabled: false,
      delayMix: 0.2,
      delayTime: 0.3,
      delayFeedback: 0.4,
      compressorEnabled: false,
      compressorThreshold: -20,
      compressorRatio: 4,
      compressorAttack: 0.02,
      compressorRelease: 0.1,
      gateEnabled: false,
      gateThreshold: -50
    };
    
    // Track Gate
    if (effects.gateEnabled) {
      // Implement a simple noise gate using standard offline dynamics compression with negative gain / extreme ratio
      // or simply skip lower amplitude. For Web Audio offline, a simple compressor simulates it:
      const gateComp = offlineCtx.createDynamicsCompressor();
      gateComp.threshold.setValueAtTime(effects.gateThreshold, 0);
      gateComp.ratio.setValueAtTime(12, 0);
      lastTrackNode.connect(gateComp);
      lastTrackNode = gateComp;
    }
    
    // Track EQ
    if (effects.eqEnabled && effects.eqBands.length > 0) {
      for (const band of effects.eqBands) {
        const filter = offlineCtx.createBiquadFilter();
        filter.type = band.type;
        filter.frequency.setValueAtTime(band.frequency, 0);
        filter.gain.setValueAtTime(band.gain, 0);
        filter.Q.setValueAtTime(band.Q, 0);
        lastTrackNode.connect(filter);
        lastTrackNode = filter;
      }
    }
    
    // Track Compressor
    if (effects.compressorEnabled) {
      const comp = offlineCtx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(effects.compressorThreshold, 0);
      comp.ratio.setValueAtTime(effects.compressorRatio, 0);
      comp.attack.setValueAtTime(effects.compressorAttack, 0);
      comp.release.setValueAtTime(effects.compressorRelease, 0);
      lastTrackNode.connect(comp);
      lastTrackNode = comp;
    }
    
    // Track Reverb
    if (effects.reverbEnabled) {
      const revConvolver = offlineCtx.createConvolver();
      revConvolver.buffer = reverbImpulse;
      
      const revDry = offlineCtx.createGain();
      const revWet = offlineCtx.createGain();
      
      const wetVal = effects.reverbMix;
      revDry.gain.setValueAtTime(1 - wetVal, 0);
      revWet.gain.setValueAtTime(wetVal, 0);
      
      lastTrackNode.connect(revDry);
      lastTrackNode.connect(revConvolver);
      revConvolver.connect(revWet);
      
      const merger = offlineCtx.createGain();
      revDry.connect(merger);
      revWet.connect(merger);
      
      lastTrackNode = merger;
    }
    
    // Track Delay
    if (effects.delayEnabled) {
      const delayNode = offlineCtx.createDelay(1.0);
      delayNode.delayTime.setValueAtTime(effects.delayTime, 0);
      
      const delayFeedback = offlineCtx.createGain();
      delayFeedback.gain.setValueAtTime(effects.delayFeedback, 0);
      
      const delayDry = offlineCtx.createGain();
      const delayWet = offlineCtx.createGain();
      
      const wetVal = effects.delayMix;
      delayDry.gain.setValueAtTime(1 - wetVal, 0);
      delayWet.gain.setValueAtTime(wetVal, 0);
      
      // Feedback loop
      delayNode.connect(delayFeedback);
      delayFeedback.connect(delayNode);
      
      lastTrackNode.connect(delayDry);
      lastTrackNode.connect(delayNode);
      delayNode.connect(delayWet);
      
      const merger = offlineCtx.createGain();
      delayDry.connect(merger);
      delayWet.connect(merger);
      
      lastTrackNode = merger;
    }
    
    // Connect track node to master node
    lastTrackNode.connect(masterGain);
    
    // Load and schedule each clip
    for (const clip of track.clips) {
      if (!clip.audioBuffer) {
        continue;
      }
      
      const source = offlineCtx.createBufferSource();
      source.buffer = clip.audioBuffer;
      
      const clipGain = offlineCtx.createGain();
      clipGain.gain.setValueAtTime(clip.volume, 0);
      
      // Apply Fades
      if (clip.fadeIn > 0) {
        clipGain.gain.setValueAtTime(0, clip.startOffset);
        clipGain.gain.linearRampToValueAtTime(clip.volume, clip.startOffset + clip.fadeIn);
      }
      if (clip.fadeOut > 0) {
        const fadeStart = clip.startOffset + clip.duration - clip.fadeOut;
        clipGain.gain.setValueAtTime(clip.volume, fadeStart);
        clipGain.gain.linearRampToValueAtTime(0, clip.startOffset + clip.duration);
      }
      
      source.connect(clipGain);
      clipGain.connect(trackGain);
      
      // Schedule audio play
      source.start(
        offlineCtx.currentTime + clip.startOffset,
        clip.audioStart,
        clip.duration
      );
    }
  }
  
  return offlineCtx.startRendering();
}

/**
 * Creates an artificial impulse response buffer (white noise with exponential decay) for reverb.
 */
export function createReverbImpulseResponse(ctx: BaseAudioContext, duration: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const buffer = ctx.createBuffer(2, length, sampleRate);
  
  const chL = buffer.getChannelData(0);
  const chR = buffer.getChannelData(1);
  
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const decay = Math.exp(-3 * t); // decay coefficient
    chL[i] = (Math.random() * 2 - 1) * decay;
    chR[i] = (Math.random() * 2 - 1) * decay;
  }
  
  return buffer;
}
