import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Advanced Device Controllers
import * as laptop from "./controllers/laptopController.js";
import * as tv from "./controllers/tvController.js";
import * as vision from "./controllers/visionController.js";
import * as liveData from "./controllers/liveDataController.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

// Serve Frontend Build (for remote mobile access via Ngrok or local port 5000)
const frontendDist = path.join(__dirname, "jarvis-frontend", "dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.use((req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Conversational Multi-Turn Memory
const conversationHistory = [];
const MAX_HISTORY_TURNS = 16;

// Execute AI-parsed Action or System Automation
async function executeAction(
  actionData,
  targetLang = "hi-IN",
  rawUserPrompt = "",
) {
  let {
    type,
    action,
    value,
    target,
    query,
    device,
    text_response,
    speech_response,
    new_language,
    direction,
  } = actionData;

  // Respectful "Yes boss" prefixing for Pal
  if (text_response && !text_response.toLowerCase().startsWith("yes boss")) {
    text_response = `Yes boss, ${text_response}`;
  }
  if (
    speech_response &&
    !speech_response.toLowerCase().startsWith("yes boss")
  ) {
    speech_response = `Yes boss, ${speech_response}`;
  }

  const voiceText = speech_response || text_response;

  // 1. Language Change Action
  if (type === "change_language") {
    return {
      type: "change_language",
      language: new_language,
      message: text_response || "Yes boss, language set successfully.",
      speechText: voiceText || "Yes boss, language set successfully.",
      status: "success",
    };
  }

  // 2. SCREEN VISION AI (Capture & Explain screen)
  if (action === "analyze_screen" || action === "screen_vision") {
    console.log("👁️ Capturing & Analyzing Screen Vision...");
    const result = await vision.analyzeScreenWithGemini(
      ai,
      query ||
        rawUserPrompt ||
        "Explain what is on the screen and solve any errors.",
      targetLang,
    );
    return {
      type: "chat",
      message: result.text_response,
      speechText: result.speech_response,
      status: "success",
    };
  }

  // 3. LIVE REAL-TIME WEATHER
  if (action === "get_weather" || action === "live_weather") {
    const city = target || query || "Delhi";
    console.log(`🌤️ Fetching Live Weather for: ${city}`);
    const w = await liveData.getLiveWeather(city);
    return {
      type: "chat",
      message: w.text_response,
      speechText: w.speech_response,
      status: "success",
      data: w.data,
    };
  }

  // 4. LIVE TOP NEWS HEADLINES
  if (action === "get_news" || action === "live_news") {
    console.log("📰 Fetching Live News Headlines...");
    const n = await liveData.getLiveNews(query || "top");
    return {
      type: "chat",
      message: n.text_response,
      speechText: n.speech_response,
      status: "success",
      data: n.headlines,
    };
  }

  // 5. VOICE TIMERS & REMINDERS
  if (action === "set_timer" || action === "set_reminder") {
    const durationSec = Math.max(1, Number(value) || 60);
    const label =
      target ||
      query ||
      `${durationSec >= 60 ? Math.round(durationSec / 60) + " minute" : durationSec + " second"} Timer`;

    const msg =
      text_response ||
      `Yes boss, ${durationSec >= 60 ? Math.round(durationSec / 60) + " minute" : durationSec + " second"} ka timer start kar diya hai.`;

    const spoken = speech_response || `Yes boss, timer shuru kar diya hai.`;

    return {
      type: "timer_created",
      timer: {
        id: `timer_${Date.now()}`,
        duration: durationSec,
        label: label,
        endTime: Date.now() + durationSec * 1000,
      },
      message: msg,
      speechText: spoken,
      status: "success",
    };
  }

  // 6. Full Intelligence Chat / Guidance Mode
  if (type === "chat") {
    return {
      type: "chat",
      message:
        text_response || "Yes boss! Main aapki kya madad kar sakti hoon?",
      speechText: voiceText || "Yes boss! Main aapki kya madad kar sakti hoon?",
      status: "success",
    };
  }

  // 7. System Automation Actions (Laptop & TV)
  try {
    // LAPTOP ACTIONS
    if (device === "laptop" || !device) {
      switch (action) {
        // Audio & Volume
        case "set_volume": {
          const vol = await laptop.setVolume(value);
          const msg =
            text_response || `Yes boss, laptop volume set to ${vol}%.`;
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
          };
        }
        case "volume_up": {
          const vol = await laptop.changeVolume(value || 10);
          const msg =
            text_response || `Yes boss, volume bada diya hai (${vol}%).`;
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
          };
        }
        case "volume_down": {
          const vol = await laptop.changeVolume(-(value || 10));
          const msg =
            text_response || `Yes boss, volume kam kar diya hai (${vol}%).`;
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
          };
        }
        case "mute": {
          await laptop.setMuted(true);
          const msg = text_response || "Yes boss, laptop mute kar diya hai.";
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
          };
        }
        case "unmute": {
          await laptop.setMuted(false);
          const msg = text_response || "Yes boss, laptop unmute kar diya hai.";
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
          };
        }

        // Media Playback & Controls
        case "media_play_pause":
        case "play_pause": {
          await laptop.mediaPlayPause();
          const msg =
            text_response || "Yes boss, media play/pause toggle kar diya hai.";
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
          };
        }
        case "media_next":
        case "next_track":
        case "next_song": {
          await laptop.mediaNext();
          const msg =
            text_response || "Yes boss, next track play kar diya hai.";
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
          };
        }
        case "media_previous":
        case "prev_track":
        case "prev_song": {
          await laptop.mediaPrevious();
          const msg =
            text_response || "Yes boss, previous track play kar diya hai.";
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
          };
        }
        case "media_forward":
        case "forward":
        case "seek_forward": {
          const sec = Number(value) || 10;
          await laptop.mediaForward(sec);
          const msg =
            text_response ||
            `Yes boss, ${sec} second aage forward kar diya hai.`;
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
          };
        }
        case "media_rewind":
        case "rewind":
        case "seek_backward": {
          const sec = Number(value) || 10;
          await laptop.mediaRewind(sec);
          const msg =
            text_response ||
            `Yes boss, ${sec} second peeche rewind kar diya hai.`;
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
          };
        }
        case "media_fullscreen":
        case "fullscreen": {
          await laptop.mediaFullscreen();
          const msg =
            text_response || "Yes boss, full screen mode toggle kar diya hai.";
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
          };
        }
        case "media_exit_fullscreen":
        case "exit_fullscreen": {
          await laptop.mediaExitFullscreen();
          const msg =
            text_response || "Yes boss, full screen se bahar aa gaye hain.";
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
          };
        }
        case "media_speed_up":
        case "speed_up": {
          await laptop.mediaSpeed("up");
          const msg = text_response || "Yes boss, playback speed badha di hai.";
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
          };
        }
        case "media_speed_down":
        case "speed_down": {
          await laptop.mediaSpeed("down");
          const msg =
            text_response || "Yes boss, playback speed kam kar di hai.";
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
          };
        }
        case "media_subtitles":
        case "subtitles": {
          await laptop.mediaSubtitles();
          const msg =
            text_response || "Yes boss, subtitles toggle kar diye hain.";
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
          };
        }
        case "media_mute_video": {
          await laptop.mediaMuteVideo();
          const msg =
            text_response || "Yes boss, video mute toggle kar diya hai.";
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
          };
        }
        case "close_tab": {
          await laptop.closeActiveTab();
          const msg =
            text_response || "Yes boss, active tab close kar diya hai.";
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
          };
        }
        case "close_window":
        case "close_app": {
          await laptop.closeActiveWindow();
          const msg = text_response || "Yes boss, window close kar di hai.";
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
          };
        }
        case "switch_tab": {
          const dir = target === "prev" || value === "prev" ? "prev" : "next";
          await laptop.switchTab(dir);
          const msg =
            text_response || `Yes boss, ${dir} tab par switch kar diya hai.`;
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
          };
        }
        case "scroll_down": {
          await laptop.scrollPage("down");
          const msg = text_response || "Yes boss, niche scroll kar diya hai.";
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
          };
        }
        case "scroll_up": {
          await laptop.scrollPage("up");
          const msg = text_response || "Yes boss, upar scroll kar diya hai.";
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
          };
        }
        case "play_youtube_song":
        case "play_music": {
          const songQuery = query || target || value || "";
          const msg = await laptop.playYouTubeDirect(songQuery);
          const fullMsg = text_response || `Yes boss, ${msg}`;
          return {
            type: "action",
            message: fullMsg,
            speechText: voiceText || fullMsg,
            status: "success",
          };
        }
        case "play_spotify":
        case "play_spotify_song": {
          const songQuery = query || target || value || "";
          const msg = await laptop.playSpotify(songQuery);
          const fullMsg = text_response || `Yes boss, ${msg}`;
          return {
            type: "action",
            message: fullMsg,
            speechText: voiceText || fullMsg,
            status: "success",
          };
        }

        // Screen Brightness
        case "set_brightness": {
          const b = await laptop.setBrightness(value);
          const msg =
            text_response || `Yes boss, screen brightness ${b}% kar di hai.`;
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
          };
        }
        case "brightness_up": {
          const b = await laptop.changeBrightness(value || 15);
          const msg =
            text_response ||
            `Yes boss, screen brightness badha kar ${b}% kar di hai.`;
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
          };
        }
        case "brightness_down": {
          const b = await laptop.changeBrightness(-(value || 15));
          const msg =
            text_response ||
            `Yes boss, screen brightness kam karke ${b}% kar di hai.`;
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
          };
        }

        // Screenshot
        case "screenshot":
        case "take_screenshot": {
          laptop.takeScreenshot();
          const msg =
            text_response ||
            "Yes boss, screenshot capture tool open kar diya hai.";
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
          };
        }

        // PC Power & Security
        case "lock_pc":
        case "lock_laptop": {
          laptop.lockWorkstation();
          const msg = text_response || "Yes boss, laptop lock kar diya hai.";
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
          };
        }
        case "sleep_pc":
        case "sleep_laptop": {
          laptop.sleepLaptop();
          const msg =
            text_response || "Yes boss, laptop sleep mode me jaa raha hai.";
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
          };
        }
        case "shutdown_pc":
        case "shutdown_laptop": {
          const sec = Number(value) || 60;
          laptop.scheduleShutdown(sec);
          const msg =
            text_response ||
            `Yes boss, laptop ${sec} seconds me shutdown ho jayega. Cancel karne ke liye 'shutdown cancel karo' bolein.`;
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
          };
        }
        case "restart_pc":
        case "restart_laptop": {
          const sec = Number(value) || 60;
          laptop.scheduleRestart(sec);
          const msg =
            text_response ||
            `Yes boss, laptop ${sec} seconds me restart ho jayega.`;
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
          };
        }
        case "cancel_shutdown": {
          laptop.cancelShutdown();
          const msg =
            text_response || "Yes boss, shutdown cancel kar diya gaya hai.";
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
          };
        }

        // Battery, Time & System Diagnostics
        case "battery_status":
        case "get_battery": {
          const batt = await laptop.getBatteryStatus();
          const msg = `Yes boss, ${batt.text}`;
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
            data: batt,
          };
        }
        case "time_date":
        case "get_time": {
          const td = laptop.getCurrentTimeAndDate(targetLang);
          const msg = `Yes boss, ${td.formatted}`;
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
            data: td,
          };
        }
        case "system_info":
        case "system_specs": {
          const info = await laptop.getSystemInfo();
          const msg = `Yes boss, ${info.summary}`;
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: "success",
            data: info,
          };
        }

        // Applications & Tools
        case "open_app": {
          const msg = await laptop.openAppOrTarget(target);
          const fullMsg = text_response || `Yes boss, ${msg}`;
          return {
            type: "action",
            message: fullMsg,
            speechText: voiceText || fullMsg,
            status: "success",
          };
        }

        // Web Search
        case "search_google": {
          const msg = await laptop.searchGoogle(query);
          const fullMsg = text_response || `Yes boss, ${msg}`;
          return {
            type: "action",
            message: fullMsg,
            speechText: voiceText || fullMsg,
            status: "success",
          };
        }
        case "search_youtube": {
          const msg = await laptop.searchYouTube(query);
          const fullMsg = text_response || `Yes boss, ${msg}`;
          return {
            type: "action",
            message: fullMsg,
            speechText: voiceText || fullMsg,
            status: "success",
          };
        }
        case "search_wikipedia": {
          const msg = await laptop.searchWikipedia(query);
          const fullMsg = text_response || `Yes boss, ${msg}`;
          return {
            type: "action",
            message: fullMsg,
            speechText: voiceText || fullMsg,
            status: "success",
          };
        }
      }
    }

    // SMART TV ACTIONS (via ADB)
    if (device === "tv") {
      switch (action) {
        case "power_off":
        case "power_toggle": {
          const res = await tv.powerOff();
          const msg = res.success
            ? text_response || "Yes boss, Smart TV band kar diya hai."
            : `Yes boss, ${res.message}`;
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: res.success ? "success" : "warning",
          };
        }
        case "power_on": {
          const res = await tv.powerOn();
          const msg = res.success
            ? text_response || "Yes boss, Smart TV on kar diya hai."
            : `Yes boss, ${res.message}`;
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: res.success ? "success" : "warning",
          };
        }
        case "tv_home":
        case "home": {
          const res = await tv.navigateHome();
          const msg = res.success
            ? text_response || "Yes boss, Smart TV Home screen par aa gayi hai."
            : `Yes boss, ${res.message}`;
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: res.success ? "success" : "warning",
          };
        }
        case "tv_back":
        case "back": {
          const res = await tv.navigateBack();
          const msg = res.success
            ? text_response || "Yes boss, TV par back kar diya hai."
            : `Yes boss, ${res.message}`;
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: res.success ? "success" : "warning",
          };
        }
        case "tv_menu":
        case "menu": {
          const res = await tv.navigateMenu();
          const msg = res.success
            ? text_response || "Yes boss, TV menu open ho gaya."
            : `Yes boss, ${res.message}`;
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: res.success ? "success" : "warning",
          };
        }
        case "tv_settings":
        case "settings": {
          const res = await tv.openSettings();
          const msg = res.success
            ? text_response || "Yes boss, TV settings open ho gayi."
            : `Yes boss, ${res.message}`;
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: res.success ? "success" : "warning",
          };
        }
        case "tv_dpad":
        case "navigate": {
          const res = await tv.dpad(direction || target || "select");
          const msg = res.success
            ? text_response ||
              `Yes boss, TV par ${direction || target} press kar diya.`
            : `Yes boss, ${res.message}`;
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: res.success ? "success" : "warning",
          };
        }
        case "volume_up": {
          const res = await tv.volumeUp();
          const msg = res.success
            ? text_response || "Yes boss, TV volume bada diya hai."
            : `Yes boss, ${res.message}`;
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: res.success ? "success" : "warning",
          };
        }
        case "volume_down": {
          const res = await tv.volumeDown();
          const msg = res.success
            ? text_response || "Yes boss, TV volume kam kar diya hai."
            : `Yes boss, ${res.message}`;
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: res.success ? "success" : "warning",
          };
        }
        case "mute":
        case "unmute": {
          const res = await tv.toggleMute();
          const msg = res.success
            ? text_response || "Yes boss, TV mute toggle kar diya hai."
            : `Yes boss, ${res.message}`;
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: res.success ? "success" : "warning",
          };
        }
        case "tv_play_pause":
        case "media_play_pause": {
          const res = await tv.mediaPlayPause();
          const msg = res.success
            ? text_response || "Yes boss, TV par video play/pause kar diya."
            : `Yes boss, ${res.message}`;
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: res.success ? "success" : "warning",
          };
        }
        case "tv_next": {
          const res = await tv.mediaNext();
          const msg = res.success
            ? text_response || "Yes boss, TV par next video play ho gaya."
            : `Yes boss, ${res.message}`;
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: res.success ? "success" : "warning",
          };
        }
        case "tv_prev": {
          const res = await tv.mediaPrev();
          const msg = res.success
            ? text_response || "Yes boss, TV par previous video play ho gaya."
            : `Yes boss, ${res.message}`;
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: res.success ? "success" : "warning",
          };
        }
        case "open_app": {
          const res = await tv.openTvApp(target);
          const msg = res.success
            ? text_response ||
              `Yes boss, Smart TV par ${target} open ho gaya hai.`
            : `Yes boss, ${res.message}`;
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: res.success ? "success" : "warning",
          };
        }
        case "search_youtube":
        case "tv_search": {
          const res = await tv.searchTvYouTube(query || target);
          const msg = res.success
            ? text_response ||
              `Yes boss, Smart TV par "${query || target}" play kar diya hai.`
            : `Yes boss, ${res.message}`;
          return {
            type: "action",
            message: msg,
            speechText: voiceText || msg,
            status: res.success ? "success" : "warning",
          };
        }
      }
    }
  } catch (err) {
    console.error("Execution Error:", err);
    return {
      type: "error",
      message: "Yes boss, command execute karne mein dikkat aayi.",
      speechText: "Yes boss, command execute karne mein dikkat aayi.",
      status: "error",
    };
  }

  return {
    type: "chat",
    message: text_response || "Yes boss! Command execute ho gaya.",
    speechText: voiceText || "Yes boss! Command execute ho gaya.",
    status: "success",
  };
}

