import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { useWorkspaceConfig, useSetWorkspace, useFragmentTypes } from '@/hooks/use-usable'
import { useConnectionStatus } from '@/hooks/use-usable'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { UsableWorkspace, UsableFragmentType, ChatMode } from '../../../../shared/types'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  chatMode?: ChatMode
  onChatModeChange?: (mode: ChatMode) => void
}

export function SettingsModal({ open, onClose, chatMode, onChatModeChange }: SettingsModalProps) {
  const { data: currentConfig } = useWorkspaceConfig()
  const { data: isConnected } = useConnectionStatus()
  const setWorkspace = useSetWorkspace()

  const [workspaces, setWorkspaces] = useState<UsableWorkspace[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('')
  const [selectedWorkspaceName, setSelectedWorkspaceName] = useState('')
  const [selectedFragmentTypeId, setSelectedFragmentTypeId] = useState('')

  // Advanced overrides
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [embedUrlOverride, setEmbedUrlOverride] = useState('')
  const [embedTokenOverride, setEmbedTokenOverride] = useState('')

  const { data: fragmentTypes } = useFragmentTypes(selectedWorkspaceId || undefined)

  // Load workspaces + advanced overrides when modal opens
  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)

    // Initialize from current config
    if (currentConfig) {
      setSelectedWorkspaceId(currentConfig.workspaceId || '')
      setSelectedWorkspaceName(currentConfig.workspaceName || '')
      setSelectedFragmentTypeId(currentConfig.taskFragmentTypeId || '')
    }

    // Load advanced overrides from localStorage
    setEmbedUrlOverride(localStorage.getItem('embed-url-override') || '')
    setEmbedTokenOverride(localStorage.getItem('embed-token-override') || '')

    window.api.usable.listWorkspaces()
      .then(result => {
        if (result.success && result.data) {
          setWorkspaces(result.data)
        } else {
          setError(result.error || 'Failed to load workspaces')
        }
      })
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }, [open, currentConfig])

  // Auto-select "task" fragment type when workspace changes
  useEffect(() => {
    if (fragmentTypes && fragmentTypes.length > 0 && !selectedFragmentTypeId) {
      const taskType = fragmentTypes.find(t => t.name.toLowerCase() === 'task')
        || fragmentTypes.find(t => t.name.toLowerCase() === 'knowledge')
      if (taskType) {
        setSelectedFragmentTypeId(taskType.id)
      }
    }
  }, [fragmentTypes, selectedFragmentTypeId])

  const handleWorkspaceChange = (wsId: string) => {
    const ws = workspaces.find(w => w.id === wsId)
    setSelectedWorkspaceId(wsId)
    setSelectedWorkspaceName(ws?.name || '')
    setSelectedFragmentTypeId('') // Reset fragment type
  }

  const handleSave = async () => {
    if (!selectedWorkspaceId) return

    // Save advanced overrides to localStorage
    if (embedUrlOverride.trim()) {
      localStorage.setItem('embed-url-override', embedUrlOverride.trim())
    } else {
      localStorage.removeItem('embed-url-override')
    }
    if (embedTokenOverride.trim()) {
      localStorage.setItem('embed-token-override', embedTokenOverride.trim())
    } else {
      localStorage.removeItem('embed-token-override')
    }

    try {
      await setWorkspace.mutateAsync({
        workspaceId: selectedWorkspaceId,
        workspaceName: selectedWorkspaceName,
        taskFragmentTypeId: selectedFragmentTypeId || undefined,
      })
      onClose()

      // Reload to apply URL/token changes to the embed iframe
      if (
        (embedUrlOverride.trim() || '') !== (localStorage.getItem('embed-url-override') || '') ||
        (embedTokenOverride.trim() || '') !== (localStorage.getItem('embed-token-override') || '')
      ) {
        window.location.reload()
      }
    } catch (err) {
      setError(String(err))
    }
  }

  const handleDisconnect = async () => {
    try {
      await setWorkspace.mutateAsync(null)
      setSelectedWorkspaceId('')
      setSelectedWorkspaceName('')
      setSelectedFragmentTypeId('')
      onClose()
    } catch (err) {
      setError(String(err))
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Settings">
      <div className="space-y-4">
        {/* Chat Mode */}
        {chatMode && onChatModeChange && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Chat Mode</label>
            <div className="flex gap-2">
              <button
                onClick={() => onChatModeChange('bubble')}
                className={cn(
                  'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors border',
                  chatMode === 'bubble'
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 border-primary-300 dark:border-primary-700'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-600'
                )}
              >
                Bubble Overlay
              </button>
              <button
                onClick={() => onChatModeChange('docked')}
                className={cn(
                  'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors border',
                  chatMode === 'docked'
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 border-primary-300 dark:border-primary-700'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-600'
                )}
              >
                Docked Panel
              </button>
            </div>
          </div>
        )}

        {/* Connection status */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
          <div className={cn('w-2.5 h-2.5 rounded-full', isConnected ? 'bg-green-500' : 'bg-gray-400')} />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {isConnected ? 'Connected' : 'Not connected'}
          </span>
        </div>

        {error && (
          <div className="text-sm text-danger-600 dark:text-danger-400 bg-danger-50 dark:bg-danger-900/20 px-3 py-2 rounded">
            {error}
          </div>
        )}

        {/* Workspace selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Workspace</label>
          {loading ? (
            <div className="text-sm text-gray-500 py-2">Loading workspaces...</div>
          ) : (
            <select
              value={selectedWorkspaceId}
              onChange={e => handleWorkspaceChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-50 text-sm"
            >
              <option value="">Select a workspace...</option>
              {workspaces.map(ws => (
                <option key={ws.id} value={ws.id}>{ws.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Fragment type selector */}
        {selectedWorkspaceId && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Fragment Type</label>
            <select
              value={selectedFragmentTypeId}
              onChange={e => setSelectedFragmentTypeId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-50 text-sm"
            >
              <option value="">Select a fragment type...</option>
              {fragmentTypes?.map((ft: UsableFragmentType) => (
                <option key={ft.id} value={ft.id}>{ft.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Advanced section — collapsible */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
          <button
            onClick={() => setAdvancedOpen(prev => !prev)}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            {advancedOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Advanced
          </button>

          {advancedOpen && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Chat Embed URL
                </label>
                <input
                  type="text"
                  value={embedUrlOverride}
                  onChange={e => setEmbedUrlOverride(e.target.value)}
                  placeholder="https://chat.usable.dev"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-50 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                  Override the chat embed base URL. Leave empty for default.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Embed Token
                </label>
                <input
                  type="text"
                  value={embedTokenOverride}
                  onChange={e => setEmbedTokenOverride(e.target.value)}
                  placeholder="uc_..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-50 text-sm font-mono text-xs placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                  Override the embed token. Leave empty for the built-in default.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between pt-2">
          {currentConfig?.workspaceId && (
            <Button variant="danger" size="sm" onClick={handleDisconnect}>
              Disconnect
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!selectedWorkspaceId || setWorkspace.isPending}
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
