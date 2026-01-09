## Changelog

All notable changes to this project are documented in this file.
This project adheres to [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

### [Unreleased]

#### Planned

- Branch tagging and improved workflows.
- Inline code review with diff views.
- Advanced PR filtering and sorting.

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
