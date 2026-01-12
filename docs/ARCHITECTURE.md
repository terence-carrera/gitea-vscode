# Branch Deletion & Restoration Architecture

## Component Diagram

```text
┌────────────────────────────────────────────────────────────────────┐
│                        VS Code Extension                           │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────────────┐         ┌────────────────────────┐        │
│  │  BranchManager      │◄────────│  Extension Context     │        │
│  │                     │         │  (Persistent Storage)  │        │
│  │  - deleteBranch()   │         └────────────────────────┘        │
│  │  - restoreBranch()  |                                           │
│  │  - reflog parsing   │         ┌────────────────────────┐        │
│  │  - history mgmt     │◄────────│  Configuration         │        │
│  └────────┬────────────┘         │  retentionDays: 90     │        │
│           │                      └────────────────────────┘        │
│           │                                                        │
│           ▼                                                        │
│  ┌──────────────────────────────────────────────┐                  │
│  │     DeletedBranchesProvider (Tree View)      │                  │
│  │                                              │                  │
│  │  ├─ Repository A (2 deleted branches)        │                  │
│  │  │  ├─ feature-xyz (2 hours ago)             │                  │
│  │  │  └─ hotfix-123 (1 day ago)                │                  │
│  │  │                                           │                  │
│  │  └─ Repository B (1 deleted branch)          │                  │
│  │     └─ experimental (5 days ago)             │                  │
│  └──────────────────────────────────────────────┘                  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Branch Deletion Flow

```text
User Action: Delete Branch
        │
        ▼
┌───────────────────┐
│  Get commit SHA   │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Execute git cmd  │
│  (git branch -d)  │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Track deletion   │
│  in memory Map    │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Persist to       │
│  globalState      │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Refresh tree     │
│  view display     │
└───────────────────┘
```

### Branch Restoration Flow

```text
User Action: Restore Branch
        │
        ▼
┌───────────────────┐
│  Get commit SHA   │
│  from history     │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Execute git cmd  │
│  (git branch name │
│   <commit-sha>)   │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Remove from      │
│  tracked history  │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Update storage   │
│  & refresh view   │
└───────────────────┘
```

### Reflog Parsing Flow
```
User Action: Restore from Reflog
        │
        ▼
┌────────────────────┐
│  Run git reflog    │
│  --all --date=iso  │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│  Parse with        │
│  multiple patterns │
│  - deleted branch  │
│  - force delete    │
│  - remote delete   │
│  - update-ref      │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│  Deduplicate &     │
│  extract metadata  │
│  - name, SHA,      │
│  - timestamp       │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│  Show QuickPick    │
│  selection UI      │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│  Restore selected  │
│  branch            │
└────────────────────┘
```

## Storage Schema

### Global State Structure
```json
{
  "giteaDeletedBranches": {
    "/path/to/repo1": [
      {
        "name": "feature-branch",
        "commit": "abc123def456...",
        "deletedAt": "2026-01-11T10:30:00.000Z",
        "deletedBy": "extension"
      },
      {
        "name": "old-feature",
        "commit": "789ghi012jkl...",
        "deletedAt": "2026-01-05T14:22:00.000Z",
        "deletedBy": "reflog"
      }
    ],
    "/path/to/repo2": [
      {
        "name": "experimental",
        "commit": "345mno678pqr...",
        "deletedAt": "2026-01-10T09:15:00.000Z",
        "deletedBy": "extension"
      }
    ]
  }
}
```

## Cleanup Process

```
Extension Activation
        │
        ▼
┌────────────────────┐
│  Load from         │
│  globalState       │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│  Get retention     │
│  config (90 days)  │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│  Calculate cutoff  │
│  date              │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│  Filter out old    │
│  deletions         │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│  Update Map &      │
│  save to storage   │
└────────────────────┘
```

## Commands & Tree View Integration

```
Activity Bar: Gitea
  │
  ├─ Repositories
  ├─ Issues
  ├─ Pull Requests
  └─ Deleted Branches ◄── NEW
         │
         ├─ [Refresh Button]
         ├─ [Restore from Reflog Button]
         ├─ [Clear History Button]
         │
         └─ Tree Items:
            ├─ Repo A (context menu)
            │  ├─ branch-1 [Restore] [Remove]
            │  └─ branch-2 [Restore] [Remove]
            └─ Repo B (context menu)
               └─ branch-3 [Restore] [Remove]
```

## Command Palette Commands

- `Gitea: Delete Branch` - Main deletion command
- `Gitea: Restore Deleted Branch` - Restore from tracked history
- `Gitea: Restore Branch from Reflog` - Scan and restore from reflog
- `Gitea: Clear All Deletion History` - Reset tracking

## Context Menu Actions

### On Deleted Branch Item
- **Restore Branch** (inline icon)
- **Remove from History** (context menu)

### On Deleted Branches View Title
- **Refresh** (inline icon)
- **Restore from Reflog** (inline icon)
- **Clear All Deletion History** (inline icon)
