/**
 * GitHub Integration Service for Loopra Live Code Patcher
 * 
 * Provides authorized, sandboxed GitHub repository operations:
 * - Read repository file tree and file contents
 * - Create isolated patch branches (patch/admin-timestamp-hash)
 * - Commit structured file patches
 * - Open Pull Requests with automated descriptions
 * - Merge approved PRs or rollback / delete branches
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';

const REPO_OWNER = process.env.GITHUB_OWNER || 'pankaj723880';
const REPO_NAME = process.env.GITHUB_REPO || 'AfterHours';
const DEFAULT_BASE_BRANCH = process.env.GITHUB_BASE_BRANCH || 'main';

// Get GitHub Token exclusively from environment variable (never exposed to frontend)
const getGitHubToken = () => {
  return (process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '').trim();
};

const getHeaders = () => {
  const token = getGitHubToken();
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Loopra-Live-Code-Patcher/2.0'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

const githubApi = axios.create({
  baseURL: 'https://api.github.com',
  timeout: 10000
});

/**
 * Checks if GitHub integration is configured with a valid token.
 */
export const isGitHubConfigured = () => {
  return Boolean(getGitHubToken());
};

/**
 * Retrieves repository information and verifies connectivity.
 */
export const verifyGitHubConnection = async () => {
  if (!isGitHubConfigured()) {
    return {
      connected: false,
      reason: 'GITHUB_TOKEN environment variable is not configured on Render/host.'
    };
  }

  try {
    const res = await githubApi.get(`/repos/${REPO_OWNER}/${REPO_NAME}`, {
      headers: getHeaders()
    });
    return {
      connected: true,
      repo: res.data.full_name,
      defaultBranch: res.data.default_branch || DEFAULT_BASE_BRANCH,
      permissions: res.data.permissions || {}
    };
  } catch (err) {
    return {
      connected: false,
      reason: err.response?.data?.message || err.message
    };
  }
};

/**
 * Reads a single file from the repository at a given ref/branch.
 */
export const getFileContent = async (filePath, branch = DEFAULT_BASE_BRANCH) => {
  const cleanPath = filePath.replace(/^\/+/, '');

  // If token is present, fetch via GitHub REST API
  if (isGitHubConfigured()) {
    try {
      const res = await githubApi.get(`/repos/${REPO_OWNER}/${REPO_NAME}/contents/${cleanPath}`, {
        params: { ref: branch },
        headers: getHeaders()
      });
      if (res.data && res.data.content) {
        const decoded = Buffer.from(res.data.content, 'base64').toString('utf8');
        return {
          content: decoded,
          sha: res.data.sha,
          path: cleanPath
        };
      }
    } catch (err) {
      if (err.response?.status === 404) {
        return null;
      }
      throw new Error(`GitHub API error reading ${cleanPath}: ${err.response?.data?.message || err.message}`);
    }
  }

  // Local filesystem fallback when running in local development mode without token
  try {
    const localPath = path.resolve(process.cwd(), cleanPath);
    if (fs.existsSync(localPath)) {
      const content = fs.readFileSync(localPath, 'utf8');
      return {
        content,
        sha: 'local_sha',
        path: cleanPath
      };
    }
  } catch (localErr) {
    // Ignore and return null
  }

  return null;
};

/**
 * Fetches the entire repository tree for deep repository-wide code inspection.
 */
export const getRepositoryTree = async (branch = DEFAULT_BASE_BRANCH) => {
  if (isGitHubConfigured()) {
    try {
      const res = await githubApi.get(`/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${branch}?recursive=1`, {
        headers: getHeaders()
      });
      const tree = (res.data?.tree || [])
        .filter(item => item.type === 'blob')
        .map(item => item.path)
        .filter(p => !p.startsWith('.') && !p.includes('node_modules/') && !p.includes('dist/'));
      return tree;
    } catch (err) {
      console.warn('[GitHubService] Failed to fetch remote tree:', err.message);
    }
  }

  // Local fallback: scan workspace recursively
  const scanDir = (dir, rootDir) => {
    let results = [];
    try {
      const list = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of list) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results = results.concat(scanDir(full, rootDir));
        } else {
          const rel = path.relative(rootDir, full).replace(/\\/g, '/');
          results.push(rel);
        }
      }
    } catch (e) {}
    return results;
  };

  return scanDir(process.cwd(), process.cwd());
};

/**
 * Creates a dedicated Git branch from the base branch.
 */
export const createPatchBranch = async (branchName, baseBranch = DEFAULT_BASE_BRANCH) => {
  if (!isGitHubConfigured()) {
    return {
      success: true,
      mode: 'local',
      branch: branchName,
      baseBranch
    };
  }

  // 1. Get SHA of base branch
  const refRes = await githubApi.get(`/repos/${REPO_OWNER}/${REPO_NAME}/git/ref/heads/${baseBranch}`, {
    headers: getHeaders()
  });
  const baseSha = refRes.data.object.sha;

  // 2. Create new branch ref
  const createRes = await githubApi.post(`/repos/${REPO_OWNER}/${REPO_NAME}/git/refs`, {
    ref: `refs/heads/${branchName}`,
    sha: baseSha
  }, {
    headers: getHeaders()
  });

  return {
    success: true,
    mode: 'github',
    branch: branchName,
    sha: createRes.data.object.sha,
    baseBranch
  };
};

