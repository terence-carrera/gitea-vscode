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
 * Calculate similarity score between two strings (0 to 1)
 * Uses simple character overlap algorithm
 */
function calculateStringSimilarity(str1, str2) {
    const s1 = String(str1 || '').toLowerCase();
    const s2 = String(str2 || '').toLowerCase();
    
    if (s1 === s2) return 1;
    if (s1.length === 0 || s2.length === 0) return 0;
    
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    const editDistance = getLevenshteinDistance(shorter, longer);
    return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function getLevenshteinDistance(s1, s2) {
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i === 0) {
                costs[j] = j;
            } else if (j > 0) {
                let newValue = costs[j - 1];
                if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                    newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                }
                costs[j - 1] = lastValue;
                lastValue = newValue;
            }
        }
        if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
}

/**
 * Fetch all issues from a repository with pagination
 * @param {Object} auth - Auth object for API calls
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} pageSize - Issues per page (default 50)
 * @returns {Promise<Array>} Array of all issues in the repository
 */
async function fetchAllIssues(auth, owner, repo, pageSize = 50) {
    const allIssues = [];
    let page = 1;
    let hasMore = true;

    try {
        while (hasMore) {
            const issues = await auth.makeRequest(
                `/api/v1/repos/${owner}/${repo}/issues?state=all&limit=${pageSize}&page=${page}`
            );

            if (!Array.isArray(issues) || issues.length === 0) {
                hasMore = false;
            } else {
                // Filter out pull requests
                issues.forEach(issue => {
                    if (!issue.pull_request) {
                        allIssues.push(issue);
                    }
                });

                // If we got less than pageSize, we've reached the end
                if (issues.length < pageSize) {
                    hasMore = false;
                } else {
                    page++;
                }
            }
        }

        console.log(`[DEBUG] Fetched ${allIssues.length} existing issues for duplicate detection`);
        return allIssues;
    } catch (error) {
        console.error('Error fetching all issues:', error);
        throw new Error(`Failed to fetch existing issues for duplicate detection: ${error.message}`);
    }
}

/**
 * Find potential duplicate issues based on title and description similarity
 * @param {Object} newIssue - Issue object to check
 * @param {Array} existingIssues - Pre-fetched array of existing issues
 * @param {number} threshold - Similarity threshold (0-1), default 0.7
 * @returns {Array} Array of potential duplicate issues
 */
function findDuplicateIssuesInCache(newIssue, existingIssues, threshold = 0.7) {
    if (!Array.isArray(existingIssues) || existingIssues.length === 0) {
        return [];
    }

    const duplicates = [];

    existingIssues.forEach(existingIssue => {
        // Calculate title similarity
        const titleSimilarity = calculateStringSimilarity(newIssue.title, existingIssue.title);

        // Calculate description similarity with improved handling for missing bodies
        let bodySimilarity = 0;
        if (newIssue.body && existingIssue.body) {
            // Both have bodies - compare them
            bodySimilarity = calculateStringSimilarity(newIssue.body, existingIssue.body);
        } else if (!newIssue.body && !existingIssue.body) {
            // Both have no bodies - consider them as matching on this criteria
            bodySimilarity = 1.0;
        }
        // If only one has a body, bodySimilarity remains 0

        // Calculate combined similarity (weighted: 75% title, 25% body)
        // Increased title weight since body might be missing
        const combinedScore = titleSimilarity * 0.75 + bodySimilarity * 0.25;

        if (combinedScore >= threshold) {
            duplicates.push({
                number: existingIssue.number,
                title: existingIssue.title,
                state: existingIssue.state,
                url: existingIssue.html_url,
                similarity: Math.round(combinedScore * 100),
                created_at: existingIssue.created_at,
                updated_at: existingIssue.updated_at
            });
        }
    });

    // Sort by similarity score (highest first)
    duplicates.sort((a, b) => b.similarity - a.similarity);
    return duplicates;
}

/**
 * Import issues from parsed data into Gitea
 */
