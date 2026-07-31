LoginScreen.tsx

```tsx
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowUpRight, Check, Copy } from "lucide-react";

const MONA_GIF = "https://github.githubassets.com/assets/mona-loading-dimmed-5da225352fd7.gif";
const BRAILLE = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const EXPIRES_IN = 15 * 60;

function makeCode() {
  const pick = (n: number) =>
    Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
  return `${pick(4)}-${pick(4)}`;
}

const easeOut = [0.16, 1, 0.3, 1] as const;
const API_BASE = "http://localhost:3001/api";

function useBraille() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setFrame((f) => (f + 1) % BRAILLE.length), 85);
    return () => window.clearInterval(id);
  }, []);
  return BRAILLE[frame];
}

interface LoginScreenProps {
  onLogin: (token: string, user: any) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [userCode, setUserCode] = useState("");
  const [revealed, setRevealed] = useState(0);
  const [seconds, setSeconds] = useState(EXPIRES_IN);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<"pending" | "authorized" | "expired" | "denied">("pending");
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [serverError, setServerError] = useState(false);
  const spinner = useBraille();
  const pollRef = useRef<number | null>(null);

  const startDeviceFlow = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/device/code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      setUserCode(data.user_code);
      setDeviceCode(data.device_code);
      setServerError(false);
    } catch {
      setServerError(true);
    }
  };

  useEffect(() => { startDeviceFlow(); }, []);

  useEffect(() => {
    if (!serverError) return;
    const retry = window.setInterval(() => startDeviceFlow(), 5000);
    return () => window.clearInterval(retry);
  }, [serverError]);

  useEffect(() => {
    if (!userCode) return;
    let revealId = 0;
    const start = window.setTimeout(() => {
      revealId = window.setInterval(
        () => setRevealed((r) => (r >= userCode.length ? r : r + 1)),
        75
      );
    }, 900);
    const countdown = window.setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(revealId);
      window.clearInterval(countdown);
    };
  }, [userCode]);

  useEffect(() => {
    if (!deviceCode || status !== "pending") return;
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/device/poll`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ device_code: deviceCode }),
        });
        const data = await res.json();
        if (data.status === "authorized") {
          setStatus("authorized");
          onLogin(data.token, data.user);
        } else if (data.status === "expired") {
          setStatus("expired");
        } else if (data.status === "denied") {
          setStatus("denied");
        } else {
          pollRef.current = window.setTimeout(poll, data.slow_down ? 10000 : 5000);
        }
      } catch {
        pollRef.current = window.setTimeout(poll, 5000);
      }
    };
    pollRef.current = window.setTimeout(poll, 5000);
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [deviceCode, status]);

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(userCode); } catch {}
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const handleRefresh = () => {
    setStatus("pending");
    setServerError(false);
    setRevealed(0);
    setSeconds(EXPIRES_IN);
    startDeviceFlow();
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="relative min-h-screen">
      <div className="term-bg" aria-hidden="true" />
      <div className="term-column">
        <motion.div
          key="auth"
          className="flex flex-1 flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.55, ease: easeOut }}
            className="mt-10 flex items-center gap-4"
          >
            <span className="sparkle" aria-hidden="true">✻</span>
            <h1 className="wordmark">kiren code</h1>
            <span className="ver-pill">v1.0.26</span>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38, duration: 0.5 }}
            className="lede mt-4"
          >
            Welcome! To start a session, <b>authenticate with GitHub</b> using the device code below.
            Nothing runs until you approve it from your browser.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6, ease: easeOut }}
            className="panel"
          >
            <span className="panel-legend">
              <span className="legend-dot" />
              Authenticate with GitHub
            </span>

            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.68, duration: 0.45 }}
              className="step"
            >
              <span className="step-num">1.</span>
              <div className="step-body">
                <p className="step-title">Open this link in your browser and sign in</p>
                <a className="url-chip" href="https://github.com/login/device" target="_blank" rel="noopener noreferrer">
                  https://github.com/login/device
                  <ArrowUpRight className="arrow h-3.5 w-3.5" />
                </a>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.82, duration: 0.45 }}
              className="step"
            >
              <span className="step-num">2.</span>
              <div className="step-body">
                <p className="step-title">Enter this <b>one-time code</b></p>

                {status === "expired" ? (
                  <div className="flex flex-col items-center gap-5 py-6">
                    <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
                      <AlertTriangle size={20} className="text-amber-600" />
                    </div>
                    <p className="text-sm text-gray-500">Code expired</p>
                    <button onClick={handleRefresh} className="chip-btn">
                      Get new code
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="code-row" aria-label={userCode ? `Device code ${userCode}` : "Loading code"}>
                      {userCode
                        ? userCode.split("").map((ch, i) => {
                            if (ch === "-") return <span key={i} className="code-cell code-cell--hyphen">-</span>;
                            const on = i < revealed;
                            const active = i === revealed - 1;
                            return (
                              <motion.span
                                key={i}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: on ? 1 : 0.22, y: 0 }}
                                transition={{ duration: 0.28, ease: easeOut }}
                                className={`code-cell ${on ? "code-cell--on" : ""} ${active ? "code-cell--active" : ""}`}
                              >
                                {on ? ch : "·"}
                              </motion.span>
                            );
                          })
                        : Array.from({ length: 9 }).map((_, i) => (
                            <span key={i} className="code-cell pulse-cell">·</span>
                          ))}
                    </div>
                    <div className="meta-row">
                      <button onClick={copyCode} disabled={!userCode} className={`chip-btn ${copied ? "is-done" : ""}`}>
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? "copied" : "copy code"}
                      </button>
                      <span className="expires">
                        expires in <b>{mm}:{ss}</b>
                      </span>
                    </div>
                  </>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5, duration: 0.45 }}
              className="warning"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Device codes are a common phishing target. Never share this code — only enter it on github.com.</span>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.75, duration: 0.5 }}
            className="waiting"
          >
            <span className="spinner" aria-hidden="true">{spinner}</span>
            <span>
              {serverError
                ? "Waiting for server to respond..."
                : status === "authorized"
                  ? "✓ Authorized!"
                  : status === "denied"
                    ? "Access denied"
                    : "Waiting for GitHub authorization — keep this window open"}
            </span>
            {!serverError && status === "pending" && (
              <img src={MONA_GIF} alt="" className="mona-mini" />
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.05, duration: 0.5 }}
            className="term-footer"
          >
            <div>
              <span className="hint"><span className="kbd">?</span> shortcuts</span>
              <span className="hint"><span className="kbd">esc</span> quit</span>
              <span className="hint"><span className="kbd">⌘C</span> copy code</span>
              <span className="hint"><span className="kbd">↵</span> re-send code</span>
            </div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.3, duration: 0.5 }}
            className="copyright"
          >
            &copy; 2027 Kiren Labs
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
```
