const vscode = require('vscode');

/**
 * Parse XLSX file and extract issue data
 * Expects columns: Title, Description, Labels (optional), Assignee (optional), Milestone (optional)
 * Returns array of issue objects
 */
function parseXlsxFile(filePath) {
    try {
        // For XLSX parsing, we need to check if user has xlsx library
        // If not available, provide helpful error message
        let XLSX;
        try {
            XLSX = require('xlsx');
        } catch {
            throw new Error('xlsx module not found. Please ensure the extension is properly installed.');
        }

        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert sheet to JSON, starting from first row
        const data = XLSX.utils.sheet_to_json(worksheet);

        if (!data || data.length === 0) {
            throw new Error('No data found in XLSX file');
        }

        // Validate and transform data
        const issues = data.map((row, index) => {
            const title = row['Title'] || row['title'] || row['TITLE'];
            if (!title || title.trim() === '') {
                throw new Error(`Row ${index + 2}: Title column is required and cannot be empty`);
            }

            return {
                title: String(title).trim(),
                body: String(row['Description'] || row['description'] || row['DESCRIPTION'] || '').trim(),
                labels: parseLabels(row['Labels'] || row['labels'] || row['LABELS'] || ''),
                assignee: (row['Assignee'] || row['assignee'] || row['ASSIGNEE'] || '').trim(),
                milestone: (row['Milestone'] || row['milestone'] || row['MILESTONE'] || '').trim(),
                // Optional fields
                state: (row['State'] || row['state'] || row['STATE'] || 'open').toLowerCase(),
                priority: (row['Priority'] || row['priority'] || row['PRIORITY'] || '').trim(),
                dueDate: (row['Due Date'] || row['due_date'] || row['DUE_DATE'] || '').trim()
            };
        });

        return issues;
    } catch (error) {
        throw new Error(`Failed to parse XLSX file: ${error.message}`);
    }
}

/**
 * Parse labels string (comma or semicolon separated) into array
 */
function parseLabels(labelsStr) {
    if (!labelsStr || typeof labelsStr !== 'string') {
        return [];
    }
    return labelsStr
        .split(/[,;]/)
        .map(label => label.trim())
        .filter(label => label.length > 0);
}

/**
 * Import issues from parsed data into Gitea
 */
async function importIssuesInternal(auth, repositoryFullName, issues, options = {}) {
    const [owner, repo] = repositoryFullName.split('/');
    const results = {
        successful: [],
        failed: [],
        skipped: 0
    };

    // Fetch available labels for label name -> ID mapping
    let labelMap = {};
    try {
        const labels = await auth.makeRequest(`/api/v1/repos/${owner}/${repo}/labels`);
        if (Array.isArray(labels)) {
            labelMap = {};
            labels.forEach(label => {
                labelMap[label.name.toLowerCase()] = label.id;
            });
        }
    } catch (error) {
        console.warn('Failed to fetch labels:', error);
        // Continue without label mapping
    }

    for (let i = 0; i < issues.length; i++) {
        const issue = issues[i];
        try {
            // Map label names to IDs
            const labelIds = [];
            for (const labelName of (issue.labels || [])) {
                const labelId = labelMap[labelName.toLowerCase()];
                if (labelId) {
                    labelIds.push(labelId);
                }
                // Silently skip labels that don't exist in the repository
            }

            const requestBody = {
                title: issue.title,
                body: issue.body || '',
                labels: labelIds
            };

            // Add optional fields if provided
            if (issue.assignee && options.allowAssignee) {
                requestBody.assignee = issue.assignee;
            }
            if (issue.milestone && options.allowMilestone) {
                requestBody.milestone = issue.milestone;
            }
            if (issue.dueDate && options.allowDueDate) {
                requestBody.due_date = issue.dueDate;
            }

            const result = await auth.makeRequest(`/api/v1/repos/${owner}/${repo}/issues`, {
                method: 'POST',
                body: requestBody
            });

            results.successful.push({
                title: issue.title,
                number: result.number,
                url: result.html_url
            });
        } catch (error) {
            results.failed.push({
                title: issue.title,
                error: error.message
            });
        }
    }

    return results;
}