async function importIssuesInternal(auth, repositoryFullName, issues, options = {}) {
    const [owner, repo] = repositoryFullName.split('/');
    const results = {
        successful: [],
        failed: [],
        skipped: 0,
        duplicates: [],
        duplicateDetectionFailed: false
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

    // Pre-fetch all existing issues for duplicate detection (optimization)
    let existingIssuesCache = [];
    if (options.checkDuplicates) {
        console.log('[DEBUG] Pre-fetching all existing issues for duplicate detection...');
        try {
            existingIssuesCache = await fetchAllIssues(auth, owner, repo);
        } catch (error) {
            // Duplicate detection failed - log error and mark as failed
            console.error('[ERROR] Duplicate detection failed:', error.message);
            results.duplicateDetectionFailed = true;
            // Continue with import but without duplicate detection
        }
    }

    for (let i = 0; i < issues.length; i++) {
        const issue = issues[i];
        try {
            // Check for duplicates if option is enabled and detection didn't fail
            if (options.checkDuplicates && !results.duplicateDetectionFailed && existingIssuesCache.length > 0) {
                const potentialDuplicates = findDuplicateIssuesInCache(
                    issue,
                    existingIssuesCache,
                    options.duplicateThreshold || 0.7
                );

                if (potentialDuplicates.length > 0) {
                    results.duplicates.push({
                        title: issue.title,
                        potentialMatches: potentialDuplicates
                    });
                    results.skipped++;
                    continue; // Skip this issue
                }
            }

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
            <div class="option">
                <input type="checkbox" id="checkDuplicates" name="checkDuplicates" checked>
                <label for="checkDuplicates">Check for duplicate issues (skip similar issues)</label>
            </div>
            <div style="margin-left: 24px; margin-top: 8px;">
                <label for="duplicateThreshold" style="font-size: 12px;">Similarity threshold:</label>
                <select id="duplicateThreshold" style="width: 100%; padding: 6px; margin-top: 4px;">
                    <option value="0.9">Very strict (90%+ match)</option>
                    <option value="0.8">Strict (80%+ match)</option>
                    <option value="0.7" selected>Normal (70%+ match)</option>
                    <option value="0.6">Loose (60%+ match)</option>
                </select>
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
        
        // Toggle duplicate threshold dropdown based on checkbox
        document.getElementById('checkDuplicates').addEventListener('change', (e) => {
            document.getElementById('duplicateThreshold').disabled = !e.target.checked;
        });
        
        function importIssues() {
            const options = {
                allowAssignee: document.getElementById('allowAssignee').checked,
                allowMilestone: document.getElementById('allowMilestone').checked,
                allowDueDate: document.getElementById('allowDueDate').checked,
                checkDuplicates: document.getElementById('checkDuplicates').checked,
                duplicateThreshold: parseFloat(document.getElementById('duplicateThreshold').value)
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
    const { successful, failed, skipped, duplicates, duplicateDetectionFailed } = results;

    if (successful.length === 0 && failed.length === 0 && (skipped || 0) === 0) {
        vscode.window.showWarningMessage('No issues were imported');
        return;
    }

    const successMsg = successful.length > 0
        ? `✓ Successfully imported ${successful.length} issue${successful.length !== 1 ? 's' : ''}`
        : '';

    const failMsg = failed.length > 0
        ? `✗ Failed to import ${failed.length} issue${failed.length !== 1 ? 's' : ''}`
        : '';

    const skipMsg = (skipped || 0) > 0
        ? `⊘ Skipped ${skipped} potential duplicate${skipped !== 1 ? 's' : ''}`
        : '';

    const warningMsg = duplicateDetectionFailed
        ? `⚠ Duplicate detection failed - issues may have been imported without duplicate checking`
        : '';

    const message = [successMsg, failMsg, skipMsg, warningMsg].filter(m => m).join('\n');

    if (failed.length > 0 || duplicates.length > 0 || duplicateDetectionFailed) {
        const buttons = [];
        if (failed.length > 0) buttons.push('View Failures');
        if (duplicates.length > 0) buttons.push('View Duplicates');
        
        vscode.window.showWarningMessage(`Import completed!\n\n${message}`, ...buttons).then(choice => {
            if (choice === 'View Failures') {
                showFailureDetails(failed);
            } else if (choice === 'View Duplicates') {
                showDuplicateDetails(duplicates);
            }
        });
    } else {
        vscode.window.showInformationMessage(`All ${successful.length} issues imported successfully!`);
    }
}

/**
 * Show detailed duplicate information
 */
function showDuplicateDetails(duplicates) {
    const panel = vscode.window.createWebviewPanel(
        'giteaDuplicates',
        'Duplicate Issues',
        vscode.ViewColumn.One,
        {}
    );

    const duplicateRows = duplicates.map(dup => {
        const matches = dup.potentialMatches.map(match => `
            <div style="margin-top: 8px; padding: 8px; background-color: var(--vscode-editor-inlineValue-background); border-radius: 3px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 500;">
                        <a href="${match.url}" style="color: var(--vscode-textLink-foreground); text-decoration: none;">
                            #${match.number}: ${escapeHtml(match.title)}
                        </a>
                    </span>
                    <span style="background-color: var(--vscode-badge-background); color: var(--vscode-badge-foreground); padding: 2px 8px; border-radius: 12px; font-size: 12px;">
                        ${match.similarity}% match
                    </span>
                </div>
                <div style="font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 4px;">
                    State: <strong>${match.state}</strong> | Updated: ${new Date(match.updated_at).toLocaleDateString()}
                </div>
            </div>
        `).join('');

        return `
            <div style="margin-bottom: 20px; padding: 12px; background-color: var(--vscode-panel-background); border: 1px solid var(--vscode-panel-border); border-radius: 4px;">
                <h3 style="margin: 0 0 12px 0; color: var(--vscode-descriptionForeground);">
                    Your Issue:
                </h3>
                <div style="font-weight: 500; margin-bottom: 12px;">
                    ${escapeHtml(dup.title)}
                </div>
                <h3 style="margin: 12px 0 8px 0; color: var(--vscode-descriptionForeground);">
                    Potential Matches:
                </h3>
                ${matches}
            </div>
        `;
    }).join('');

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
            line-height: 1.6;
        }
        h2 {
            margin-top: 0;
            border-bottom: 1px solid var(--vscode-input-border);
            padding-bottom: 10px;
        }
        a {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        .summary {
            padding: 12px;
            background-color: var(--vscode-editor-inlineValue-background);
            border-left: 3px solid var(--vscode-notificationCenter-border);
            margin-bottom: 20px;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <h2>Duplicate Issues (${duplicates.length})</h2>
    <div class="summary">
        <strong>${duplicates.length}</strong> issue${duplicates.length !== 1 ? 's' : ''} were skipped due to similarity with existing issues.
        Consider merging or referencing the matched issues instead of creating duplicates.
    </div>
    ${duplicateRows}
</body>
</html>`;
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
    showImportIssuesDialog,
    fetchAllIssues,
    findDuplicateIssuesInCache
};
