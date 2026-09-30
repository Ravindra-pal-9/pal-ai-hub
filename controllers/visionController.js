import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

// Silently capture primary screen to temp JPG
export function captureScreen() {
  return new Promise((resolve, reject) => {
    if (process.platform !== "win32") {
      return reject(
        new Error("Screen capture only available on Windows host."),
      );
    }
    const tempFile = path.join(os.tmpdir(), `pal_screen_${Date.now()}.jpg`);
    const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$bmp.Save('${tempFile.replace(/\\/g, "\\\\")}', [System.Drawing.Imaging.ImageFormat]::Jpeg)
$g.Dispose()
$bmp.Dispose()
Write-Output '${tempFile.replace(/\\/g, "\\\\")}'
`;

    execFile(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-Command", psScript],
      { timeout: 8000 },
      (err, stdout, stderr) => {
        if (err) {
          console.warn("Screen capture warning:", stderr || err.message);
          reject(err);
        } else {
          const outPath = stdout.trim();
          if (fs.existsSync(outPath)) {
            resolve(outPath);
          } else if (fs.existsSync(tempFile)) {
            resolve(tempFile);
          } else {
            reject(new Error("Screenshot file not found"));
          }
        }
      },
    );
  });
}

// Analyze screen using Gemini Vision
export async function analyzeScreenWithGemini(
  ai,
  userPrompt = "What is on my screen? Explain or solve any errors visible.",
  targetLanguage = "hi-IN",
) {
  let imgPath = null;
  try {
    imgPath = await captureScreen();
    const imageBytes = fs.readFileSync(imgPath).toString("base64");

    const promptText = `
      You are Pal, an advanced AI Assistant analyzing the user's active laptop screen.
      Target Response Language: "${targetLanguage}".
      User Question: "${userPrompt}"

      Instructions:
      1. ALWAYS start with "Yes boss, " or "Yes boss! ".
      2. Carefully examine the screenshot. Identify what applications, code, browser tabs, errors, documents, or content are visible.
      3. If there is a code error, compiler error, or issue on screen: explain the root cause and provide the exact fix.
      4. If the user asks for explanation or summary: explain what is happening on screen in simple, clear steps.
      5. Provide a full detailed markdown response for the screen, plus a natural 1-2 sentence spoken summary for voice output.
      
      Return JSON:
      {
        "type": "chat",
        "text_response": "Full detailed markdown explanation/solution",
        "speech_response": "Short natural 1-2 sentence spoken summary in ${targetLanguage}"
      }
    `;

    const contents = [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: imageBytes,
            },
          },
          { text: promptText },
        ],
      },
    ];

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: contents,
      config: {
        responseMimeType: "application/json",
      },
    });

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

    try {
      return JSON.parse(raw);
    } catch {
      return {
        type: "chat",
        text_response: raw,
        speech_response:
          "Yes boss, maine aapki screen ka poora vishleshan screen par likh diya hai.",
      };
    }
  } catch (err) {
    console.error("Screen Vision Error:", err);
    return {
      type: "chat",
      text_response:
        "Yes boss, screen capture karne mein takneeki dikkat aayi. Kripya check karein ki display active hai.",
      speech_response: "Yes boss, screen capture karne mein dikkat aayi.",
    };
  } finally {
    // Cleanup temporary screenshot file
    if (imgPath && fs.existsSync(imgPath)) {
      try {
        fs.unlinkSync(imgPath);
      } catch {}
    }
  }
}
