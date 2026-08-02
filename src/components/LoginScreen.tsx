"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowUpRight, Check, Copy } from "lucide-react";

const BRAILLE = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const EXPIRES_IN = 15 * 60;

import { auth } from "../api";

const easeOut = [0.16, 1, 0.3, 1] as const;

function useBraille() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = window.setInterval(
      () => setFrame((f) => (f + 1) % BRAILLE.length),
      85,
    );
    return () => window.clearInterval(id);
  }, []);
  return BRAILLE[frame];
}

function Boot({ onDone }: { onDone: () => void }) {
  const spinner = useBraille();

  useEffect(() => {
    const id = window.setTimeout(onDone, 1600);
    return () => window.clearTimeout(id);
  }, [onDone]);

  return (
    <motion.div
      key="boot"
      className="flex flex-1 items-center justify-center"
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="boot-spark"
        aria-label="Loading"
      >
        {spinner}
      </motion.span>
    </motion.div>
  );
}

function AuthScreen({ onLogin }: { onLogin: (token: string, user: any) => void }) {
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
      const data = await auth.deviceCode();
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
    const start = window.setTimeout(() => {
      window.setInterval(
        () => setRevealed((r) => (r >= userCode.length ? r : r + 1)),
        75,
      );
    }, 500);
    return () => window.clearTimeout(start);
  }, [userCode]);

  useEffect(() => {
    const id = window.setInterval(
      () => setSeconds((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!deviceCode || status !== "pending") return;
    const poll = async () => {
      try {
        const data = await auth.devicePoll(deviceCode);
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
  }, [deviceCode, status, onLogin]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(userCode);
    } catch {}
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") copyCode();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [userCode]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <motion.div
      key="auth"
      className="flex flex-1 flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.5 }}
        className="lede mt-3"
      >
        Welcome! To start a session, <b>authenticate with GitHub</b> using the
        device code below. Nothing runs until you approve it from your browser.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.55, ease: easeOut }}
        className="panel"
      >
        <span className="panel-legend">
          <span className="legend-dot" />
          Authenticate with GitHub
        </span>

        <div className="steps">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.44, duration: 0.45 }}
            className="step"
          >
            <span className="step-num">1</span>
            <div className="step-body">
              <p className="step-title">
                Open this link in your browser and sign in
              </p>
              <a
                className="url-chip"
                href="https://github.com/login/device"
                target="_blank"
                rel="noopener noreferrer"
              >
                https://github.com/login/device
                <ArrowUpRight className="arrow h-3.5 w-3.5" />
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.55, duration: 0.45 }}
            className="step"
          >
            <span className="step-num">2</span>
            <div className="step-body">
              <p className="step-title">
                Enter this <b>one-time code</b>
              </p>

              <div className="code-row" aria-label={userCode ? `Device code ${userCode}` : "Loading code"}>
                {userCode
                  ? userCode.split("").map((ch, i) => {
                      if (ch === "-")
                        return (
                          <motion.span
                            key={i}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{
                              delay: 0.6 + i * 0.03,
                              duration: 0.25,
                              ease: easeOut,
                            }}
                            className="code-cell code-cell--hyphen"
                          >
                            –
                          </motion.span>
                        );
                      const on = i < revealed;
                      const active = i === revealed - 1;
                      return (
                        <motion.span
                          key={i}
                          initial={{ opacity: 0, y: 12, scale: 0.92 }}
                          animate={{
                            opacity: on ? 1 : 0.22,
                            y: 0,
                            scale: 1,
                          }}
                          transition={{ duration: 0.3, ease: easeOut }}
                          whileHover={
                            on
                              ? { y: -2, transition: { duration: 0.15 } }
                              : undefined
                          }
                          className={`code-cell ${on ? "code-cell--on" : ""} ${
                            active ? "code-cell--active" : ""
                          }`}
                        >
                          {on ? ch : "·"}
                        </motion.span>
                      );
                    })
                  : Array.from({ length: 9 }).map((_, i) => (
                      <span key={i} className="code-cell" style={{ opacity: 0.35 }}>·</span>
                    ))}
              </div>

              <motion.div
                className="meta-row"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.65, duration: 0.4 }}
              >
                <motion.button
                  onClick={copyCode}
                  className={`chip-btn ${copied ? "is-done" : ""}`}
                  whileTap={{ scale: 0.97 }}
                  aria-label={copied ? "Code copied" : "Copy code"}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? "copied" : "copy code"}
                </motion.button>
                <span className="expires">
                  expires in{" "}
                  <b>
                    {mm}:{ss}
                  </b>
                </span>
              </motion.div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.45 }}
          className="warning"
          role="note"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>
            Device codes are a common phishing target. Never share this code
            — only enter it on github.com.
          </span>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.5 }}
        className="waiting"
        aria-live="polite"
      >
        <span className={`spinner ${serverError ? "spinner--error" : ""}`} aria-hidden="true">
          {spinner}
        </span>
        <span>
          {serverError
            ? "Waiting for server to respond..."
            : status === "authorized"
              ? "✓ Authorized!"
              : status === "denied"
                ? "Access denied"
                : status === "expired"
                  ? "Code expired — refresh for a new one"
                  : "Waiting for GitHub authorization — keep this window open"}
        </span>
      </motion.div>
    </motion.div>
  );
}

interface LoginScreenProps {
  onLogin: (token: string, user: any) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [stage, setStage] = useState<"boot" | "auth">("boot");

  return (
    <div className="relative min-h-screen">
      <div className="term-bg" aria-hidden="true" />
      <div className="term-column">
        <AnimatePresence mode="wait">
          {stage === "boot" ? (
            <Boot key="boot" onDone={() => setStage("auth")} />
          ) : (
            <AuthScreen key="auth" onLogin={onLogin} />
          )}
        </AnimatePresence>

        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: stage === "auth" ? 1 : 0 }}
          transition={{ delay: 1.2, duration: 0.5 }}
          className="auth-footer"
        >
          <div className="footer-hints">
            <span className="hint">
              <span className="kbd">?</span> shortcuts
            </span>
            <span className="hint">
              <span className="kbd">esc</span> quit
            </span>
            <span className="hint">
              <span className="kbd">⌘C</span> copy code
            </span>
            <span className="hint">
              <span className="kbd">↵</span> re-send code
            </span>
          </div>
          <p className="footer-copy">&copy; 2027 Kiren Labs</p>
        </motion.footer>
      </div>
    </div>
  );
}
