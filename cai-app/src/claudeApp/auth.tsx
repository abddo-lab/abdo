import { createContext, useContext, useRef, useState, type ReactNode } from "react";

export interface UserProfile {
  name: string;
  email: string;
  plan: string;
  workspace: string;
}

export type AuthMethod = "key" | "demo";
export type AuthStatus = "idle" | "verifying" | "success" | "error";

export interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;

  method: AuthMethod;
  setMethod: (m: AuthMethod) => void;

  status: AuthStatus;
  step: number;
  error: string | null;

  keyValue: string;
  setKeyValue: (v: string) => void;
  showKey: boolean;
  setShowKey: (v: boolean) => void;

  remember: boolean;
  setRemember: (v: boolean) => void;

  startVerify: () => void;
  signInDemo: () => void;
  cancel: () => void;
  logout: () => void;
}

const DEFAULT_USER: UserProfile = {
  name: "Developer Workspace",
  email: "dev@caret.ai",
  plan: "Team plan · 5×",
  workspace: "Caret Workspace",
};

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [method, setMethodRaw] = useState<AuthMethod>("key");
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [keyValue, setKeyValue] = useState("");
  const [showKey, setShowKey] = useState(false);
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

  const startVerify = () => {
    clear();
    setError(null);
    setStatus("verifying");
    setStep(2);
    const trimmed = keyValue.trim();
    if (!trimmed.startsWith("caret_sk_")) {
      setStatus("error");
      setError("Invalid key — it should start with caret_sk_.");
      return;
    }
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
    setMethodRaw("key");
    setKeyValue("");
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
        keyValue,
        setKeyValue,
        showKey,
        setShowKey,
        remember,
        setRemember,
        startVerify,
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