import open from "open";
import { exec, execFile } from "child_process";
import os from "os";

// Safe dynamic loudness loader (prevents crash on Linux Cloud servers)
let loudness = null;
try {
  const mod = await import("loudness");
  loudness = mod.default || mod;
} catch {
  // Silently fallback if audio hardware is absent (Cloud/Linux container)
}

// Safe PowerShell Command Executor (100% silent background execution, no window popups)
function runPowershell(command) {
  if (process.platform !== "win32") {
    return Promise.resolve("");
  }
  return new Promise((resolve) => {
    execFile(
      "powershell",
      [
        "-NoProfile",
        "-NonInteractive",
        "-WindowStyle",
        "Hidden",
        "-Command",
        command,
      ],
      { timeout: 7000, windowsHide: true },
      (err, stdout, stderr) => {
        if (err) {
          console.warn("PowerShell warning:", stderr || err.message);
          resolve("");
        } else {
          resolve(stdout ? stdout.trim() : "");
        }
      },
    );
  });
}

// 1. Audio & Volume Controls
export async function getVolume() {
  try {
    if (loudness) return await loudness.getVolume();
    return 50;
  } catch {
    return 50;
  }
}

export async function setVolume(val) {
  const clamped = Math.min(100, Math.max(0, Number(val) || 0));
  if (loudness) {
    try {
      await loudness.setVolume(clamped);
      if (clamped > 0) {
        const isMuted = await loudness.getMuted();
        if (isMuted) await loudness.setMuted(false);
      }
    } catch {}
  }
  return clamped;
}

export async function changeVolume(delta) {
  const current = await getVolume();
  const target = Math.min(100, Math.max(0, current + Number(delta)));
  await setVolume(target);
  return target;
}

export async function setMuted(mutedState) {
  if (loudness) {
    try {
      await loudness.setMuted(Boolean(mutedState));
    } catch {}
  }
  return Boolean(mutedState);
}

// 2. Comprehensive Media Playback & App Controls
export async function mediaPlayPause() {
  await runPowershell(
    "$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys([char]179); $ws.SendKeys('k')",
  );
  return "Play/Pause toggled";
}

export async function mediaNext() {
  await runPowershell(
    "$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys([char]176); $ws.SendKeys('+n')",
  );
  return "Next track / video";
}

export async function mediaPrevious() {
  await runPowershell(
    "$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys([char]177); $ws.SendKeys('+p')",
  );
  return "Previous track / video";
}

export async function mediaForward(seconds = 10) {
  const count = Math.max(
    1,
    Math.min(10, Math.round((Number(seconds) || 10) / 10)),
  );
  const keys = "l".repeat(count);
  await runPowershell(
    `$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('${keys}'); $ws.SendKeys('+{RIGHT}')`,
  );
  return `${seconds} seconds aage forward kar diya hai.`;
}

export async function mediaRewind(seconds = 10) {
  const count = Math.max(
    1,
    Math.min(10, Math.round((Number(seconds) || 10) / 10)),
  );
  const keys = "j".repeat(count);
  await runPowershell(
    `$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('${keys}'); $ws.SendKeys('+{LEFT}')`,
  );
  return `${seconds} seconds peeche rewind kar diya hai.`;
}

export async function mediaFullscreen() {
  await runPowershell(
    "$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('f')",
  );
  return "Full screen mode toggle kar diya hai.";
}

export async function mediaExitFullscreen() {
  await runPowershell(
    "$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('{ESC}')",
  );
  return "Full screen se exit kar diya hai.";
}

export async function mediaSpeed(direction = "up") {
  const key = direction === "down" ? "<" : ">";
  await runPowershell(
    `$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('${key}')`,
  );
  return direction === "down"
    ? "Playback speed kam kar di hai."
    : "Playback speed badha di hai.";
}

export async function mediaSubtitles() {
  await runPowershell(
    "$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('c')",
  );
  return "Subtitles/Captions toggle kar diye hain.";
}

export async function mediaMuteVideo() {
  await runPowershell(
    "$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('m')",
  );
  return "Video mute toggle kar diya hai.";
}

// Window & Tab Controls
export async function closeActiveTab() {
  await runPowershell(
    "$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('^w')",
  );
  return "Current tab close kar diya hai.";
}

