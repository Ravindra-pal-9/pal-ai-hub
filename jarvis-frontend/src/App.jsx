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
  { code: "hi-IN", label: "Hindi / Hinglish" },
  { code: "en-US", label: "English" },
  { code: "gu-IN", label: "Gujarati" },
  { code: "mr-IN", label: "Marathi" },
  { code: "es-ES", label: "Spanish" },
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
    volume: 50,
    muted: false,
    brightness: 80,
    battery: { percent: 100, isCharging: true },
    tvIp: "192.168.29.151",
  });

  const [messages, setMessages] = useState([
    {
      sender: "pal",
      text: "Namaste Boss! Main Pal hoon — Google Gemini, Screen Vision AI, Live Weather & News, aur Voice Timers se equipped full AI assistant. Aap mujhse screen analyze karwa sakte hain, koi bhi question pooch sakte hain, ya laptop aur TV control kar sakte hain. Shuru karne ke liye 'Pal' bolein!",
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

  // Text-To-Speech Output Function
  const speakText = useCallback(
    (text, langCode, onEndCallback) => {
      if (!ttsEnabled || !("speechSynthesis" in window)) {
        if (onEndCallback) onEndCallback();
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const cleanText = text
          .replace(/[#*`_~>[\]()]/g, "")
          .replace(/[🔊🌐🔇🔍🎥📺❓❌⚡💡🗣️🔋⏰🧮💻👁️🌤️📰📲]/g, "")
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

        utterance.pitch = 1.18;
        utterance.rate = 1.0;

        if (onEndCallback) {
          utterance.onend = onEndCallback;
        }

        window.speechSynthesis.speak(utterance);
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

  // Speech Recognition with Zero-Duplication Fix
  const startListening = () => {
    startListeningRef.current = startListening;

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          console.warn("Abort error:", e);
        }
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech Recognition is not supported on this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.lang = selectedLangRef.current || "hi-IN";

    hasEmittedRef.current = false;

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript("");
      hasEmittedRef.current = false;
    };

    recognition.onresult = (e) => {
      if (hasEmittedRef.current) return;
      hasEmittedRef.current = true;

      const finalTranscript = e.results[0][0].transcript;
      setTranscript(finalTranscript);
      sendCommand(finalTranscript);
    };

    recognition.onerror = (e) => {
      console.warn("Speech error:", e.error);
      setIsListening(false);
      if (e.error === "not-allowed") {
        alert("Microphone permission blocked! Browser me mic allow karein.");
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch (e) {
      console.warn("Start error:", e);
      setIsListening(false);
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
    {
      label: '👁️ "Screen Vision"',
      cmd: "Pal, meri screen dekho aur batao kya ho raha hai",
    },
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
    { label: '🔋 "Battery check"', cmd: "Pal, battery kitni hai?" },
    { label: '📸 "Screenshot lo"', cmd: "Pal, screenshot lo" },
    { label: '🔒 "Lock laptop"', cmd: "Pal, laptop lock karo" },
    { label: '📺 "TV YouTube"', cmd: "Pal, TV par YouTube chalao" },
    { label: '🎵 "Song Pause/Play"', cmd: "Pal, gaana pause karo" },
    { label: '💡 "Brightness 70%"', cmd: "Pal, brightness 70 percent karo" },
    { label: '🌐 "English me bolo"', cmd: "Pal, switch to English" },
    { label: ' "So jao"', cmd: "Pal, so jao" },
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

            {/* Battery Pill */}
            {systemState.battery?.percent !== undefined && (
              <div
                className={`battery-badge ${systemState.battery.isCharging ? "charging" : ""}`}
                title={systemState.battery.text || "Battery"}
              >
                {systemState.battery.isCharging ? (
                  <BatteryCharging size={13} />
                ) : (
                  <Battery size={13} />
                )}
                <span>{systemState.battery.percent}%</span>
              </div>
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
              <p className="tap-guide-text">
                {isListening
                  ? "Listening your voice..."
                  : isAwake
                    ? "🟢 Pal is Awake — Ask anything, analyze screen, or control devices!"
                    : '🌙 Standby — Say "Pal" to wake up'}
              </p>
              {isListening && (
                <div className="voice-wave-container">
                  <span className="wave-bar b1"></span>
                  <span className="wave-bar b2"></span>
                  <span className="wave-bar b3"></span>
                  <span className="wave-bar b4"></span>
                  <span className="wave-bar b5"></span>
                  <span className="listening-subtext">Sun rahi hoon...</span>
                </div>
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
                          <span className="bubble-time">{m.time}</span>
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
            {/* SECTION 1: SCREEN VISION & LIVE DATA SPOTLIGHT */}
            <div className="deck-card vision-spotlight">
              <div className="deck-card-header">
                <div className="deck-title-group">
                  <Eye size={18} className="deck-icon cyan" />
                  <h3>Screen Vision & Live Internet Data</h3>
                </div>
                <span className="deck-status-pill">Gemini Multimodal</span>
              </div>

              <div className="vision-buttons-grid">
                <button
                  className="vision-action-card"
                  onClick={() => sendDirectAction({ action: "analyze_screen" })}
                >
                  <Eye size={20} className="card-icon cyan" />
                  <div className="card-text">
                    <h4>Analyze Screen Vision</h4>
                    <p>Screen capture karke error fix ya summary samjhao</p>
                  </div>
                </button>

                <button
                  className="vision-action-card"
                  onClick={() =>
                    sendDirectAction({ action: "get_weather", target: "Delhi" })
                  }
                >
                  <CloudSun size={20} className="card-icon amber" />
                  <div className="card-text">
                    <h4>Live Real-Time Weather</h4>
                    <p>Current temp, humidity aur condition check karo</p>
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
              </div>
            </div>

            {/* SECTION 2: LAPTOP CONTROLS */}
            <div className="deck-card">
              <div className="deck-card-header">
                <div className="deck-title-group">
                  <Monitor size={18} className="deck-icon cyan" />
                  <h3>Laptop Control Hub</h3>
                </div>
                <span className="deck-status-pill">Windows Hub</span>
              </div>

              {/* Volume Slider */}
              <div className="deck-control-row">
                <div className="slider-label-row">
                  <span className="slider-name">
                    <Volume2 size={14} /> Volume
                  </span>
                  <span className="slider-val">{systemState.volume}%</span>
                </div>
                <div className="slider-flex">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={systemState.volume}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setSystemState((p) => ({ ...p, volume: v }));
                    }}
                    onMouseUp={(e) =>
                      sendDirectAction({
                        device: "laptop",
                        action: "set_volume",
                        value: Number(e.target.value),
                      })
                    }
                    onTouchEnd={(e) =>
                      sendDirectAction({
                        device: "laptop",
                        action: "set_volume",
                        value: Number(e.target.value),
                      })
                    }
                    className="deck-slider cyan"
                  />
                  <button
                    className={`deck-mini-btn ${systemState.muted ? "danger" : ""}`}
                    onClick={() =>
                      sendDirectAction({
                        device: "laptop",
                        action: systemState.muted ? "unmute" : "mute",
                      })
                    }
                  >
                    {systemState.muted ? (
                      <VolumeX size={14} />
                    ) : (
                      <Volume2 size={14} />
                    )}
                  </button>
                </div>
              </div>

              {/* Brightness Slider */}
              <div className="deck-control-row">
                <div className="slider-label-row">
                  <span className="slider-name">
                    <Sun size={14} /> Brightness
                  </span>
                  <span className="slider-val">{systemState.brightness}%</span>
                </div>
                <div className="slider-flex">
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={systemState.brightness}
                    onChange={(e) => {
                      const b = Number(e.target.value);
                      setSystemState((p) => ({ ...p, brightness: b }));
                    }}
                    onMouseUp={(e) =>
                      sendDirectAction({
                        device: "laptop",
                        action: "set_brightness",
                        value: Number(e.target.value),
                      })
                    }
                    onTouchEnd={(e) =>
                      sendDirectAction({
                        device: "laptop",
                        action: "set_brightness",
                        value: Number(e.target.value),
                      })
                    }
                    className="deck-slider amber"
                  />
                </div>
              </div>

              {/* Media Playback Controls */}
              <div className="deck-media-group">
                <span className="group-label">
                  Media & App Controls (YouTube, Spotify, etc.)
                </span>
                <div className="media-buttons-row">
                  <button
                    className="deck-pill-btn"
                    title="Rewind 10 Seconds"
                    onClick={() =>
                      sendDirectAction({
                        device: "laptop",
                        action: "media_rewind",
                        value: 10,
                      })
                    }
                  >
                    <Rewind size={14} /> -10s
                  </button>
                  <button
                    className="deck-pill-btn"
                    title="Previous Track"
                    onClick={() =>
                      sendDirectAction({
                        device: "laptop",
                        action: "media_previous",
                      })
                    }
                  >
                    <SkipBack size={14} /> Prev
                  </button>
                  <button
                    className="deck-pill-btn highlight"
                    title="Play / Pause"
                    onClick={() =>
                      sendDirectAction({
                        device: "laptop",
                        action: "media_play_pause",
                      })
                    }
                  >
                    <Play size={14} /> / <Pause size={14} /> Play/Pause
                  </button>
                  <button
                    className="deck-pill-btn"
                    title="Next Track"
                    onClick={() =>
                      sendDirectAction({
                        device: "laptop",
                        action: "media_next",
                      })
                    }
                  >
                    Next <SkipForward size={14} />
                  </button>
                  <button
                    className="deck-pill-btn"
                    title="Forward 10 Seconds"
                    onClick={() =>
                      sendDirectAction({
                        device: "laptop",
                        action: "media_forward",
                        value: 10,
                      })
                    }
                  >
                    +10s <FastForward size={14} />
                  </button>
                </div>
                <div
                  className="media-extra-row"
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginTop: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    className="deck-pill-btn"
                    style={{ flex: 1, minWidth: "90px", fontSize: "0.78rem" }}
                    onClick={() =>
                      sendDirectAction({
                        device: "laptop",
                        action: "media_fullscreen",
                      })
                    }
                  >
                    <Maximize size={13} /> Fullscreen
                  </button>
                  <button
                    className="deck-pill-btn"
                    style={{ flex: 1, minWidth: "90px", fontSize: "0.78rem" }}
                    onClick={() =>
                      sendDirectAction({
                        device: "laptop",
                        action: "media_mute_video",
                      })
                    }
                  >
                    <VolumeX size={13} /> Mute Vid
                  </button>
                  <button
                    className="deck-pill-btn"
                    style={{ flex: 1, minWidth: "90px", fontSize: "0.78rem" }}
                    onClick={() =>
                      sendDirectAction({
                        device: "laptop",
                        action: "media_speed_up",
                      })
                    }
                  >
                    ⚡ Speed +
                  </button>
                  <button
                    className="deck-pill-btn"
                    style={{ flex: 1, minWidth: "90px", fontSize: "0.78rem" }}
                    onClick={() =>
                      sendDirectAction({
                        device: "laptop",
                        action: "close_tab",
                      })
                    }
                  >
                    <X size={13} /> Close Tab
                  </button>
                </div>
              </div>

              {/* Quick System Buttons */}
              <div className="deck-grid-row">
                <button
                  className="deck-action-btn"
                  onClick={() =>
                    sendDirectAction({
                      device: "laptop",
                      action: "screenshot",
                    })
                  }
                >
                  <Camera size={16} />
                  <span>Screenshot</span>
                </button>

                <button
                  className="deck-action-btn"
                  onClick={() =>
                    sendDirectAction({
                      device: "laptop",
                      action: "lock_pc",
                    })
                  }
                >
                  <Lock size={16} />
                  <span>Lock Laptop</span>
                </button>

                <button
                  className="deck-action-btn"
                  onClick={() =>
                    sendDirectAction({
                      device: "laptop",
                      action: "battery_status",
                    })
                  }
                >
                  <Battery size={16} />
                  <span>Battery</span>
                </button>

                <button
                  className="deck-action-btn"
                  onClick={() =>
                    sendDirectAction({
                      device: "laptop",
                      action: "time_date",
                    })
                  }
                >
                  <Activity size={16} />
                  <span>Time / Date</span>
                </button>
              </div>

              {/* Windows Tools Grid */}
              <div className="deck-apps-section">
                <span className="group-label">Launch Windows Tools</span>
                <div className="deck-app-chips">
                  <button
                    onClick={() =>
                      sendDirectAction({
                        device: "laptop",
                        action: "open_app",
                        target: "calculator",
                      })
                    }
                  >
                    <Calculator size={14} /> Calc
                  </button>
                  <button
                    onClick={() =>
                      sendDirectAction({
                        device: "laptop",
                        action: "open_app",
                        target: "notepad",
                      })
                    }
                  >
                    <FileText size={14} /> Notepad
                  </button>
                  <button
                    onClick={() =>
                      sendDirectAction({
                        device: "laptop",
                        action: "open_app",
                        target: "task manager",
                      })
                    }
                  >
                    <Activity size={14} /> TaskMgr
                  </button>
                  <button
                    onClick={() =>
                      sendDirectAction({
                        device: "laptop",
                        action: "open_app",
                        target: "explorer",
                      })
                    }
                  >
                    <Folder size={14} /> Files
                  </button>
                  <button
                    onClick={() =>
                      sendDirectAction({
                        device: "laptop",
                        action: "open_app",
                        target: "downloads",
                      })
                    }
                  >
                    <Download size={14} /> Downloads
                  </button>
                  <button
                    onClick={() =>
                      sendDirectAction({
                        device: "laptop",
                        action: "open_app",
                        target: "settings",
                      })
                    }
                  >
                    <Settings size={14} /> Settings
                  </button>
                  <button
                    onClick={() =>
                      sendDirectAction({
                        device: "laptop",
                        action: "open_app",
                        target: "youtube",
                      })
                    }
                  >
                    ▶️ YouTube
                  </button>
                  <button
                    onClick={() =>
                      sendDirectAction({
                        device: "laptop",
                        action: "open_app",
                        target: "whatsapp",
                      })
                    }
                  >
                    💬 WhatsApp
                  </button>
                </div>
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
                Vision AI, Live Weather, News, Voice Timers, Laptop aur TV
                Remote ke sabhi voice commands.
              </p>
            </div>

            <div className="guide-category-grid">
              {/* Category 1 */}
              <div className="guide-card">
                <div className="guide-card-header">
                  <Eye size={16} className="guide-icon cyan" />
                  <h4>Screen Vision AI & OCR</h4>
                </div>
                <ul>
                  <li>
                    <code>
                      "Pal, meri screen dekho aur batao kya chal raha hai"
                    </code>
                  </li>
                  <li>
                    <code>
                      "Pal, screen par jo error hai usko explain aur solve karo"
                    </code>
                  </li>
                  <li>
                    <code>"Pal, screen par dikh rahe code ka summary do"</code>
                  </li>
                  <li>
                    Gemini Vision laptop screen ko analyze karke turant solution
                    dega!
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
                  <Monitor size={16} className="guide-icon blue" />
                  <h4>Laptop Hardware Automation</h4>
                </div>
                <ul>
                  <li>
                    <code>"Laptop volume 50 karo"</code> /{" "}
                    <code>"Volume badhao"</code> / <code>"Mute"</code>
                  </li>
                  <li>
                    <code>"Gaana pause karo"</code> /{" "}
                    <code>"Next track chalao"</code>
                  </li>
                  <li>
                    <code>"Brightness 70 karo"</code> /{" "}
                    <code>"Screen light badhao"</code>
                  </li>
                  <li>
                    <code>"Screenshot lo"</code> /{" "}
                    <code>"Laptop lock kar do"</code>
                  </li>
                  <li>
                    <code>"Battery kitni hai?"</code> /{" "}
                    <code>"Time kya hua hai?"</code>
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
              <Monitor className="device-svg" />
            </div>
            <div className="device-info">
              <p className="device-title">Laptop Hub</p>
              <p className="device-sub">
                Vol {systemState.volume}% •{" "}
                {systemState.battery?.percent || 100}% Batt
              </p>
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
