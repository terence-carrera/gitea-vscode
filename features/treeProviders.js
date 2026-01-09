const vscode = require('vscode');

class RepositoryTreeItem extends vscode.TreeItem {
    constructor(repository, collapsibleState) {
        super(repository.name, collapsibleState);

        this.repository = repository;
        this.description = repository.full_name;
        this.tooltip = `${repository.full_name}\n${repository.description || 'No description'}`;
        this.iconPath = new vscode.ThemeIcon('repo');
        this.contextValue = 'repository';

        this.metadata = {
            id: repository.id,
            name: repository.name,
            fullName: repository.full_name,
            owner: repository.owner?.login,
            private: repository.private,
            htmlUrl: repository.html_url,
            cloneUrl: repository.clone_url
        };
    }
}

class IssueTreeItem extends vscode.TreeItem {
    constructor(issue, repositoryName) {
        super(`#${issue.number}: ${issue.title}`, vscode.TreeItemCollapsibleState.None);

        this.issue = issue;
        this.description = `${repositoryName} • ${issue.user?.login}`;
        this.tooltip = `${issue.title}\n\nRepository: ${repositoryName}\nAuthor: ${issue.user?.login}\nState: ${issue.state}`;

        this.iconPath = new vscode.ThemeIcon(
            issue.state === 'open' ? 'issue-opened' : 'issue-closed',
            issue.state === 'open' ? new vscode.ThemeColor('issues.open') : new vscode.ThemeColor('issues.closed')
        );

        this.contextValue = 'issue';
        this.metadata = {
            number: issue.number,
            title: issue.title,
            state: issue.state,
            repository: repositoryName,
            htmlUrl: issue.html_url
        };
    }
}

class PullRequestTreeItem extends vscode.TreeItem {
    constructor(pullRequest, repositoryName) {
        super(`#${pullRequest.number}: ${pullRequest.title}`, vscode.TreeItemCollapsibleState.None);

        this.pullRequest = pullRequest;
        this.description = `${repositoryName} • ${pullRequest.user?.login}`;
        this.tooltip = `${pullRequest.title}\n\nRepository: ${repositoryName}\nAuthor: ${pullRequest.user?.login}\nState: ${pullRequest.state}`;

        this.iconPath = new vscode.ThemeIcon(
            pullRequest.state === 'open' ? 'git-pull-request' : 'git-pull-request-closed',
            pullRequest.state === 'open' ? new vscode.ThemeColor('pullRequests.open') : new vscode.ThemeColor('pullRequests.closed')
        );

        this.contextValue = 'pullRequest';
        this.metadata = {
            number: pullRequest.number,
            title: pullRequest.title,
            state: pullRequest.state,
            repository: repositoryName,
            htmlUrl: pullRequest.html_url,
            draft: pullRequest.draft || false
        };
    }
}

class RepositoryProvider {
    constructor(auth) {
        this.auth = auth;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.repositories = [];
        this.mode = 'all';
        this.lastQuery = '';
    }

    refresh() { this._onDidChangeTreeData.fire(); }
    getTreeItem(element) { return element; }