export async function closeActiveWindow() {
  await runPowershell(
    "$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('%{F4}')",
  );
  return "Active window close kar di hai.";
}

export async function switchTab(direction = "next") {
  const key = direction === "prev" ? "+^{TAB}" : "^{TAB}";
  await runPowershell(
    `$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('${key}')`,
  );
  return `${direction === "prev" ? "Previous" : "Next"} tab par switch kar diya hai.`;
}

export async function scrollPage(direction = "down") {
  const key = direction === "up" ? "{PGUP}" : "{PGDN}";
  await runPowershell(
    `$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('${key}')`,
  );
  return `${direction === "up" ? "Upar" : "Niche"} scroll kar diya hai.`;
}

// 3. Screen Brightness Controls
export async function getBrightness() {
  try {
    const res = await runPowershell(
      "(Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorBrightness -ErrorAction SilentlyContinue).CurrentBrightness",
    );
    const parsed = parseInt(res, 10);
    return isNaN(parsed) ? 80 : parsed;
  } catch {
    return 80;
  }
}

export async function setBrightness(val) {
  const clamped = Math.min(100, Math.max(0, Number(val) || 0));
  await runPowershell(
    `(Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorBrightnessMethods -ErrorAction SilentlyContinue) | Invoke-CimMethod -MethodName WmiSetBrightness -Arguments @{ Timeout = 1; Brightness = ${clamped} }`,
  );
  return clamped;
}

export async function changeBrightness(delta) {
  const current = await getBrightness();
  const target = Math.min(100, Math.max(0, current + Number(delta)));
  await setBrightness(target);
  return target;
}

// 4. Screenshot Capture (Snipping Tool overlay)
export function takeScreenshot() {
  exec("explorer ms-screenclip:");
  return "Screenshot tool launched";
}

// 5. System Power & Session Controls
export function lockWorkstation() {
  exec("rundll32.exe user32.dll,LockWorkStation");
  return "Laptop locked";
}

export function sleepLaptop() {
  exec("rundll32.exe powrprof.dll,SetSuspendState 0,1,0");
  return "Laptop entering sleep mode";
}

export function scheduleShutdown(seconds = 60) {
  exec(`shutdown /s /t ${seconds}`);
  return `Laptop shutdown scheduled in ${seconds} seconds`;
}

export function scheduleRestart(seconds = 60) {
  exec(`shutdown /r /t ${seconds}`);
  return `Laptop restart scheduled in ${seconds} seconds`;
}

export function cancelShutdown() {
  exec("shutdown /a");
  return "Shutdown / restart cancelled";
}

// 6. Battery & Diagnostic Status
export async function getBatteryStatus() {
  try {
    const percentStr = await runPowershell(
      "(Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue).EstimatedChargeRemaining",
    );
    const statusStr = await runPowershell(
      "(Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue).BatteryStatus",
    );

    const percent = parseInt(percentStr, 10);
    const status = parseInt(statusStr, 10);

    const isCharging =
      status === 2 || status === 6 || status === 7 || status === 8;
    const isFull = percent === 100;

    return {
      available: !isNaN(percent),
      percent: isNaN(percent) ? 100 : percent,
      isCharging,
      isFull,
      text: !isNaN(percent)
        ? `Battery ${percent}% par hai${isCharging ? " aur charger laga hua hai" : ""}.`
        : "Battery status detect nahi ho paaya.",
    };
  } catch {
    return {
      available: false,
      percent: 100,
      isCharging: true,
      text: "Battery status unavailable.",
    };
  }
}

// 7. Time & Date Formatter
export function getCurrentTimeAndDate(lang = "hi-IN") {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const options = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  const dateStr = now.toLocaleDateString(
    lang.startsWith("hi") ? "hi-IN" : "en-US",
    options,
  );

  return {
    time: timeStr,
    date: dateStr,
    formatted: lang.startsWith("hi")
      ? `Abhi ka time ${timeStr} hai, aur aaj ${dateStr} hai.`
      : `The current time is ${timeStr}, and today is ${dateStr}.`,
  };
}

