import React, { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Tv,
  Monitor,
  Sparkles,
  Send,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Globe,
  Radio,
  Lightbulb,
  Zap,
  Languages,
  Moon,
  Battery,
  BatteryCharging,
  Sun,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Lock,
  Camera,
  Calculator,
  FileText,
  Activity,
  Folder,
  Download,
  Settings,
  Home,
  ArrowLeft,
  Power,
  Sliders,
  BookOpen,
  Copy,
  Check,
  Trash2,
  Eye,
  CloudSun,
  Newspaper,
  Clock,
  Bell,
  DownloadCloud,
  X,
  FastForward,
  Rewind,
  Maximize,
} from "lucide-react";
import "./App.css";

// Auto-detect socket url: If accessing via Ngrok / mobile, connect to origin. If local vite dev, connect to 5000.
const SOCKET_URL =
  window.location.hostname === "localhost" && window.location.port === "5173"
    ? "http://localhost:5000"
    : window.location.origin;

const LANGUAGES = [
  { code: "hi-IN", label: "🇮🇳 Hindi (हिंदी)" },
  { code: "en-IN", label: "🇮🇳 Hinglish / English (India)" },
  { code: "en-US", label: "🇺🇸 English (US)" },
  { code: "gu-IN", label: "🇮🇳 Gujarati" },
  { code: "mr-IN", label: "🇮🇳 Marathi" },
  { code: "es-ES", label: "🇪🇸 Spanish" },
];

// Audio synthesizer beep for Timer Completion Alert
function playTimerAlertSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.3); // Arpeggio to A6

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) {
    console.warn("Audio chime error:", e);
  }
}

// Inline formatting helper for **bold** and `code`
function formatInline(str) {
  if (!str) return "";
  const tokens = str.split(/(\*\*.*?\*\*|`.*?`)/g);
  return tokens.map((token, i) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      return <strong key={i}>{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith("`") && token.endsWith("`")) {
      return (
        <code key={i} className="ai-inline-code">
          {token.slice(1, -1)}
        </code>
      );
    }
    return token;
  });
}

