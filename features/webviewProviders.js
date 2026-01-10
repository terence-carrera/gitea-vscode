const vscode = require('vscode');

class PullRequestWebviewProvider {
    constructor(auth) {
        this.auth = auth;
        this._panels = new Map();
    }

    async showPullRequest(prNumber, repository) {
        try {
            const panelKey = `${repository}#${prNumber}`;

            // Reuse existing panel if available
            if (this._panels.has(panelKey)) {
                const panel = this._panels.get(panelKey);
                panel.reveal(vscode.ViewColumn.One);
                return;
            }

            // Fetch PR details
            const [owner, repo] = repository.split('/');
            let prDetails, comments, reviews;

            try {
                [prDetails, comments, reviews] = await Promise.all([
                    this.auth.makeRequest(`/api/v1/repos/${owner}/${repo}/pulls/${prNumber}`),
                    this.auth.makeRequest(`/api/v1/repos/${owner}/${repo}/issues/${prNumber}/comments`),
                    this.auth.makeRequest(`/api/v1/repos/${owner}/${repo}/pulls/${prNumber}/reviews`).catch(() => [])
                ]);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to load PR #${prNumber}: ${error.message}`);
                return;
            }

            // Create panel
            const panel = vscode.window.createWebviewPanel(
                'giteaPullRequest',
                `PR #${prNumber}: ${prDetails.title}`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            this._panels.set(panelKey, panel);

            panel.onDidDispose(() => {
                this._panels.delete(panelKey);
            });

            // Handle messages from webview
            panel.webview.onDidReceiveMessage(
                async message => {
                    try {
                        switch (message.command) {
                            case 'addComment':
                                await this.addComment(owner, repo, prNumber, message.body);
                                break;
                            case 'addReview':
                                await this.addReview(owner, repo, prNumber, message.body, message.event);
                                break;
                            case 'mergePR':
                                await this.mergePullRequest(owner, repo, prNumber, message.mergeMethod);
                                break;
                            case 'closePR':
                                await this.closePullRequest(owner, repo, prNumber);
                                break;
                            case 'createBranch':
                                vscode.commands.executeCommand('gitea.createBranchFromPR', {
                                    metadata: { repository: `${owner}/${repo}`, number: prNumber }
                                });
                                break;
                            case 'openInBrowser':
                                vscode.env.openExternal(vscode.Uri.parse(prDetails.html_url));
                                break;
                        }
                    } catch (error) {
                        console.error('Error handling webview message:', error);
                        vscode.window.showErrorMessage(`Error: ${error.message}`);
                    }
                }
            );

            panel.webview.html = this.getPullRequestHtml(panel.webview, prDetails, comments, reviews);
        } catch (error) {
            console.error('Failed to show pull request:', error);
            vscode.window.showErrorMessage(`Failed to show pull request: ${error.message}`);
        }
    }

    async addComment(owner, repo, prNumber, body) {
        try {
            await this.auth.makeRequest(`/api/v1/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
                method: 'POST',
                body: { body }
            });
            vscode.window.showInformationMessage('Comment added successfully');
            // Refresh the webview
            await this.showPullRequest(prNumber, `${owner}/${repo}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to add comment: ${error.message}`);
        }
    }

    async addReview(owner, repo, prNumber, body, event) {
        try {
            await this.auth.makeRequest(`/api/v1/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, {
                method: 'POST',
                body: { body, event }
            });
            vscode.window.showInformationMessage(`Review ${event.toLowerCase()} successfully`);
            await this.showPullRequest(prNumber, `${owner}/${repo}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to submit review: ${error.message}`);
        }
    }

    async mergePullRequest(owner, repo, prNumber, mergeMethod = 'merge') {
        try {
            await this.auth.makeRequest(`/api/v1/repos/${owner}/${repo}/pulls/${prNumber}/merge`, {
                method: 'POST',
                body: { Do: mergeMethod }
            });
            vscode.window.showInformationMessage(`PR #${prNumber} merged successfully`);
            await this.showPullRequest(prNumber, `${owner}/${repo}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to merge PR: ${error.message}`);
        }
    }

    async closePullRequest(owner, repo, prNumber) {
        try {
            await this.auth.makeRequest(`/api/v1/repos/${owner}/${repo}/pulls/${prNumber}`, {
                method: 'PATCH',
                body: { state: 'closed' }
            });
            vscode.window.showInformationMessage(`PR #${prNumber} closed`);
            await this.showPullRequest(prNumber, `${owner}/${repo}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to close PR: ${error.message}`);
        }
    }

    getPullRequestHtml(webview, pr, comments, reviews) {
        const stateColor = pr.state === 'open' ? '#3fb950' : pr.merged ? '#8957e5' : '#f85149';
        const stateIcon = pr.state === 'open' ? '●' : pr.merged ? '✓' : '×';
        const stateText = pr.state === 'open' ? 'Open' : pr.merged ? 'Merged' : 'Closed';

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }
        .header {
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 16px;
            margin-bottom: 20px;
        }
        .title {
            font-size: 24px;
            font-weight: 600;
            margin: 8px 0;
        }
        .state-badge {
            display: inline-flex;
            align-items: center;
            padding: 4px 12px;
            border-radius: 16px;
            font-size: 14px;
            font-weight: 500;
            background-color: ${stateColor};
            color: white;
            margin-right: 8px;
        }
        .metadata {
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
            margin-top: 8px;
        }
        .section {
            margin: 24px 0;
        }
        .section-title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 8px;
        }
        .description {
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-textBlockQuote-border);
            padding: 12px 16px;
            margin: 12px 0;
            white-space: pre-wrap;
        }
        .comment {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 12px;
        }
        .comment-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 13px;
        }
        .comment-author {
            font-weight: 600;
            color: var(--vscode-textLink-foreground);
        }
        .comment-date {
            color: var(--vscode-descriptionForeground);
        }
        .comment-body {
            white-space: pre-wrap;
            line-height: 1.5;
        }
        .review {
            border-left: 4px solid #8957e5;
            background-color: var(--vscode-editor-background);
            padding: 12px;
            margin-bottom: 12px;
            border-radius: 4px;
        }
        .review-approved {
            border-left-color: #3fb950;
        }
        .review-changes-requested {
            border-left-color: #f85149;
        }
        textarea {
            width: 100%;
            min-height: 100px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            padding: 8px;
            font-family: var(--vscode-font-family);
            font-size: 13px;
            resize: vertical;
        }
        .button-group {
            display: flex;
            gap: 8px;
            margin-top: 12px;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 14px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        button.danger {
            background-color: #f85149;
            color: white;
        }
        button.success {
            background-color: #3fb950;
            color: white;
        }
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin: 16px 0;
        }
        .info-item {
            background-color: var(--vscode-textBlockQuote-background);
            padding: 12px;
            border-radius: 4px;
        }
        .info-label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 4px;
        }
        .info-value {
            font-size: 14px;
            font-weight: 500;
        }
        .actions {
            display: flex;
            gap: 8px;
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid var(--vscode-panel-border);
        }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <span class="state-badge">${stateIcon} ${stateText}</span>
            ${pr.draft ? '<span class="state-badge" style="background-color: #6e7681;">Draft</span>' : ''}
        </div>
        <h1 class="title">#${pr.number}: ${pr.title}</h1>
        <div class="metadata">
            <strong>${pr.user?.login || 'Unknown'}</strong> wants to merge 
            <strong>${pr.head?.ref || 'unknown'}</strong> into 
            <strong>${pr.base?.ref || 'unknown'}</strong>
            • Created ${new Date(pr.created_at).toLocaleString()}
        </div>
    </div>

    <div class="info-grid">
        <div class="info-item">
            <div class="info-label">Commits</div>
            <div class="info-value">${pr.commits || 0}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Changed Files</div>
            <div class="info-value">${pr.changed_files || 0}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Additions</div>
            <div class="info-value" style="color: #3fb950;">+${pr.additions || 0}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Deletions</div>
            <div class="info-value" style="color: #f85149;">-${pr.deletions || 0}</div>
        </div>
    </div>

    ${pr.body ? `
    <div class="section">
        <div class="section-title">Description</div>
        <div class="description">${this.escapeHtml(pr.body)}</div>
    </div>
    ` : ''}

    ${reviews && reviews.length > 0 ? `
    <div class="section">
        <div class="section-title">Reviews (${reviews.length})</div>
        ${reviews.map(review => `
            <div class="review review-${review.state?.toLowerCase()}">
                <div class="comment-header">
                    <span class="comment-author">${review.user?.login || 'Unknown'}</span>
                    <span class="comment-date">${new Date(review.submitted_at).toLocaleString()}</span>
                </div>
                <div><strong>${review.state || 'COMMENTED'}</strong></div>
                ${review.body ? `<div class="comment-body">${this.escapeHtml(review.body)}</div>` : ''}
            </div>
        `).join('')}
    </div>
    ` : ''}

    <div class="section">
        <div class="section-title">Comments (${comments?.length || 0})</div>
        ${comments && comments.length > 0 ? comments.map(comment => `
            <div class="comment">
                <div class="comment-header">
                    <span class="comment-author">${comment.user?.login || 'Unknown'}</span>
                    <span class="comment-date">${new Date(comment.created_at).toLocaleString()}</span>
                </div>
                <div class="comment-body">${this.escapeHtml(comment.body || '')}</div>
            </div>
        `).join('') : '<p>No comments yet.</p>'}
        
        <div style="margin-top: 16px;">
            <textarea id="commentBody" placeholder="Leave a comment..."></textarea>
            <div class="button-group">
                <button onclick="addComment()">Add Comment</button>
            </div>
        </div>
    </div>

    ${pr.state === 'open' ? `
    <div class="section">
        <div class="section-title">Review Actions</div>
        <textarea id="reviewBody" placeholder="Leave a review comment (optional)..."></textarea>
        <div class="button-group">
            <button class="success" onclick="submitReview('APPROVED')">✓ Approve</button>
            <button onclick="submitReview('COMMENT')">Comment</button>
            <button class="danger" onclick="submitReview('REQUEST_CHANGES')">Request Changes</button>
        </div>
    </div>

    <div class="actions">
        ${pr.mergeable ? `
            <button class="success" onclick="mergePR('merge')">Merge Pull Request</button>
            <button class="secondary" onclick="mergePR('squash')">Squash and Merge</button>
            <button class="secondary" onclick="mergePR('rebase')">Rebase and Merge</button>
        ` : '<p style="color: var(--vscode-errorForeground);">This PR has conflicts and cannot be merged.</p>'}
        <button class="danger" onclick="closePR()">Close PR</button>
        <button class="secondary" onclick="createBranch()">Create Branch</button>
        <button class="secondary" onclick="openInBrowser()">Open in Browser</button>
    </div>
    ` : `
    <div class="actions">
        <button class="secondary" onclick="createBranch()">Create Branch</button>
        <button class="secondary" onclick="openInBrowser()">Open in Browser</button>
    </div>
    `}

    <script>
        const vscode = acquireVsCodeApi();

        function addComment() {
            const body = document.getElementById('commentBody').value.trim();
            if (!body) {
                return;
            }
            vscode.postMessage({ command: 'addComment', body });
            document.getElementById('commentBody').value = '';
        }

        function submitReview(event) {
            const body = document.getElementById('reviewBody').value.trim();
            vscode.postMessage({ command: 'addReview', body, event });
            document.getElementById('reviewBody').value = '';
        }

        function mergePR(mergeMethod) {
            showConfirmation('Merge Pull Request', 'Are you sure you want to merge this pull request?', () => {
                vscode.postMessage({ command: 'mergePR', mergeMethod });
            });
        }

        function closePR() {
            showConfirmation('Close Pull Request', 'Are you sure you want to close this pull request?', () => {
                vscode.postMessage({ command: 'closePR' });
            });
        }

        function createBranch() {
            vscode.postMessage({ command: 'createBranch' });
        }

        function showConfirmation(title, message, onConfirm) {
            const modal = document.createElement('div');
            modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;';
            
            const dialog = document.createElement('div');
            dialog.style.cssText = 'background:var(--vscode-editor-background);border:1px solid var(--vscode-panel-border);border-radius:6px;padding:20px;max-width:400px;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
            
            dialog.innerHTML = \`
                <div style="font-size:16px;font-weight:600;margin-bottom:12px;color:var(--vscode-foreground);">\${title}</div>
                <div style="font-size:14px;margin-bottom:20px;color:var(--vscode-descriptionForeground);">\${message}</div>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button onclick="this.parentElement.parentElement.parentElement.remove();" style="background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:13px;">Cancel</button>
                    <button id="confirmBtn" style="background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:13px;font-weight:500;">Confirm</button>
                </div>
            \`;
            
            modal.appendChild(dialog);
            document.body.appendChild(modal);
            
            document.getElementById('confirmBtn').onclick = () => {
                modal.remove();
                onConfirm();
            };
        }

        function openInBrowser() {
            vscode.postMessage({ command: 'openInBrowser' });
        }
    </script>
</body>
</html>`;
    }

    escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

