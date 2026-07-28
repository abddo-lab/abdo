import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { githubAPI, type GitHubUser, type GitHubRepo, type GitHubBranch, type GitHubPR } from "../services/api";
export type { GitHubPR };

export interface GitHubFile { path: string; name: string; type: "file" | "dir"; sha: string; size?: number; content?: string; download_url?: string; }
import { settingsDB, filesDB } from "../services/db";

export interface GitHubState {
  connected: boolean;
  connecting: boolean;
  token: string | null;
  user: GitHubUser | null;
  repos: GitHubRepo[];
  selectedRepo: string | null; // full_name e.g. "owner/repo"
  branches: GitHubBranch[];
  selectedBranch: string | null;
  prs: GitHubPR[];

  connect: (token: string) => Promise<void>;
  disconnect: () => void;
  selectRepo: (fullName: string) => void;
  selectBranch: (name: string) => void;
  refreshRepos: () => Promise<void>;
  refreshPRs: () => Promise<void>;
  getFileTree: (path?: string) => Promise<GitHubFile[]>;
  getFileContent: (path: string) => Promise<string>;
  getOwner: () => string;
  getRepoName: () => string;
}

const Ctx = createContext<GitHubState | null>(null);

export function GitHubProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [prs, setPRs] = useState<GitHubPR[]>([]);

  // Auto-login from saved token
  useEffect(() => {
    (async () => {
      const saved = await settingsDB.get<string | null>("github_token", null);
      if (saved) {
        try {
          const u = await githubAPI.getUser(saved);
          setToken(saved); setUser(u); setConnected(true);
          const r = await githubAPI.getRepos(saved);
          setRepos(r);
          const savedRepo = await settingsDB.get<string | null>("github_repo", null);
          if (savedRepo && r.some((x) => x.full_name === savedRepo)) {
            setSelectedRepo(savedRepo);
          } else if (r.length > 0) {
            setSelectedRepo(r[0].full_name);
          }
        } catch { await settingsDB.set("github_token", null); }
      }
    })();
  }, []);

  // Load branches when repo changes
  useEffect(() => {
    if (!token || !selectedRepo) return;
    const [owner, repo] = selectedRepo.split("/");
    githubAPI.getBranches(token, owner, repo).then((b) => {
      setBranches(b);
      const defaultBranch = repos.find((r) => r.full_name === selectedRepo)?.default_branch ?? "main";
      setSelectedBranch(defaultBranch);
    }).catch(console.error);
    settingsDB.set("github_repo", selectedRepo);
  }, [token, selectedRepo]);

  const connect = useCallback(async (t: string) => {
    setConnecting(true);
    try {
      const u = await githubAPI.getUser(t);
      const r = await githubAPI.getRepos(t);
      setToken(t); setUser(u); setRepos(r); setConnected(true);
      await settingsDB.set("github_token", t);
      if (r.length > 0) {
        const savedRepo = await settingsDB.get<string | null>("github_repo", null);
        const repo = (savedRepo && r.some((x) => x.full_name === savedRepo)) ? savedRepo : r[0].full_name;
        setSelectedRepo(repo);
      }
    } catch (err) { throw err; }
    finally { setConnecting(false); }
  }, []);

  const disconnect = useCallback(() => {
    setToken(null); setUser(null); setRepos([]); setConnected(false);
    setSelectedRepo(null); setBranches([]); setSelectedBranch(null); setPRs([]);
    settingsDB.set("github_token", null);
    window.dispatchEvent(new CustomEvent("cai:github-disconnected"));
  }, []);

  const selectRepo = useCallback((name: string) => setSelectedRepo(name), []);
  const selectBranch = useCallback((name: string) => setSelectedBranch(name), []);

  const refreshRepos = useCallback(async () => {
    if (!token) return;
    setRepos(await githubAPI.getRepos(token));
  }, [token]);

  const refreshPRs = useCallback(async () => {
    if (!token || !selectedRepo) return;
    const [owner, repo] = selectedRepo.split("/");
    setPRs(await githubAPI.getPRs(token, owner, repo));
  }, [token, selectedRepo]);

  const getFileTree = useCallback(async (path = ""): Promise<GitHubFile[]> => {
    if (!token || !selectedRepo) return [];
    const [owner, repo] = selectedRepo.split("/");
    return githubAPI.getFiles(token, owner, repo, path, selectedBranch ?? undefined);
  }, [token, selectedRepo, selectedBranch]);

  const getFileContent = useCallback(async (path: string): Promise<string> => {
    if (!token || !selectedRepo) return "";
    const [owner, repo] = selectedRepo.split("/");
    // Check cache first
    const cached = await filesDB.get(path);
    if (cached && cached.repo === selectedRepo && Date.now() - cached.fetchedAt < 300_000) return cached.content;
    const content = await githubAPI.getFileContent(token, owner, repo, path, selectedBranch ?? undefined);
    await filesDB.put({ path, repo: selectedRepo, content, sha: "", fetchedAt: Date.now() });
    return content;
  }, [token, selectedRepo, selectedBranch]);

  const getOwner = useCallback(() => selectedRepo?.split("/")[0] ?? "", [selectedRepo]);
  const getRepoName = useCallback(() => selectedRepo?.split("/")[1] ?? "", [selectedRepo]);

  return (
    <Ctx.Provider value={{
      connected, connecting, token, user, repos, selectedRepo, branches, selectedBranch, prs,
      connect, disconnect, selectRepo, selectBranch, refreshRepos, refreshPRs, getFileTree, getFileContent, getOwner, getRepoName,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useGitHub() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGitHub must be used inside GitHubProvider");
  return v;
}

export function GitHubMark({ size = 13, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
      <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.3 9.3 0 0 1 2.5-.34c.85 0 1.7.12 2.5.34 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.35 4.79-4.58 5.05.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.6.69.49A10.04 10.04 0 0 0 22 12.25C22 6.58 17.52 2 12 2z" />
    </svg>
  );
}