// Rich Markdown Message Formatter for ChatGPT & Gemini Level Output
function FormattedMessage({ content }) {
  const [copiedIndex, setCopiedIndex] = useState(null);

  if (!content) return null;

  const handleCopy = (code, index) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Split into code blocks vs standard text
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="formatted-ai-text">
      {parts.map((part, index) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const rawLines = part.slice(3, -3).trim().split("\n");
          const firstLine = rawLines[0].trim();
          const hasLang = /^[a-zA-Z0-9_-]+$/.test(firstLine);
          const lang = hasLang ? firstLine : "";
          const code = (hasLang ? rawLines.slice(1) : rawLines).join("\n");

          return (
            <div key={index} className="ai-code-block">
              <div className="code-header">
                <span className="code-lang">{lang || "code"}</span>
                <button
                  type="button"
                  className="copy-code-btn"
                  onClick={() => handleCopy(code, index)}
                  title="Copy code"
                >
                  {copiedIndex === index ? (
                    <>
                      <Check size={12} /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={12} /> Copy
                    </>
                  )}
                </button>
              </div>
              <pre className="code-content">
                <code>{code}</code>
              </pre>
            </div>
          );
        }

        // Parse paragraphs, headings, and lists
        const paragraphs = part.split(/\n\n+/);
        return (
          <div key={index} className="ai-text-segment">
            {paragraphs.map((p, pIdx) => {
              const trimmed = p.trim();
              if (!trimmed) return null;

              // Headings
              if (trimmed.startsWith("### ")) {
                return (
                  <h4 key={pIdx} className="ai-heading h4">
                    {formatInline(trimmed.slice(4))}
                  </h4>
                );
              }
              if (trimmed.startsWith("## ")) {
                return (
                  <h3 key={pIdx} className="ai-heading h3">
                    {formatInline(trimmed.slice(3))}
                  </h3>
                );
              }
              if (trimmed.startsWith("# ")) {
                return (
                  <h2 key={pIdx} className="ai-heading h2">
                    {formatInline(trimmed.slice(2))}
                  </h2>
                );
              }

              // Lists
              const lines = trimmed.split("\n");
              const isList = lines.every((l) =>
                /^\s*([*\-•]|\d+\.)\s+/.test(l),
              );
              if (isList) {
                return (
                  <ul key={pIdx} className="ai-list">
                    {lines.map((l, lIdx) => (
                      <li key={lIdx}>
                        {formatInline(l.replace(/^\s*([*\-•]|\d+\.)\s+/, ""))}
                      </li>
                    ))}
                  </ul>
                );
              }

              // Paragraphs
              return (
                <p key={pIdx} className="ai-para">
                  {lines.map((line, lIdx) => (
                    <React.Fragment key={lIdx}>
                      {formatInline(line)}
                      {lIdx < lines.length - 1 && <br />}
                    </React.Fragment>
                  ))}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const [socket, setSocket] = useState(null);
  const [status, setStatus] = useState("Connecting...");
  const [connected, setConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isAwake, setIsAwake] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState(
    "Pal is in Standby... Say 'Pal' to wake up!",
  );
  const [responseType, setResponseType] = useState("sleep_mode");
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [selectedLang, setSelectedLang] = useState("hi-IN");
  const [showLogs, setShowLogs] = useState(true);
  const [inputCommand, setInputCommand] = useState("");
  const [activeTab, setActiveTab] = useState("voice");

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // Active Voice Timers State
  const [timers, setTimers] = useState([]);

  // Live System State
  const [systemState, setSystemState] = useState({
    tvIp: "192.168.29.151",
  });

  const [messages, setMessages] = useState([
    {
      sender: "pal",
      text: "Namaste Boss! Main Pal hoon — Google Gemini, Live Real-Time Weather, Breaking News, aur Voice Timers se equipped aapki personal AI assistant. Aap mujhse koi bhi sawaal pooch sakte hain, coding sikh sakte hain, ya calculation karwa sakte hain. Shuru karne ke liye mic tap karein!",
      type: "sleep_mode",
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
  ]);

  const recognitionRef = useRef(null);
  const startListeningRef = useRef(null);
  const hasEmittedRef = useRef(false);
  const chatBottomRef = useRef(null);
  const socketRef = useRef(null);
  const selectedLangRef = useRef("hi-IN");
  const speakTextRef = useRef(null);
  const latestTranscriptRef = useRef("");
  const silenceTimerRef = useRef(null);
  const maxListenTimerRef = useRef(null);

  // Forcefully release iPhone/Desktop Microphone hardware when Tab is closed, hidden, or minimized
  useEffect(() => {
    const releaseMicrophone = () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (maxListenTimerRef.current) {
        clearTimeout(maxListenTimerRef.current);
        maxListenTimerRef.current = null;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
        recognitionRef.current = null;
      }
      setIsListening(false);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        releaseMicrophone();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", releaseMicrophone);
    window.addEventListener("beforeunload", releaseMicrophone);

    return () => {
      releaseMicrophone();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", releaseMicrophone);
      window.removeEventListener("beforeunload", releaseMicrophone);
    };
  }, []);

  useEffect(() => {
    selectedLangRef.current = selectedLang;
  }, [selectedLang]);

  // Listen for PWA Install Prompt Event
  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }
  };

  // Timer Countdown Engine (1-second tick)
  useEffect(() => {
    if (timers.length === 0) return;

    const interval = setInterval(() => {
      setTimers((prevTimers) => {
        return prevTimers
          .map((t) => {
            const rem = Math.max(
              0,
              Math.round((t.endTime - Date.now()) / 1000),
            );

            // Timer Finished Trigger
            if (rem === 0 && !t.completed) {
              playTimerAlertSound();
              if (speakTextRef.current) {
                speakTextRef.current(
                  `Yes boss! Aapka ${t.label} poora ho gaya hai!`,
                  selectedLangRef.current,
                );
              }
              return { ...t, remaining: 0, completed: true };
            }

            return { ...t, remaining: rem };
          })
          .filter((t) => !t.completed || Date.now() - t.endTime < 5000); // keep finished for 5s
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timers.length]);

  const deleteTimer = (id) => {
    setTimers((prev) => prev.filter((t) => t.id !== id));
  };

  // Preload and monitor available voices
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const loadVoices = () => {
      window.speechSynthesis.getVoices();
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Female voice selection algorithm
  const getFemaleVoice = useCallback((targetLang) => {
    if (!("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    const langPrefix = (targetLang || "hi-IN").split("-")[0].toLowerCase();
    const femaleKeywords = [
      "zira",
      "heera",
      "kalpana",
      "swara",
      "samantha",
      "victoria",
      "karen",
      "hazel",
      "female",
      "woman",
      "lekha",
      "priya",
      "ayushi",
      "shruti",
      "neerja",
      "google हिन्दी",
      "google us english",
      "google uk english female",
    ];

    const langFemale = voices.find(
      (v) =>
        v.lang.toLowerCase().replace("_", "-").startsWith(langPrefix) &&
        femaleKeywords.some((kw) => v.name.toLowerCase().includes(kw)),
    );
    if (langFemale) return langFemale;

    const langVoice = voices.find((v) =>
      v.lang.toLowerCase().replace("_", "-").startsWith(langPrefix),
    );
    if (langVoice) return langVoice;

    const anyFemale = voices.find((v) =>
      femaleKeywords.some((kw) => v.name.toLowerCase().includes(kw)),
    );
    if (anyFemale) return anyFemale;

    return null;
  }, []);

  // Text-To-Speech Output Function with iOS Safari Audio Queue Resuming
  const speakText = useCallback(
    (text, langCode, onEndCallback) => {
      if (!ttsEnabled || !("speechSynthesis" in window)) {
        if (onEndCallback) onEndCallback();
        return;
      }
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.cancel();

        const cleanText = text
          .replace(/[#*`_~>[\]()]/g, "")
          .replace(/[🔊🌐🔇🔍🎥📺❓❌⚡💡🗣️🔋⏰🧮💻👁️🌤️📰📲🇮🇳🇺🇸🇪🇸]/gu, "")
          .trim();

        if (!cleanText) {
          if (onEndCallback) onEndCallback();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(cleanText);
        const targetLang = langCode || selectedLangRef.current || "hi-IN";
        utterance.lang = targetLang;

        const femaleVoice = getFemaleVoice(targetLang);
        if (femaleVoice) {
          utterance.voice = femaleVoice;
        }

        utterance.pitch = 1.15;
        utterance.rate = 1.0;

        if (onEndCallback) {
          utterance.onend = onEndCallback;
        }

        // 40ms timeout ensures iOS Safari flushes previous cancel before speak
        setTimeout(() => {
          try {
            window.speechSynthesis.speak(utterance);
          } catch (speakErr) {
            console.warn("Speak error:", speakErr);
          }
        }, 40);
      } catch (e) {
        console.warn("Speech synthesis error:", e);
        if (onEndCallback) onEndCallback();
      }
    },
    [ttsEnabled, getFemaleVoice],
  );

  useEffect(() => {
    speakTextRef.current = speakText;
  }, [speakText]);

  // Send Command to Backend
  const sendCommand = useCallback((cmdText) => {
    const trimmed = cmdText.trim();
    if (!trimmed) return;

    setMessages((prev) => [
      ...prev,
      {
        sender: "user",
        text: trimmed,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);

    setResponse(`Processing: "${trimmed}"...`);

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("user_command", {
        command: trimmed,
        language: selectedLangRef.current,
      });
    } else {
      setResponse("❌ Backend server offline hai!");
      setMessages((prev) => [
        ...prev,
        {
          sender: "pal",
          text: "❌ Backend server offline hai! Kripya server check karein.",
          type: "error",
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    }

    setTranscript("");
    setInputCommand("");
  }, []);

  // Direct Deck Action Trigger (Runs instantly on server)
  const sendDirectAction = useCallback((actionData) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("direct_action", actionData);
    }
  }, []);

  // Clear Chat History & Memory
  const clearChat = useCallback(() => {
    setMessages([
      {
        sender: "pal",
        text: "Yes boss, chat history reset kar di gayi hai! Aap mujhse naya sawaal pooch sakte hain.",
        type: "chat",
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("clear_history");
    }
  }, []);

  // Initialize Socket.io Connection
  useEffect(() => {
    const s = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
    });

    s.on("connect", () => {
      setStatus("Connected");
      setConnected(true);
      s.emit("get_status");
    });

    s.on("disconnect", () => {
      setStatus("Disconnected");
      setConnected(false);
    });

    s.on("connect_error", () => {
      setStatus("Offline");
      setConnected(false);
    });

    s.on("system_state", (state) => {
      if (state) {
        setSystemState((prev) => ({ ...prev, ...state }));
        if (state.isAwake !== undefined) {
          setIsAwake(state.isAwake);
        }
      }
    });

    s.on("agent_response", (data) => {
      const fullText = data.message || "Complete!";
      const voiceText = data.speechText || data.message || "Complete!";
      const resType = data.type || "chat";

      setResponse(fullText);
      setResponseType(resType);
      setIsListening(false);

      if (data.isAwake !== undefined) {
        setIsAwake(data.isAwake);
      }

      if (resType === "change_language" && data.language) {
        setSelectedLang(data.language);
      }

      // Handle Timer Creation Event
      if (resType === "timer_created" && data.timer) {
        setTimers((prev) => [
          ...prev,
          {
            ...data.timer,
            remaining: data.timer.duration,
            completed: false,
          },
        ]);
      }

      setMessages((prev) => [
        ...prev,
        {
          sender: "pal",
          text: fullText,
          type: resType,
          status: data.status,
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);

      const onSpeechEnd = () => {
        if (data.autoListen) {
          setTimeout(() => {
            if (startListeningRef.current) {
              startListeningRef.current();
            }
          }, 350);
        }
      };

      if (speakTextRef.current) {
        speakTextRef.current(
          voiceText,
          data.language || selectedLangRef.current,
          onSpeechEnd,
        );
      }
    });

    s.on("session_status", (data) => {
      if (data && data.isAwake !== undefined) {
        setIsAwake(data.isAwake);
      }
    });

    setSocket(s);
    socketRef.current = s;

    return () => {
      s.disconnect();
    };
  }, []);

  // Explicit Stop & Send Helper (Safeguards against WebKit discarding speech)
  const stopAndSend = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (maxListenTimerRef.current) {
      clearTimeout(maxListenTimerRef.current);
      maxListenTimerRef.current = null;
    }
    const captured = (latestTranscriptRef.current || "").trim();
    if (captured && !hasEmittedRef.current) {
      hasEmittedRef.current = true;
      sendCommand(captured);
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, [sendCommand]);

  // Speech Recognition with iOS Safari & Android Cross-Platform Support
  const startListening = () => {
    startListeningRef.current = startListening;

    // 1. Unlock iOS Safari Web Audio / Speech Synthesis on user gesture
    if ("speechSynthesis" in window) {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        const unlock = new SpeechSynthesisUtterance(" ");
        unlock.volume = 0.01;
        window.speechSynthesis.speak(unlock);
      } catch {}
    }

    // 2. If already listening, user tapped the mic to finish and send!
    if (isListening) {
      stopAndSend();
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Speech Recognition is not supported on this browser. Kripya Safari ya Chrome use karein.",
      );
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_) {}
      recognitionRef.current = null;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = false;
    // Critical for iOS Safari: interimResults must be true or Safari silently fails to fire onresult
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = selectedLangRef.current || "hi-IN";

    hasEmittedRef.current = false;
    latestTranscriptRef.current = "";
    setTranscript("");

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript("");
      setResponse("🎤 Sun rahi hoon... (Abhi bolein boss)");
      hasEmittedRef.current = false;
      latestTranscriptRef.current = "";
    };

    recognition.onresult = (e) => {
      let currentText = "";
      let isFinal = false;

      for (let i = 0; i < e.results.length; ++i) {
        currentText += e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          isFinal = true;
        }
      }

      if (currentText) {
        latestTranscriptRef.current = currentText;
        setTranscript(currentText);

        // iOS Safari Silence Detection: Auto-submit 1.2s after user finishes speaking
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          if (
            !hasEmittedRef.current &&
            latestTranscriptRef.current &&
            latestTranscriptRef.current.trim()
          ) {
            hasEmittedRef.current = true;
            sendCommand(latestTranscriptRef.current.trim());
            try {
              recognition.stop();
            } catch (_) {}
            recognitionRef.current = null;
            setIsListening(false);
          }
        }, 1200);
      }

      // If browser fires isFinal early
      if (isFinal && currentText.trim()) {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (maxListenTimerRef.current) clearTimeout(maxListenTimerRef.current);
        if (!hasEmittedRef.current) {
          hasEmittedRef.current = true;
          sendCommand(currentText.trim());
          try {
            recognition.stop();
          } catch (_) {}
          recognitionRef.current = null;
          setIsListening(false);
        }
      }
    };

    recognition.onerror = (e) => {
      console.warn("Speech error:", e.error);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (maxListenTimerRef.current) clearTimeout(maxListenTimerRef.current);

      // If we already transcribed text before error, send it!
      if (
        !hasEmittedRef.current &&
        latestTranscriptRef.current &&
        latestTranscriptRef.current.trim()
      ) {
        hasEmittedRef.current = true;
        sendCommand(latestTranscriptRef.current.trim());
        try {
          recognition.abort();
        } catch (_) {}
        recognitionRef.current = null;
        setIsListening(false);
        return;
      }

      try {
        recognition.abort();
      } catch (_) {}
      recognitionRef.current = null;
      setIsListening(false);

      if (e.error === "not-allowed") {
        setResponse(
          "❌ Microphone blocked! iPhone Settings ➔ Safari ➔ Microphone Allow karein.",
        );
        alert(
          "Microphone permission blocked! iPhone Settings ➔ Safari ➔ Microphone ko 'Allow' karein.",
        );
      } else if (e.error === "no-speech") {
        setResponse(
          "⚠️ Awaaz detect nahi hui. Tip: Mic ke paas bolein ya Hinglish/English chunein.",
        );
      } else if (e.error === "network") {
        setResponse(
          "⚠️ Network error: iPhone Settings ➔ General ➔ Keyboard ➔ Enable Dictation check karein.",
        );
      } else {
        setResponse(`⚠️ Speech status: ${e.error}`);
      }
    };

    recognition.onend = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (maxListenTimerRef.current) clearTimeout(maxListenTimerRef.current);
      setIsListening(false);
      recognitionRef.current = null;

      // iOS WebKit Fallback: If user spoke but Safari closed before setting isFinal
      if (
        !hasEmittedRef.current &&
        latestTranscriptRef.current &&
        latestTranscriptRef.current.trim()
      ) {
        hasEmittedRef.current = true;
        sendCommand(latestTranscriptRef.current.trim());
      }
    };

    try {
      recognition.start();

      // Safety Cap: If user leaves mic open without speaking, auto-close after 10 seconds to free the mic
      if (maxListenTimerRef.current) clearTimeout(maxListenTimerRef.current);
      maxListenTimerRef.current = setTimeout(() => {
        stopAndSend();
      }, 10000);
    } catch (e) {
      console.warn("Start error:", e);
      setIsListening(false);
      recognitionRef.current = null;
    }
  };

  useEffect(() => {
    startListeningRef.current = startListening;
  });

  useEffect(() => {
    if (showLogs) {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, showLogs]);

  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (inputCommand) {
      sendCommand(inputCommand);
    }
  };

  const quickCommands = [
    { label: '⚡ "Pal"', cmd: "Pal" },
    { label: '🌤️ "Delhi Weather"', cmd: "Pal, Delhi ka mausam kaisa hai?" },
    { label: '📰 "Live News"', cmd: "Pal, aaj ki breaking news batao" },
    { label: '⏰ "5 Min Timer"', cmd: "Pal, 5 minute ka timer lagao" },
    {
      label: '🧠 "Python roadmap"',
      cmd: "Pal, Python sikhne ka complete roadmap batao",
    },
    {
      label: '🧮 "15000 ka 18% GST"',
      cmd: "Pal, 15000 ka 18% GST kitna hoga?",
    },
    { label: '📺 "TV YouTube"', cmd: "Pal, TV par YouTube chalao" },
    { label: '🌍 "Ek accha joke"', cmd: "Pal, ek majedar joke sunao" },
    { label: '🌐 "English me bolo"', cmd: "Pal, switch to English" },
    { label: '🌙 "So jao"', cmd: "Pal, so jao" },
  ];

  return (
    <div className="jarvis-app">
      {/* Background Ambient Glows */}
      <div className="ambient-glow cyan-glow"></div>
      <div className="ambient-glow blue-glow"></div>

      <div className="jarvis-wrapper">
        {/* Header */}
        <header className="jarvis-navbar">
          <div className="navbar-brand">
            <Sparkles className="sparkle-icon" />
            <h1 className="brand-title">PAL AI</h1>
            <div
              className={`session-status-badge ${isAwake ? "awake" : "sleep"}`}
            >
              <span className="session-dot"></span>
              <span>{isAwake ? "Awake (5m)" : "Standby"}</span>
            </div>
          </div>

          <div className="navbar-actions">
            {/* PWA Install Button (If installable) */}
            {deferredPrompt && !isInstalled && (
              <button
                className="pwa-install-badge"
                onClick={handleInstallApp}
                title="Install Pal App on your device"
              >
                <DownloadCloud size={13} />
                <span>Install App</span>
              </button>
            )}


            {/* Language Dropdown */}
            <div className="lang-dropdown-wrapper">
              <Globe size={14} className="lang-globe-icon" />
              <select
                value={selectedLang}
                onChange={(e) => setSelectedLang(e.target.value)}
                className="lang-select"
                aria-label="Select Voice Language"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            {/* TTS Toggle */}
            <button
              className={`icon-pill-btn ${ttsEnabled ? "active" : ""}`}
              onClick={() => setTtsEnabled(!ttsEnabled)}
              title={ttsEnabled ? "Voice: ON" : "Voice: OFF"}
            >
              {ttsEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>

            {/* Status Badge */}
            <div
              className={`status-badge ${connected ? "connected" : "disconnected"}`}
            >
              <span className="status-dot"></span>
              <span>{status}</span>
            </div>
          </div>
        </header>

        {/* ACTIVE TIMERS BANNER */}
        {timers.length > 0 && (
          <div className="active-timers-banner">
            {timers.map((t) => {
              const mins = Math.floor(t.remaining / 60);
              const secs = t.remaining % 60;
              const formattedTime = `${mins}:${secs < 10 ? "0" : ""}${secs}`;

              return (
                <div
                  key={t.id}
                  className={`timer-pill ${t.completed ? "alarm-ringing" : ""}`}
                >
                  <Clock size={14} className="timer-icon" />
                  <span className="timer-label">{t.label}:</span>
                  <span className="timer-countdown">
                    {t.completed ? "FINISHED! 🔔" : formattedTime}
                  </span>
                  <button
                    className="timer-delete-btn"
                    onClick={() => deleteTimer(t.id)}
                    title="Dismiss Timer"
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* View Navigation Switcher */}
        <nav className="tab-navigation">
          <button
            className={`tab-btn ${activeTab === "voice" ? "active" : ""}`}
            onClick={() => setActiveTab("voice")}
          >
            <Mic size={15} />
            <span>AI Voice & Chat</span>
          </button>
          <button
            className={`tab-btn ${activeTab === "deck" ? "active" : ""}`}
            onClick={() => setActiveTab("deck")}
          >
            <Sliders size={15} />
            <span>Control Deck</span>
          </button>
          <button
            className={`tab-btn ${activeTab === "guide" ? "active" : ""}`}
            onClick={() => setActiveTab("guide")}
          >
            <BookOpen size={15} />
            <span>Commands</span>
          </button>
        </nav>

        {/* TAB 1: AI VOICE & CHAT INTERFACE */}
        {activeTab === "voice" && (
          <main className="jarvis-main-stage">
            {/* Centerpiece Glowing Reactor Mic Orb */}
            <div className="mic-centerpiece">
              <div
                className={`orb-concentric outer ${isListening ? "active" : ""}`}
              ></div>
              <div
                className={`orb-concentric inner ${isListening ? "active" : ""}`}
              ></div>

              <button
                className={`reactor-mic-btn ${isListening ? "is-listening" : ""}`}
                onClick={startListening}
                aria-label="Activate Microphone"
              >
                {isListening ? (
                  <MicOff className="mic-svg bounce" />
                ) : (
                  <Mic className="mic-svg" />
                )}
              </button>
            </div>

            {/* Mic Status Banner */}
            <div className="mic-action-banner">
              {isListening ? (
                <div className="active-listening-box">
                  {transcript ? (
                    <div className="live-transcript-card">
                      <div className="live-transcript-header">
                        <span className="hearing-pulse-badge">
                          <span className="pulse-dot"></span> Sun rahi hoon:
                        </span>
                        <button
                          type="button"
                          className="tap-to-send-btn"
                          onClick={stopAndSend}
                        >
                          <Send size={13} /> Send Now
                        </button>
                      </div>
                      <p className="live-transcript-text">"{transcript}"</p>
                      <span className="silence-hint">
                        ⏱️ Bolna band karte hi auto-send ho jaayega
                      </span>
                    </div>
                  ) : (
                    <div className="listening-waiting-state">
                      <div className="voice-wave-container">
                        <span className="wave-bar b1"></span>
                        <span className="wave-bar b2"></span>
                        <span className="wave-bar b3"></span>
                        <span className="wave-bar b4"></span>
                        <span className="wave-bar b5"></span>
                        <span className="listening-subtext">
                          Sun rahi hoon...
                        </span>
                      </div>
                      <p className="tap-guide-text">
                        Bolein boss... (Bolte hi live words dikhenge)
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="tap-guide-text">
                  {isAwake
                    ? "🟢 Pal is Awake — Ask anything, analyze screen, or control devices!"
                    : '⚡ Mic tap karein ya "Pal" bolein!'}
                </p>
              )}
            </div>

            {/* Quick One-Tap Suggestions */}
            <div className="quick-chip-container">
              {quickCommands.map((item, idx) => (
                <button
                  key={idx}
                  className="action-chip"
                  onClick={() => sendCommand(item.cmd)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* ChatGPT / Gemini Style Activity Feed */}
            <div className="activity-panel full-ai">
              <div className="activity-panel-header">
                <div className="panel-title-group">
                  <MessageSquare size={15} />
                  <span>Conversation Feed ({messages.length})</span>
                </div>
                <div className="panel-actions-group">
                  <button
                    className="clear-chat-btn"
                    onClick={clearChat}
                    title="Clear Chat & Memory"
                  >
                    <Trash2 size={13} />
                    <span>Reset</span>
                  </button>
                  <button
                    className="logs-toggle-btn-small"
                    onClick={() => setShowLogs(!showLogs)}
                  >
                    {showLogs ? (
                      <ChevronUp size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    )}
                  </button>
                </div>
              </div>

              {showLogs && (
                <>
                  <div className="chat-messages-container">
                    {messages.map((m, i) => (
                      <div key={i} className={`chat-bubble ${m.sender}`}>
                        <div className="bubble-header">
                          <span className="bubble-sender-name">
                            {m.sender === "pal" ? "Pal AI" : "You"}
                          </span>
                          <div className="bubble-header-actions">
                            <span className="bubble-time">{m.time}</span>
                            {m.sender === "pal" && (
                              <button
                                type="button"
                                className="chat-speak-btn"
                                onClick={() =>
                                  speakText(m.text, selectedLangRef.current)
                                }
                                title="Awaaz suno"
                              >
                                <Volume2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                        {m.sender === "pal" ? (
                          <FormattedMessage content={m.text} />
                        ) : (
                          <span className="bubble-text">{m.text}</span>
                        )}
                      </div>
                    ))}
                    <div ref={chatBottomRef} />
                  </div>

                  <form className="quick-type-form" onSubmit={handleTextSubmit}>
                    <input
                      type="text"
                      placeholder={
                        isAwake
                          ? "Poonchhein: 'Screen dekho', 'Delhi weather', 'Python code'..."
                          : "Type: 'Pal' to wake up or ask anything..."
                      }
                      value={inputCommand}
                      onChange={(e) => setInputCommand(e.target.value)}
                    />
                    <button type="submit" disabled={!inputCommand.trim()}>
                      <Send size={15} />
                    </button>
                  </form>
                </>
              )}
            </div>
          </main>
        )}

        {/* TAB 2: ADVANCED CONTROL DECK */}
        {activeTab === "deck" && (
          <main className="deck-container">
            {/* SECTION 1: LIVE INTERNET DATA & AI TOOLS */}
            <div className="deck-card vision-spotlight">
              <div className="deck-card-header">
                <div className="deck-title-group">
                  <Sparkles size={18} className="deck-icon cyan" />
                  <h3>Live Real-Time Data & AI Tools</h3>
                </div>
                <span className="deck-status-pill">Gemini AI</span>
              </div>

              <div className="vision-buttons-grid">
                <button
                  className="vision-action-card"
                  onClick={() =>
                    sendDirectAction({ action: "get_weather", target: "Delhi" })
                  }
                >
                  <CloudSun size={20} className="card-icon amber" />
                  <div className="card-text">
                    <h4>Live Real-Time Weather</h4>
                    <p>Current temp, humidity aur mausam check karo</p>
                  </div>
                </button>

                <button
                  className="vision-action-card"
                  onClick={() => sendDirectAction({ action: "get_news" })}
                >
                  <Newspaper size={20} className="card-icon green" />
                  <div className="card-text">
                    <h4>Top Breaking News</h4>
                    <p>India aur World ki latest headlines suno</p>
                  </div>
                </button>

                <button
                  className="vision-action-card"
                  onClick={() =>
                    sendDirectAction({
                      action: "set_timer",
                      value: 300,
                      target: "5 Minute Timer",
                    })
                  }
                >
                  <Clock size={20} className="card-icon purple" />
                  <div className="card-text">
                    <h4>Quick 5-Min Timer</h4>
                    <p>5 minute ka countdown shuru karo</p>
                  </div>
                </button>

                <button
                  className="vision-action-card"
                  onClick={() =>
                    sendCommand("Pal, ek majedar joke sunao")
                  }
                >
                  <Sparkles size={20} className="card-icon cyan" />
                  <div className="card-text">
                    <h4>Ek Majedar Joke</h4>
                    <p>AI se ek funny joke ya shayari suno</p>
                  </div>
                </button>
              </div>
            </div>


            {/* SECTION 3: SMART TV REMOTE */}
            <div className="deck-card">
              <div className="deck-card-header">
                <div className="deck-title-group">
                  <Tv size={18} className="deck-icon green" />
                  <h3>Smart TV Remote</h3>
                </div>
                <button
                  className="tv-power-btn"
                  title="Toggle TV Power"
                  onClick={() =>
                    sendDirectAction({
                      device: "tv",
                      action: "power_toggle",
                    })
                  }
                >
                  <Power size={14} />
                  <span>Power</span>
                </button>
              </div>

              {/* D-Pad Virtual Remote Controller */}
              <div className="dpad-wrapper">
                <div className="dpad-container">
                  <button
                    className="dpad-btn up"
                    aria-label="Up"
                    onClick={() =>
                      sendDirectAction({
                        device: "tv",
                        action: "tv_dpad",
                        direction: "up",
                      })
                    }
                  >
                    ▲
                  </button>
                  <button
                    className="dpad-btn left"
                    aria-label="Left"
                    onClick={() =>
                      sendDirectAction({
                        device: "tv",
                        action: "tv_dpad",
                        direction: "left",
                      })
                    }
                  >
                    ◀
                  </button>
                  <button
                    className="dpad-btn center-ok"
                    aria-label="OK"
                    onClick={() =>
                      sendDirectAction({
                        device: "tv",
                        action: "tv_dpad",
                        direction: "select",
                      })
                    }
                  >
                    OK
                  </button>
                  <button
                    className="dpad-btn right"
                    aria-label="Right"
                    onClick={() =>
                      sendDirectAction({
                        device: "tv",
                        action: "tv_dpad",
                        direction: "right",
                      })
                    }
                  >
                    ▶
                  </button>
                  <button
                    className="dpad-btn down"
                    aria-label="Down"
                    onClick={() =>
                      sendDirectAction({
                        device: "tv",
                        action: "tv_dpad",
                        direction: "down",
                      })
                    }
                  >
                    ▼
                  </button>
                </div>
              </div>

              {/* TV Navigation Controls */}
              <div className="tv-nav-row">
                <button
                  className="tv-nav-pill"
                  onClick={() =>
                    sendDirectAction({ device: "tv", action: "tv_back" })
                  }
                >
                  <ArrowLeft size={14} /> Back
                </button>
                <button
                  className="tv-nav-pill highlight"
                  onClick={() =>
                    sendDirectAction({ device: "tv", action: "tv_home" })
                  }
                >
                  <Home size={14} /> Home
                </button>
                <button
                  className="tv-nav-pill"
                  onClick={() =>
                    sendDirectAction({ device: "tv", action: "tv_settings" })
                  }
                >
                  <Settings size={14} /> Settings
                </button>
              </div>

              {/* TV Volume & Media Controls */}
              <div className="tv-vol-media-row">
                <div className="tv-sub-group">
                  <span className="sub-group-title">TV Volume</span>
                  <div className="btn-duo">
                    <button
                      className="deck-mini-btn"
                      onClick={() =>
                        sendDirectAction({
                          device: "tv",
                          action: "volume_down",
                        })
                      }
                    >
                      Vol -
                    </button>
                    <button
                      className="deck-mini-btn"
                      onClick={() =>
                        sendDirectAction({ device: "tv", action: "volume_up" })
                      }
                    >
                      Vol +
                    </button>
                    <button
                      className="deck-mini-btn"
                      onClick={() =>
                        sendDirectAction({ device: "tv", action: "mute" })
                      }
                    >
                      <VolumeX size={14} />
                    </button>
                  </div>
                </div>

                <div className="tv-sub-group">
                  <span className="sub-group-title">TV Playback</span>
                  <div className="btn-duo">
                    <button
                      className="deck-mini-btn"
                      onClick={() =>
                        sendDirectAction({
                          device: "tv",
                          action: "tv_play_pause",
                        })
                      }
                    >
                      ⏯️ Play/Pause
                    </button>
                  </div>
                </div>
              </div>

              {/* TV Streaming Apps Grid */}
              <div className="deck-apps-section">
                <span className="group-label">Open TV Streaming App</span>
                <div className="tv-app-grid">
                  <button
                    className="tv-app-btn yt"
                    onClick={() =>
                      sendDirectAction({
                        device: "tv",
                        action: "open_app",
                        target: "youtube",
                      })
                    }
                  >
                    YouTube
                  </button>
                  <button
                    className="tv-app-btn nfx"
                    onClick={() =>
                      sendDirectAction({
                        device: "tv",
                        action: "open_app",
                        target: "netflix",
                      })
                    }
                  >
                    Netflix
                  </button>
                  <button
                    className="tv-app-btn hotstar"
                    onClick={() =>
                      sendDirectAction({
                        device: "tv",
                        action: "open_app",
                        target: "hotstar",
                      })
                    }
                  >
                    Hotstar
                  </button>
                  <button
                    className="tv-app-btn prime"
                    onClick={() =>
                      sendDirectAction({
                        device: "tv",
                        action: "open_app",
                        target: "prime",
                      })
                    }
                  >
                    Prime Video
                  </button>
                  <button
                    className="tv-app-btn jio"
                    onClick={() =>
                      sendDirectAction({
                        device: "tv",
                        action: "open_app",
                        target: "jiocinema",
                      })
                    }
                  >
                    JioCinema
                  </button>
                  <button
                    className="tv-app-btn spot"
                    onClick={() =>
                      sendDirectAction({
                        device: "tv",
                        action: "open_app",
                        target: "spotify",
                      })
                    }
                  >
                    Spotify TV
                  </button>
                </div>
              </div>
            </div>
          </main>
        )}

        {/* TAB 3: COMPLETE VOICE COMMANDS GUIDE */}
        {activeTab === "guide" && (
          <main className="guide-container">
            <div className="guide-hero">
              <Sparkles className="guide-sparkle" />
              <h2>Pal Full AI & Supercharged Guide</h2>
              <p>
                Live Weather, Breaking News, Voice Timers, Smart TV Remote aur
                Conversational AI ke sabhi voice commands.
              </p>
            </div>

            <div className="guide-category-grid">
              {/* Category 1 */}
              <div className="guide-card">
                <div className="guide-card-header">
                  <Globe size={16} className="guide-icon cyan" />
                  <h4>Conversational AI & Knowledge</h4>
                </div>
                <ul>
                  <li>
                    <code>
                      "Pal, Quantum Computing kya hai asan shabdon mein samjhao"
                    </code>
                  </li>
                  <li>
                    <code>
                      "Pal, AI agent aur LLM mein kya antar hota hai?"
                    </code>
                  </li>
                  <li>
                    <code>
                      "Pal, solar system ke baare mein dilchasp fact batao"
                    </code>
                  </li>
                  <li>
                    Google Gemini 2.5 Flash engine se instantaneous aur accurate
                    jawab!
                  </li>
                </ul>
              </div>

              {/* Category 2 */}
              <div className="guide-card">
                <div className="guide-card-header">
                  <CloudSun size={16} className="guide-icon amber" />
                  <h4>Live Real-Time Weather & News</h4>
                </div>
                <ul>
                  <li>
                    <code>"Pal, aaj mausam kaisa hai?"</code> /{" "}
                    <code>"Delhi ka weather batao"</code>
                  </li>
                  <li>
                    <code>
                      "Pal, Mumbai me temperature aur humidity kitni hai?"
                    </code>
                  </li>
                  <li>
                    <code>"Pal, aaj ki breaking news headlines kya hain?"</code>
                  </li>
                  <li>Direct real-time internet data se live updates!</li>
                </ul>
              </div>

              {/* Category 3 */}
              <div className="guide-card">
                <div className="guide-card-header">
                  <Clock size={16} className="guide-icon purple" />
                  <h4>Voice Timers & Reminders</h4>
                </div>
                <ul>
                  <li>
                    <code>"Pal, 5 minute ka timer lagao"</code>
                  </li>
                  <li>
                    <code>"Pal, 30 second ka timer lagao"</code>
                  </li>
                  <li>
                    <code>
                      "Pal, 15 minute baad paani peene ka reminder do"
                    </code>
                  </li>
                  <li>
                    Live countdown UI aur chime sound alert ke sath awaaz
                    lagayegi!
                  </li>
                </ul>
              </div>

              {/* Category 4 */}
              <div className="guide-card">
                <div className="guide-card-header">
                  <Lightbulb size={16} className="guide-icon pink" />
                  <h4>Full AI Intelligence (ChatGPT & Gemini)</h4>
                </div>
                <ul>
                  <li>
                    <code>
                      "Pal, Python me Fibonacci series ka code likh kar samjhao"
                    </code>
                  </li>
                  <li>
                    <code>
                      "Pal, Quantum Computing kya hai asan shabdon mein samjhao"
                    </code>
                  </li>
                  <li>
                    <code>
                      "Pal, 15000 ka 18% GST aur total amount kitna hoga?"
                    </code>
                  </li>
                  <li>
                    <code>
                      "Pal, office ke liye professional leave application likho"
                    </code>
                  </li>
                  <li>
                    Pichli baatein yaad rakhti hai (multi-turn follow up
                    questions)!
                  </li>
                </ul>
              </div>

              {/* Category 5 */}
              <div className="guide-card">
                <div className="guide-card-header">
                  <Zap size={16} className="guide-icon blue" />
                  <h4>Productivity & Daily Assistance</h4>
                </div>
                <ul>
                  <li>
                    <code>"Pal, ek funny joke sunao"</code> /{" "}
                    <code>"Kuch naya motivation do"</code>
                  </li>
                  <li>
                    <code>"Pal, healthy lifestyle ke tips batao"</code>
                  </li>
                  <li>
                    <code>"Pal, interview preparation tips kya hain?"</code>
                  </li>
                  <li>
                    <code>"Pal, aaj ka din productive kaise banayein?"</code>
                  </li>
                  <li>
                    <code>"Abhi kya time hua hai?"</code>
                  </li>
                </ul>
              </div>

              {/* Category 6 */}
              <div className="guide-card">
                <div className="guide-card-header">
                  <Tv size={16} className="guide-icon green" />
                  <h4>Smart TV Controls (ADB)</h4>
                </div>
                <ul>
                  <li>
                    <code>"TV band kar do"</code> / <code>"TV on karo"</code>
                  </li>
                  <li>
                    <code>"TV home screen par jao"</code> /{" "}
                    <code>"TV back karo"</code>
                  </li>
                  <li>
                    <code>"TV par YouTube open karo"</code> /{" "}
                    <code>"Netflix chalao"</code>
                  </li>
                  <li>
                    <code>"TV volume badhao"</code> /{" "}
                    <code>"TV mute karo"</code>
                  </li>
                  <li>
                    <code>"TV par Arijit Singh ke gaane search karo"</code>
                  </li>
                </ul>
              </div>
            </div>
          </main>
        )}

        {/* Target Devices Footer Bar */}
        <footer className="jarvis-device-bar">
          <div className="device-card">
            <div className="device-icon-box">
              <Globe className="device-svg" />
            </div>
            <div className="device-info">
              <p className="device-title">Pal Cloud AI</p>
              <p className="device-sub">Online • Gemini Engine</p>
            </div>
          </div>

          <div className="device-card">
            <div className="device-icon-box">
              <Tv className="device-svg" />
            </div>
            <div className="device-info">
              <p className="device-title">Smart TV</p>
              <p className="device-sub">
                {systemState.tvIp || "192.168.29.151"}
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
