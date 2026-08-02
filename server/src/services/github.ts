// server/src/services/github.ts — Real GitHub API integration
import { loadConfig } from "../config.js";
import pool from "../db.js";

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
}

export class GitHubService {
  /** Resolve the user's GitHub access token — stored on the user row since
   *  the device_codes entry is cleaned up after login. */
  static async getAccessToken(userId: string): Promise<string | null> {
    const user = await pool.query(`SELECT github_access_token FROM users WHERE id = $1`, [userId]);
    if (user.rows[0]?.github_access_token) return user.rows[0].github_access_token;
    // Legacy fallback: some sessions pre-date the users.github_access_token column
    const dc = await pool.query(
      `SELECT github_access_token FROM device_codes WHERE user_id = $1 AND github_access_token IS NOT NULL ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    if (dc.rows[0]?.github_access_token) {
      await pool.query(`UPDATE users SET github_access_token = $1, updated_at = NOW() WHERE id = $2`, [dc.rows[0].github_access_token, userId]);
      return dc.rows[0].github_access_token;
    }
    return null;
  }

  /** Exchange GitHub access token for user info */
  static async getUser(accessToken: string): Promise<GitHubUser> {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Kiren/2.6",
      },
    });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
    return res.json();
  }

  /** Get user's primary email */
  static async getEmail(accessToken: string): Promise<string | null> {
    const res = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Kiren/2.6",
      },
    });
    if (!res.ok) return null;
    const emails: any[] = await res.json();
    const primary = emails.find((e) => e.primary && e.verified);
    return primary?.email ?? null;
  }

  /** List user repos (paginated) */
  static async getRepos(accessToken: string, page = 1, perPage = 30): Promise<GitHubRepo[]> {
    const res = await fetch(
      `https://api.github.com/user/repos?page=${page}&per_page=${perPage}&sort=updated&type=all`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Kiren/2.6",
        },
      }
    );
    if (!res.ok) throw new Error(`GitHub repos error: ${res.status}`);
    return res.json();
  }

  /** Get repo details */
  static async getRepo(accessToken: string, owner: string, repo: string): Promise<any> {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Kiren/2.6",
      },
    });
    if (!res.ok) throw new Error(`GitHub repo error: ${res.status}`);
    return res.json();
  }

  /** Get repo file tree */
  static async getTree(accessToken: string, owner: string, repo: string, sha = "main"): Promise<any> {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Kiren/2.6",
        },
      }
    );
    if (!res.ok) throw new Error(`GitHub tree error: ${res.status}`);
    return res.json();
  }

  /** Get file content */
  static async getFileContent(accessToken: string, owner: string, repo: string, path: string): Promise<string> {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Kiren/2.6",
      },
    });
    if (!res.ok) throw new Error(`GitHub file error: ${res.status}`);
    const data: any = await res.json();
    return Buffer.from(data.content, "base64").toString("utf-8");
  }

  /** List branches */
  static async getBranches(accessToken: string, owner: string, repo: string): Promise<any[]> {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Kiren/2.6",
      },
    });
    if (!res.ok) throw new Error(`GitHub branches error: ${res.status}`);
    return res.json();
  }

  /** Get GitHub Actions workflows */
  static async getWorkflows(accessToken: string, owner: string, repo: string): Promise<any> {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Kiren/2.6",
      },
    });
    if (!res.ok) throw new Error(`GitHub workflows error: ${res.status}`);
    return res.json();
  }

  /** Get workflow runs */
  static async getWorkflowRuns(accessToken: string, owner: string, repo: string, perPage = 10): Promise<any> {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=${perPage}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Kiren/2.6",
        },
      }
    );
    if (!res.ok) throw new Error(`GitHub workflow runs error: ${res.status}`);
    return res.json();
  }

  /** Create a commit (write files) */
  static async createOrUpdateFile(
    accessToken: string,
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha?: string,
    branch = "main"
  ): Promise<any> {
    const body: any = {
      message,
      content: Buffer.from(content).toString("base64"),
      branch,
    };
    if (sha) body.sha = sha;

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "Kiren/2.6",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`GitHub commit error: ${res.status}`);
    return res.json();
  }

  /** Create a branch */
  static async createBranch(accessToken: string, owner: string, repo: string, newBranch: string, fromSha: string): Promise<any> {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "Kiren/2.6",
      },
      body: JSON.stringify({ ref: `refs/heads/${newBranch}`, sha: fromSha }),
    });
    if (!res.ok) throw new Error(`GitHub branch error: ${res.status}`);
    return res.json();
  }

  /** Create a pull request */
  static async createPR(accessToken: string, owner: string, repo: string, title: string, head: string, base: string, body?: string): Promise<any> {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "Kiren/2.6",
      },
      body: JSON.stringify({ title, head, base, body }),
    });
    if (!res.ok) throw new Error(`GitHub PR error: ${res.status}`);
    return res.json();
  }

  /** Get or create user in our DB from GitHub data */
  static async getOrCreateUser(accessToken: string): Promise<any> {
    const ghUser = await this.getUser(accessToken);
    const email = ghUser.email || (await this.getEmail(accessToken));

    const existing = await pool.query(`SELECT * FROM users WHERE github_id = $1`, [ghUser.id]);
    if (existing.rows.length > 0) {
      const result = await pool.query(
        `UPDATE users SET username=$1, display_name=$2, email=$3, avatar_url=$4, updated_at=NOW()
         WHERE github_id=$5 RETURNING *`,
        [ghUser.login, ghUser.name || ghUser.login, email, ghUser.avatar_url, ghUser.id]
      );
      return result.rows[0];
    }

    const { v4: uuid } = await import("uuid");
    const result = await pool.query(
      `INSERT INTO users (id, github_id, username, display_name, email, avatar_url, plan_id, balance)
       VALUES ($1, $2, $3, $4, $5, $6, 'free', 0) RETURNING *`,
      [uuid(), ghUser.id, ghUser.login, ghUser.name || ghUser.login, email, ghUser.avatar_url]
    );
    // Seed ready-made subagents + built-in MCP servers for the new user
    const { seedUserExtras } = await import("./seeds.js");
    seedUserExtras(result.rows[0].id).catch(console.error);
    return result.rows[0];
  }

  /** Sync user repos into our projects table */
  static async syncUserRepos(userId: string, accessToken: string): Promise<void> {
    const repos = await this.getRepos(accessToken, 1, 50);
    for (const repo of repos) {
      await pool.query(
        `INSERT INTO projects (id, user_id, name, repo_full_name, repo_url, branch, source, glyph, color)
         VALUES ($1, $2, $3, $4, $5, $6, 'github', $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           name=$3, repo_full_name=$4, repo_url=$5, branch=$6, updated_at=NOW()`,
        [
          `gh-${repo.id}`, userId, repo.name, repo.full_name, repo.html_url,
          repo.default_branch,
          repo.name.slice(0, 2).toUpperCase(),
          repo.private ? "#3d3d52" : "#1A1D28",
        ]
      );
    }
  }
}
