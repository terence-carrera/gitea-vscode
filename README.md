## Gitea Extension for VS Code

Integrate Gitea into VS Code: browse repositories, track issues and pull requests, search across your projects, receive notifications, and jump to items in your browser — all from the Activity Bar.

### Features

- **Branch Deletion Tracking & Restoration**: Comprehensive branch management with deletion history, visual diff previews, and automatic sync
  - Track deleted branches across sessions with persistent storage
  - Restore deleted branches from extension history or Git reflog
  - Preview file changes before restoration with interactive diff viewer
  - Export/import deletion history as JSON for portability
  - Automatic sync across machines via VS Code Settings Sync
  - Deleted Branches view with repository grouping and timestamps
  - Configurable retention period (1-365 days) for automatic cleanup
- Repositories view: lists only repositories present in your workspace (detected via local Git remotes).
- Issues view: grouped by Repository → State (Open/Closed) → Items, with quick open-in-browser.
- Pull Requests view: grouped by Repository → State (Open/WIP/Closed) → Items, with draft/WIP detection.
- Search: repository, issue, and PR search with flat result lists per view.
- WebView details: rich detail panels for Issues and Pull Requests with inline commenting and actions.
- WebView creation: rich forms for creating issues and pull requests with repository selection, branch picker, labels, and assignees.
- Reviews: approve, comment, or request changes on pull requests directly from VS Code.
- Merge PRs: merge, squash, or rebase pull requests with confirmation.
- Close/reopen: close or reopen issues and pull requests.
- Notifications: optional polling to surface repository activity inside VS Code.
- Notification alerts: quick actions to open issues/PRs in VS Code, open in browser, or copy commit SHAs directly from toasts.
- Performance-aware: caches read-only API responses, throttles refresh bursts, and defers notification polling to reduce startup cost and API load.
- PR commits view: see all commits in a pull request with SHA, message, author, and timestamp.
- Conflict detection: displays specific conflicting files when merge conflicts are detected in a PR.
- Out-of-date PR alerts: notifies when a PR branch is behind the base branch with quick update action.
- Create actions: create Repository, Issue, and Pull Request from the views.
- Open actions: open repository/issue/pull request in your default browser.
- Clone and open: clone a remote repo and open it in a new window if not already present.

### Getting Started

1. Open VS Code in a folder containing one or more Git repositories.
2. Configure your Gitea instance and token via command palette:
   - Run `Gitea: Configure Instance`.
   - Provide `gitea.instanceUrl`, Personal Access Token and an Alias/Name for your Profile.
3. Open the Gitea Activity Bar icon to explore Repositories, Issues, and Pull Requests.

### Views Overview

- Repositories: shows only repos whose `.git/config` remote matches your Gitea instance.
- Issues: repository groups → `Open` and `Closed` sections → individual issues.
- Pull Requests: repository groups → `Open`, `Work-in-Progress`, and `Closed` sections.

Notes

- WIP detection uses `draft` flag or common title prefixes (wip, [wip], work in progress, draft).
- Searches return flat lists for quick navigation; clear search to return to grouped view.

### Commands

- Gitea: Configure Instance (`gitea.configure`): set instance URL and token.
- Gitea: Search Repositories (`gitea.searchRepositories`)
- Gitea: Search Issues (`gitea.searchIssues`)
- Gitea: Search Pull Requests (`gitea.searchPullRequests`)
- Refresh Repositories (`gitea.refreshRepositories`): refresh current view data.
- Gitea: Toggle Notifications (`gitea.toggleNotifications`)
- Gitea: Check Notification Status (`gitea.notificationStatus`)
- Gitea: Create Repository (`gitea.createRepository`)
- Gitea: Create Issue (`gitea.createIssue`)
- Gitea: Create Pull Request (`gitea.createPullRequest`)
- Open Repository in VS Code (`gitea.openRepository`)
- Open in Browser (`gitea.openInBrowser`)
- Open Issue in Browser (`gitea.openIssueInBrowser`)
- Open Pull Request in Browser (`gitea.openPullRequestInBrowser`)
- View Issue Details (`gitea.viewIssueDetails`): open rich detail panel with comments and actions.
- View Pull Request Details (`gitea.viewPullRequestDetails`): open rich detail panel with reviews, comments, and merge actions.

### Settings

- `gitea.instanceUrl`: Your Gitea instance URL (e.g., <https://gitea.example.com>).
- `gitea.authToken`: Personal Access Token for Gitea API authentication.
- `gitea.enableNotifications`: Enable notifications for repository activities.
- `gitea.notificationPollInterval`: Poll interval for notifications in ms (minimum 30000).
- `gitea.defaultRepoStartingPath`: Default local path for cloning new repositories.
- `gitea.profiles`: Configure multiple Gitea profiles with instance URL, token, and alias.
- `gitea.activeProfile`: Set the active profile by its alias/name.

### Performance behavior

- GET requests are cached for 5 minutes to reduce duplicate API calls; caches clear automatically when you switch or add profiles.
- Refresh commands are throttled to prevent rapid bursts of network requests.
- Notification polling initializes lazily and starts after a short delay to keep extension activation snappy.

### Requirements

- VS Code 1.90.0 or newer.
- Git installed.
- Access to a Gitea instance and a Personal Access Token.

### Known Issues

- This extension is in active development; features and APIs may change.

### Contributing

Contributions are welcome! Whether you're fixing bugs, adding features, or improving documentation, your help is appreciated.

#### How to Contribute

1. **Fork the repository** on Gitea or GitHub.
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/terence-carrera/gitea-vscode.git
   cd gitea-vscode
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
5. **Make your changes** and test thoroughly.
6. **Commit your changes** with clear, descriptive messages:
   ```bash
   git commit -m "Add feature: description of your changes"
   ```
7. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```
8. **Submit a pull request** with a clear description of the changes and any related issues.

#### Development

- Run the extension in debug mode by pressing `F5` in VS Code.
- Make sure to test your changes with a real Gitea instance.
- Follow existing code style and patterns.
- Update documentation as needed.

#### Reporting Issues

If you encounter bugs or have feature requests, please [open an issue](https://github.com/terence-carrera/gitea-vscode/issues) with:
- A clear description of the problem or suggestion
- Steps to reproduce (for bugs)
- Your environment (VS Code version, OS, Gitea version)

### Release Notes

See [CHANGELOG.md](CHANGELOG.md) for details.
