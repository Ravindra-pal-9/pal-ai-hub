// Vision Controller - Disconnected from Laptop Screen Capture
// All OS, PowerShell, and native hooks have been permanently removed.

export function captureScreen() {
  return Promise.reject(
    new Error(
      "Laptop screen capture is disabled. Laptop connection has been removed.",
    ),
  );
}

export async function analyzeScreenWithGemini(
  ai,
  userPrompt = "Analyze screen",
  targetLang = "hi-IN",
) {
  const msg =
    "Yes boss, laptop screen capture is project se remove kar diya gaya hai taaki aapke laptop par koi background process na chale. Main aapki baaki sabhi sawaalon, live news, weather aur timers mein madad kar sakti hoon!";
  return {
    text_response: msg,
    speech_response: msg,
    status: "info",
  };
}