// Fast-Path Direct Media Intent Matcher (Instant <10ms response without AI delay)
function checkFastMediaCommand(prompt) {
  const p = (prompt || "").toLowerCase().trim();

  // 0. Direct YouTube or Spotify Song Playback
  if (/(youtube.*par|play.*on.*youtube|chalao.*youtube)/i.test(p)) {
    const q = p
      .replace(/[,!?.–—]+/g, " ")
      .replace(
        /(youtube\s*par|play\s*on\s*youtube|chalao\s*youtube|youtube|video|gaana|song|play|chalao|suno|karo|batao|dikhao)/gi,
        " ",
      )
      .trim();
    if (q.length > 1) {
      return {
        type: "action",
        device: "laptop",
        action: "play_youtube_song",
        query: q,
        text_response: `Yes boss, YouTube par "${q}" play kar diya hai.`,
        speech_response: `Yes boss, YouTube par "${q}" chala diya hai.`,
      };
    }
  }

  if (
    /(spotify.*par|play.*on.*spotify|spotify)/i.test(p) &&
    /(play|chalao|song|gaana|music)/i.test(p)
  ) {
    const q = p
      .replace(/[,!?.–—]+/g, " ")
      .replace(
        /(spotify\s*par|play\s*on\s*spotify|spotify|gaana|song|play|chalao|suno|karo)/gi,
        " ",
      )
      .trim();
    if (q.length > 1) {
      return {
        type: "action",
        device: "laptop",
        action: "play_spotify",
        query: q,
        text_response: `Yes boss, Spotify par "${q}" play kar diya hai.`,
        speech_response: `Yes boss, Spotify par "${q}" chala diya hai.`,
      };
    }
  }

  // 1. Generic Play / Pause Toggle (Only when no specific song or video title is requested)
  if (
    /^(play|pause|chalao|roko|ruk jao|play pause|video roko|gaana roko|pause karo|play karo|chalado|रोक दो|चलाओ|पॉज|प्ले)$/i.test(
      p,
    ) ||
    /^(gaana|video|song|media|music)\s*(pause|play|roko|chalao|ruk jao)$/i.test(
      p,
    ) ||
    /^(pause|play|roko)\s*(gaana|video|song|media|music)$/i.test(p)
  ) {
    return {
      type: "action",
      device: "laptop",
      action: "media_play_pause",
      text_response: "Yes boss, media play/pause toggle kar diya hai.",
      speech_response: "Yes boss, media toggle kar diya hai.",
    };
  }

  // 2. Forward / Seek forward
  if (
    /(aage.*karo|forward|फाॅरवर्ड|seek.*forward|skip.*ahead|aage.*badhao)/i.test(
      p,
    )
  ) {
    const match = p.match(/(\d+)\s*(sec|second|सेकंड)?/);
    const sec = match ? parseInt(match[1], 10) : 10;
    return {
      type: "action",
      device: "laptop",
      action: "media_forward",
      value: sec,
      text_response: `Yes boss, ${sec} second aage forward kar diya hai.`,
      speech_response: `Yes boss, ${sec} second aage kar diya hai.`,
    };
  }

  // 3. Rewind / Seek backward
  if (
    /(peeche.*karo|rewind|रिवाइंड|seek.*back|peeche.*lo|piche.*karo)/i.test(p)
  ) {
    const match = p.match(/(\d+)\s*(sec|second|सेकंड)?/);
    const sec = match ? parseInt(match[1], 10) : 10;
    return {
      type: "action",
      device: "laptop",
      action: "media_rewind",
      value: sec,
      text_response: `Yes boss, ${sec} second peeche rewind kar diya hai.`,
      speech_response: `Yes boss, ${sec} second peeche kar diya hai.`,
    };
  }

  // 4. Next Track / Song / Video
  if (
    /(next.*(song|track|video|gaana)|agla.*gaana|agla.*song|agla.*video|next|अगला गाना|नेक्स्ट)/i.test(
      p,
    )
  ) {
    return {
      type: "action",
      device: "laptop",
      action: "media_next",
      text_response: "Yes boss, next track play kar diya hai.",
      speech_response: "Yes boss, next track chala diya hai.",
    };
  }

  // 5. Previous Track / Song / Video
  if (
    /(prev.*(song|track|video|gaana)|pichla.*gaana|pichla.*song|pichla.*video|previous|पिछला गाना|प्रीवियस)/i.test(
      p,
    )
  ) {
    return {
      type: "action",
      device: "laptop",
      action: "media_previous",
      text_response: "Yes boss, previous track play kar diya hai.",
      speech_response: "Yes boss, pichla track chala diya hai.",
    };
  }

  // 6. Fullscreen
  if (
    /(full.*screen.*(hatao|exit|band)|chhoti.*screen|normal.*screen)/i.test(p)
  ) {
    return {
      type: "action",
      device: "laptop",
      action: "media_exit_fullscreen",
      text_response: "Yes boss, full screen se bahar aa gaye hain.",
      speech_response: "Yes boss, normal screen kar di hai.",
    };
  }
  if (/(full.*screen|badi.*screen|फुल स्क्रीन|स्क्रीन बड़ी)/i.test(p)) {
    return {
      type: "action",
      device: "laptop",
      action: "media_fullscreen",
      text_response: "Yes boss, full screen mode toggle kar diya hai.",
      speech_response: "Yes boss, full screen kar di hai.",
    };
  }

  // 7. Video Speed
  if (/(speed.*badhao|speed.*up|tez.*karo|2x.*karo|स्पीड बढ़ाओ)/i.test(p)) {
    return {
      type: "action",
      device: "laptop",
      action: "media_speed_up",
      text_response: "Yes boss, playback speed badha di hai.",
      speech_response: "Yes boss, speed badha di hai.",
    };
  }
  if (/(speed.*kam.*karo|speed.*down|dheere.*karo|स्पीड कम)/i.test(p)) {
    return {
      type: "action",
      device: "laptop",
      action: "media_speed_down",
      text_response: "Yes boss, playback speed kam kar di hai.",
      speech_response: "Yes boss, speed kam kar di hai.",
    };
  }

  // 8. Subtitles / Captions
  if (/(subtitles?|captions?|सबटाइटल)/i.test(p)) {
    return {
      type: "action",
      device: "laptop",
      action: "media_subtitles",
      text_response: "Yes boss, subtitles toggle kar diye hain.",
      speech_response: "Yes boss, subtitles toggle ho gaye hain.",
    };
  }

  // 9. Video Mute
  if (/(video.*mute|mute.*video|awaaz.*band.*karo)/i.test(p)) {
    return {
      type: "action",
      device: "laptop",
      action: "media_mute_video",
      text_response: "Yes boss, video mute toggle kar diya hai.",
      speech_response: "Yes boss, video mute toggle kar diya hai.",
    };
  }

  // 10. Close tab / window
  if (/(tab.*(band|close)|close.*tab|टैब बंद)/i.test(p)) {
    return {
      type: "action",
      device: "laptop",
      action: "close_tab",
      text_response: "Yes boss, active tab close kar diya hai.",
      speech_response: "Yes boss, tab close kar diya hai.",
    };
  }
  if (
    /(window.*(band|close)|app.*(band|close)|close.*window|close.*app)/i.test(p)
  ) {
    return {
      type: "action",
      device: "laptop",
      action: "close_window",
      text_response: "Yes boss, window close kar di hai.",
      speech_response: "Yes boss, window close kar di hai.",
    };
  }

  return null;
}

