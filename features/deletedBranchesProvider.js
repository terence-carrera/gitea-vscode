const vscode = require('vscode');
const path = require('path');

class DeletedBranchesProvider {
    constructor(branchManager, repositoryProvider) {
        this.branchManager = branchManager;
        this.repositoryProvider = repositoryProvider;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        return element;
    }

    async getChildren(element) {
        if (!element) {
            // Root level - show repositories with deleted branches
            return this.getRepositoriesWithDeletedBranches();
        } else if (element.contextValue === 'deletedBranchesRepo') {
            // Show deleted branches for this repository
            return this.getDeletedBranchesForRepo(element.repoPath);
        }
        return [];
    }

    async getRepositoriesWithDeletedBranches() {
        const items = [];

        for (const [repoPath, deletions] of this.branchManager.deletedBranches.entries()) {
            if (deletions.length > 0) {
                const repoName = path.basename(repoPath);
                const item = new vscode.TreeItem(
                    repoName,
                    vscode.TreeItemCollapsibleState.Collapsed
                );
                item.description = `${deletions.length} deleted branch${deletions.length > 1 ? 'es' : ''}`;
                item.iconPath = new vscode.ThemeIcon('repo');
                item.contextValue = 'deletedBranchesRepo';
                item.repoPath = repoPath;
                item.tooltip = `${repoPath}\n${deletions.length} deleted branch${deletions.length > 1 ? 'es' : ''}`;
                items.push(item);
            }
        }

        if (items.length === 0) {
            const emptyItem = new vscode.TreeItem('No deleted branches tracked');
            emptyItem.contextValue = 'empty';
            emptyItem.iconPath = new vscode.ThemeIcon('info');
            emptyItem.tooltip = 'Delete a branch through the extension to track it here, or use "Restore from Reflog" to find historical deletions';
            return [emptyItem];
        }

        return items;
    }

    getDeletedBranchesForRepo(repoPath) {
        const deletions = this.branchManager.getDeletedBranches(repoPath);
        const items = [];

        for (const deletion of deletions) {
            const deletedDate = new Date(deletion.deletedAt);
            const now = new Date();
            const diffMs = now - deletedDate;
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffMinutes = Math.floor(diffMs / (1000 * 60));

            let timeAgo;
            if (diffDays > 0) {
                timeAgo = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
            } else if (diffHours > 0) {
                timeAgo = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
            } else if (diffMinutes > 0) {
                timeAgo = `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
            } else {
                timeAgo = 'just now';
            }

            const item = new vscode.TreeItem(deletion.name);
            item.description = timeAgo;
            item.tooltip = [
                `Branch: ${deletion.name}`,
                `Commit: ${deletion.commit.substring(0, 7)}`,
                `Deleted: ${deletedDate.toLocaleString()}`,
                `Source: ${deletion.deletedBy || 'extension'}`
            ].join('\n');
            item.iconPath = new vscode.ThemeIcon('git-branch', new vscode.ThemeColor('gitDecoration.deletedResourceForeground'));
            item.contextValue = 'deletedBranch';
            item.repoPath = repoPath;
            item.branchName = deletion.name;
            item.commit = deletion.commit;
            item.command = {
                command: 'gitea.showDeletedBranchDetails',
                title: 'Show Details',
                arguments: [deletion, repoPath]
            };
            items.push(item);
        }

        // Sort by deletion date (most recent first)
        items.sort((a, b) => {
            const deletionA = deletions.find(d => d.name === a.branchName);
            const deletionB = deletions.find(d => d.name === b.branchName);
            return new Date(deletionB.deletedAt) - new Date(deletionA.deletedAt);
        });

        return items;
    }
}

module.exports = DeletedBranchesProvider;
