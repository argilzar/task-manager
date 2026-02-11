import { ipcMain } from "electron";
import { registerTaskHandlers } from "./ipc/task-handlers";
import { registerDependencyHandlers } from "./ipc/dependency-handlers";
import { registerTagHandlers } from "./ipc/tag-handlers";
import { registerAuthHandlers } from "./ipc/auth-handlers";
import { registerUsableHandlers } from "./ipc/usable-handlers";
import { registerJiraHandlers } from "./ipc/jira-handlers";
import { getAppName } from "./app-config";
import { IPC_CHANNELS } from "../shared/ipc-channels";

export function registerAllHandlers(): void {
	registerTaskHandlers();
	registerDependencyHandlers();
	registerTagHandlers();
	registerAuthHandlers();
	registerUsableHandlers();
	registerJiraHandlers();

	// Theme handlers
	let storedTheme = "system";

	ipcMain.handle(IPC_CHANNELS.APP_GET_THEME, async () => {
		return { success: true, data: storedTheme };
	});

	ipcMain.handle(IPC_CHANNELS.APP_SET_THEME, async (_event, theme: string) => {
		storedTheme = theme;
		return { success: true };
	});

	ipcMain.handle(IPC_CHANNELS.APP_GET_NAME, async () => {
		return { success: true, data: getAppName() };
	});

	console.log("All IPC handlers registered");
}