// AI Prompting with Multi-Turn Memory & Fast Fallback
async function processPrompt(
  userPrompt,
  targetLanguage = "hi-IN",
  retries = 2,
) {
  // Check fast-path direct media match first (0ms latency)
  const fastAction = checkFastMediaCommand(userPrompt);
  if (fastAction) {
    return await executeAction(fastAction, targetLanguage, userPrompt);
  }

  const systemInstruction = `
    You are Pal, an omnipotent, highly intelligent AI Assistant combining Google Gemini and ChatGPT capabilities with Screen Vision, Real-Time Data (Weather/News), Timers, and Windows Laptop & Smart TV hardware control.
    Target Response Language Code: "${targetLanguage}".

    CORE RULES:
    1. ALWAYS start every response or speech with "Yes boss, " or "Yes boss! ".
    2. Maintain a friendly, polite, respectful female persona.
    3. Return valid JSON only.

    SUPPORTED ACTIONS:
    - Weather: {"type": "action", "action": "get_weather", "target": "city name", "text_response": "...", "speech_response": "..."}
    - News: {"type": "action", "action": "get_news", "text_response": "...", "speech_response": "..."}
    - Timer: {"type": "action", "action": "set_timer", "value": seconds, "target": "label", "text_response": "...", "speech_response": "..."}
    - Screen Vision: {"type": "action", "action": "analyze_screen", "query": "what to analyze", "text_response": "...", "speech_response": "..."}
    - Laptop Hardware & Media Controls: {"type": "action", "device": "laptop", "action": "set_volume"|"volume_up"|"volume_down"|"mute"|"unmute"|"media_play_pause"|"media_next"|"media_previous"|"media_forward"|"media_rewind"|"media_fullscreen"|"media_exit_fullscreen"|"media_speed_up"|"media_speed_down"|"media_subtitles"|"media_mute_video"|"play_youtube_song"|"play_spotify"|"close_tab"|"close_window"|"switch_tab"|"scroll_down"|"scroll_up"|"set_brightness"|"screenshot"|"lock_pc"|"battery_status"|"time_date"|"open_app"|"search_google"|"search_youtube", "value": number, "query": "song or search query", "target": "target or label", "text_response": "...", "speech_response": "..."}
    - TV Remote: {"type": "action", "device": "tv", "action": "power_off"|"power_on"|"tv_home"|"tv_back"|"tv_dpad"|"volume_up"|"volume_down"|"tv_play_pause"|"open_app", ...}
    - Q&A / Knowledge / Chat: {"type": "chat", "text_response": "Full detailed markdown explanation/code/points (like ChatGPT/Gemini)", "speech_response": "Natural 1-2 sentence spoken summary"}

    MEDIA & MUSIC RULES:
    - If user asks to play a song/artist/music (e.g. "YouTube par Arijit Singh ke gaane play karo" or "play Believer on spotify" or "gaana chalao"): Use action "play_youtube_song" (or "play_spotify" if Spotify mentioned) with "query" set to the song/artist.
    - If user asks to forward/skip (e.g. "10 second aage karo", "forward karo"): Use action "media_forward" with "value": seconds (default 10).
    - If user asks to rewind/go back (e.g. "10 second peeche karo", "rewind karo"): Use action "media_rewind" with "value": seconds (default 10).
    - If user asks for next/previous track: Use action "media_next" or "media_previous".
    - If user asks to pause/play: Use action "media_play_pause".
    - If user asks to fullscreen/exit fullscreen: Use action "media_fullscreen" or "media_exit_fullscreen".
    - If user asks to close tab/window: Use action "close_tab" or "close_window".
  `;

  const contents = [
    ...conversationHistory,
    { role: "user", parts: [{ text: userPrompt }] },
  ];

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash-lite",
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
        },
      });

      if (response && response.text) {
        let raw = response.text.trim();
        if (raw.startsWith("```")) {
          raw = raw
            .replace(/^```[a-z]*\n?/i, "")
            .replace(/\n?```$/, "")
            .trim();
        }
        const firstBrace = raw.indexOf("{");
        const lastBrace = raw.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          raw = raw.slice(firstBrace, lastBrace + 1);
        }

        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = {
            type: "chat",
            text_response: raw,
            speech_response:
              "Yes boss, maine aapke sawal ka poora vishleshan screen par taiyar kar diya hai.",
          };
        }

        // Update multi-turn history
        conversationHistory.push({
          role: "user",
          parts: [{ text: userPrompt }],
        });
        conversationHistory.push({
          role: "model",
          parts: [
            {
              text:
                parsed.text_response || parsed.speech_response || "Yes boss!",
            },
          ],
        });

        if (conversationHistory.length > MAX_HISTORY_TURNS) {
          conversationHistory.splice(
            0,
            conversationHistory.length - MAX_HISTORY_TURNS,
          );
        }

        return await executeAction(parsed, targetLanguage, userPrompt);
      }
    } catch (err) {
      console.warn("AI generation attempt failed:", err.message);
      if (attempt < retries) {
        await new Promise((res) => setTimeout(res, 800));
      }
    }
  }

  throw new Error("AI models unavailable");
}

