// server/src/routes/github.ts — GitHub integration routes
import { Router } from "express";
import { GitHubService } from "../services/github.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

/** Resolve the user's GitHub access token or send a 400 asking them to re-auth. */
async function tokenFor(req: any, res: any): Promise<string | null> {
  const accessToken = await GitHubService.getAccessToken(req.user.id);
  if (!accessToken) {
    res.status(400).json({ error: "No GitHub access token. Re-authenticate." });
    return null;
  }
  return accessToken;
}

// GET /api/github/repos — list user's GitHub repos
router.get("/repos", authMiddleware, async (req: any, res) => {
  try {
    const accessToken = await tokenFor(req, res);
    if (!accessToken) return;

    const repos = await GitHubService.getRepos(accessToken, parseInt(req.query.page as string) || 1);
    res.json({ repos });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/github/sync — sync repos into projects
router.post("/sync", authMiddleware, async (req: any, res) => {
  try {
    const accessToken = await tokenFor(req, res);
    if (!accessToken) return;

    await GitHubService.syncUserRepos(req.user.id, accessToken);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/github/repos/:owner/:repo/tree — get file tree
router.get("/repos/:owner/:repo/tree", authMiddleware, async (req: any, res) => {
  try {
    const accessToken = await tokenFor(req, res);
    if (!accessToken) return;

    const tree = await GitHubService.getTree(accessToken, req.params.owner, req.params.repo, req.query.sha as string);
    res.json(tree);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/github/repos/:owner/:repo/file — get file content
router.get("/repos/:owner/:repo/file", authMiddleware, async (req: any, res) => {
  try {
    const accessToken = await tokenFor(req, res);
    if (!accessToken) return;

    const content = await GitHubService.getFileContent(accessToken, req.params.owner, req.params.repo, req.query.path as string);
    res.json({ content, path: req.query.path });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/github/repos/:owner/:repo/branches — list branches
router.get("/repos/:owner/:repo/branches", authMiddleware, async (req: any, res) => {
  try {
    const accessToken = await tokenFor(req, res);
    if (!accessToken) return;

    const branches = await GitHubService.getBranches(accessToken, req.params.owner, req.params.repo);
    res.json({ branches });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/github/repos/:owner/:repo/workflows — GitHub Actions workflows
router.get("/repos/:owner/:repo/workflows", authMiddleware, async (req: any, res) => {
  try {
    const accessToken = await tokenFor(req, res);
    if (!accessToken) return;

    const workflows = await GitHubService.getWorkflows(accessToken, req.params.owner, req.params.repo);
    res.json(workflows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/github/repos/:owner/:repo/pr — create a pull request
router.post("/repos/:owner/:repo/pr", authMiddleware, async (req: any, res) => {
  try {
    const accessToken = await tokenFor(req, res);
    if (!accessToken) return;

    const { title, head, base, body } = req.body;
    const pr = await GitHubService.createPR(accessToken, req.params.owner, req.params.repo, title, head, base, body);
    res.json(pr);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
