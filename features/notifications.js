const vscode = require('vscode');

class NotificationManager {
    constructor(auth) {
        this.auth = auth;
        this.isMonitoring = false;
        this.pollInterval = 60000; // 60 seconds
        this.monitoringTimers = {};
        this.activityCache = {}; // Track last known state
    }

    /**
     * Start monitoring repositories for activity
     */
    async startMonitoring() {
        try {
            if (this.isMonitoring) return;

            this.isMonitoring = true;
            vscode.window.showInformationMessage('Repository monitoring started');

            const config = vscode.workspace.getConfiguration('gitea');
            this.pollInterval = config.get('notificationPollInterval') || 60000;

            // Initial check
            await this.checkRepositoriesActivity();

            // Set up polling
            this.monitoringTimers.main = setInterval(async () => {
                await this.checkRepositoriesActivity();
            }, this.pollInterval);
        } catch (error) {
            console.error('Failed to start monitoring:', error);
            this.isMonitoring = false;
            vscode.window.showErrorMessage(`Failed to start repository monitoring: ${error.message}`);
        }
    }

    /**
     * Stop monitoring repositories
     */
    stopMonitoring() {
        try {
            if (!this.isMonitoring) return;

            this.isMonitoring = false;
            Object.keys(this.monitoringTimers).forEach(key => {
                clearInterval(this.monitoringTimers[key]);
            });
            this.monitoringTimers = {};
            vscode.window.showInformationMessage('Repository monitoring stopped');
        } catch (error) {
            console.error('Failed to stop monitoring:', error);
            // Don't show error to user as this is cleanup code
        }
    }

    /**
     * Check all repositories for new activities
     */
    async checkRepositoriesActivity() {
        if (!this.auth.isConfigured()) return;

        try {
            const repos = await this.auth.makeRequest('/api/v1/user/repos');
            if (!repos || repos.length === 0) return;

            const workspaceRepos = this.filterRepositoriesByWorkspace(repos);
            if (workspaceRepos.length === 0) return; // No workspace repos to monitor

            for (const repo of workspaceRepos) {
                await this.checkRepoActivity(repo);
            }
        } catch (error) {
            console.error('Failed to check repositories activity:', error);
        }
    }

    /**
     * Check a single repository for new activities
     */
    async checkRepoActivity(repo) {
        try {
            const repoKey = `${repo.owner.login}/${repo.name}`;

            // Check for recent activity: issues, pull requests, commits
            const [issues, prs, commits] = await Promise.all([
                this.checkNewIssues(repo, repoKey),
                this.checkNewPullRequests(repo, repoKey),
                this.checkNewCommits(repo, repoKey)
            ]);

            // Check for new issues
            if (issues.length > 0) {
                this.notifyNewIssues(repo, issues);
            }

            // Check for new pull requests
            if (prs.length > 0) {
                this.notifyNewPullRequests(repo, prs);
            }

            // Check for new commits
            if (commits.length > 0) {
                this.notifyNewCommits(repo, commits);
            }
        } catch (error) {
            console.error(`Failed to check activity for ${repo.full_name}:`, error);
        }
    }

    /**
     * Check for new issues
     */
    async checkNewIssues(repo, repoKey) {
        try {
            const issues = await this.auth.makeRequest(
                `/api/v1/repos/${repo.owner.login}/${repo.name}/issues?state=open&limit=10`
            );

            const cacheKey = `${repoKey}:issues`;
            const previous = this.activityCache[cacheKey] || [];

            const newIssues = issues.filter(issue =>
                !issue.pull_request &&
                !previous.some(p => p.id === issue.id)
            );

            this.activityCache[cacheKey] = issues.map(i => ({ id: i.id }));
            return newIssues;
        } catch (error) {
            console.error(`Failed to check issues for ${repoKey}:`, error);
            return [];
        }
    }

    /**
     * Check for new pull requests
     */
    async checkNewPullRequests(repo, repoKey) {
        try {
            const prs = await this.auth.makeRequest(
                `/api/v1/repos/${repo.owner.login}/${repo.name}/pulls?state=open&limit=10`
            );

            const cacheKey = `${repoKey}:prs`;
            const previous = this.activityCache[cacheKey] || [];

            const newPRs = prs.filter(pr =>
                !previous.some(p => p.id === pr.id)
            );

            this.activityCache[cacheKey] = prs.map(p => ({ id: p.id }));
            return newPRs;
        } catch (error) {
            console.error(`Failed to check PRs for ${repoKey}:`, error);
            return [];
        }
    }