    async getChildren(element) {
        if (!this.auth.isConfigured()) return [];
        try {
            if (!element) {
                if (this.mode === 'search') {
                    return (this.repositories || []).map(repo => new RepositoryTreeItem(repo, vscode.TreeItemCollapsibleState.None));
                }
                const repos = await this.auth.makeRequest('/api/v1/user/repos');
                this.repositories = this.filterRepositoriesByWorkspace(repos || []);
                this.mode = 'all';
                return this.repositories.map(repo => new RepositoryTreeItem(repo, vscode.TreeItemCollapsibleState.None));
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load repositories: ${error.message}`);
        }
        return [];
    }

    async searchRepositories(query) {
        try {
            const repos = await this.auth.makeRequest(`/api/v1/repos/search?q=${encodeURIComponent(query)}`);
            this.repositories = repos?.data || [];
            this.mode = 'search';
            this.lastQuery = query;
            this.refresh();
        } catch (error) { vscode.window.showErrorMessage(`Failed to search repositories: ${error.message}`); }
    }

    resetSearch() { this.mode = 'all'; this.lastQuery = ''; this.repositories = []; }

    filterRepositoriesByWorkspace(allRepos) {
        const fs = require('fs');
        const path = require('path');
        const workspaceFolders = vscode.workspace.workspaceFolders || [];
        if (workspaceFolders.length === 0) return [];
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
            } catch (err) { console.error(`Failed to scan directory ${dirPath}:`, err); }
            return foundRepos;
        };
        const loadedRepos = [];
        for (const repo of allRepos) {
            for (const folder of workspaceFolders) {
                const folderPath = folder.uri.fsPath;
                const gitRepoPaths = findGitReposInDir(folderPath);
                for (const repoPath of gitRepoPaths) {
                    const gitConfigPath = path.join(repoPath, '.git', 'config');
                    if (require('fs').existsSync(gitConfigPath)) {
                        try {
                            const gitConfig = require('fs').readFileSync(gitConfigPath, 'utf8');
                            const cloneUrlNormalized = repo.clone_url.toLowerCase();
                            const htmlUrlNormalized = repo.html_url.toLowerCase();
                            if (gitConfig.toLowerCase().includes(cloneUrlNormalized) ||
                                gitConfig.toLowerCase().includes(htmlUrlNormalized) ||
                                gitConfig.toLowerCase().includes(repo.full_name.toLowerCase())) {
                                if (!loadedRepos.some(r => r.id === repo.id)) loadedRepos.push(repo);
                                break;
                            }
                        } catch (err) { console.error(`Failed to read git config for ${repoPath}:`, err); }
                    }
                }
                if (loadedRepos.some(r => r.id === repo.id)) break;
            }
        }
        return loadedRepos;
    }
}

class IssueProvider {
    constructor(auth) {
        this.auth = auth;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.issues = { openByRepo: {}, closedByRepo: {} };
        this.mode = 'all';
        this.lastQuery = '';
    }

    refresh() { this._onDidChangeTreeData.fire(); }
    getTreeItem(element) { return element; }

    async getChildren(element) {
        if (!this.auth.isConfigured()) return [];
        try {
            if (!element) {
                if (this.mode === 'search') return this.issues;
                const repos = await this.auth.makeRequest('/api/v1/user/repos');
                const workspaceRepos = this.filterRepositoriesByWorkspace(repos || []);
                const openByRepo = {};
                const closedByRepo = {};
                for (const repo of workspaceRepos) {
                    try {
                        const openIssues = await this.auth.makeRequest(`/api/v1/repos/${repo.owner.login}/${repo.name}/issues?state=open`);
                        const openItems = [];
                        openIssues.forEach(issue => { if (!issue.pull_request) openItems.push(new IssueTreeItem(issue, repo.full_name)); });
                        if (openItems.length > 0) openByRepo[repo.full_name] = openItems;

                        const closedIssues = await this.auth.makeRequest(`/api/v1/repos/${repo.owner.login}/${repo.name}/issues?state=closed`);
                        const closedItems = [];
                        closedIssues.forEach(issue => { if (!issue.pull_request) closedItems.push(new IssueTreeItem(issue, repo.full_name)); });
                        if (closedItems.length > 0) closedByRepo[repo.full_name] = closedItems;
                    } catch (err) { console.error(`Failed to fetch issues for ${repo.full_name}:`, err); }
                }
                this.issues = { openByRepo, closedByRepo };
                this.mode = 'all';
                const repoNames = new Set([...Object.keys(openByRepo), ...Object.keys(closedByRepo)]);
                return Array.from(repoNames).map(repoName => {
                    const total = (openByRepo[repoName]?.length || 0) + (closedByRepo[repoName]?.length || 0);
                    const repoGroup = new vscode.TreeItem(`${repoName} (${total})`, vscode.TreeItemCollapsibleState.Collapsed);
                    repoGroup.contextValue = 'issueRepoGroup';
                    repoGroup.iconPath = new vscode.ThemeIcon('repo');
                    repoGroup.id = `repo:${repoName}`;
                    return repoGroup;
                });
            }
            if (element.contextValue === 'issueRepoGroup') {
                const repoName = element.id.substring('repo:'.length);
                const openCount = this.issues.openByRepo[repoName]?.length || 0;
                const closedCount = this.issues.closedByRepo[repoName]?.length || 0;
                const openGroup = new vscode.TreeItem(`Open (${openCount})`, vscode.TreeItemCollapsibleState.Expanded);
                openGroup.contextValue = 'issueStateGroup';
                openGroup.iconPath = new vscode.ThemeIcon('issues');
                openGroup.id = `repo:${repoName}:open`;
                const closedGroup = new vscode.TreeItem(`Closed (${closedCount})`, vscode.TreeItemCollapsibleState.Collapsed);
                closedGroup.contextValue = 'issueStateGroup';
                closedGroup.iconPath = new vscode.ThemeIcon('issue-closed');
                closedGroup.id = `repo:${repoName}:closed`;
                return [openGroup, closedGroup];
            }
            if (element.contextValue === 'issueStateGroup') {
                const parts = element.id.split(':');
                const repoName = parts[1];
                const state = parts[2];
                const repoMap = state === 'open' ? this.issues.openByRepo : this.issues.closedByRepo;
                return repoMap[repoName] || [];
            }
        } catch (error) { vscode.window.showErrorMessage(`Failed to load issues: ${error.message}`); }
        return [];
    }

    async searchIssues(query) {
        try {
            const repos = await this.auth.makeRequest('/api/v1/user/repos');
            const workspaceRepos = this.filterRepositoriesByWorkspace(repos || []);
            const allIssues = [];
            for (const repo of workspaceRepos) {
                try {
                    const issues = await this.auth.makeRequest(`/api/v1/repos/${repo.owner.login}/${repo.name}/issues?state=all`);
                    issues.forEach(issue => { if (!issue.pull_request && issue.title.toLowerCase().includes(query.toLowerCase())) allIssues.push(new IssueTreeItem(issue, repo.full_name)); });
                } catch (err) { console.error(`Failed to search issues in ${repo.full_name}:`, err); }
            }
            this.issues = allIssues; // flat for search
            this.mode = 'search';
            this.lastQuery = query;
            this.refresh();
        } catch (error) { vscode.window.showErrorMessage(`Failed to search issues: ${error.message}`); }
    }

    resetSearch() { this.mode = 'all'; this.lastQuery = ''; this.issues = { openByRepo: {}, closedByRepo: {} }; }

    filterRepositoriesByWorkspace(allRepos) {
        const fs = require('fs');
        const path = require('path');
        const workspaceFolders = vscode.workspace.workspaceFolders || [];
        if (workspaceFolders.length === 0) return [];
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
            } catch (err) { console.error(`Failed to scan directory ${dirPath}:`, err); }
            return foundRepos;
        };
        const loadedRepos = [];
        for (const repo of allRepos) {
            for (const folder of workspaceFolders) {
                const folderPath = folder.uri.fsPath;
                const gitRepoPaths = findGitReposInDir(folderPath);
                for (const repoPath of gitRepoPaths) {
                    const gitConfigPath = path.join(repoPath, '.git', 'config');
                    if (require('fs').existsSync(gitConfigPath)) {
                        try {
                            const gitConfig = require('fs').readFileSync(gitConfigPath, 'utf8');
                            const cloneUrlNormalized = repo.clone_url.toLowerCase();
                            const htmlUrlNormalized = repo.html_url.toLowerCase();
                            if (gitConfig.toLowerCase().includes(cloneUrlNormalized) ||
                                gitConfig.toLowerCase().includes(htmlUrlNormalized) ||
                                gitConfig.toLowerCase().includes(repo.full_name.toLowerCase())) {
                                if (!loadedRepos.some(r => r.id === repo.id)) loadedRepos.push(repo);
                                break;
                            }
                        } catch (err) { console.error(`Failed to read git config for ${repoPath}:`, err); }
                    }
                }
                if (loadedRepos.some(r => r.id === repo.id)) break;
            }
        }
        return loadedRepos;
    }
}

class PullRequestProvider {
    constructor(auth) {
        this.auth = auth;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.pullRequests = { openByRepo: {}, closedByRepo: {}, wipByRepo: {} };
        this.mode = 'all';
        this.lastQuery = '';
    }

    refresh() { this._onDidChangeTreeData.fire(); }
    getTreeItem(element) { return element; }

    async getChildren(element) {
        if (!this.auth.isConfigured()) return [];
        try {
            if (!element) {
                if (this.mode === 'search') return this.pullRequests;
                const repos = await this.auth.makeRequest('/api/v1/user/repos');
                const workspaceRepos = this.filterRepositoriesByWorkspace(repos || []);
                const openByRepo = {};
                const closedByRepo = {};
                const wipByRepo = {};
                for (const repo of workspaceRepos) {
                    try {
                        const openPRs = await this.auth.makeRequest(`/api/v1/repos/${repo.owner.login}/${repo.name}/pulls?state=open`);
                        const openItems = [];
                        const wipItems = [];
                        openPRs.forEach(pr => {
                            const isWIP = pr.draft || /^(wip|\[wip\]|work in progress|draft)/i.test(pr.title.toLowerCase());
                            if (isWIP) wipItems.push(new PullRequestTreeItem(pr, repo.full_name));
                            else openItems.push(new PullRequestTreeItem(pr, repo.full_name));
                        });
                        if (openItems.length > 0) openByRepo[repo.full_name] = openItems;
                        if (wipItems.length > 0) wipByRepo[repo.full_name] = wipItems;

                        const closedPRs = await this.auth.makeRequest(`/api/v1/repos/${repo.owner.login}/${repo.name}/pulls?state=closed`);
                        const closedItems = [];
                        closedPRs.forEach(pr => closedItems.push(new PullRequestTreeItem(pr, repo.full_name)));
                        if (closedItems.length > 0) closedByRepo[repo.full_name] = closedItems;
                    } catch (err) { console.error(`Failed to fetch PRs for ${repo.full_name}:`, err); }
                }
                this.pullRequests = { openByRepo, closedByRepo, wipByRepo };
                this.mode = 'all';
                const repoNames = new Set([...Object.keys(openByRepo), ...Object.keys(wipByRepo), ...Object.keys(closedByRepo)]);
                return Array.from(repoNames).map(repoName => {
                    const total = (openByRepo[repoName]?.length || 0) + (wipByRepo[repoName]?.length || 0) + (closedByRepo[repoName]?.length || 0);
                    const repoGroup = new vscode.TreeItem(`${repoName} (${total})`, vscode.TreeItemCollapsibleState.Collapsed);
                    repoGroup.contextValue = 'prRepoGroup';
                    repoGroup.iconPath = new vscode.ThemeIcon('repo');
                    repoGroup.id = `repo:${repoName}`;
                    return repoGroup;
                });
            }
            if (element.contextValue === 'prRepoGroup') {
                const repoName = element.id.substring('repo:'.length);
                const openCount = this.pullRequests.openByRepo[repoName]?.length || 0;
                const wipCount = this.pullRequests.wipByRepo[repoName]?.length || 0;
                const closedCount = this.pullRequests.closedByRepo[repoName]?.length || 0;
                const openGroup = new vscode.TreeItem(`Open (${openCount})`, vscode.TreeItemCollapsibleState.Expanded);
                openGroup.contextValue = 'prStateGroup';
                openGroup.iconPath = new vscode.ThemeIcon('git-pull-request');
                openGroup.id = `repo:${repoName}:open`;
                const wipGroup = new vscode.TreeItem(`Work-in-Progress (${wipCount})`, vscode.TreeItemCollapsibleState.Collapsed);
                wipGroup.contextValue = 'prStateGroup';
                wipGroup.iconPath = new vscode.ThemeIcon('git-pull-request-draft');
                wipGroup.id = `repo:${repoName}:wip`;
                const closedGroup = new vscode.TreeItem(`Closed (${closedCount})`, vscode.TreeItemCollapsibleState.Collapsed);
                closedGroup.contextValue = 'prStateGroup';
                closedGroup.iconPath = new vscode.ThemeIcon('git-pull-request-closed');
                closedGroup.id = `repo:${repoName}:closed`;
                return [openGroup, wipGroup, closedGroup];
            }
            if (element.contextValue === 'prStateGroup') {
                const parts = element.id.split(':');
                const repoName = parts[1];
                const state = parts[2];
                let repoMap;
                if (state === 'open') repoMap = this.pullRequests.openByRepo;
                else if (state === 'wip') repoMap = this.pullRequests.wipByRepo;
                else repoMap = this.pullRequests.closedByRepo;
                return repoMap[repoName] || [];
            }
        } catch (error) { vscode.window.showErrorMessage(`Failed to load pull requests: ${error.message}`); }
        return [];
    }

    async searchPullRequests(query) {
        try {
            const repos = await this.auth.makeRequest('/api/v1/user/repos');
            const workspaceRepos = this.filterRepositoriesByWorkspace(repos || []);
            const allPRs = [];
            for (const repo of workspaceRepos) {
                try {
                    const prs = await this.auth.makeRequest(`/api/v1/repos/${repo.owner.login}/${repo.name}/pulls?state=all`);
                    prs.forEach(pr => { if (pr.title.toLowerCase().includes(query.toLowerCase())) allPRs.push(new PullRequestTreeItem(pr, repo.full_name)); });
                } catch (err) { console.error(`Failed to search PRs in ${repo.full_name}:`, err); }
            }
            this.pullRequests = allPRs; // flat for search
            this.mode = 'search';
            this.lastQuery = query;
            this.refresh();
        } catch (error) { vscode.window.showErrorMessage(`Failed to search pull requests: ${error.message}`); }
    }

    resetSearch() { this.mode = 'all'; this.lastQuery = ''; this.pullRequests = { openByRepo: {}, closedByRepo: {}, wipByRepo: {} }; }

    filterRepositoriesByWorkspace(allRepos) {
        const fs = require('fs');
        const path = require('path');
        const workspaceFolders = vscode.workspace.workspaceFolders || [];
        if (workspaceFolders.length === 0) return [];
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
            } catch (err) { console.error(`Failed to scan directory ${dirPath}:`, err); }
            return foundRepos;
        };
        const loadedRepos = [];
        for (const repo of allRepos) {
            for (const folder of workspaceFolders) {
                const folderPath = folder.uri.fsPath;
                const gitRepoPaths = findGitReposInDir(folderPath);
                for (const repoPath of gitRepoPaths) {
                    const gitConfigPath = path.join(repoPath, '.git', 'config');
                    if (require('fs').existsSync(gitConfigPath)) {
                        try {
                            const gitConfig = require('fs').readFileSync(gitConfigPath, 'utf8');
                            const cloneUrlNormalized = repo.clone_url.toLowerCase();
                            const htmlUrlNormalized = repo.html_url.toLowerCase();
                            if (gitConfig.toLowerCase().includes(cloneUrlNormalized) ||
                                gitConfig.toLowerCase().includes(htmlUrlNormalized) ||
                                gitConfig.toLowerCase().includes(repo.full_name.toLowerCase())) {
                                if (!loadedRepos.some(r => r.id === repo.id)) loadedRepos.push(repo);
                                break;
                            }
                        } catch (err) { console.error(`Failed to read git config for ${repoPath}:`, err); }
                    }
                }
                if (loadedRepos.some(r => r.id === repo.id)) break;
            }
        }
        return loadedRepos;
    }
}

module.exports = {
    RepositoryProvider,
    IssueProvider,
    PullRequestProvider,
    RepositoryTreeItem,
    IssueTreeItem,
    PullRequestTreeItem
};
