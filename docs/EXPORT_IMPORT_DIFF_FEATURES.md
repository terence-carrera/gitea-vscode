# Export/Import & Diff Preview Features

## Summary

The branch deletion & restoration feature has been enhanced with two major improvements:

### 1. Export/Import Deletion History

**Export Functionality:**

- Save deletion history to JSON files
- Includes all metadata (branch name, commit SHA, deletion timestamp, source)
- Versioned export format for future compatibility
- Can be used for backups or transferring between machines

**Import Functionality:**

- Load deletion history from JSON files
- Two merge strategies:
  - **Merge**: Combine imported data with existing history
  - **Replace**: Clear existing and use only imported data
- Prevents duplicate entries when merging
- Validates file format before importing

**Commands:**

- `Gitea: Export Deletion History` - Save to JSON file
- `Gitea: Import Deletion History` - Load from JSON file

**Use Cases:**

- Backup deletion history before clearing
- Transfer history between computers
- Share deletion tracking with team members
- Recover from accidental history clearing

### 2. Visual Diff Preview Before Restoration

**Interactive Preview:**

- Shows all changed files before restoring
- File status indicators (Added, Modified, Deleted, Renamed)
- Click individual files to see detailed side-by-side diffs
- Can be cancelled at any time

**Workflow:**

1. User clicks on deleted branch or selects "Preview & Restore"
2. Extension compares deleted branch commit with current branch
3. Shows quick-pick menu with:
   - "Restore Branch" option at the top
   - "Cancel" option
   - List of all changed files
4. User can click files to preview diffs
5. User confirms or cancels restoration

**Benefits:**

- Prevents unexpected conflicts
- Review changes before applying
- Understand impact of restoration
- See what will change in the codebase

## Technical Implementation

### Export Format

```json
{
  "version": "1.0",
  "exportedAt": "2026-01-11T10:30:00.000Z",
  "deletionHistory": {
    "/path/to/repo": [
      {
        "name": "branch-name",
        "commit": "full-sha",
        "deletedAt": "2026-01-10T09:15:00.000Z",
        "deletedBy": "extension"
      }
    ]
  }
}
```

### Diff Preview Flow

```text
User Action → showDiffPreview()
    ↓
Get current branch
    ↓
Run: git diff --name-status <current> <deleted-commit>
    ↓
Parse file changes (status + paths)
    ↓
Show QuickPick with:
  - Restore Branch option
  - Cancel option
  - File list with status icons
    ↓
User selects file → showFileDiff()
    ↓
Open VS Code diff viewer
    ↓
Return to QuickPick (recursive)
    ↓
User confirms → return true → restore branch
```

### New Methods Added

**In BranchManager class:**

1. `exportDeletionHistory()` - Export to JSON file
   - Converts Map to plain object
   - Adds version and timestamp
   - Uses VS Code's save dialog
   - Writes to file system

2. `importDeletionHistory()` - Import from JSON file
   - Uses VS Code's open dialog
   - Validates file format
   - Prompts for merge strategy
   - Deduplicates entries
   - Saves to persistent storage

3. `showDiffPreview(repoPath, branchName, commitSha)` - Show diff preview
   - Runs git diff command
   - Parses file status
   - Creates QuickPick UI
   - Handles file selection
   - Returns boolean for proceed/cancel

4. `showFileDiff(repoPath, currentBranch, commitSha, filePath)` - Show individual file diff
   - Constructs git URIs
   - Opens VS Code diff viewer
   - Handles errors gracefully

## UI Changes

### Deleted Branches View Title Bar

**New Buttons:**

- Export icon (in context menu under "export" group)
- Import icon (in context menu under "export" group)

### Branch Details Dialog

**Updated Button:**

- Changed from "Restore Branch" to "Preview & Restore"
- Shows diff preview before confirming restoration

### Restore Actions

**All restore actions now show diff preview:**

- Inline restore button in tree view
- "Preview & Restore" in details dialog
- Both use the same preview workflow

## Configuration

No new configuration needed. Uses existing:

- `gitea.branchDeletionRetentionDays` - Still applies to imported data

## Error Handling

**Export:**

- Graceful handling if save dialog cancelled
- Error message if write fails
- Success notification with file path

**Import:**

- Validates JSON structure
- Checks for required fields
- Error if invalid format
- Success message with import count

**Diff Preview:**

- Fallback if diff command fails
- Option to restore anyway if preview fails
- Handles missing files gracefully
- Warning if no differences found

## Testing Scenarios

### Export/Import

1. ✓ Export empty history
2. ✓ Export with multiple repos
3. ✓ Import with merge strategy
4. ✓ Import with replace strategy
5. ✓ Import duplicate prevention
6. ✓ Invalid file format handling

### Diff Preview

1. ✓ Preview with no changes
2. ✓ Preview with multiple files
3. ✓ Preview with added files
4. ✓ Preview with deleted files
5. ✓ Preview with modified files
6. ✓ Preview with renamed files
7. ✓ Click file to see diff
8. ✓ Cancel restoration
9. ✓ Confirm restoration

## Benefits

**For Users:**

- Data portability (export/import)
- Confidence before restoring (preview)
- Better understanding of changes
- Reduced mistakes
- Backup capabilities

**For Teams:**

- Share deletion history
- Consistent tracking across machines
- Better collaboration
- Audit trail

**For Developers:**

- Extensible export format
- Easy to add new features
- Clean separation of concerns
- Reusable diff preview component
