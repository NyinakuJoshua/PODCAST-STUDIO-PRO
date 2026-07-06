/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Set up JSON body parser with increased limit for audio base64 payload
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize GoogleGenAI SDK safely
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
  });
});

// AI Podcast Speech-to-Text Transcription & Show Notes
app.post("/api/ai/transcribe", async (req, res) => {
  try {
    const { audioData, mimeType, projectName, durationSeconds } = req.body;

    if (!ai) {
      return res.status(503).json({
        error: "Gemini API is not configured. Please add your GEMINI_API_KEY to secrets.",
      });
    }

    // Prepare contents array for Gemini
    const contents: any[] = [];

    // If actual audio base64 is provided, attach it as inlineData
    if (audioData && mimeType) {
      contents.push({
        inlineData: {
          mimeType: mimeType, // e.g. "audio/wav" or "audio/webm"
          data: audioData,
        },
      });
    }

    // Create the instruction/prompt.
    // If no real audio was passed, we ask Gemini to generate an ideal mock podcast recording
    // for demonstration purposes to let the user play with the app.
    const systemPrompt = `You are a professional AI podcast producer and sound engineer.
${audioData ? "Transcribe the attached audio exactly and structure it into segments." : `Create a highly authentic and engaging podcast transcript for a sample project named "${projectName || "My Tech Talk"}" with a duration of about ${durationSeconds || 120} seconds. Ensure there are 2 speakers: Host and Guest.`}

Analyze the recording (or generate a beautiful demo) and return a JSON object with:
1. "transcript": An array of segments with "speaker", "text", "start" (seconds), "end" (seconds), and "isFiller" (boolean, true if the segment represents a verbal filler like 'um', 'uh', 'like' or an awkward pause). Make sure filler words are clearly marked so our editor can "cut" them.
2. "summary": A concise, engaging 1-sentence description of the episode.
3. "showNotes": Beautifully produced show notes containing:
   - "title": A catchy, SEO-friendly, high-converting episode title.
   - "description": A rich, engaging multi-paragraph overview of what was discussed.
   - "chapters": Interactive chapter markers with "timestamp" (MM:SS) and "title" + "description".
   - "bulletPoints": A list of key lessons, takeaways, or quotes.
   - "keywords": Search-friendly tag keywords.

Your response MUST be 100% valid JSON matching the schema provided. Do not include any markdown fences outside the JSON.`;

    contents.push({ text: systemPrompt });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcript: {
              type: Type.ARRAY,
              description: "Array of speech-to-text segments with timestamps",
              items: {
                type: Type.OBJECT,
                properties: {
                  speaker: { type: Type.STRING },
                  text: { type: Type.STRING },
                  start: { type: Type.NUMBER, description: "Start time of segment in seconds" },
                  end: { type: Type.NUMBER, description: "End time of segment in seconds" },
                  isFiller: { type: Type.BOOLEAN, description: "True if this segment is a verbal filler like um, uh, or like" },
                },
                required: ["speaker", "text", "start", "end"],
              },
            },
            summary: { type: Type.STRING },
            showNotes: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                chapters: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      timestamp: { type: Type.STRING, description: "Format MM:SS" },
                      title: { type: Type.STRING },
                      description: { type: Type.STRING },
                    },
                    required: ["timestamp", "title", "description"],
                  },
                },
                bulletPoints: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                keywords: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ["title", "description", "chapters", "bulletPoints", "keywords"],
            },
          },
          required: ["transcript", "summary", "showNotes"],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response returned from Gemini.");
    }

    const jsonResult = JSON.parse(text);
    return res.json(jsonResult);
  } catch (error: any) {
    console.error("AI Transcription Error:", error);
    res.status(500).json({
      error: error?.message || "Failed to process AI request",
    });
  }
});

// AI Podcast Cover Art Generator
app.post("/api/ai/generate-cover", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    if (!ai) {
      return res.status(503).json({
        error: "Gemini API is not configured. Please add your GEMINI_API_KEY to secrets.",
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-image",
      contents: `Generate a beautiful, modern, square 1:1 ratio cover art for a podcast. Topic/Style: ${prompt}. Minimalist modern graphic layout, high-contrast, professional, bold colors, readable branding shapes, suitable for Spotify or Apple Podcasts. No realistic photos of random faces, clean illustration style.`,
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    });

    let base64Image = "";
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        base64Image = part.inlineData.data;
        break;
      }
    }

    if (base64Image) {
      return res.json({ base64: base64Image });
    } else {
      throw new Error("Gemini Image generation did not return inline data.");
    }
  } catch (error: any) {
    console.error("AI Cover Art Error:", error);
    // Return a structured error so client can fallback to a beautiful SVG or local pattern safely
    res.status(500).json({
      error: error?.message || "Failed to generate podcast cover artwork.",
      fallbackNeeded: true,
    });
  }
});

// AI Voice Enhancement Advice Endpoint
app.post("/api/ai/enhance-advice", async (req, res) => {
  try {
    const { profileName, currentSettings } = req.body;

    if (!ai) {
      return res.status(503).json({
        error: "Gemini API is not configured. Please add your GEMINI_API_KEY to secrets.",
      });
    }

    const prompt = `You are a high-end recording studio mixing engineer.
The podcaster is trying to achieve a "${profileName || "Warm Radio"}" vocal profile.
Their current studio effect settings are:
${JSON.stringify(currentSettings || {}, null, 2)}

Recommend specific, expert-level EQ bands, compression settings (threshold, ratio, attack, release), and noise gate configurations to achieve an absolute masterpiece.
Return the suggestions strictly in JSON format matching the following schema. Keep descriptions concise and highly actionable.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            eqBands: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  frequency: { type: Type.NUMBER },
                  type: { type: Type.STRING, enum: ["lowshelf", "peaking", "highshelf"] },
                  gain: { type: Type.NUMBER, description: "Gain value in dB (-12 to +12)" },
                  Q: { type: Type.NUMBER },
                },
                required: ["frequency", "type", "gain", "Q"],
              },
            },
            compressor: {
              type: Type.OBJECT,
              properties: {
                threshold: { type: Type.NUMBER, description: "Threshold in dB (-60 to 0)" },
                ratio: { type: Type.NUMBER, description: "Ratio (1 to 20)" },
                attack: { type: Type.NUMBER, description: "Attack time in seconds" },
                release: { type: Type.NUMBER, description: "Release time in seconds" },
              },
              required: ["threshold", "ratio", "attack", "release"],
            },
            gate: {
              type: Type.OBJECT,
              properties: {
                threshold: { type: Type.NUMBER, description: "Gate threshold in dB (-80 to -20)" },
              },
              required: ["threshold"],
            },
            engineeringTip: { type: Type.STRING, description: "A pro-level mixing tip for this preset." },
          },
          required: ["eqBands", "compressor", "gate", "engineeringTip"],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No advice generated.");
    }

    return res.json(JSON.parse(text));
  } catch (error: any) {
    console.error("Enhance Advice Error:", error);
    res.status(500).json({ error: error?.message || "Failed to retrieve AI advice." });
  }
});

// ----------------------------------------------------
// FRONTEND BUNDLING / DEVELOPMENT INTEGRATION
// ----------------------------------------------------

async function start() {
  if (process.env.NODE_ENV !== "production") {
    // In development mode, mount Vite dev server as middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production mode, serve the built static assets
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));

    // For SPAs, fallback any unhandled GET request to index.html
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[PODCAST STUDIO PORTAL] Server running on http://localhost:${PORT}`);
    console.log(`[MODE] ${process.env.NODE_ENV || "development"}`);
  });
}

start();
