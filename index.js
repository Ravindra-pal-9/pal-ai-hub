import { GoogleGenAI } from "@google/genai";
import loudness from "loudness";
import open from "open";
import dotenv from "dotenv";

dotenv.config();

// Gemini AI Setup
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// System Action Handler
async function executeAction(actionData) {
  const { action, value, target } = actionData;

  switch (action) {
    case "set_volume": {
      const vol = Number(value);
      await loudness.setVolume(vol);
      // Agar volume 0 se zyada kiya gaya hai aur laptop mute par hai, toh automatic unmute karein
      if (vol > 0) {
        const isMuted = await loudness.getMuted();
        if (isMuted) {
          await loudness.setMuted(false);
        }
      }
      console.log(`🔊 Laptop volume set to ${vol}% and unmuted.`);
      break;
    }

    case "mute":
      await loudness.setMuted(true);
      console.log("🔇 Laptop muted.");
      break;

    case "unmute":
      await loudness.setMuted(false);
      console.log("🔊 Laptop unmuted.");
      break;

    case "open_app":
      if (target === "youtube") {
        await open("https://www.youtube.com");
        console.log("🌐 YouTube opened in browser.");
      } else if (target === "google") {
        await open("https://www.google.com");
        console.log("🌐 Google opened in browser.");
      }
      break;

    case "unknown":
    default:
      console.log("❓ Command samajh nahi aaya ya supported nahi hai.");
      break;
  }
}

// AI Intent Parser
async function processVoiceCommand(userPrompt) {
  console.log(`\n🗣️ Command received: "${userPrompt}"`);

  const systemInstruction = `
    You are an AI assistant controlling a laptop.
    Analyze the user's natural language command and return strictly a valid JSON object.
    
    Possible actions:
    1. Action: "set_volume", Value: number between 0 and 100
    2. Action: "mute"
    3. Action: "unmute"
    4. Action: "open_app", Target: "youtube" | "google"
    5. Action: "unknown"

    JSON Format Example:
    {"action": "set_volume", "value": 50}
    {"action": "mute"}
    {"action": "unmute"}
    {"action": "open_app", "target": "youtube"}
    {"action": "unknown"}
  `;

  const candidateModels = [
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.8-flash",
  ];

  let response = null;
  let lastError = null;

  for (const model of candidateModels) {
    try {
      response = await ai.models.generateContent({
        model: model,
        contents: userPrompt,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
        },
      });
      if (response && response.text) {
        break;
      }
    } catch (err) {
      lastError = err;
      // Agar kisi model pe high demand (503) ya issue aaye to agla model try karega
      continue;
    }
  }

  if (!response) {
    console.error(
      "Error processing command:",
      lastError?.message || "Unable to get response",
    );
    return;
  }

  try {
    const actionData = JSON.parse(response.text);
    await executeAction(actionData);
  } catch (error) {
    console.error("Error parsing action response:", error.message);
  }
}

// Test Commands
async function runTest() {
  await processVoiceCommand("Jarvis, laptop ki volume 40 percent kar do");
  await processVoiceCommand("YouTube khol do browser mein");
}

runTest();
