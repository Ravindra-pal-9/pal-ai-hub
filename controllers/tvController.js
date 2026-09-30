import { exec } from "child_process";
import fs from "fs";

const TV_IP = process.env.TV_IP || "192.168.29.151";

// Resolve local ADB binary
const localAdbPath = `${process.env.LOCALAPPDATA || "C:\\Users\\RAVINA\\AppData\\Local"}\\Android\\Sdk\\platform-tools\\adb.exe`;
const ADB_CMD = fs.existsSync(localAdbPath) ? `"${localAdbPath}"` : "adb";

export function getTvIp() {
  return TV_IP;
}

// Low-level command execution with fast timeout
export function executeTvCommand(command, timeoutMs = 4500) {
  return new Promise((resolve) => {
    const fullCmd = `${ADB_CMD} connect ${TV_IP} && ${ADB_CMD} shell ${command}`;
    console.log(`📡 TV Command: ${command}`);

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      resolve({
        success: false,
        message:
          "Smart TV connect nahi ho paayi. Check karein ki TV on hai aur same Wi-Fi par connected hai.",
      });
    }, timeoutMs);

    exec(fullCmd, { timeout: timeoutMs + 1000 }, (error, stdout, stderr) => {
      if (timedOut) return;
      clearTimeout(timer);

      if (error) {
        console.warn("TV Execution Warning:", stderr || error.message);
        resolve({
          success: false,
          message:
            "Smart TV connect nahi ho paayi. Kripya Wi-Fi aur TV status check karein.",
        });
      } else {
        resolve({
          success: true,
          output: stdout ? stdout.trim() : "Success",
          message: "Command TV par execute ho gaya.",
        });
      }
    });
  });
}

// 1. Power Controls
export async function powerOff() {
  return await executeTvCommand("input keyevent 26");
}

export async function powerOn() {
  return await executeTvCommand("input keyevent 224");
}

export async function powerToggle() {
  return await executeTvCommand("input keyevent 26");
}

// 2. Volume & Audio Controls
export async function volumeUp() {
  return await executeTvCommand("input keyevent 24");
}

export async function volumeDown() {
  return await executeTvCommand("input keyevent 25");
}

export async function toggleMute() {
  return await executeTvCommand("input keyevent 164");
}

// 3. Navigation (Virtual Remote D-Pad)
export async function navigateHome() {
  return await executeTvCommand("input keyevent 3");
}

export async function navigateBack() {
  return await executeTvCommand("input keyevent 4");
}

export async function navigateMenu() {
  return await executeTvCommand("input keyevent 82");
}

export async function openSettings() {
  return await executeTvCommand("am start -a android.settings.SETTINGS");
}

export async function dpad(direction) {
  const map = {
    up: "input keyevent 19",
    down: "input keyevent 20",
    left: "input keyevent 21",
    right: "input keyevent 22",
    select: "input keyevent 23",
    ok: "input keyevent 23",
    enter: "input keyevent 66",
  };
  const cmd = map[direction.toLowerCase()] || "input keyevent 23";
  return await executeTvCommand(cmd);
}

// 4. Media Playback Controls
export async function mediaPlayPause() {
  return await executeTvCommand("input keyevent 85");
}

export async function mediaPlay() {
  return await executeTvCommand("input keyevent 126");
}

export async function mediaPause() {
  return await executeTvCommand("input keyevent 127");
}

export async function mediaNext() {
  return await executeTvCommand("input keyevent 87");
}

export async function mediaPrev() {
  return await executeTvCommand("input keyevent 88");
}

// 5. Streaming & TV Applications
export async function openTvApp(appTarget) {
  const target = (appTarget || "").toLowerCase().trim();

  const appLaunchCommands = {
    youtube:
      "am start -n com.google.android.youtube.tv/com.google.android.apps.youtube.tv.activity.ShellActivity",
    netflix: "monkey -p com.netflix.ninja 1",
    prime: "monkey -p com.amazon.amazonvideo.livingroom 1",
    "prime video": "monkey -p com.amazon.amazonvideo.livingroom 1",
    hotstar: "monkey -p in.startv.hotstar 1",
    disney: "monkey -p in.startv.hotstar 1",
    "disney hotstar": "monkey -p in.startv.hotstar 1",
    jiocinema: "monkey -p com.jio.media.ondemand 1",
    jio: "monkey -p com.jio.media.ondemand 1",
    spotify: "monkey -p com.spotify.tv.android 1",
    sonyliv: "monkey -p com.sony.liv 1",
    sony: "monkey -p com.sony.liv 1",
    zee5: "monkey -p com.graymatrix.did 1",
    playstore: "monkey -p com.android.vending 1",
    "play store": "monkey -p com.android.vending 1",
  };

  const command = appLaunchCommands[target] || `monkey -p ${target} 1`;

  return await executeTvCommand(command);
}

// 6. Direct Video Search on TV YouTube
export async function searchTvYouTube(query) {
  const encoded = encodeURIComponent(query);
  const command = `am start -a android.intent.action.VIEW "https://www.youtube.com/results?search_query=${encoded}"`;
  return await executeTvCommand(command);
}
