const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { execSync, spawn } = require('child_process');

class BranchManager {
    constructor(auth) {
        this.auth = auth;
    }

    /**
     * Get the repository path from the current workspace
     * @param {string} repoName - Repository name in format "owner/repo"
     * @returns {string|null} - Absolute path to the repository or null if not found
     */
    getRepositoryPath(repoName) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return null;

        const repoNameLower = repoName.toLowerCase();

        // Helper function to search for git repos recursively
        const findGitReposInDir = (dirPath, depth = 2) => {
            const foundRepos = [];
            if (depth < 0) return foundRepos;
            try {
                const gitPath = path.join(dirPath, '.git');
                if (fs.existsSync(gitPath)) foundRepos.push(dirPath);
                const entries = fs.readdirSync(dirPath, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isDirectory() && !entry.name.startsWith('.')) {
                        const subDirPath = path.join(dirPath, entry.name);
                        foundRepos.push(...findGitReposInDir(subDirPath, depth - 1));
                    }
                }
            } catch (err) {
                // Ignore errors for inaccessible directories
            }
            return foundRepos;
        };

        // Search through all workspace folders and their subdirectories
        for (const folder of workspaceFolders) {
            const folderPath = folder.uri.fsPath;
            const gitRepoPaths = findGitReposInDir(folderPath);

            for (const repoPath of gitRepoPaths) {
                const gitConfigPath = path.join(repoPath, '.git', 'config');
                if (fs.existsSync(gitConfigPath)) {
                    try {
                        const config = fs.readFileSync(gitConfigPath, 'utf8').toLowerCase();
                        // Match against various formats: full path, .git suffix, or just repo name
                        if (config.includes(`/${repoNameLower}`) ||
                            config.includes(`/${repoNameLower}.git`) ||
                            config.includes(`:${repoNameLower}.git`) ||
                            config.includes(`:${repoNameLower}/`)) {
                            return repoPath;
                        }
                    } catch (err) {
                        // Ignore read errors
                    }
                }
            }
        }
        return null;
    }

    /**
     * Get all branches for a repository
     * @param {string} repoPath - Path to the repository
     * @returns {Promise<Array>} - Array of branch names
     */
    async getBranches(repoPath) {
        try {
            const result = execSync('git branch -a', { cwd: repoPath, encoding: 'utf8' });
            const branches = result
                .split('\n')
                .filter(line => line.trim())
                .map(line => {
                    const branch = line.replace(/^\*?\s+/, '').replace(/^remotes\/origin\//, '');
                    return branch;
                })
                .filter((branch, index, arr) => arr.indexOf(branch) === index); // Remove duplicates
            return branches;
        } catch (error) {
            throw new Error(`Failed to get branches: ${error.message}`);
        }
    }

    /**
     * Get the current branch
     * @param {string} repoPath - Path to the repository
     * @returns {string} - Current branch name
     */
    async getCurrentBranch(repoPath) {
        try {
            const branch = execSync('git rev-parse --abbrev-ref HEAD', {
                cwd: repoPath,
                encoding: 'utf8'
            }).trim();
            return branch;
        } catch (error) {
            throw new Error(`Failed to get current branch: ${error.message}`);
        }
    }

    /**
     * Checkout a branch
     * @param {string} repoPath - Path to the repository
     * @param {string} branchName - Branch to checkout
     * @returns {Promise<void>}
     */
    async checkoutBranch(repoPath, branchName) {
        try {
            execSync(`git checkout ${branchName}`, { cwd: repoPath, stdio: 'pipe' });
            vscode.window.showInformationMessage(`Switched to branch: ${branchName}`);
        } catch (error) {
            throw new Error(`Failed to checkout branch: ${error.message}`);
        }
    }

    /**
     * Create a new branch
     * @param {string} repoPath - Path to the repository
     * @param {string} branchName - Name for the new branch
     * @param {string} baseBranch - Branch to create from (optional, defaults to current)
     * @returns {Promise<void>}
     */
    async createBranch(repoPath, branchName, baseBranch = null) {
        try {
            if (baseBranch) {
                execSync(`git checkout -b ${branchName} ${baseBranch}`, {
                    cwd: repoPath,
                    stdio: 'pipe'
                });
            } else {
                execSync(`git checkout -b ${branchName}`, {
                    cwd: repoPath,
                    stdio: 'pipe'
                });
            }
            vscode.window.showInformationMessage(`Branch created: ${branchName}`);
        } catch (error) {
            throw new Error(`Failed to create branch: ${error.message}`);
        }
    }

    /**
     * Create a branch from an issue
     * @param {string} repoName - Repository in format "owner/repo"
     * @param {number} issueNumber - Issue number
     * @returns {Promise<void>}
     */
    async createBranchFromIssue(repoName, issueNumber) {
        try {
            const repoPath = this.getRepositoryPath(repoName);
            if (!repoPath) {
                throw new Error('Repository not found in workspace');
            }

            const [owner, repo] = repoName.split('/');
            const issue = await this.auth.makeRequest(`/api/v1/repos/${owner}/${repo}/issues/${issueNumber}`);

            // Generate branch name from issue
            const branchName = await vscode.window.showInputBox({
                prompt: 'Branch name',
                placeHolder: `issue/${issueNumber}-${this.sanitizeBranchName(issue.title)}`,
                value: `issue/${issueNumber}-${this.sanitizeBranchName(issue.title)}`
            });

            if (!branchName) return;

            // Get base branch
            const branches = await this.getBranches(repoPath);
            const baseBranch = await vscode.window.showQuickPick(branches, {
                placeHolder: 'Select base branch'
            });

            if (!baseBranch) return;

            await this.createBranch(repoPath, branchName, baseBranch);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create branch from issue: ${error.message}`);
        }
    }

    /**
     * Create a branch from a pull request
     * @param {string} repoName - Repository in format "owner/repo"
     * @param {number} prNumber - Pull request number
     * @returns {Promise<void>}
     */
    async createBranchFromPullRequest(repoName, prNumber) {
        try {
            const repoPath = this.getRepositoryPath(repoName);
            if (!repoPath) {
                throw new Error('Repository not found in workspace');
            }

            const [owner, repo] = repoName.split('/');
            const pr = await this.auth.makeRequest(`/api/v1/repos/${owner}/${repo}/pulls/${prNumber}`);

            // Generate branch name from PR
            const branchName = await vscode.window.showInputBox({
                prompt: 'Branch name',
                placeHolder: `feature/pr-${prNumber}-${this.sanitizeBranchName(pr.title)}`,
                value: `feature/pr-${prNumber}-${this.sanitizeBranchName(pr.title)}`
            });

            if (!branchName) return;

            // Offer to use PR's source branch or create new
            const action = await vscode.window.showQuickPick(
                [
                    { label: 'Create from PR source branch', value: 'source' },
                    { label: 'Create from main/develop', value: 'develop' }
                ],
                { placeHolder: 'How would you like to create the branch?' }
            );

            if (!action) return;

            let baseBranch;
            if (action.value === 'source') {
                baseBranch = pr.head?.ref || 'main';
            } else {
                const branches = await this.getBranches(repoPath);
                baseBranch = await vscode.window.showQuickPick(branches, {
                    placeHolder: 'Select base branch'
                });
                if (!baseBranch) return;
            }

            await this.createBranch(repoPath, branchName, baseBranch);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create branch from PR: ${error.message}`);
        }
    }

    /**
     * Switch branches with quick pick
     * @param {string} repoName - Repository in format "owner/repo"
     * @returns {Promise<void>}
     */
    async switchBranch(repoName) {
        try {
            const repoPath = this.getRepositoryPath(repoName);
            if (!repoPath) {
                throw new Error('Repository not found in workspace');
            }

            const branches = await this.getBranches(repoPath);
            const currentBranch = await this.getCurrentBranch(repoPath);

            const items = branches.map(branch => ({
                label: branch === currentBranch ? `$(check) ${branch}` : branch,
                description: branch === currentBranch ? 'current' : '',
                value: branch
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select branch to checkout'
            });

            if (selected && selected.value !== currentBranch) {
                await this.checkoutBranch(repoPath, selected.value);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to switch branch: ${error.message}`);
        }
    }

    /**
     * Sanitize a string to be a valid git branch name
     * @param {string} str - String to sanitize
     * @returns {string} - Sanitized string
     */
    sanitizeBranchName(str) {
        return str
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 50);
    }
}

module.exports = BranchManager;