    /**
     * Check for new commits
     */
    async checkNewCommits(repo, repoKey) {
        try {
            const commits = await this.auth.makeRequest(
                `/api/v1/repos/${repo.owner.login}/${repo.name}/commits?limit=5`
            );

            if (!commits || commits.length === 0) return [];

            const cacheKey = `${repoKey}:commits`;
            const previous = this.activityCache[cacheKey] || [];

            const newCommits = commits.filter(commit =>
                !previous.some(p => p.sha === commit.sha)
            );

            this.activityCache[cacheKey] = commits.map(c => ({ sha: c.sha }));
            return newCommits;
        } catch (error) {
            console.error(`Failed to check commits for ${repoKey}:`, error);
            return [];
        }
    }

    /**
     * Show notification for new issues
     */
    notifyNewIssues(repo, issues) {
        try {
            const count = issues.length;
            const title = count === 1 ? 'New Issue' : `${count} New Issues`;
            const message = `${title} in ${repo.full_name}`;

            vscode.window.showInformationMessage(
                message,
                'View',
                'Dismiss'
            ).then(selection => {
                if (selection === 'View') {
                    vscode.commands.executeCommand('gitea.searchIssues', issues[0].title);
                }
            });
        } catch (error) {
            console.error('Failed to notify new issues:', error);
        }
    }

    /**
     * Show notification for new pull requests
     */
    notifyNewPullRequests(repo, prs) {
        try {
            const count = prs.length;
            const title = count === 1 ? 'New Pull Request' : `${count} New Pull Requests`;
            const message = `${title} in ${repo.full_name}`;

            vscode.window.showInformationMessage(
                message,
                'View',
                'Dismiss'
            ).then(selection => {
                if (selection === 'View') {
                    vscode.commands.executeCommand('gitea.searchPullRequests', prs[0].title);
                }
            });
        } catch (error) {
            console.error('Failed to notify new pull requests:', error);
        }
    }

    /**
     * Show notification for new commits
     */
    notifyNewCommits(repo, commits) {
        try {
            const count = commits.length;
            const title = count === 1 ? 'New Commit' : `${count} New Commits`;
            const message = `${title} in ${repo.full_name}`;

            vscode.window.showInformationMessage(message, 'Dismiss');
        } catch (error) {
            console.error('Failed to notify new commits:', error);
        }
    }

    /**
     * Toggle monitoring state
     */
    async toggleMonitoring() {
        try {
            if (this.isMonitoring) {
                this.stopMonitoring();
            } else {
                await this.startMonitoring();
            }
        } catch (error) {
            console.error('Failed to toggle monitoring:', error);
            vscode.window.showErrorMessage(`Failed to toggle monitoring: ${error.message}`);
        }
    }

    /**
     * Get monitoring status
     */
    getStatus() {
        try {
            return {
                isMonitoring: this.isMonitoring,
                pollInterval: this.pollInterval
            };
        } catch (error) {
            console.error('Failed to get status:', error);
            return {
                isMonitoring: false,
                pollInterval: 60000
            };
        }
    }

    /**
     * Filter repositories to only those loaded in current workspace
     */
    filterRepositoriesByWorkspace(allRepos) {
        // Get workspace folders
        const workspaceFolders = vscode.workspace.workspaceFolders || [];
        if (workspaceFolders.length === 0) {
            return []; // No workspace folders open
        }

        // Match repositories with workspace folders
        const loadedRepos = [];
        for (const repo of allRepos) {
            for (const folder of workspaceFolders) {
                const folderName = folder.name;
                const repoName = repo.name;
                const repoFullName = repo.full_name;

                if (
                    folderName === repoName ||
                    folderName === repoFullName ||
                    folderName.toLowerCase() === repoName.toLowerCase() ||
                    folderName.toLowerCase() === repoFullName.toLowerCase()
                ) {
                    loadedRepos.push(repo);
                    break; // Found match, move to next repo
                }
            }
        }

        return loadedRepos;
    }
}

module.exports = NotificationManager;