// Wake-Word & Greeting Identification (Devanagari + English support)
const palNameRegex = /(pal|paal|pall|paul|pol|पाल|पल|पॉल)/i;
const justNameRegex =
  /^(hey|hello|hi|हाय|नमस्ते|सूनो|सुनो|o|arre)?\s*(pal|paal|pall|paul|pol|पाल|पल|पॉल)\s*(ji|जी|suno|सुनो)?$/i;

// 5-Minute Inactivity Session State
const SESSION_TIMEOUT_MS = 5 * 60 * 1000;
let isAwake = false;
let lastActiveTimestamp = 0;

function isSessionActive() {
  if (!isAwake) return false;
  const elapsed = Date.now() - lastActiveTimestamp;
  if (elapsed > SESSION_TIMEOUT_MS) {
    isAwake = false;
    return false;
  }
  return true;
}

function refreshSession() {
  isAwake = true;
  lastActiveTimestamp = Date.now();
}

function putToSleep() {
  isAwake = false;
  lastActiveTimestamp = 0;
  conversationHistory.length = 0;
}

// In-Memory Cached System State for Lightning Fast Responses
let cachedSystemState = {
  volume: 50,
  muted: false,
  brightness: 80,
  battery: { percent: 100, isCharging: true, text: "Battery 100%" },
  tvIp: tv.getTvIp(),
  isAwake: false,
  sessionTimeoutMs: SESSION_TIMEOUT_MS,
};

