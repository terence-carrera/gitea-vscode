# Import Issues from XLSX Feature

## Overview

The Gitea VS Code extension supports importing issues in bulk from Excel (XLSX) files. This feature streamlines the process of migrating or creating multiple issues at once into any of your Gitea repositories.

## Prerequisites

- Gitea instance configured in VS Code
- At least one repository in your workspace
- Excel file (XLSX format) with issue data
- Labels, assignees, and milestones should exist in the target repository before importing

## Supported XLSX Format

Your Excel file should contain the following columns (in any order):

### Required Columns

- **Title** - The issue title (required for each row)

### Optional Columns

- **Description** - Issue description/body text
- **Labels** - Comma or semicolon-separated list of label names (labels must exist in target repository; case-insensitive matching)
- **Assignee** - Username of the assignee
- **Milestone** - Milestone name (must exist in target repository)
- **State** - Issue state (`open` or `closed`); default is `open` (not used during import)
- **Priority** - Issue priority level (informational only)
- **Due Date** - Due date in ISO format (YYYY-MM-DD)

## Column Name Variants

The parser is flexible and accepts these column name variations (case-insensitive):

- Title / title / TITLE
- Description / description / DESCRIPTION
- Labels / labels / LABELS
- Assignee / assignee / ASSIGNEE
- Milestone / milestone / MILESTONE
- State / state / STATE
- Priority / priority / PRIORITY
- Due Date / due_date / DUE_DATE

## Usage

### Step 1: Prepare Your XLSX File

Create an Excel file with your issues data. Here's an example:

| Title         | Description                 | Labels        | Assignee   | Milestone |
| ------------- | --------------------------- | ------------- | ---------- | --------- |
| Fix login bug | Users cannot login with SSO | bug, urgent   | john.doe   | v1.0      |
| Add dark mode | Implement dark theme        | feature       | jane.smith | v1.1      |
| Update docs   | Update API documentation    | documentation | -          | v1.0      |

### Step 2: Open the Import Dialog

1. In VS Code, open the Gitea explorer panel (click the Gitea icon in the activity bar)
2. Navigate to the **Issues** view
3. Click the **Import Issues from XLSX** button (archive icon) in the Issues view title bar
4. Browse and select your XLSX file

### Step 3: Select Target Repository

Choose the repository where you want to import the issues from the dropdown list. Only repositories in your current workspace are shown.

### Step 4: Configure Import Options

A dialog will appear with the following options:

- **Import assignees** - Include assignee information if the column exists
- **Import milestones** - Include milestone information if the column exists
- **Import due dates** - Include due date information if the column exists

You can enable/disable each option as needed.

### Step 5: Review and Confirm

Review a preview of the first 3 issues and click **Import Issues** to start the import process.

## Import Results

After the import completes, you'll see a summary showing:

- Number of successfully imported issues
- Number of failed imports (if any)
- Details of failed imports with error messages

You can view detailed failure information if needed.

## Error Handling

The importer validates your data and provides helpful error messages for:

- Missing required columns (Title)
- Invalid XLSX file format
- Empty or corrupted files
- API errors when creating issues
- Missing labels, assignees, or milestones

Common error messages:

- **"Title column is required"** - Your Excel file must have a "Title" column with data
- **"No data found in XLSX file"** - The Excel file is empty or has no data rows
- **"Invalid assignee"** - The username doesn't exist in your Gitea instance
- **"Invalid milestone"** - The milestone doesn't exist in the target repository
- **"API request failed with status 422"** - Data format issue; check that labels exist in the repository

**Note:** Labels that don't exist in the repository are silently skipped and won't cause the import to fail. The issue will be created without those labels.

## Tips & Best Practices

1. **Test with a small batch first** - Import 2-3 test issues to verify your format and data are correct
2. **Create labels before importing** - **Labels must exist in the target repository**. Use exact label names (case-insensitive matching)
3. **Verify usernames and milestones** - Ensure assignee usernames and milestone names match exactly with what's in Gitea
4. **Use consistent column names** - While the parser accepts variations (Title/title/TITLE), consistency improves readability
5. **Handle special characters carefully** - Excel may auto-format dates or special characters; review your data before import
6. **Review before importing** - Check the preview window showing the first 3 issues to catch any formatting issues
7. **Monitor import progress** - For large imports (50+ issues), check the Output panel for progress logs
8. **Don't create duplicate issues** - Always review your repository before importing to avoid duplicates

### Large repositories

- The extension supports repositories with more than 100 existing issues by fetching list endpoints across multiple pages when needed. This can make the initial duplicate-check prefetch take longer on very large repositories.

### Label Matching Behavior

- Label matching is **case-insensitive** (e.g., "Bug" matches "bug")
- Labels that don't exist in the repository are **silently skipped**
- Create all required labels in your Gitea repository before importing
- Multiple labels can be separated by commas or semicolons: `bug, urgent` or `bug; urgent`

## Example XLSX Template

You can create an Excel file with this structure:

```text
Title                    | Description                      | Labels        | Assignee   | Milestone
User authentication bug  | Login fails with special chars    | bug,urgent    | dev-team   | v1.0
Implement API v2         | Create new API version 2         | feature,api   | api-lead   | v1.1
Update user guide        | Add new sections to documentation| documentation |            | v1.0
```

## Limitations

- Imports into one repository at a time (multi-repository import not supported)
- Only supports XLSX format (Excel 2007+); XLS (Excel 97-2003) support is limited
- Large files (>1000 issues) may take several minutes to process
- Assignees, milestones must exist in the target repository (will fail if not found)
- Labels that don't exist are skipped (won't fail the import)
- No duplicate detection - check manually before importing
- Issues are always created as "open" regardless of State column value

## Troubleshooting

### Issue: Button doesn't respond when clicked

**Solution:** 
1. Reload VS Code (Ctrl+Shift+P → "Developer: Reload Window")
2. Ensure you have at least one repository in your workspace
3. Check that Gitea is properly configured (Gitea: Configure Instance)
4. Check the Output panel (View → Output → select "Gitea") for error messages

### Issue: "No repositories found in workspace"

**Solution:**
- Make sure you have opened a folder/workspace in VS Code that contains Git repositories
- The repositories must be cloned from your Gitea instance
- Only repositories matching your Gitea instance will be shown

### Issue: Import hangs or is very slow

**Solution:** 
- This is normal for large batches (100+ issues)
- The extension respects API rate limits to avoid overloading your Gitea instance
- Check the VS Code Output panel (Gitea channel) for progress messages
- Consider splitting very large imports into smaller batches

### Issue: Some issues failed to import

**Solution:** Click "View Details" in the error message to see which issues failed and why. Common causes:

- **Invalid assignee username** - User doesn't exist or username is misspelled
- **Milestone doesn't exist** - Create the milestone in Gitea first
- **API errors** - Check Gitea server logs for detailed error information
- **Permission issues** - Ensure you have write access to the repository

## Related Features

- **Create Issue** - Manually create individual issues through the UI
- **Search Issues** - Find and filter existing issues
- **View Issue Details** - Open issues in a detailed webview panel
- **Export Issues** - Export issues to XLSX format (planned feature)

## Changelog

### Version 0.1.5+
- ✅ Initial import feature implementation
- ✅ Support for Excel XLSX format
- ✅ Automatic label name to ID mapping
- ✅ Import progress tracking
- ✅ Detailed error reporting with failure summary
