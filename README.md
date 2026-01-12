## Gitea Extension for VS Code

Integrate Gitea into VS Code: browse repositories, track issues and pull requests, search across your projects, receive notifications, and jump to items in your browser — all from the Activity Bar.

### Features

#### Issue Management

- **Import Issues from XLSX**: Bulk import issues from Excel files with automatic label mapping
  - Support for XLSX format with flexible column naming
  - Automatic label name to ID mapping (labels must exist in repository)
  - Interactive preview and configuration dialog
  - Detailed error reporting with failure summary
  - See [Import Issues Documentation](docs/IMPORT_ISSUES_FEATURE.md) for details
- **Issues View**: Grouped by Repository → State (Open/Closed) → Items, with quick open-in-browser
- **WebView Creation**: Rich forms for creating issues with repository selection, labels, and assignees
- **WebView Details**: Rich detail panels with inline commenting and actions
- **Search Issues**: Quick search with flat result lists per view

#### Pull Request Management

- **Pull Requests View**: Grouped by Repository → State (Open/WIP/Closed) → Items, with draft/WIP detection
- **WebView Creation**: Rich forms for creating pull requests with repository selection, branch picker, labels, and assignees
- **WebView Details**: Rich detail panels with reviews, comments, and merge actions
- **Reviews**: Approve, comment, or request changes on pull requests directly from VS Code
- **Merge PRs**: Merge, squash, or rebase pull requests with confirmation
- **PR Commits View**: See all commits in a pull request with SHA, message, author, and timestamp
- **Conflict Detection**: Displays specific conflicting files when merge conflicts are detected in a PR
- **Out-of-date PR Alerts**: Notifies when a PR branch is behind the base branch with quick update action
- **Search Pull Requests**: Quick search with flat result lists

#### Branch Management

- **Branch Deletion Tracking & Restoration**: Comprehensive branch management with deletion history, visual diff previews, and automatic sync
  - Track deleted branches across sessions with persistent storage
  - Restore deleted branches from extension history or Git reflog
  - Preview file changes before restoration with interactive diff viewer
  - Export/import deletion history as JSON for portability
  - Automatic sync across machines via VS Code Settings Sync
  - Deleted Branches view with repository grouping and timestamps
  - Configurable retention period (1-365 days) for automatic cleanup
- **Branch Switching**: Switch between branches in your repository with a quick picker
- **Quick Branch Creation**: Create branches directly from issues or pull requests with auto-generated names

#### Repository Management

- **Repositories View**: Lists only repositories present in your workspace (detected via local Git remotes)
- **Create Repository**: Create new repositories directly from VS Code
- **Clone and Open**: Clone a remote repo and open it in a new window if not already present
- **Search Repositories**: Quick search across your Gitea repositories
- **Open Actions**: Open repository/issue/pull request in your default browser

#### Notifications & Alerts

- **Notifications**: Optional polling to surface repository activity inside VS Code
- **Notification Alerts**: Quick actions to open issues/PRs in VS Code, open in browser, or copy commit SHAs directly from toasts
- **Performance-aware**: Caches read-only API responses, throttles refresh bursts, and defers notification polling to reduce startup cost and API load

#### Additional Features

- **Profile Management**: Configure and switch between multiple Gitea instances/accounts with profile management commands
- **Stash Management**: Manage git stashes with support for creating, applying, popping, dropping, and viewing stashes
- **Markdown Rendering**: PR and Issue descriptions and comments render with full markdown formatting
- **Inline Code Review**: View file changes directly in PR detail panels with syntax-highlighted diffs

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
- Gitea: Import Issues from XLSX (`gitea.importIssues`): bulk import issues from Excel file.
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

- GET requests are cached for 10 seconds to reduce duplicate API calls; caches clear automatically when you switch or add profiles.
- Refresh commands are throttled to prevent rapid bursts of network requests.
- Notification polling initializes lazily and starts after a short delay to keep extension activation snappy.

### Requirements

- VS Code 1.90.0 or newer.
- Git installed.
- Access to a Gitea instance and a Personal Access Token.
    - **Required Token Permissions (Read & Write)**:
        - **Repository**: Create repositories, access repository metadata, manage branches
        - **Issue**: View, create, import, and comment on issues
        - **Pull Request**: View, create, review, and merge pull requests
    - **Required Token Permissions (Read Only)**:
        - **Notification**: Receive repository activity notifications
        - **User**: Authenticate and fetch user information

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
