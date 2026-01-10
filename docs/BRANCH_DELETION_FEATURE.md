# Branch Deletion & Restoration Feature

## Overview

The Gitea extension now includes comprehensive branch deletion tracking and restoration capabilities. This feature helps prevent accidental data loss by maintaining a history of deleted branches and providing multiple ways to restore them.

## Key Features

### 1. Deleted Branches View

- **New tree view** in the Gitea Activity Bar showing all tracked deleted branches
- Organized by repository with branch count badges
- Real-time deletion timestamps (e.g., "2 hours ago", "5 days ago")
- Visual indicators showing commit SHA and deletion source

### 2. Persistent Storage

- Deletion history survives VS Code restarts
- Stored in VS Code's global state
- Automatically cleaned up based on retention period

### 3. Enhanced Reflog Parsing

Detects multiple branch deletion patterns:

- Standard branch deletion (`git branch -d`)
- Force deletion (`git branch -D`)
- Remote branch deletion
- Update-ref deletions
- Duplicates are automatically filtered

### 4. Configurable Retention Period

- Default: 90 days
- Configurable via `gitea.branchDeletionRetentionDays` setting
- Range: 1-365 days
- Automatic cleanup on extension startup

## Commands

### Main Commands

- **Gitea: Delete Branch** (`gitea.deleteBranch`)
  - Delete a branch with normal or force options
  - Automatically tracks the deletion
  
- **Gitea: Restore Deleted Branch** (`gitea.restoreDeletedBranch`)
  - Restore from extension's tracked history
  - Shows recently deleted branches with metadata
  
- **Gitea: Restore Branch from Reflog** (`gitea.restoreBranchFromReflog`)
  - Scan Git reflog for historical deletions
  - Finds branches deleted outside the extension

### Tree View Commands

- **Restore Branch** - Inline button on deleted branch items with diff preview
- **Show Details** - Click on branch to see full information with preview & restore option
- **Remove from History** - Clean up individual entries
- **Clear All Deletion History** - Reset all tracking data
- **Export Deletion History** - Save deletion history to JSON file for backup
- **Import Deletion History** - Load deletion history from JSON file
- **Refresh** - Manual refresh of the view

## Usage Examples

### Delete a Branch

1. Run `Gitea: Delete Branch` from command palette
2. Select repository
3. Select branch to delete
4. Choose normal or force delete
5. Branch is deleted and added to history

### Restore Recently Deleted Branch

1. Open Deleted Branches view in Activity Bar
2. Find the branch you want to restore
3. Click the restore icon or right-click → Restore Branch
4. Confirm restoration
5. Branch is recreated at the same commit

### Restore from Reflog (Historical)

1. Run `Gitea: Restore Branch from Reflog`
2. Select repository
3. Wait for reflog scan (may take a moment for large repos)
4. Select branch from list of detected deletions
5. Confirm restoration

### Export Deletion History

1. Open Deleted Branches view
2. Click the export icon in the view title bar (or run `Gitea: Export Deletion History`)
3. Choose location and filename for the JSON export file
4. History is saved with timestamps and metadata

### Import Deletion History

1. Open Deleted Branches view
2. Click the import icon in the view title bar (or run `Gitea: Import Deletion History`)
3. Select the JSON file to import
4. Choose merge (combine with existing) or replace (overwrite existing)
5. History is loaded and available for restoration

### Preview Changes Before Restoration

1. Click on a deleted branch in the tree view
2. Select "Preview & Restore" from the dialog
3. Review the list of changed files
4. Optionally click on individual files to see detailed diffs
5. Choose "Restore Branch" to proceed or "Cancel" to abort

### Sync Across Machines with VS Code Settings Sync

Your deletion history automatically syncs across all your machines when **VS Code Settings Sync** is enabled.

#### Setup

1. Enable Settings Sync in VS Code:
   - Click the gear icon (⚙️) in the activity bar
   - Select **Turn on Settings Sync...**
   - Sign in with Microsoft or GitHub
   - Ensure **User Data** is checked

2. That's it! The extension automatically marks deletion history for sync

#### How It Works

- Deletion history is stored separately from settings (no clutter in settings UI)
- Syncs automatically when Settings Sync is enabled
- Works across Windows, macOS, and Linux
- No manual export/import needed
- No external services required (uses Microsoft's infrastructure)

#### Manual Backup (Additional Safety)

Even with automatic sync, you can export deletion history manually:

1. Click export icon in Deleted Branches view
2. Choose location and save JSON file
3. Store in cloud storage (Dropbox, OneDrive, etc.) for extra safety

## Configuration

### Settings

```json
{
  "gitea.branchDeletionRetentionDays": 90
}
```

**gitea.branchDeletionRetentionDays**

- Type: `number`
- Default: `90`
- Range: 1-365
- Description: Number of days to retain deleted branch history

## Technical Details

### Storage Format

Deleted branches are stored with:

- `name`: Branch name
- `commit`: Full commit SHA
- `deletedAt`: ISO timestamp
- `deletedBy`: Source ("extension" or "reflog")

### Reflog Patterns Detected

1. `branch: deleted <branch-name>`
2. `deleted remote-tracking branch <branch-name>`
3. `branch: force-deleted <branch-name>`
4. `update-ref.*delete.*refs/heads/<branch-name>`

### Cleanup Behavior

- Runs on extension activation
- Removes entries older than retention period
- Preserves all entries within retention window

## Tips

1. **Regular Cleanup**: Use "Clear All Deletion History" periodically if you don't need old entries
2. **Reflog Limitations**: Git's reflog has its own retention (default ~90 days for unreachable commits)
3. **Restore Quickly**: Restore important branches soon after deletion for best results
4. **Multiple Repos**: Each repository maintains its own deletion history
5. **Commit SHA**: Can copy commit SHA from details to manually restore if needed
6. **Backup History**: Export deletion history regularly or enable VS Code Settings Sync for automatic cloud sync
7. **Preview First**: Always preview changes before restoring to avoid unexpected conflicts
8. **Import/Export**: Use export/import to transfer deletion history between machines or as backups
9. **Settings Sync**: Enable VS Code Settings Sync for seamless cross-machine synchronization
10. **No External Dependencies**: Deletion history syncs using VS Code's built-in Settings Sync (no external accounts needed)

## Future Enhancements

Potential improvements:

- Batch restore operations
- Integration with Gitea server's branch protection
- Notification on branch deletion
- Branch deletion analytics and reports
- Conflict resolution UI for multi-machine edits
