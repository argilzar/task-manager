export type TaskStatus = 'todo' | 'in-progress' | 'done' | 'archived'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type ThemeMode = 'light' | 'dark' | 'system'
export type ChatMode = 'bubble' | 'docked'

export interface WorkspaceMember {
  id: string
  userId: string
  name: string
  email: string
  role: string
}

export interface TaskComment {
  id: string
  text: string
  author: string
  authorEmail: string
  authorId?: string
  createdAt: string
}

export interface TaskWithTags {
  id: string           // fragment ID
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  kanbanOrder: number
  listOrder: number
  createdAt: string    // ISO from frontmatter
  updatedAt: string    // ISO from fragment
  tags: string[]       // plain strings (user tags only, no status:/priority: prefixes)
  projects: string[]   // project names (extracted from project: tags)
  dependencies: string[] // fragment IDs
  comments: TaskComment[]
  startDate?: string     // ISO date string (YYYY-MM-DD)
  endDate?: string       // ISO date string (YYYY-MM-DD)
  assigneeId?: string    // userId of assigned workspace member
  jiraKey?: string       // e.g. PROJ-123 — when set, status changes sync to JIRA
  jiraUrl?: string       // e.g. https://company.atlassian.net/browse/PROJ-123 — link to open in JIRA
}

export interface CreateTaskInput {
  title: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  tags?: string[]
  projects?: string[]
  startDate?: string
  endDate?: string
  assigneeId?: string
  jiraKey?: string
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  kanbanOrder?: number
  listOrder?: number
  tags?: string[]
  projects?: string[]
  dependencies?: string[]
  comments?: TaskComment[]
  startDate?: string | null
  endDate?: string | null
  assigneeId?: string | null
  jiraKey?: string | null
}

export interface GraphData {
  nodes: TaskWithTags[]
  edges: { id: string; taskId: string; dependsOnId: string }[]
}

export interface IpcResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface UsableWorkspace {
  id: string
  name: string
  description?: string
}

export interface UsableFragmentType {
  id: string
  name: string
  description?: string
}

export interface WorkspaceConfig {
  workspaceId: string
  workspaceName: string
  taskFragmentTypeId?: string
}

/** JIRA Cloud connection (domain only, e.g. "mycompany"). Auth: email + API token. */
export interface JiraConfig {
  domain: string
  email: string
  apiToken: string
}
