import { createContext, useContext, useRef, useState, type ReactNode } from "react";

export interface UserProfile {
  name: string;
  email: string;
  plan: string;
  workspace: string;
}

export type AuthMethod = "browser" | "key" | "demo";
export type AuthStatus = "idle" | "waiting" | "verifying" | "success" | "error";

export interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;

  method: AuthMethod;
  setMethod: (m: AuthMethod) => void;

  status: AuthStatus;
  step: number; // 0..3 progress through the handshake
  error: string | null;

  pairCode: string;
  region: string;
  setRegion: (r: string) => void;
  remember: boolean;
  setRemember: (v: boolean) => void;

  startBrowser: () => void;
  approve: () => void;
  signInWithKey: (key: string) => void;
  signInDemo: () => void;
  cancel: () => void;
  logout: () => void;
}

const DEFAULT_USER: UserProfile = {
  name: "Christina Warren",
  email: "christina@tailspin.dev",
  plan: "Max plan · 20×",
  workspace: "Tailspin Toys",
};

const AuthCtx = createContext<AuthState | null>(null);

function makeCode() {
  const block = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${block()}-${block()}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [method, setMethodRaw] = useState<AuthMethod>("browser");
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pairCode, setPairCode] = useState(makeCode);
  const [region, setRegion] = useState("us-west");
  const [remember, setRemember] = useState(true);
  const timers = useRef<number[]>([]);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const setMethod = (m: AuthMethod) => {
    if (status === "verifying" || status === "success") return;
    clear();
    setStatus("idle");
    setStep(0);
    setError(null);
    setMethodRaw(m);
  };

  const finish = (profile: UserProfile) => {
    setStatus("success");
    setStep(3);
    timers.current.push(
      window.setTimeout(() => {
        setUser(profile);
        setStatus("idle");
        setStep(0);
      }, 620)
    );
  };

  const startBrowser = () => {
    clear();
    setPairCode(makeCode());
    setError(null);
    setStatus("waiting");
    setStep(1);
  };

  const approve = () => {
    if (status !== "waiting") return;
    clear();
    setStatus("verifying");
    setStep(2);
    timers.current.push(window.setTimeout(() => finish(DEFAULT_USER), 1150));
  };

  const signInWithKey = (key: string) => {
    clear();
    const trimmed = key.trim();
    if (!trimmed.startsWith("caret_sk_")) {
      setStatus("error");
      setError("That key doesn't look right — it should start with caret_sk_.");
      return;
    }
    setError(null);
    setStatus("verifying");
    setStep(2);
    timers.current.push(
      window.setTimeout(
        () => finish({ ...DEFAULT_USER, name: "Developer Workspace", email: "dev@caret.ai", plan: "Team plan · 5×" }),
        1000
      )
    );
  };

  const signInDemo = () => {
    clear();
    setError(null);
    setStatus("verifying");
    setStep(2);
    timers.current.push(window.setTimeout(() => finish(DEFAULT_USER), 620));
  };

  const cancel = () => {
    clear();
    setStatus("idle");
    setStep(0);
    setError(null);
  };

  const logout = () => {
    clear();
    setUser(null);
    setStatus("idle");
    setStep(0);
    setError(null);
    setMethodRaw("browser");
  };

  return (
    <AuthCtx.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        method,
        setMethod,
        status,
        step,
        error,
        pairCode,
        region,
        setRegion,
        remember,
        setRemember,
        startBrowser,
        approve,
        signInWithKey,
        signInDemo,
        cancel,
        logout,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