class IssueWebviewProvider {
    constructor(auth) {
        this.auth = auth;
        this._panels = new Map();
    }

    async showIssue(issueNumber, repository) {
        try {
            const panelKey = `${repository}#${issueNumber}`;

            if (this._panels.has(panelKey)) {
                const panel = this._panels.get(panelKey);
                panel.reveal(vscode.ViewColumn.One);
                return;
            }

            const [owner, repo] = repository.split('/');
            let issueDetails, comments;

            try {
                [issueDetails, comments] = await Promise.all([
                    this.auth.makeRequest(`/api/v1/repos/${owner}/${repo}/issues/${issueNumber}`),
                    this.auth.makeRequest(`/api/v1/repos/${owner}/${repo}/issues/${issueNumber}/comments`)
                ]);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to load Issue #${issueNumber}: ${error.message}`);
                return;
            }

            const panel = vscode.window.createWebviewPanel(
                'giteaIssue',
                `Issue #${issueNumber}: ${issueDetails.title}`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            this._panels.set(panelKey, panel);

            panel.onDidDispose(() => {
                this._panels.delete(panelKey);
            });

            panel.webview.onDidReceiveMessage(
                async message => {
                    try {
                        switch (message.command) {
                            case 'addComment':
                                await this.addComment(owner, repo, issueNumber, message.body);
                                break;
                            case 'closeIssue':
                                await this.closeIssue(owner, repo, issueNumber);
                                panel.dispose();
                                break;
                            case 'reopenIssue':
                                await this.reopenIssue(owner, repo, issueNumber);
                                panel.dispose();
                                break;
                            case 'createBranch':
                                vscode.commands.executeCommand('gitea.createBranchFromIssue', {
                                    metadata: { repository: `${owner}/${repo}`, number: issueNumber }
                                });
                                break;
                            case 'openInBrowser':
                                vscode.env.openExternal(vscode.Uri.parse(issueDetails.html_url));
                                break;
                        }
                    } catch (error) {
                        console.error('Error handling webview message:', error);
                        vscode.window.showErrorMessage(`Error: ${error.message}`);
                    }
                }
            );

            panel.webview.html = this.getIssueHtml(panel.webview, issueDetails, comments);
        } catch (error) {
            console.error('Failed to show issue:', error);
            vscode.window.showErrorMessage(`Failed to show issue: ${error.message}`);
        }
    }

    async addComment(owner, repo, issueNumber, body) {
        try {
            await this.auth.makeRequest(`/api/v1/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
                method: 'POST',
                body: { body }
            });
            vscode.window.showInformationMessage('Comment added successfully');
            await this.showIssue(issueNumber, `${owner}/${repo}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to add comment: ${error.message}`);
        }
    }

    async closeIssue(owner, repo, issueNumber) {
        try {
            await this.auth.makeRequest(`/api/v1/repos/${owner}/${repo}/issues/${issueNumber}`, {
                method: 'PATCH',
                body: { state: 'closed' }
            });
            vscode.window.showInformationMessage(`Issue #${issueNumber} closed successfully`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to close issue: ${error.message}`);
        }
    }

    async reopenIssue(owner, repo, issueNumber) {
        try {
            await this.auth.makeRequest(`/api/v1/repos/${owner}/${repo}/issues/${issueNumber}`, {
                method: 'PATCH',
                body: { state: 'open' }
            });
            vscode.window.showInformationMessage(`Issue #${issueNumber} reopened successfully`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to reopen issue: ${error.message}`);
        }
    }

    getIssueHtml(webview, issue, comments) {
        const stateColor = issue.state === 'open' ? '#3fb950' : '#8957e5';
        const stateIcon = issue.state === 'open' ? '●' : '✓';
        const stateText = issue.state === 'open' ? 'Open' : 'Closed';

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }
        .header {
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 16px;
            margin-bottom: 20px;
        }
        .title {
            font-size: 24px;
            font-weight: 600;
            margin: 8px 0;
        }
        .state-badge {
            display: inline-flex;
            align-items: center;
            padding: 4px 12px;
            border-radius: 16px;
            font-size: 14px;
            font-weight: 500;
            background-color: ${stateColor};
            color: white;
            margin-right: 8px;
        }
        .metadata {
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
            margin-top: 8px;
        }
        .section {
            margin: 24px 0;
        }
        .section-title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 8px;
        }
        .description {
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-textBlockQuote-border);
            padding: 12px 16px;
            margin: 12px 0;
            white-space: pre-wrap;
        }
        .comment {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 12px;
        }
        .comment-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 13px;
        }
        .comment-author {
            font-weight: 600;
            color: var(--vscode-textLink-foreground);
        }
        .comment-date {
            color: var(--vscode-descriptionForeground);
        }
        .comment-body {
            white-space: pre-wrap;
            line-height: 1.5;
        }
        .labels {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
            margin: 12px 0;
        }
        .label {
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
        }
        textarea {
            width: 100%;
            min-height: 100px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            padding: 8px;
            font-family: var(--vscode-font-family);
            font-size: 13px;
            resize: vertical;
        }
        .button-group {
            display: flex;
            gap: 8px;
            margin-top: 12px;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 14px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        button.danger {
            background-color: #f85149;
            color: white;
        }
        button.success {
            background-color: #3fb950;
            color: white;
        }
        .actions {
            display: flex;
            gap: 8px;
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid var(--vscode-panel-border);
        }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <span class="state-badge">${stateIcon} ${stateText}</span>
        </div>
        <h1 class="title">#${issue.number}: ${issue.title}</h1>
        <div class="metadata">
            <strong>${issue.user?.login || 'Unknown'}</strong> opened this issue 
            ${new Date(issue.created_at).toLocaleString()}
            ${issue.comments ? ` • ${issue.comments} comment${issue.comments !== 1 ? 's' : ''}` : ''}
        </div>
        ${issue.labels && issue.labels.length > 0 ? `
        <div class="labels">
            ${issue.labels.map(label => `
                <span class="label" style="background-color: #${label.color}; color: ${this.getContrastColor(label.color)};">
                    ${label.name}
                </span>
            `).join('')}
        </div>
        ` : ''}
    </div>

    ${issue.body ? `
    <div class="section">
        <div class="section-title">Description</div>
        <div class="description">${this.escapeHtml(issue.body)}</div>
    </div>
    ` : ''}

    <div class="section">
        <div class="section-title">Comments (${comments?.length || 0})</div>
        ${comments && comments.length > 0 ? comments.map(comment => `
            <div class="comment">
                <div class="comment-header">
                    <span class="comment-author">${comment.user?.login || 'Unknown'}</span>
                    <span class="comment-date">${new Date(comment.created_at).toLocaleString()}</span>
                </div>
                <div class="comment-body">${this.escapeHtml(comment.body || '')}</div>
            </div>
        `).join('') : '<p>No comments yet.</p>'}
        
        <div style="margin-top: 16px;">
            <textarea id="commentBody" placeholder="Leave a comment..."></textarea>
            <div class="button-group">
                <button onclick="addComment()">Add Comment</button>
            </div>
        </div>
    </div>

    <div class="actions">
        ${issue.state === 'open'
                ? '<button class="danger" onclick="closeIssue()">Close Issue</button>'
                : '<button class="success" onclick="reopenIssue()">Reopen Issue</button>'
            }
        <button class="secondary" onclick="createBranch()">Create Branch</button>
        <button class="secondary" onclick="openInBrowser()">Open in Browser</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function addComment() {
            const body = document.getElementById('commentBody').value.trim();
            if (!body) {
                return;
            }
            vscode.postMessage({ command: 'addComment', body });
            document.getElementById('commentBody').value = '';
        }

        function closeIssue() {
            showConfirmation('Close Issue', 'Are you sure you want to close this issue?', () => {
                vscode.postMessage({ command: 'closeIssue' });
            });
        }

        function reopenIssue() {
            vscode.postMessage({ command: 'reopenIssue' });
        }

        function createBranch() {
            vscode.postMessage({ command: 'createBranch' });
        }

        function showConfirmation(title, message, onConfirm) {
            const modal = document.createElement('div');
            modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;';
            
            const dialog = document.createElement('div');
            dialog.style.cssText = 'background:var(--vscode-editor-background);border:1px solid var(--vscode-panel-border);border-radius:6px;padding:20px;max-width:400px;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
            
            dialog.innerHTML = \`
                <div style="font-size:16px;font-weight:600;margin-bottom:12px;color:var(--vscode-foreground);">\${title}</div>
                <div style="font-size:14px;margin-bottom:20px;color:var(--vscode-descriptionForeground);">\${message}</div>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button onclick="this.parentElement.parentElement.parentElement.remove();" style="background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:13px;">Cancel</button>
                    <button id="confirmBtn" style="background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:13px;font-weight:500;">Confirm</button>
                </div>
            \`;
            
            modal.appendChild(dialog);
            document.body.appendChild(modal);
            
            document.getElementById('confirmBtn').onclick = () => {
                modal.remove();
                onConfirm();
            };
        }

        function openInBrowser() {
            vscode.postMessage({ command: 'openInBrowser' });
        }
    </script>
</body>
</html>`;
    }

    escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    getContrastColor(hexColor) {
        try {
            if (!hexColor) return '#000000';
            const hex = hexColor.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            if (isNaN(r) || isNaN(g) || isNaN(b)) return '#000000';
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            return brightness > 155 ? '#000000' : '#ffffff';
        } catch (error) {
            console.error('Failed to calculate contrast color:', error);
            return '#000000';
        }
    }

    async showCreateIssue(repositories) {
        try {
            const panel = vscode.window.createWebviewPanel(
                'giteaCreateIssue',
                'Create New Issue',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            panel.webview.onDidReceiveMessage(async message => {
                try {
                    switch (message.command) {
                        case 'loadBranches':
                            const branches = await this.loadBranches(message.repository);
                            panel.webview.postMessage({ command: 'branchesLoaded', branches });
                            break;
                        case 'createIssue':
                            await this.createIssue(message.data);
                            panel.dispose();
                            break;
                    }
                } catch (error) {
                    console.error('Error handling webview message:', error);
                    vscode.window.showErrorMessage(`Error: ${error.message}`);
                }
            });

            panel.webview.html = this.getCreateIssueHtml(panel.webview, repositories);
        } catch (error) {
            console.error('Failed to show create issue form:', error);
            vscode.window.showErrorMessage(`Failed to show create issue form: ${error.message}`);
        }
    }

    async loadBranches(repository) {
        try {
            const [owner, repo] = repository.split('/');
            const branches = await this.auth.makeRequest(`/api/v1/repos/${owner}/${repo}/branches`);
            return branches.map(b => b.name);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load branches: ${error.message}`);
            return [];
        }
    }

    async createIssue(data) {
        try {
            const [owner, repo] = data.repository.split('/');

            const requestBody = {
                title: data.title,
                body: data.body || '',
                labels: data.labels ? data.labels.split(',').map(l => l.trim()).filter(Boolean) : []
            };

            // Add branch reference if specified
            if (data.branch) {
                requestBody.ref = data.branch;
            }

            const result = await this.auth.makeRequest(`/api/v1/repos/${owner}/${repo}/issues`, {
                method: 'POST',
                body: requestBody
            });
            vscode.window.showInformationMessage(`Issue #${result.number} created successfully!`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create issue: ${error.message}`);
        }
    }

    getCreateIssueHtml(webview, repositories) {
        const repoOptions = repositories.map(repo =>
            `<option value="${repo.full_name}">${repo.full_name}</option>`
        ).join('');

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            font-weight: 600;
            margin-bottom: 6px;
            font-size: 14px;
        }
        input, select, textarea {
            width: 100%;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            padding: 8px;
            font-family: var(--vscode-font-family);
            font-size: 13px;
            box-sizing: border-box;
        }
        textarea {
            min-height: 150px;
            resize: vertical;
        }
        .hint {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }
        .button-group {
            display: flex;
            gap: 8px;
            margin-top: 24px;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        h1 {
            font-size: 24px;
            margin-top: 0;
            margin-bottom: 24px;
        }
    </style>
</head>
<body>
    <h1>Create New Issue</h1>
    <form id="issueForm">
        <div class="form-group">
            <label for="repository">Repository *</label>
            <select id="repository" required>
                <option value="">Select a repository...</option>
                ${repoOptions}
            </select>
        </div>
        
        <div class="form-group">
            <label for="title">Title *</label>
            <input type="text" id="title" placeholder="Brief description of the issue" required>
        </div>
        
        <div class="form-group">
            <label for="body">Description</label>
            <textarea id="body" placeholder="Provide more details about the issue..."></textarea>
            <div class="hint">Supports Markdown formatting</div>
        </div>
        
        <div class="form-group">
            <label for="labels">Labels</label>
            <input type="text" id="labels" placeholder="bug, enhancement, documentation">
            <div class="hint">Comma-separated list of labels</div>
        </div>
        
        <div class="form-group">
            <label for="branch">Branch</label>
            <select id="branch">
                <option value="">Select a branch...</option>
            </select>
            <div class="hint">Optional: tag this issue with a specific branch</div>
        </div>
        
        <div class="button-group">
            <button type="submit">Create Issue</button>
            <button type="button" class="secondary" onclick="window.close()">Cancel</button>
        </div>
    </form>

    <script>
        const vscode = acquireVsCodeApi();
        
        document.getElementById('repository').addEventListener('change', async (e) => {
            const repository = e.target.value;
            if (repository) {
                vscode.postMessage({ command: 'loadBranches', repository });
            }
        });
        
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'branchesLoaded') {
                const branchSelect = document.getElementById('branch');
                branchSelect.innerHTML = '<option value="">Select a branch...</option>';
                
                message.branches.forEach(branch => {
                    branchSelect.innerHTML += \`<option value="\${branch}">\${branch}</option>\`;
                });
                
                // Auto-select 'main' or 'master' if available
                const defaultBranches = ['main', 'master'];
                for (const defaultBranch of defaultBranches) {
                    if (message.branches.includes(defaultBranch)) {
                        branchSelect.value = defaultBranch;
                        break;
                    }
                }
            }
        });
        
        document.getElementById('issueForm').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const repository = document.getElementById('repository').value;
            const title = document.getElementById('title').value;
            const body = document.getElementById('body').value;
            const labels = document.getElementById('labels').value;
            const branch = document.getElementById('branch').value;
            
            if (!repository || !title) {
                return;
            }
            
            vscode.postMessage({
                command: 'createIssue',
                data: { repository, title, body, labels, branch }
            });
        });
    </script>
</body>
</html>`;
    }
}

class PullRequestCreationProvider {
    constructor(auth) {
        this.auth = auth;
    }

    async showCreatePullRequest(repositories) {
        try {
            const panel = vscode.window.createWebviewPanel(
                'giteaCreatePR',
                'Create New Pull Request',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            panel.webview.onDidReceiveMessage(async message => {
                try {
                    switch (message.command) {
                        case 'loadBranches':
                            const branches = await this.loadBranches(message.repository);
                            panel.webview.postMessage({ command: 'branchesLoaded', branches });
                            break;
                        case 'createPR':
                            await this.createPullRequest(message.data);
                            panel.dispose();
                            break;
                    }
                } catch (error) {
                    console.error('Error handling webview message:', error);
                    vscode.window.showErrorMessage(`Error: ${error.message}`);
                }
            });

            panel.webview.html = this.getCreatePRHtml(panel.webview, repositories);
        } catch (error) {
            console.error('Failed to show create pull request form:', error);
            vscode.window.showErrorMessage(`Failed to show create pull request form: ${error.message}`);
        }
    }

    async loadBranches(repository) {
        try {
            const [owner, repo] = repository.split('/');
            const branches = await this.auth.makeRequest(`/api/v1/repos/${owner}/${repo}/branches`);
            return branches.map(b => b.name);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load branches: ${error.message}`);
            return [];
        }
    }

    async createPullRequest(data) {
        try {
            const [owner, repo] = data.repository.split('/');
            const result = await this.auth.makeRequest(`/api/v1/repos/${owner}/${repo}/pulls`, {
                method: 'POST',
                body: {
                    title: data.title,
                    body: data.body,
                    head: data.head,
                    base: data.base,
                    assignees: data.assignees ? data.assignees.split(',').map(a => a.trim()).filter(Boolean) : []
                }
            });
            vscode.window.showInformationMessage(`Pull Request #${result.number} created successfully!`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create pull request: ${error.message}`);
        }
    }

    getCreatePRHtml(webview, repositories) {
        const repoOptions = repositories.map(repo =>
            `<option value="${repo.full_name}">${repo.full_name}</option>`
        ).join('');

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            font-weight: 600;
            margin-bottom: 6px;
            font-size: 14px;
        }
        input, select, textarea {
            width: 100%;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            padding: 8px;
            font-family: var(--vscode-font-family);
            font-size: 13px;
            box-sizing: border-box;
        }
        textarea {
            min-height: 150px;
            resize: vertical;
        }
        .hint {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }
        .button-group {
            display: flex;
            gap: 8px;
            margin-top: 24px;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        h1 {
            font-size: 24px;
            margin-top: 0;
            margin-bottom: 24px;
        }
        .branch-selector {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            gap: 12px;
            align-items: center;
        }
        .arrow {
            font-size: 20px;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <h1>Create New Pull Request</h1>
    <form id="prForm">
        <div class="form-group">
            <label for="repository">Repository *</label>
            <select id="repository" required>
                <option value="">Select a repository...</option>
                ${repoOptions}
            </select>
        </div>
        
        <div class="form-group">
            <label>Branches *</label>
            <div class="branch-selector">
                <div>
                    <select id="base" required>
                        <option value="">Base branch...</option>
                    </select>
                    <div class="hint">Target branch</div>
                </div>
                <div class="arrow">←</div>
                <div>
                    <select id="head" required>
                        <option value="">Compare branch...</option>
                    </select>
                    <div class="hint">Your changes</div>
                </div>
            </div>
        </div>
        
        <div class="form-group">
            <label for="title">Title *</label>
            <input type="text" id="title" placeholder="Brief description of the changes" required>
        </div>
        
        <div class="form-group">
            <label for="body">Description</label>
            <textarea id="body" placeholder="Describe the changes in detail..."></textarea>
            <div class="hint">Supports Markdown formatting</div>
        </div>
        
        <div class="form-group">
            <label for="assignees">Assignees</label>
            <input type="text" id="assignees" placeholder="username1, username2">
            <div class="hint">Comma-separated list of usernames</div>
        </div>
        
        <div class="button-group">
            <button type="submit">Create Pull Request</button>
            <button type="button" class="secondary" onclick="window.close()">Cancel</button>
        </div>
    </form>

    <script>
        const vscode = acquireVsCodeApi();
        
        document.getElementById('repository').addEventListener('change', async (e) => {
            const repository = e.target.value;
            if (repository) {
                vscode.postMessage({ command: 'loadBranches', repository });
            }
        });
        
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'branchesLoaded') {
                const baseSelect = document.getElementById('base');
                const headSelect = document.getElementById('head');
                
                baseSelect.innerHTML = '<option value="">Base branch...</option>';
                headSelect.innerHTML = '<option value="">Compare branch...</option>';
                
                message.branches.forEach(branch => {
                    baseSelect.innerHTML += \`<option value="\${branch}">\${branch}</option>\`;
                    headSelect.innerHTML += \`<option value="\${branch}">\${branch}</option>\`;
                });
                
                // Auto-select 'main' or 'master' as base if available
                const defaultBases = ['main', 'master'];
                for (const defaultBase of defaultBases) {
                    if (message.branches.includes(defaultBase)) {
                        baseSelect.value = defaultBase;
                        break;
                    }
                }
            }
        });
        
        function showMessage(message) {
            const modal = document.createElement('div');
            modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;';
            
            const dialog = document.createElement('div');
            dialog.style.cssText = 'background:var(--vscode-editor-background);border:1px solid var(--vscode-panel-border);border-radius:6px;padding:20px;max-width:400px;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
            
            dialog.innerHTML = \`
                <div style="font-size:16px;font-weight:600;margin-bottom:12px;color:var(--vscode-foreground);">Message</div>
                <div style="font-size:14px;margin-bottom:20px;color:var(--vscode-descriptionForeground);">\${message}</div>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button style="background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:13px;font-weight:500;" onclick="this.parentElement.parentElement.parentElement.remove();">OK</button>
                </div>
            \`;
            
            modal.appendChild(dialog);
            document.body.appendChild(modal);
        }
        
        document.getElementById('prForm').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const repository = document.getElementById('repository').value;
            const base = document.getElementById('base').value;
            const head = document.getElementById('head').value;
            const title = document.getElementById('title').value;
            const body = document.getElementById('body').value;
            const assignees = document.getElementById('assignees').value;
            
            if (!repository || !base || !head || !title) {
                return;
            }
            
            if (base === head) {
                showMessage('Base and head branches must be different');
                return;
            }
            
            vscode.postMessage({
                command: 'createPR',
                data: { repository, base, head, title, body, assignees }
            });
        });
    </script>
</body>
</html>`;
    }
}

module.exports = {
    PullRequestWebviewProvider,
    IssueWebviewProvider,
    PullRequestCreationProvider
};
