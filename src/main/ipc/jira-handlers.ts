import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { getJiraConfig, setJiraConfig, clearJiraConfig } from '../jira-config'
import { getJiraIssue, type JiraIssueInfo } from '../jira-api'
import { getWorkspaceConfig } from '../workspace-config'
import { taskToFragmentPayload, fragmentToTask } from '../fragment-serializer'
import { createFragment } from '../usable-api'
import { getCachedTaskFragments, invalidateTaskCache, broadcastTasksChanged } from '../task-cache'
import { countFragments } from '../usable-api'
import type { IpcResponse, TaskWithTags, JiraConfig } from '../../shared/types'

/** Map JIRA status name to planner TaskStatus (best-effort). */
function jiraStatusToPlanner(statusName: string): 'todo' | 'in-progress' | 'done' | 'archived' {
  const lower = statusName.toLowerCase()
  if (lower.includes('progress') || lower.includes('development') || lower.includes('review')) return 'in-progress'
  if (lower.includes('done') || lower.includes('closed') || lower.includes('resolved') || lower.includes('complete')) return 'done'
  if (lower.includes('backlog')) return 'todo'
  return 'todo'
}

/** Map JIRA priority name to planner priority. */
function jiraPriorityToPlanner(name: string | undefined): 'low' | 'medium' | 'high' | 'urgent' {
  if (!name) return 'medium'
  const lower = name.toLowerCase()
  if (lower.includes('highest') || lower.includes('critical') || lower === 'urgent') return 'urgent'
  if (lower.includes('high')) return 'high'
  if (lower.includes('low') || lower.includes('lowest')) return 'low'
  return 'medium'
}

export function registerJiraHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.JIRA_GET_CONFIG, async (): Promise<IpcResponse<JiraConfig | null>> => {
    try {
      const config = getJiraConfig()
      return { success: true, data: config }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.JIRA_SET_CONFIG, async (_event, config: JiraConfig | null): Promise<IpcResponse<void>> => {
    try {
      if (config) {
        setJiraConfig(config)
      } else {
        clearJiraConfig()
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.JIRA_GET_ISSUE, async (_event, issueKey: string): Promise<IpcResponse<JiraIssueInfo>> => {
    try {
      const config = getJiraConfig()
      if (!config) return { success: false, error: 'JIRA is not configured. Add domain, email, and API token in Settings.' }
      const issue = await getJiraIssue(config, issueKey)
      return { success: true, data: issue }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.JIRA_IMPORT_TASK, async (_event, issueKey: string): Promise<IpcResponse<TaskWithTags>> => {
    try {
      const config = getJiraConfig()
      if (!config) return { success: false, error: 'JIRA is not configured. Add domain, email, and API token in Settings.' }

      const workspace = getWorkspaceConfig()
      if (!workspace?.taskFragmentTypeId) return { success: false, error: 'No workspace or fragment type configured.' }

      const issue = await getJiraIssue(config, issueKey)

      // Check we don't already have a task linked to this JIRA key
      const fragments = await getCachedTaskFragments(workspace.workspaceId)
      const existing = fragments.find(f => {
        const task = fragmentToTask(f)
        return task.jiraKey === issue.key
      })
      if (existing) {
        return { success: true, data: fragmentToTask(existing) }
      }

      const now = new Date().toISOString()
      const status = jiraStatusToPlanner(issue.statusName)
      const priority = jiraPriorityToPlanner(issue.priorityName)
      const order = await countFragments(workspace.workspaceId, { tags: ['source:my-tasks-plan'] })

      const description = issue.description
        ? `${issue.description}\n\n---\n[JIRA: ${issue.key}](${issue.webUrl})`
        : `[JIRA: ${issue.key}](${issue.webUrl})`

      const payload = taskToFragmentPayload({
        title: `[${issue.key}] ${issue.summary}`,
        description,
        status,
        priority,
        kanbanOrder: order,
        listOrder: order,
        createdAt: now,
        tags: ['jira'],
        projects: [],
        dependencies: [],
        jiraKey: issue.key,
      })

      const result = await createFragment({
        workspaceId: workspace.workspaceId,
        fragmentTypeId: workspace.taskFragmentTypeId,
        ...payload,
      })

      invalidateTaskCache()
      broadcastTasksChanged()

      const created: TaskWithTags = {
        id: result.fragmentId,
        title: payload.title,
        description,
        status,
        priority,
        kanbanOrder: order,
        listOrder: order,
        createdAt: now,
        updatedAt: now,
        tags: ['jira'],
        projects: [],
        dependencies: [],
        comments: [],
        jiraKey: issue.key,
      }
      return { success: true, data: created }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })
}
