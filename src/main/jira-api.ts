import type { JiraConfig } from '../shared/types'
import type { TaskStatus } from '../shared/types'

const JIRA_API_PREFIX = '/rest/api/3'

/** Normalized JIRA issue for creating a planner task */
export interface JiraIssueInfo {
  key: string
  summary: string
  description: string
  statusName: string
  priorityName?: string
  issueType?: string
  webUrl: string
  /** JIRA project key (e.g. CLOUD) for tagging */
  projectKey?: string
  /** JIRA project name */
  projectName?: string
  /** Assignee email for matching to workspace member */
  assigneeEmail?: string
  assigneeDisplayName?: string
  /** Epic issue key when this issue is linked to an Epic */
  epicKey?: string
  /** Epic summary/name (set when we resolve the Epic) */
  epicName?: string
}

/** JIRA transition from GET .../transitions */
interface JiraTransition {
  id: string
  name: string
  to?: { id: string; name: string }
}

/** Planner status -> preferred JIRA status name (for picking a transition) */
const PLANNER_STATUS_TO_JIRA_STATUS: Record<TaskStatus, string[]> = {
  todo: ['To Do', 'Open', 'Backlog', 'Selected for Development'],
  'in-progress': ['In Progress', 'In Development', 'In Review'],
  done: ['Done', 'Closed', 'Resolved', 'Complete'],
  archived: ['Done', 'Closed', 'Resolved', 'Complete'],
}

function baseUrl(domain: string): string {
  const d = domain.replace(/^https?:\/\//, '').replace(/\.atlassian\.net.*$/, '')
  return `https://${d}.atlassian.net`
}

/** Build the JIRA browse URL for an issue (for "Open in JIRA" link). */
export function getJiraBrowseUrl(config: JiraConfig, issueKey: string): string {
  return `${baseUrl(config.domain)}/browse/${encodeURIComponent(issueKey)}`
}

function authHeader(email: string, apiToken: string): string {
  const encoded = Buffer.from(`${email}:${apiToken}`, 'utf-8').toString('base64')
  return `Basic ${encoded}`
}

async function jiraFetch(
  config: JiraConfig,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${baseUrl(config.domain)}${path}`
  const headers: HeadersInit = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: authHeader(config.email, config.apiToken),
    ...options.headers,
  }
  return fetch(url, { ...options, headers })
}

/**
 * Extract plain text from JIRA description.
 * Can be ADF (Atlassian Document Format) object or plain string.
 */
function descriptionToPlainText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null && 'content' in value) {
    const adf = value as { type?: string; content?: Array<{ type?: string; text?: string; content?: unknown[] }> }
    const parts: string[] = []
    function walk(nodes: unknown[] | undefined): void {
      if (!Array.isArray(nodes)) return
      for (const node of nodes) {
        if (node && typeof node === 'object') {
          const n = node as Record<string, unknown>
          if (n.text != null && typeof n.text === 'string') parts.push(n.text)
          if (Array.isArray(n.content)) walk(n.content)
        }
      }
    }
    walk(adf.content as unknown[])
    return parts.join(' ').trim() || ''
  }
  return String(value)
}

const ISSUE_KEY_REGEX = /^[A-Z][A-Z0-9]+-\d+$/

function findEpicKeyInFields(fields: Record<string, unknown>): { key: string; name?: string } | undefined {
  // JIRA structure (company-managed): parent can be the Epic
  const parent = fields.parent as { key?: string; fields?: { summary?: string } } | undefined
  if (parent?.key && ISSUE_KEY_REGEX.test(String(parent.key))) {
    return { key: parent.key, name: parent.fields?.summary }
  }
  // Custom field "Epic Link" or similar: value can be key string or { key, ... }
  for (const value of Object.values(fields)) {
    if (typeof value === 'string' && ISSUE_KEY_REGEX.test(value)) {
      return { key: value }
    }
    if (value && typeof value === 'object' && 'key' in value && typeof (value as { key: string }).key === 'string') {
      const v = value as { key: string; fields?: { summary?: string } }
      if (ISSUE_KEY_REGEX.test(v.key)) return { key: v.key, name: v.fields?.summary }
    }
  }
  return undefined
}

/**
 * Fetch a JIRA issue by key and return normalized fields for the planner.
 */
export async function getJiraIssue(config: JiraConfig, issueKey: string): Promise<JiraIssueInfo> {
  const path = `${JIRA_API_PREFIX}/issue/${encodeURIComponent(issueKey)}`
  const res = await jiraFetch(config, path)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`JIRA API error ${res.status}: ${body || res.statusText}`)
  }
  const data = (await res.json()) as {
    key: string
    self?: string
    fields?: Record<string, unknown> & {
      summary?: string
      description?: unknown
      status?: { name: string }
      priority?: { name: string }
      issuetype?: { name: string }
      project?: { key: string; name?: string }
      assignee?: { emailAddress?: string; displayName?: string; accountId?: string }
    }
  }
  const fields = data.fields ?? {}
  const base = baseUrl(config.domain)
  const webUrl = `${base}/browse/${data.key}`

  const project = fields.project as { key?: string; name?: string } | undefined
  const assignee = fields.assignee as { emailAddress?: string; displayName?: string } | undefined
  const epic = findEpicKeyInFields(fields)

  return {
    key: data.key,
    summary: (fields.summary as string) ?? data.key,
    description: descriptionToPlainText(fields.description),
    statusName: fields.status?.name ?? 'Unknown',
    priorityName: fields.priority?.name,
    issueType: fields.issuetype?.name,
    webUrl,
    projectKey: project?.key,
    projectName: project?.name,
    assigneeEmail: assignee?.emailAddress,
    assigneeDisplayName: assignee?.displayName,
    epicKey: epic?.key,
    epicName: epic?.name,
  }
}

/**
 * Get available transitions for an issue.
 */
export async function getJiraTransitions(config: JiraConfig, issueKey: string): Promise<JiraTransition[]> {
  const path = `${JIRA_API_PREFIX}/issue/${encodeURIComponent(issueKey)}/transitions`
  const res = await jiraFetch(config, path)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`JIRA transitions error ${res.status}: ${body || res.statusText}`)
  }
  const data = (await res.json()) as { transitions?: JiraTransition[] }
  return data.transitions ?? []
}

/**
 * Transition an issue to a new status by finding a transition whose target status
 * matches the planner status (using name heuristics).
 */
export async function transitionJiraIssue(
  config: JiraConfig,
  issueKey: string,
  plannerStatus: TaskStatus
): Promise<{ ok: true } | { ok: false; error: string }> {
  const transitions = await getJiraTransitions(config, issueKey)
  const targetNames = PLANNER_STATUS_TO_JIRA_STATUS[plannerStatus]
  const targetSet = new Set(targetNames.map(n => n.toLowerCase()))

  const transition = transitions.find(t => {
    const toName = (t.to?.name ?? t.name).toLowerCase()
    return targetSet.has(toName)
  })

  if (!transition) {
    const available = transitions.map(t => t.to?.name ?? t.name).join(', ') || 'none'
    return { ok: false, error: `No transition to "${targetNames[0]}" for ${issueKey}. Available: ${available}` }
  }

  const path = `${JIRA_API_PREFIX}/issue/${encodeURIComponent(issueKey)}/transitions`
  const res = await jiraFetch(config, path, {
    method: 'POST',
    body: JSON.stringify({ transition: { id: transition.id } }),
  })

  if (!res.ok) {
    const body = await res.text()
    return { ok: false, error: `JIRA transition failed ${res.status}: ${body || res.statusText}` }
  }
  return { ok: true }
}