/**
 * Show import dialog and process file selection
 */
async function showImportIssuesDialog(auth, repositories) {
    try {
        console.log('[DEBUG] showImportIssuesDialog called with', repositories.length, 'repositories');

        // Step 1: Select XLSX file
        const fileUris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: {
                'Excel Files': ['xlsx', 'xls'],
                'All Files': ['*']
            },
            title: 'Select XLSX file to import issues'
        });

        if (!fileUris || fileUris.length === 0) {
            console.log('[DEBUG] User cancelled file selection');
            return; // User cancelled
        }

        const filePath = fileUris[0].fsPath;

        // Step 2: Select target repository
        if (!repositories || repositories.length === 0) {
            vscode.window.showErrorMessage('No repositories available to import issues into');
            return;
        }

        const repoOptions = repositories.map(repo => ({
            label: repo.full_name,
            description: repo.description || '',
            value: repo.full_name
        }));

        const selectedRepo = await vscode.window.showQuickPick(repoOptions, {
            placeHolder: 'Select repository to import issues into',
            title: 'Import Issues - Select Target Repository'
        });

        if (!selectedRepo) {
            return; // User cancelled
        }

        // Step 3: Parse XLSX file
        vscode.window.showInformationMessage('Parsing XLSX file...');
        const issues = parseXlsxFile(filePath);

        if (issues.length === 0) {
            vscode.window.showErrorMessage('No valid issues found in XLSX file');
            return;
        }

        // Step 4: Show preview and options
        const importOptions = await showImportOptionsDialog(issues);
        if (!importOptions) {
            return; // User cancelled
        }

        // Step 5: Import issues
        const progress = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Importing ${issues.length} issues...`,
            cancellable: false
        }, async () => {
            const results = await importIssuesInternal(auth, selectedRepo.value, issues, importOptions);
            return results;
        });

        // Show results
        showImportResults(progress);
    } catch (error) {
        vscode.window.showErrorMessage(`Import failed: ${error.message}`);
        console.error('Import error:', error);
    }
}

/**
 * Show dialog for import options
 */
async function showImportOptionsDialog(issues) {
    return new Promise((resolve) => {
        const panel = vscode.window.createWebviewPanel(
            'giteaImportOptions',
            'Import Issues - Options',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        const issuePreview = issues.slice(0, 3).map(issue =>
            `<tr>
                <td>${escapeHtml(issue.title)}</td>
                <td>${issue.labels.length > 0 ? issue.labels.join(', ') : '-'}</td>
                <td>${escapeHtml(issue.body.substring(0, 50))}${issue.body.length > 50 ? '...' : ''}</td>
            </tr>`
        ).join('');

        panel.webview.html = `<!DOCTYPE html>
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
        .container {
            max-width: 600px;
            margin: 0 auto;
        }
        h2 {
            margin-top: 0;
            border-bottom: 1px solid var(--vscode-input-border);
            padding-bottom: 10px;
        }
        .section {
            margin: 20px 0;
            padding: 15px;
            background-color: var(--vscode-editor-inlineValue-background);
            border-left: 3px solid var(--vscode-input-border);
            border-radius: 4px;
        }
        .section h3 {
            margin: 0 0 10px 0;
            font-size: 14px;
            font-weight: 600;
        }
        .option {
            margin: 10px 0;
            display: flex;
            align-items: center;
        }
        input[type="checkbox"] {
            margin-right: 8px;
            cursor: pointer;
        }
        label {
            cursor: pointer;
        }
        .preview {
            margin: 20px 0;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }
        th, td {
            border: 1px solid var(--vscode-input-border);
            padding: 8px;
            text-align: left;
        }
        th {
            background-color: var(--vscode-editor-lineNumberForeground);
            font-weight: 600;
        }
        .buttons {
            margin-top: 20px;
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        }
        button {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-family: var(--vscode-font-family);
            font-size: 13px;
        }
        .btn-primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .btn-primary:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .btn-secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .summary {
            font-size: 12px;
            color: var(--vscode-input-foreground);
            margin-bottom: 15px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>Import Issues - Options</h2>
        
        <div class="summary">
            Found <strong>${issues.length} issues</strong> to import
        </div>

        <div class="section">
            <h3>Import Options</h3>
            <div class="option">
                <input type="checkbox" id="allowAssignee" name="allowAssignee" checked>
                <label for="allowAssignee">Import assignees (if column present)</label>
            </div>
            <div class="option">
                <input type="checkbox" id="allowMilestone" name="allowMilestone" checked>
                <label for="allowMilestone">Import milestones (if column present)</label>
            </div>
            <div class="option">
                <input type="checkbox" id="allowDueDate" name="allowDueDate" unchecked>
                <label for="allowDueDate">Import due dates (if column present)</label>
            </div>
        </div>

        <div class="preview">
            <h3>Preview (first 3 issues)</h3>
            <table>
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Labels</th>
                        <th>Description</th>
                    </tr>
                </thead>
                <tbody>
                    ${issuePreview}
                </tbody>
            </table>
        </div>

        <div class="buttons">
            <button class="btn-secondary" onclick="cancel()">Cancel</button>
            <button class="btn-primary" onclick="importIssues()">Import Issues</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        function importIssues() {
            const options = {
                allowAssignee: document.getElementById('allowAssignee').checked,
                allowMilestone: document.getElementById('allowMilestone').checked,
                allowDueDate: document.getElementById('allowDueDate').checked
            };
            vscode.postMessage({ command: 'import', options: options });
        }
        function cancel() {
            vscode.postMessage({ command: 'cancel' });
        }
    </script>
</body>
</html>`;

        panel.webview.onDidReceiveMessage(message => {
            if (message.command === 'import') {
                resolve(message.options);
            } else {
                resolve(null);
            }
            panel.dispose();
        });

        panel.onDidDispose(() => {
            resolve(null);
        });
    });
}

/**
 * Show import results summary
 */
function showImportResults(results) {
    const { successful, failed } = results;

    if (successful.length === 0 && failed.length === 0) {
        vscode.window.showWarningMessage('No issues were imported');
        return;
    }

    const successMsg = successful.length > 0
        ? `✓ Successfully imported ${successful.length} issue${successful.length !== 1 ? 's' : ''}`
        : '';

    const failMsg = failed.length > 0
        ? `✗ Failed to import ${failed.length} issue${failed.length !== 1 ? 's' : ''}`
        : '';

    const message = [successMsg, failMsg].filter(m => m).join('\n');

    if (failed.length > 0) {
        vscode.window.showWarningMessage(`Import completed with errors!\n\n${message}`, 'View Details').then(choice => {
            if (choice === 'View Details') {
                showFailureDetails(failed);
            }
        });
    } else {
        vscode.window.showInformationMessage(`All ${successful.length} issues imported successfully!`);
    }
}

/**
 * Show detailed failure information
 */
function showFailureDetails(failedIssues) {
    const panel = vscode.window.createWebviewPanel(
        'giteaImportFailures',
        'Import Failures',
        vscode.ViewColumn.One,
        {}
    );

    const failureRows = failedIssues.map(issue => `
        <tr>
            <td>${escapeHtml(issue.title)}</td>
            <td>${escapeHtml(issue.error)}</td>
        </tr>
    `).join('');

    panel.webview.html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
        }
        h2 {
            margin-top: 0;
            border-bottom: 1px solid var(--vscode-input-border);
            padding-bottom: 10px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        th, td {
            border: 1px solid var(--vscode-input-border);
            padding: 10px;
            text-align: left;
        }
        th {
            background-color: var(--vscode-editor-lineNumberForeground);
            font-weight: 600;
        }
        .error-col {
            color: var(--vscode-diffEditor-removedTextForeground);
            font-family: monospace;
            font-size: 11px;
        }
    </style>
</head>
<body>
    <h2>Import Failures (${failedIssues.length})</h2>
    <table>
        <thead>
            <tr>
                <th>Title</th>
                <th>Error</th>
            </tr>
        </thead>
        <tbody>
            ${failureRows}
        </tbody>
    </table>
</body>
</html>`;
}

/**
 * Helper function to escape HTML special characters
 */
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

module.exports = {
    parseXlsxFile,
    importIssuesInternal,
    showImportIssuesDialog
};
