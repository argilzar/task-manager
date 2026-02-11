import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { JiraConfig } from '../shared/types'

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'jira-config.json')
}

export function getJiraConfig(): JiraConfig | null {
  const filePath = getConfigPath()
  if (!fs.existsSync(filePath)) return null

  try {
    const data = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(data) as JiraConfig
  } catch {
    return null
  }
}

export function setJiraConfig(config: JiraConfig): void {
  const filePath = getConfigPath()
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8')
}

export function clearJiraConfig(): void {
  const filePath = getConfigPath()
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}