// 8. System Specs & Info
export async function getSystemInfo() {
  const freeMemGB = (os.freemem() / (1024 * 1024 * 1024)).toFixed(1);
  const totalMemGB = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(1);
  const uptimeHours = (os.uptime() / 3600).toFixed(1);
  const cpuModel = os.cpus()[0]?.model || "Intel/AMD";
  const hostname = os.hostname();

  return {
    hostname,
    cpu: cpuModel,
    ram: `${freeMemGB} GB free of ${totalMemGB} GB`,
    uptime: `${uptimeHours} hours`,
    summary: `Laptop '${hostname}' par ${freeMemGB} GB RAM free hai (${totalMemGB} GB me se). System ${uptimeHours} ghante se chal raha hai.`,
  };
}

// 9. Application & URL Opener
export async function openAppOrTarget(target) {
  const t = (target || "").trim().toLowerCase();

  // Known Windows native applications & utilities
  const appMappings = {
    calculator: "start calc",
    calc: "start calc",
    notepad: "start notepad",
    "task manager": "start taskmgr",
    taskmgr: "start taskmgr",
    settings: "explorer ms-settings:",
    "windows settings": "explorer ms-settings:",
    camera: "explorer microsoft.windows.camera:",
    paint: "start mspaint",
    mspaint: "start mspaint",
    terminal: "start wt || start cmd",
    cmd: "start cmd",
    "command prompt": "start cmd",
    explorer: "start explorer",
    files: "start explorer",
    "file explorer": "start explorer",
    "my computer": "start explorer shell:MyComputerFolder",
    downloads: "start explorer shell:Downloads",
    desktop: "start explorer shell:Desktop",
    documents: "start explorer shell:Personal",
    code: "start code",
    "vs code": "start code",
    vscode: "start code",
    chrome: "start chrome",
    edge: "start msedge",
  };

  if (appMappings[t]) {
    exec(appMappings[t]);
    return `App '${target}' open kar diya hai.`;
  }

  // Known web destinations
  const webMappings = {
    youtube: "https://www.youtube.com",
    google: "https://www.google.com",
    github: "https://github.com",
    gmail: "https://mail.google.com",
    whatsapp: "https://web.whatsapp.com",
    "whatsapp web": "https://web.whatsapp.com",
    chatgpt: "https://chatgpt.com",
    spotify: "https://open.spotify.com",
    netflix: "https://www.netflix.com",
    linkedin: "https://www.linkedin.com",
    instagram: "https://www.instagram.com",
    twitter: "https://twitter.com",
    x: "https://x.com",
    amazon: "https://www.amazon.in",
    flipkart: "https://www.flipkart.com",
  };

  if (webMappings[t]) {
    await open(webMappings[t]);
    return `${target} open kar diya hai.`;
  }

  // General URL or Domain fallback
  const url =
    t.startsWith("http://") || t.startsWith("https://")
      ? t
      : `https://${t.includes(".") ? t : `${t}.com`}`;

  await open(url);
  return `${target} open kar diya hai.`;
}

// 10. Search Helpers
export async function searchGoogle(query) {
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  await open(url);
  return `Google par "${query}" search kar diya hai.`;
}

export async function searchYouTube(query) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  await open(url);
  return `YouTube par "${query}" open kar diya hai.`;
}

export async function playYouTubeDirect(query) {
  const q = (query || "").trim();
  if (!q) {
    await open("https://www.youtube.com");
    return "YouTube open kar diya hai.";
  }

  try {
    const res = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      },
    );
    const html = await res.text();
    const match = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
    if (match && match[1]) {
      const videoUrl = `https://www.youtube.com/watch?v=${match[1]}&autoplay=1`;
      await open(videoUrl);
      return `YouTube par "${q}" direct play kar diya hai.`;
    }
  } catch (err) {
    console.warn("YouTube direct playback fallback:", err.message);
  }

  const fallbackUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
  await open(fallbackUrl);
  return `YouTube par "${q}" open kar diya hai.`;
}

export async function playSpotify(query) {
  const q = (query || "").trim();
  if (!q) {
    exec("start spotify: || start https://open.spotify.com");
    return "Spotify open kar diya hai.";
  }

  try {
    exec(`start spotify:search:${encodeURIComponent(q)}`);
  } catch {}
  await open(`https://open.spotify.com/search/${encodeURIComponent(q)}`);
  return `Spotify par "${q}" play kar diya hai.`;
}

export async function searchWikipedia(query) {
  const url = `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}`;
  await open(url);
  return `Wikipedia par "${query}" search kar diya hai.`;
}
