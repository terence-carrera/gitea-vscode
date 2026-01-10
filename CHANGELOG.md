## Changelog

All notable changes to this project are documented in this file.
This project adheres to [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

### [Unreleased]

#### Planned

- Advanced PR filtering and sorting.
- Branch delete/rename operations.

### [0.1.3] - 2026-01-10

#### Added

- Branch switching/checkout: switch between branches in your repository with a quick picker.
- Quick branch creation from Issues: create a new branch directly from an issue with auto-generated branch names.
- Quick branch creation from Pull Requests: create a new branch from PR details with branch base selection.
- Branch context menu actions: right-click on issues and PRs to create branches.
- Create Branch buttons in Issue and PR detail panels for easy branch creation workflow.
- `gitea.switchBranch` command: switch branches from the command palette.
- `gitea.createBranchFromIssue` command: create a branch linked to an issue.
- `gitea.createBranchFromPR` command: create a branch linked to a pull request.
- Contributing section in README with contribution guidelines, development setup, and issue reporting instructions.
- Markdown rendering support: PR and Issue descriptions and comments now render with full markdown formatting including headings, code blocks, blockquotes, and links.
- Inline code review with diff views: view file changes directly in PR detail panels with syntax-highlighted diffs showing additions, deletions, and context.
- Collapsible file diff viewer: click file headers to expand/collapse individual file diffs for easier navigation.
- Stash management integration: manage git stashes with support for creating, applying, popping, dropping, and viewing stashes directly from VS Code.
- Profile switching for multiple Gitea accounts: configure and switch between multiple Gitea instances/accounts with profile management commands.
- Add Profile command: create new Gitea profiles for multiple accounts/instances.
- Status bar indicator: displays current active Gitea profile with quick access to profile switcher.
- Enhanced notification system with actionable alerts: open issues/PRs in VS Code or browser, and copy commit SHAs directly from alerts.
- Commits section in PR detail view: displays all commits with SHA, message, author, and timestamp for better code review context.
- Conflict details display: when a PR has merge conflicts, shows the actual list of conflicting files with conflict markers instead of a generic error message.
- Out-of-date PR detection: displays an alert banner when a PR branch is behind the base branch with an "Update branch by merge" action button.

#### Changed

- Performance tuning: cache GET responses with a 5-minute TTL, throttle refresh bursts, lazily initialize notifications, and defer notification polling to reduce startup cost and API load.

#### Fixed

- Repository path lookup now searches subdirectories (up to 2 levels deep) for better repository detection.
- PR detail view now shows an accurate commit count by fetching commit list when the API omits the count.
- Improved repository matching with support for multiple URL formats (SSH, HTTPS, with/without .git suffix).
- Fixed "Repository not found in workspace" error when using `gitea.switchBranch` from command palette.
- Fixed profile list not showing created profiles by reloading from settings on demand.

### [0.1.2] - 2026-01-10

#### Changed

- Extension compatibility updated to VS Code 1.90.0 and above.

### [0.1.1] - 2026-01-09

#### Added

- `gitea.defaultRepoStartingPath` setting to specify default path for new repositories.

### [0.1.0] - 2026-01-09

#### Added

- WebView detail panels for Issues: view full issue details, comments, labels, and state.
- WebView detail panels for Pull Requests: view PR details, commits, files changed, reviews, and comments.
- WebView creation forms: rich forms for creating issues and pull requests with better UX than input boxes.
- Branch selector for PRs: automatically loads branches from selected repository with smart defaults.
- Label support: add labels when creating issues directly from the creation form.
- Assignee support: assign users to pull requests during creation.
- Inline commenting: add comments to issues and pull requests directly from the detail panel.
- PR review actions: approve, comment, or request changes on pull requests.
- PR merge actions: merge, squash, or rebase pull requests with confirmation prompts.
- Close/reopen actions: close or reopen issues and pull requests from detail panels.
- Real-time updates: detail panels refresh after actions to show latest state.

#### Changed

- Issue and PR tree items now include "View Details" context menu action with eye icon.
- Create Issue command now opens rich WebView form instead of input boxes.
- Create Pull Request command now opens rich WebView form with branch selection.
- Enhanced UX with color-coded state badges and improved metadata display.

### [0.0.3] - 2026-01-09

#### Added

- Issues view grouped by Repository → State (Open/Closed) → Items.
- Pull Requests view grouped by Repository → State (Open/WIP/Closed) → Items, with WIP/draft detection.
- Search commands for Issues and Pull Requests, with flat result display.
- “Open in Browser” commands for repositories, issues, and pull requests.
- Create commands: Repository, Issue, Pull Request.
- Clone-and-open workflow for repositories not yet in the workspace.
- Notifications: polling toggle and status command.

#### Changed

- Repository listing now filters to repos actually present in the current workspace by parsing `.git/config` remotes.
- Grouping order switched to Repository → State → Items for improved scanability.

#### Fixed

- Stability improvements and activation error fixes in tree providers.

### [0.0.2]

#### Added (0.0.2)

- Activity Bar container and basic Repositories/Issues/Pull Requests views.
- Repository search.
- Basic authentication configuration and request handling.

### [0.0.1]

#### Added (0.0.1)

- Initial extension scaffold and configuration.