async function refreshSystemStateAsync() {
  try {
    const [vol, bright, batt] = await Promise.all([
      laptop.getVolume().catch(() => 50),
      laptop.getBrightness().catch(() => 80),
      laptop
        .getBatteryStatus()
        .catch(() => ({ percent: 100, isCharging: true })),
    ]);
    cachedSystemState = {
      volume: vol,
      muted: false,
      brightness: bright,
      battery: batt,
      tvIp: tv.getTvIp(),
      isAwake: isSessionActive(),
      sessionTimeoutMs: SESSION_TIMEOUT_MS,
    };
  } catch {}
}

// Initial fetch and 30s background sync
refreshSystemStateAsync();
setInterval(refreshSystemStateAsync, 30000);

// Socket.io Real-time Connection
io.on("connection", (socket) => {
  console.log("⚡ Client Connected to Pal Hub:", socket.id);

  // Send cached system state instantly (0ms delay)
  socket.emit("system_state", cachedSystemState);
  socket.emit("session_status", {
    isAwake: isSessionActive(),
    timeoutMs: SESSION_TIMEOUT_MS,
  });

  // Client requests live status refresh
  socket.on("get_status", async () => {
    socket.emit("system_state", cachedSystemState);
    refreshSystemStateAsync();
  });

  // Reset conversation memory
  socket.on("clear_history", () => {
    conversationHistory.length = 0;
    console.log("🧹 Conversation history cleared.");
  });

  // Direct Control Deck Action (Instant execution without AI prompt roundtrip)
  socket.on("direct_action", async (actionData) => {
    refreshSession();
    console.log("🎮 Direct Deck Action:", actionData);
    const result = await executeAction(actionData, "hi-IN", "");
    socket.emit("agent_response", {
      ...result,
      isAwake: true,
    });
    refreshSystemStateAsync();
    io.emit("system_state", cachedSystemState);
  });

  // User Voice / Text Command
  socket.on("user_command", async (data) => {
    const rawCmd = (data.command || "").trim();
    const lang = data.language || "hi-IN";
    console.log(`🗣️ Command: "${rawCmd}" | Lang: ${lang}`);

    if (!rawCmd) return;

    const hasName = palNameRegex.test(rawCmd);
    const isJustName = justNameRegex.test(rawCmd);
    const currentlyActive = isSessionActive();

    // 1. Wake-up Trigger: User says "Pal"
    if (isJustName) {
      refreshSession();
      console.log(`⚡ Pal Awakened! Active session window reset to 5 minutes.`);
      socket.emit("agent_response", {
        type: "wake_up",
        status: "success",
        message: "Yes boss!",
        speechText: "Yes boss!",
        isAwake: true,
        autoListen: true,
      });
      return;
    }

    // 2. Explicit Sleep Trigger: User says "So jao" / "Sleep" / "Standby"
    const sleepRegex = /^(so jao|sleep|standby|bye|अलvida|सो जाओ)$/i;
    if (sleepRegex.test(rawCmd)) {
      putToSleep();
      const sleepMsg =
        lang === "en-US"
          ? "Yes boss, going to standby."
          : "Yes boss, main standby mode me jaa rahi hoon.";
      socket.emit("agent_response", {
        type: "sleep_mode",
        status: "success",
        message: sleepMsg,
        speechText: sleepMsg,
        isAwake: false,
        autoListen: false,
      });
      return;
    }

    // 3. Standby Mode Check: If session inactive and user didn't mention "Pal"
    if (!currentlyActive && !hasName) {
      console.log("💤 Pal is in standby. Prompting user to say 'Pal'.");
      const wakePrompt =
        lang === "en-US"
          ? "Pal is on standby. Please say 'Pal' to wake me up first."
          : "Pal standby mode me hai. Kripya pehle 'Pal' bolkar wake up karein.";
      socket.emit("agent_response", {
        type: "sleep_mode",
        status: "standby",
        message: wakePrompt,
        speechText: wakePrompt,
        isAwake: false,
        autoListen: false,
      });
      return;
    }

    // 4. Session Active or Pal named: Execute command via Gemini AI
    refreshSession();

    try {
      const cleanPrompt = rawCmd
        .replace(palNameRegex, "")
        .replace(/^(hey|hello|hi|हाय|नमस्ते|सुनो|सूनo)\s*/i, "")
        .trim();

      const promptToSend = cleanPrompt.length > 0 ? cleanPrompt : rawCmd;
      console.log(
        `🤖 Processing with Gemini: "${promptToSend}" [Lang: ${lang}]`,
      );

      const result = await processPrompt(promptToSend, lang);
      socket.emit("agent_response", {
        ...result,
        message: result.message,
        speechText: result.speechText || result.message,
        isAwake: true,
      });

      refreshSystemStateAsync();
      io.emit("system_state", cachedSystemState);
    } catch (err) {
      console.error("Agent Processing Error:", err);
      socket.emit("agent_response", {
        type: "error",
        status: "error",
        message: "Yes boss, koshish ki par command process nahi ho paayi.",
        speechText: "Yes boss, koshish ki par command process nahi ho paayi.",
        isAwake: isSessionActive(),
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Client Disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;

httpServer.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `\n❌ [PORT IN USE] Port ${PORT} already use mein hai! Kisi dusre process ne port ${PORT} occupy kar rakha hai.`,
    );
    console.error(
      `👉 Solution: Pehle chal rahe server process ko band karein, ya PowerShell me ye command chalayein:\n   Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT} -State Listen).OwningProcess -Force\n`,
    );
    process.exit(1);
  } else {
    console.error("Server Error:", err);
  }
});

httpServer.listen(PORT, () => {
  console.log(
    `🚀 Pal Ultimate Hub (Vision + Real-Time Data + Timers + PWA) running on http://localhost:${PORT}`,
  );
});
