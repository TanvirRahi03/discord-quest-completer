export interface GameExecutable {
  is_launcher: boolean;
  name: string;
  os: string;
  filename?: string;
  path?: string;
  segments?: number;
  is_running?: boolean;
  is_installed?: boolean;
}

export interface Game {
  uid?: string;
  id: string;
  name: string;
  executables: GameExecutable[];
  aliases?: string[];
  themes?: string[];
  is_running?: boolean;
  is_installed?: boolean;
}

export interface GameActionsProvider {
  canPlayGame: (game: Game | null) => boolean;
  isGameInstalled: (game: Game | null) => boolean;
  isExecutableRunning: (executable: GameExecutable) => boolean;
  isGameExecutableInstalled: (executable: GameExecutable) => boolean;
}

export type QueueItemStatus = 'pending' | 'running' | 'completed' | 'skipped' | 'failed';

export interface QueueItem {
  id: string;
  gameId: string;
  gameName: string;
  gameUid?: string;
  executableName: string;
  executableFilename: string;
  executablePath: string;
  executableSegments: number;
  executableOs: string;
  durationMinutes: number;
  durationSeconds: number;
  status: QueueItemStatus;
  timeRemaining: number; // in seconds
  elapsedSeconds: number; // in seconds
  error?: string;
  addedAt: number;
}

export type QueueStatus = 'idle' | 'running' | 'paused' | 'waiting_transition';
