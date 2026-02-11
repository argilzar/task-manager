const DEFAULT_APP_NAME = "My Tasks Planner";

/**
 * Returns the application display name.
 * Set APP_NAME environment variable to override (e.g. for white-label builds).
 */
export function getAppName(): string {
	return process.env.APP_NAME?.trim() || DEFAULT_APP_NAME;
}