/**
 * Commits multiple file modifications to a specific branch on GitHub using the Git Data API.
 */
export const commitFilesToBranch = async ({
  branch,
  files, // Array of { path, content, action: 'modify' | 'create' | 'delete' }
  commitMessage
}) => {
  if (!isGitHubConfigured()) {
    // In local mode, write to disk directly
    for (const file of files) {
      const fullPath = path.resolve(process.cwd(), file.path);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, file.content, 'utf8');
    }
    return {
      success: true,
      mode: 'local',
      commitSha: 'local_commit_' + Date.now(),
      branch
    };
  }

  const headers = getHeaders();

  // 1. Get current branch commit SHA and tree SHA
  const branchRefRes = await githubApi.get(`/repos/${REPO_OWNER}/${REPO_NAME}/git/ref/heads/${branch}`, { headers });
  const parentCommitSha = branchRefRes.data.object.sha;
  const commitRes = await githubApi.get(`/repos/${REPO_OWNER}/${REPO_NAME}/git/commits/${parentCommitSha}`, { headers });
  const baseTreeSha = commitRes.data.tree.sha;

  // 2. Create blobs / tree entries for each file
  const treeEntries = [];
  for (const file of files) {
    if (file.action === 'delete') {
      // To delete, omit or set sha null if supported, or handle accordingly
      continue;
    }

    const blobRes = await githubApi.post(`/repos/${REPO_OWNER}/${REPO_NAME}/git/blobs`, {
      content: file.content,
      encoding: 'utf-8'
    }, { headers });

    treeEntries.push({
      path: file.path.replace(/^\/+/, ''),
      mode: '100644',
      type: 'blob',
      sha: blobRes.data.sha
    });
  }

  // 3. Create new tree
  const treeRes = await githubApi.post(`/repos/${REPO_OWNER}/${REPO_NAME}/git/trees`, {
    base_tree: baseTreeSha,
    tree: treeEntries
  }, { headers });

  // 4. Create new commit
  const newCommitRes = await githubApi.post(`/repos/${REPO_OWNER}/${REPO_NAME}/git/commits`, {
    message: commitMessage || 'AI Live Code Patcher update',
    tree: treeRes.data.sha,
    parents: [parentCommitSha]
  }, { headers });

  // 5. Update branch ref to point to new commit
  await githubApi.patch(`/repos/${REPO_OWNER}/${REPO_NAME}/git/refs/heads/${branch}`, {
    sha: newCommitRes.data.sha
  }, { headers });

  return {
    success: true,
    mode: 'github',
    commitSha: newCommitRes.data.sha,
    treeSha: treeRes.data.sha,
    branch
  };
};

/**
 * Creates a Pull Request on GitHub.
 */
export const createPullRequest = async ({
  title,
  body,
  headBranch,
  baseBranch = DEFAULT_BASE_BRANCH
}) => {
  if (!isGitHubConfigured()) {
    return {
      success: true,
      mode: 'local',
      prNumber: Math.floor(Math.random() * 900) + 100,
      prUrl: `https://github.com/${REPO_OWNER}/${REPO_NAME}/compare/${headBranch}`,
      merged: false
    };
  }

  const res = await githubApi.post(`/repos/${REPO_OWNER}/${REPO_NAME}/pulls`, {
    title,
    body,
    head: headBranch,
    base: baseBranch
  }, {
    headers: getHeaders()
  });

  return {
    success: true,
    mode: 'github',
    prNumber: res.data.number,
    prUrl: res.data.html_url,
    state: res.data.state
  };
};

/**
 * Merges a Pull Request upon explicit admin confirmation.
 */
export const mergePullRequest = async (prNumber, commitMessage) => {
  if (!isGitHubConfigured()) {
    return {
      success: true,
      mode: 'local',
      merged: true,
      message: 'Local changes retained.'
    };
  }

  const res = await githubApi.put(`/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${prNumber}/merge`, {
    commit_title: commitMessage || `Merge pull request #${prNumber} from Live Code Patcher`,
    merge_method: 'squash'
  }, {
    headers: getHeaders()
  });

  return {
    success: true,
    mode: 'github',
    merged: res.data.merged,
    sha: res.data.sha,
    message: res.data.message
  };
};

/**
 * Rolls back / closes a pull request and deletes the patch branch.
 */
export const rollbackPatchBranch = async (branchName, prNumber = null) => {
  if (!isGitHubConfigured()) {
    return { success: true, mode: 'local' };
  }

  const headers = getHeaders();
  // Close PR if open
  if (prNumber) {
    try {
      await githubApi.patch(`/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${prNumber}`, {
        state: 'closed'
      }, { headers });
    } catch (e) {}
  }

  // Delete branch ref
  if (branchName && branchName.startsWith('patch/')) {
    try {
      await githubApi.delete(`/repos/${REPO_OWNER}/${REPO_NAME}/git/refs/heads/${branchName}`, { headers });
    } catch (e) {}
  }

  return { success: true };
};

