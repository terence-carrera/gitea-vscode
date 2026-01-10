const vscode = require('vscode');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

class StashManager {
    constructor() {
        this.stashes = [];
    }

    /**
     * Get the git repository root from the current workspace
     */
    getRepositoryRoot() {
        try {
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                throw new Error('No workspace folder is open');
            }

            const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;

            // Check if .git exists in the workspace root
            if (fs.existsSync(path.join(workspaceFolder, '.git'))) {
                return workspaceFolder;
            }

            // Search subdirectories for .git folder
            const searchGitDir = (dir, depth = 0) => {
                if (depth > 2) return null;

                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.name === '.git' && entry.isDirectory()) {
                        return dir;
                    }
                    if (entry.isDirectory() && !entry.name.startsWith('.')) {
                        const found = searchGitDir(path.join(dir, entry.name), depth + 1);
                        if (found) return found;
                    }
                }
                return null;
            };

            const repoRoot = searchGitDir(workspaceFolder);
            if (repoRoot) {
                return repoRoot;
            }

            throw new Error('No git repository found in workspace');
        } catch (error) {
            console.error('Failed to get repository root:', error);
            throw error;
        }
    }

    /**
     * Execute a git command
     */
    executeGitCommand(command, cwd) {
        try {
            const result = execSync(command, { cwd, encoding: 'utf-8' });
            return result.trim();
        } catch (error) {
            throw new Error(`Git command failed: ${error.message}`);
        }
    }

    /**
     * List all stashes
     */
    async listStashes() {
        try {
            const cwd = this.getRepositoryRoot();
            const result = this.executeGitCommand('git stash list', cwd);

            if (!result) {
                this.stashes = [];
                return [];
            }

            // Parse stash output: stash@{0}: WIP on master: abc1234 commit message
            this.stashes = result.split('\n').filter(line => line.trim()).map(line => {
                const match = line.match(/^(stash@\{\d+\}): (.+)$/);
                if (match) {
                    return {
                        id: match[1],
                        description: match[2]
                    };
                }
                return null;
            }).filter(Boolean);

            return this.stashes;
        } catch (error) {
            console.error('Failed to list stashes:', error);
            vscode.window.showErrorMessage(`Failed to list stashes: ${error.message}`);
            return [];
        }
    }

    /**
     * Create a new stash with an optional message
     */
    async createStash(message = null) {
        try {
            const cwd = this.getRepositoryRoot();

            // Get current branch and status for default message
            const branch = this.executeGitCommand('git rev-parse --abbrev-ref HEAD', cwd);
            const defaultMessage = message || `WIP on ${branch}`;

            // Create stash
            this.executeGitCommand(`git stash push -m "${defaultMessage}"`, cwd);

            vscode.window.showInformationMessage(`Stash created: "${defaultMessage}"`);
            await this.listStashes();
            return true;
        } catch (error) {
            console.error('Failed to create stash:', error);
            vscode.window.showErrorMessage(`Failed to create stash: ${error.message}`);
            return false;
        }
    }

    /**
     * Apply a stash without removing it
     */
    async applyStash(stashId = null) {
        try {
            const cwd = this.getRepositoryRoot();

            if (!stashId) {
                // Show quick pick
                const stashes = await this.listStashes();
                if (stashes.length === 0) {
                    vscode.window.showInformationMessage('No stashes available');
                    return false;
                }

                const selected = await vscode.window.showQuickPick(
                    stashes.map(s => ({ label: s.id, description: s.description, stashId: s.id })),
                    { placeHolder: 'Select a stash to apply' }
                );

                if (!selected) return false;
                stashId = selected.stashId;
            }

            this.executeGitCommand(`git stash apply ${stashId}`, cwd);
            vscode.window.showInformationMessage(`Applied stash: ${stashId}`);
            return true;
        } catch (error) {
            console.error('Failed to apply stash:', error);
            vscode.window.showErrorMessage(`Failed to apply stash: ${error.message}`);
            return false;
        }
    }

    /**
     * Pop a stash (apply and remove)
     */
    async popStash(stashId = null) {
        try {
            const cwd = this.getRepositoryRoot();

            if (!stashId) {
                // Show quick pick
                const stashes = await this.listStashes();
                if (stashes.length === 0) {
                    vscode.window.showInformationMessage('No stashes available');
                    return false;
                }

                const selected = await vscode.window.showQuickPick(
                    stashes.map(s => ({ label: s.id, description: s.description, stashId: s.id })),
                    { placeHolder: 'Select a stash to pop' }
                );

                if (!selected) return false;
                stashId = selected.stashId;
            }

            this.executeGitCommand(`git stash pop ${stashId}`, cwd);
            vscode.window.showInformationMessage(`Popped stash: ${stashId}`);
            await this.listStashes();
            return true;
        } catch (error) {
            console.error('Failed to pop stash:', error);
            vscode.window.showErrorMessage(`Failed to pop stash: ${error.message}`);
            return false;
        }
    }

    /**
     * Drop a stash
     */
    async dropStash(stashId = null) {
        try {
            const cwd = this.getRepositoryRoot();

            if (!stashId) {
                // Show quick pick
                const stashes = await this.listStashes();
                if (stashes.length === 0) {
                    vscode.window.showInformationMessage('No stashes available');
                    return false;
                }

                const selected = await vscode.window.showQuickPick(
                    stashes.map(s => ({ label: s.id, description: s.description, stashId: s.id })),
                    { placeHolder: 'Select a stash to drop' }
                );

                if (!selected) return false;
                stashId = selected.stashId;
            }

            const confirm = await vscode.window.showWarningMessage(
                `Are you sure you want to drop ${stashId}?`,
                'Drop', 'Cancel'
            );

            if (confirm !== 'Drop') return false;

            this.executeGitCommand(`git stash drop ${stashId}`, cwd);
            vscode.window.showInformationMessage(`Dropped stash: ${stashId}`);
            await this.listStashes();
            return true;
        } catch (error) {
            console.error('Failed to drop stash:', error);
            vscode.window.showErrorMessage(`Failed to drop stash: ${error.message}`);
            return false;
        }
    }

    /**
     * Show stash contents/diff
     */
    async showStashDiff(stashId = null) {
        try {
            const cwd = this.getRepositoryRoot();

            if (!stashId) {
                // Show quick pick
                const stashes = await this.listStashes();
                if (stashes.length === 0) {
                    vscode.window.showInformationMessage('No stashes available');
                    return false;
                }

                const selected = await vscode.window.showQuickPick(
                    stashes.map(s => ({ label: s.id, description: s.description, stashId: s.id })),
                    { placeHolder: 'Select a stash to view' }
                );

                if (!selected) return false;
                stashId = selected.stashId;
            }

            const diff = this.executeGitCommand(`git stash show -p ${stashId}`, cwd);

            // Create an output channel and show the diff
            const outputChannel = vscode.window.createOutputChannel(`Stash: ${stashId}`);
            outputChannel.clear();
            outputChannel.append(diff);
            outputChannel.show();

            return true;
        } catch (error) {
            console.error('Failed to show stash diff:', error);
            vscode.window.showErrorMessage(`Failed to show stash diff: ${error.message}`);
            return false;
        }
    }

    /**
     * Manage stashes with interactive menu
     */
    async manageStashes() {
        const actions = [
            { label: '📦 Stash Changes', action: 'create' },
            { label: '📋 List Stashes', action: 'list' },
            { label: '✓ Apply Stash', action: 'apply' },
            { label: '⤵️  Pop Stash', action: 'pop' },
            { label: '🗑️  Drop Stash', action: 'drop' },
            { label: '👁️  View Stash Diff', action: 'diff' }
        ];

        const selected = await vscode.window.showQuickPick(
            actions,
            { placeHolder: 'Select a stash action' }
        );

        if (!selected) return;

        switch (selected.action) {
            case 'create': {
                const message = await vscode.window.showInputBox({
                    prompt: 'Enter a stash message (optional)',
                    placeHolder: 'e.g., WIP: feature implementation'
                });
                await this.createStash(message);
                break;
            }
            case 'list': {
                const stashes = await this.listStashes();
                if (stashes.length === 0) {
                    vscode.window.showInformationMessage('No stashes available');
                } else {
                    const items = stashes.map(s => `${s.id}: ${s.description}`);
                    await vscode.window.showQuickPick(items, { placeHolder: 'Stashes' });
                }
                break;
            }
            case 'apply':
                await this.applyStash();
                break;
            case 'pop':
                await this.popStash();
                break;
            case 'drop':
                await this.dropStash();
                break;
            case 'diff':
                await this.showStashDiff();
                break;
        }
    }
}

module.exports = StashManager;
