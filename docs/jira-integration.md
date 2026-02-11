# JIRA integration

This document describes how JIRA Cloud is integrated with the task planner: importing issues by key and syncing status changes back to JIRA.

## Overview

- **Import by key**: In chat, you can refer to a JIRA issue key (e.g. `PROJ-123`). The app uses the JIRA REST API to fetch the issue and creates a planner task linked to that key. The task stores the key in frontmatter as `jiraKey`.
- **Status sync**: When you change the status of a linked task in the planner (e.g. move to "In progress" or "Done"), the app calls the JIRA transitions API to move the issue to a matching status in JIRA.

## Configuration

JIRA uses **JIRA Cloud** and **Basic auth** (email + API token).

- **Domain**: Your Atlassian site name only, e.g. `mycompany` for `https://mycompany.atlassian.net`. Do not include `https://` or `.atlassian.net`.
- **Email**: The Atlassian account email used for API access.
- **API token**: Create one at [Atlassian API tokens](https://id.atlassian.com/manage-profile/security/api-tokens).

Config is stored in the app’s user data directory as `jira-config.json`. You can set it in **Settings → JIRA integration** (collapsible section): enter domain, email, and API token, then Save. Use “Clear JIRA configuration” to remove it. The API token field shows a “leave blank to keep” placeholder when config is already saved so you can change domain/email without re-entering the token.

If JIRA is not configured, `import_jira_task` and status sync are no-ops or return a clear error.

## Chat: import JIRA task

The AI chat has a parent tool **`import_jira_task`**:

- **Parameter**: `issueKey` (e.g. `PROJ-123`).
- **Behaviour**:
  1. If JIRA is not configured, returns an error asking the user to configure it.
  2. Fetches the issue from JIRA (summary, description, status, priority).
  3. If a planner task already exists with the same `jiraKey`, returns that task (no duplicate).
  4. Otherwise creates a new task with:
     - Title: `[PROJ-123] <summary>`
     - Description: JIRA description (plain text) plus a link to the issue.
     - Status/priority mapped from JIRA (see below).
     - Tag `jira` and `jiraKey: PROJ-123` so status sync can find it.

Users can say things like: “Import PROJ-123” or “Add the task for MY-456 from JIRA.”

## Status sync (planner → JIRA)

When a task has a `jiraKey`:

- **Task update** (e.g. via `update_task` or the UI) that changes `status` triggers a JIRA transition.
- **Reorder** (e.g. moving a card to another column in the Kanban) that changes `status` also triggers a JIRA transition.

Sync is best-effort and fire-and-forget: the planner does not block on JIRA. If the transition fails (e.g. workflow doesn’t allow it), a warning is logged; the planner task remains updated.

### Status mapping

Planner statuses are mapped to JIRA transition **target** status names (case-insensitive):

| Planner    | JIRA target names (examples)                    |
|-----------|--------------------------------------------------|
| todo      | To Do, Open, Backlog, Selected for Development  |
| in-progress | In Progress, In Development, In Review        |
| done      | Done, Closed, Resolved, Complete                |
| archived  | Done, Closed, Resolved, Complete                |

The code fetches available transitions for the issue and picks the first one whose target status name matches one of the names above. If no transition matches, sync is skipped and a warning is logged.

## API usage (main process)

- **`jira-config.ts`**: Read/write `jira-config.json` (domain, email, apiToken).
- **`jira-api.ts`**:
  - `getJiraIssue(config, issueKey)`: GET `/rest/api/3/issue/{key}`, returns normalized `JiraIssueInfo`.
  - `getJiraTransitions(config, issueKey)`: GET `.../transitions`.
  - `transitionJiraIssue(config, issueKey, plannerStatus)`: GET transitions, find matching transition, POST transition.
- **`ipc/jira-handlers.ts`**: IPC for get/set config, get issue, import task (create fragment with `jiraKey`).
- **`ipc/task-handlers.ts`**: After update/reorder, if task has `jiraKey` and status changed, calls `transitionJiraIssue` (fire-and-forget).

## Data model

- **Task (fragment)**: Frontmatter can include `jiraKey: "PROJ-123"`. It is persisted by `fragment-serializer` and exposed on `TaskWithTags.jiraKey`.
- **CreateTaskInput / UpdateTaskInput**: Optional `jiraKey` so tasks can be created or updated with a link.

## Security and storage

- JIRA config (including API token) is stored in plain JSON in the app user data directory. Prefer adding a Settings screen that uses the existing IPC (`jira.getConfig` / `jira.setConfig`) rather than documenting manual file edits.
- API token should be treated as secret; the app does not send it to any server other than `*.atlassian.net`.

## Possible extensions

- **Settings UI**: Modal or page to set/clear JIRA domain, email, and API token.
- **JIRA → planner sync**: Periodically or on demand refresh planner task from JIRA (e.g. status, summary) for linked tasks.
- **Custom status mapping**: Let users map planner statuses to specific JIRA transition names or IDs per project.
- **Two-way sync**: When JIRA status changes (e.g. via webhook), update the planner task (would require a backend or local webhook receiver).
