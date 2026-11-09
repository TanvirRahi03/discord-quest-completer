import { ref, computed, watch } from 'vue';
import { createGlobalState } from '@vueuse/core';
import { invoke } from '@tauri-apps/api/core';
import { Game, GameExecutable, QueueItem, QueueStatus } from '@/types/types';
import { useGlobalState } from '@/composables/app-state';
import { randomString } from '@/utils/random-string';
import { getBestExecutable, prepareExecutable } from '@/utils/executable-helper';
import { playChime } from '@/utils/audio-chime';

const STORAGE_KEY_ITEMS = 'dqc_quest_queue_items';
const STORAGE_KEY_SETTINGS = 'dqc_quest_queue_settings';

export const useQueue = createGlobalState(() => {
  const { addLog } = useGlobalState();

  // Load persisted items
  const savedItemsRaw = localStorage.getItem(STORAGE_KEY_ITEMS);
  let initialItems: QueueItem[] = [];
  if (savedItemsRaw) {
    try {
      const parsed = JSON.parse(savedItemsRaw);
      if (Array.isArray(parsed)) {
        // Reset any items that were left as 'running' back to 'pending' on startup
        initialItems = parsed.map((item: QueueItem) => ({
          ...item,
          status: item.status === 'running' ? 'pending' : item.status,
          timeRemaining: item.status === 'running'
            ? item.durationMinutes * 60 + item.durationSeconds
            : item.timeRemaining,
        }));
      }
    } catch (e) {
      console.error('Failed to parse saved queue items:', e);
    }
  }

  // Load persisted settings
  const savedSettingsRaw = localStorage.getItem(STORAGE_KEY_SETTINGS);
  let initialSettings = {
    defaultDurationMinutes: 15,
    defaultDurationSeconds: 0,
    transitionDelaySeconds: 5,
    repeatQueue: false,
    soundEnabled: true,
  };
  if (savedSettingsRaw) {
    try {
      initialSettings = { ...initialSettings, ...JSON.parse(savedSettingsRaw) };
    } catch (e) {
      console.error('Failed to parse saved queue settings:', e);
    }
  }

  // State
  const queueItems = ref<QueueItem[]>(initialItems);
  const queueStatus = ref<QueueStatus>('idle');
  const activeItemId = ref<string | null>(null);
  const transitionCountdown = ref<number>(0);

  // Settings
  const defaultDurationMinutes = ref<number>(initialSettings.defaultDurationMinutes);
  const defaultDurationSeconds = ref<number>(initialSettings.defaultDurationSeconds);
  const transitionDelaySeconds = ref<number>(initialSettings.transitionDelaySeconds);
  const repeatQueue = ref<boolean>(initialSettings.repeatQueue);
  const soundEnabled = ref<boolean>(initialSettings.soundEnabled);

  // Timers
  let timerInterval: number | null = null;
  let transitionInterval: number | null = null;

  // Persist items
  watch(
    queueItems,
    (items) => {
      localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
    },
    { deep: true }
  );

  // Persist settings
  watch(
    [defaultDurationMinutes, defaultDurationSeconds, transitionDelaySeconds, repeatQueue, soundEnabled],
    () => {
      const settings = {
        defaultDurationMinutes: defaultDurationMinutes.value,
        defaultDurationSeconds: defaultDurationSeconds.value,
        transitionDelaySeconds: transitionDelaySeconds.value,
        repeatQueue: repeatQueue.value,
        soundEnabled: soundEnabled.value,
      };
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    }
  );

  // Getters / Computed
  const activeItemIndex = computed(() => {
    if (!activeItemId.value) return -1;
    return queueItems.value.findIndex(item => item.id === activeItemId.value);
  });

  const currentItem = computed<QueueItem | null>(() => {
    if (activeItemIndex.value === -1) return null;
    return queueItems.value[activeItemIndex.value] || null;
  });

  const isQueueRunning = computed(() => {
    return queueStatus.value === 'running' || queueStatus.value === 'waiting_transition';
  });

  const isQueueActive = computed(() => {
    return queueStatus.value !== 'idle';
  });

  const pendingCount = computed(() => {
    return queueItems.value.filter(i => i.status === 'pending').length;
  });

  const completedCount = computed(() => {
    return queueItems.value.filter(i => i.status === 'completed').length;
  });

  const totalItems = computed(() => queueItems.value.length);

  const currentProgressPercent = computed(() => {
    if (!currentItem.value) return 0;
    const totalSec = currentItem.value.durationMinutes * 60 + currentItem.value.durationSeconds;
    if (totalSec <= 0) return 100;
    const elapsed = totalSec - currentItem.value.timeRemaining;
    return Math.min(100, Math.max(0, Math.round((elapsed / totalSec) * 100)));
  });

  const totalQueueRemainingSeconds = computed(() => {
    let total = 0;
    for (const item of queueItems.value) {
      if (item.status === 'running') {
        total += item.timeRemaining;
      } else if (item.status === 'pending') {
        total += item.durationMinutes * 60 + item.durationSeconds;
      }
    }
    return total;
  });

  // Time formatter helper
  function formatSeconds(sec: number): string {
    const s = Math.max(0, Math.floor(sec));
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = s % 60;

    const pad = (n: number) => n.toString().padStart(2, '0');

    if (hours > 0) {
      return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  }

  // Queue actions
  function addToQueue(
    game: Game,
    executable?: GameExecutable,
    customDuration?: { minutes?: number; seconds?: number }
  ): QueueItem | null {
    const exec = executable || getBestExecutable(game);
    if (!exec) {
      addLog('error', `Cannot add "${game.name}" to queue: no valid executable found.`);
      return null;
    }

    const { path, filename, segments } = prepareExecutable(exec);
    const minutes = customDuration?.minutes ?? defaultDurationMinutes.value;
    const seconds = customDuration?.seconds ?? defaultDurationSeconds.value;

    const newItem: QueueItem = {
      id: randomString(12),
      gameId: game.id,
      gameName: game.name,
      gameUid: game.uid,
      executableName: exec.name,
      executableFilename: filename,
      executablePath: path,
      executableSegments: segments,
      executableOs: exec.os,
      durationMinutes: minutes,
      durationSeconds: seconds,
      status: 'pending',
      timeRemaining: minutes * 60 + seconds,
      elapsedSeconds: 0,
      addedAt: Date.now(),
    };

    queueItems.value.push(newItem);
    addLog('info', `Added "${game.name}" (${filename}) to queue [${minutes}m ${seconds}s]`);
    return newItem;
  }

  function addMultipleToQueue(games: Game[]): number {
    let count = 0;
    for (const game of games) {
      if (addToQueue(game)) {
        count++;
      }
    }
    return count;
  }

  function addPlaynightItems(items: { game: Game; durationMinutes: number; durationSeconds: number }[]): number {
    let count = 0;
    for (const entry of items) {
      if (addToQueue(entry.game, undefined, { minutes: entry.durationMinutes, seconds: entry.durationSeconds })) {
        count++;
      }
    }
    return count;
  }

  async function removeFromQueue(itemId: string) {
    const index = queueItems.value.findIndex(item => item.id === itemId);
    if (index === -1) return;

    const item = queueItems.value[index];

    // If currently running, stop it first
    if (activeItemId.value === itemId && queueStatus.value !== 'idle') {
      await stopCurrentProcess(item);
      moveToNextItem();
    }

    queueItems.value.splice(index, 1);
    addLog('info', `Removed "${item.gameName}" from queue.`);
  }

  function updateItemDuration(itemId: string, minutes: number, seconds: number) {
    const item = queueItems.value.find(i => i.id === itemId);
    if (!item) return;

    item.durationMinutes = Math.max(0, minutes);
    item.durationSeconds = Math.max(0, Math.min(59, seconds));

    if (item.status === 'pending') {
      item.timeRemaining = item.durationMinutes * 60 + item.durationSeconds;
    }
  }

  function applyDefaultDurationToAll() {
    for (const item of queueItems.value) {
      if (item.status === 'pending') {
        item.durationMinutes = defaultDurationMinutes.value;
        item.durationSeconds = defaultDurationSeconds.value;
        item.timeRemaining = item.durationMinutes * 60 + item.durationSeconds;
      }
    }
    addLog('info', `Updated pending queue items duration to ${defaultDurationMinutes.value}m ${defaultDurationSeconds.value}s`);
  }

  function moveItemUp(index: number) {
    if (index <= 0 || index >= queueItems.value.length) return;
    const temp = queueItems.value[index];
    queueItems.value[index] = queueItems.value[index - 1];
    queueItems.value[index - 1] = temp;
  }

  function moveItemDown(index: number) {
    if (index < 0 || index >= queueItems.value.length - 1) return;
    const temp = queueItems.value[index];
    queueItems.value[index] = queueItems.value[index + 1];
    queueItems.value[index + 1] = temp;
  }

  async function clearQueue() {
    if (queueStatus.value !== 'idle') {
      await stopQueue();
    }
    queueItems.value = [];
    addLog('info', 'Queue cleared.');
  }

  function clearCompleted() {
    queueItems.value = queueItems.value.filter(
      item => item.status !== 'completed' && item.status !== 'skipped'
    );
  }

  function resetQueue() {
    if (queueStatus.value !== 'idle') {
      stopQueue();
    }
    for (const item of queueItems.value) {
      item.status = 'pending';
      item.timeRemaining = item.durationMinutes * 60 + item.durationSeconds;
      item.elapsedSeconds = 0;
      delete item.error;
    }
    addLog('info', 'Reset all items in queue to pending.');
  }

  // Execution Engine
  async function startQueue() {
    if (queueStatus.value === 'running') return;

    // Clear any timers
    clearAllTimers();

    // If currently paused with an active item, resume it
    if (queueStatus.value === 'paused' && currentItem.value) {
      resumeQueue();
      return;
    }

    // Find first pending item
    let startIndex = queueItems.value.findIndex(item => item.status === 'pending');

    // If no pending items but repeat is enabled, reset and start from beginning
    if (startIndex === -1) {
      if (queueItems.value.length > 0) {
        resetQueue();
        startIndex = 0;
      } else {
        addLog('warning', 'Queue is empty. Add games to queue first.');
        return;
      }
    }

    activeItemId.value = queueItems.value[startIndex].id;
    queueStatus.value = 'running';
    addLog('info', `[Queue] Starting queue with ${pendingCount.value} pending games...`);
    await processCurrentItem();
  }

  async function processCurrentItem() {
    if (queueStatus.value !== 'running' || !currentItem.value) return;

    const item = currentItem.value;
    item.status = 'running';
    if (item.timeRemaining <= 0) {
      item.timeRemaining = item.durationMinutes * 60 + item.durationSeconds;
    }
    item.elapsedSeconds = (item.durationMinutes * 60 + item.durationSeconds) - item.timeRemaining;

    addLog('info', `[Queue] Opening window for "${item.gameName}" (${item.executableFilename})...`);

    // 1. Ensure dummy executable is created
    try {
      await invoke('create_fake_game', {
        path: item.executablePath,
        executable_name: item.executableFilename,
        path_len: item.executableSegments,
        app_id: Number(item.gameId),
        display_name: item.gameName,
      });
    } catch (err) {
      console.warn('[Queue] Note from create_fake_game:', err);
    }

    // 2. Spawn the process (opens the window)
    try {
      await invoke('run_background_process', {
        name: item.gameName,
        path: item.executablePath,
        executable_name: item.executableFilename,
        path_len: item.executableSegments,
        app_id: Number(item.gameId),
        exec_path: item.executablePath ? `${item.executablePath}/${item.executableFilename}` : item.executableFilename,
      });
      addLog('info', `[Queue] Window opened: "${item.gameName}". Countdown: ${formatSeconds(item.timeRemaining)}`);
    } catch (err: any) {
      const errMsg = err instanceof Error ? err.message : String(err);
      addLog('error', `[Queue] Failed to open window for "${item.gameName}": ${errMsg}`);
      item.status = 'failed';
      item.error = errMsg;
      // Skip to next item
      await moveToNextItem();
      return;
    }

    // 3. Start countdown timer
    startTimer(item);
  }

  function startTimer(item: QueueItem) {
    clearAllTimers();

    timerInterval = window.setInterval(async () => {
      if (queueStatus.value !== 'running') return;

      if (item.timeRemaining > 0) {
        item.timeRemaining--;
        item.elapsedSeconds++;
      }

      if (item.timeRemaining <= 0) {
        // Time expired! Automatically close current window and open next!
        clearAllTimers();
        await onTimerFinished(item);
      }
    }, 1000);
  }

  async function onTimerFinished(item: QueueItem) {
    addLog('info', `[Queue] Timer expired for "${item.gameName}". Automatically closing window...`);

    // Automatically close the window
    await stopCurrentProcess(item);

    item.status = 'completed';
    if (soundEnabled.value) {
      playChime(false);
    }

    // Advance to next queued window
    await moveToNextItem();
  }

  async function stopCurrentProcess(item: QueueItem) {
    try {
      await invoke('stop_process', {
        exec_name: item.executableFilename,
      });
      addLog('info', `[Queue] Closed window for "${item.gameName}".`);
    } catch (err: any) {
      // Process might already be closed manually by user
      console.debug('[Queue] Process closed with notice:', err);
    }
  }

  async function moveToNextItem() {
    clearAllTimers();

    // Find next pending item
    const nextItem = queueItems.value.find(item => item.status === 'pending');

    if (nextItem) {
      activeItemId.value = nextItem.id;
      const delay = transitionDelaySeconds.value;

      if (delay > 0) {
        queueStatus.value = 'waiting_transition';
        transitionCountdown.value = delay;
        addLog('info', `[Queue] Next window: "${nextItem.gameName}" in ${delay}s...`);

        transitionInterval = window.setInterval(async () => {
          if (queueStatus.value !== 'waiting_transition') return;

          transitionCountdown.value--;
          if (transitionCountdown.value <= 0) {
            clearAllTimers();
            queueStatus.value = 'running';
            await processCurrentItem();
          }
        }, 1000);
      } else {
        queueStatus.value = 'running';
        await processCurrentItem();
      }
    } else {
      // No more pending items! Check repeat option
      if (repeatQueue.value && queueItems.value.length > 0) {
        addLog('info', `[Queue] Repeat queue enabled. Resetting and looping queue...`);
        resetQueue();
        const first = queueItems.value[0];
        activeItemId.value = first.id;
        queueStatus.value = 'running';
        await processCurrentItem();
      } else {
        // Queue complete!
        finishQueue();
      }
    }
  }

  function finishQueue() {
    clearAllTimers();
    queueStatus.value = 'idle';
    activeItemId.value = null;
    addLog('info', `[Queue] All queued windows completed!`);
    if (soundEnabled.value) {
      playChime(true);
    }
  }

  function pauseQueue() {
    if (queueStatus.value !== 'running' && queueStatus.value !== 'waiting_transition') return;
    clearAllTimers();
    queueStatus.value = 'paused';
    addLog('info', `[Queue] Queue paused.`);
  }

  function resumeQueue() {
    if (queueStatus.value !== 'paused') return;
    queueStatus.value = 'running';
    addLog('info', `[Queue] Queue resumed.`);

    if (currentItem.value) {
      startTimer(currentItem.value);
    } else {
      moveToNextItem();
    }
  }

  async function stopQueue() {
    clearAllTimers();

    if (currentItem.value) {
      // Close currently active window
      await stopCurrentProcess(currentItem.value);
      if (currentItem.value.status === 'running') {
        currentItem.value.status = 'pending';
      }
    }

    queueStatus.value = 'idle';
    activeItemId.value = null;
    transitionCountdown.value = 0;
    addLog('info', `[Queue] Queue stopped.`);
  }

  async function skipCurrent() {
    if (!currentItem.value) return;
    const item = currentItem.value;

    addLog('info', `[Queue] Skipping "${item.gameName}"...`);
    await stopCurrentProcess(item);
    item.status = 'skipped';

    await moveToNextItem();
  }

  async function runSpecificItemNow(itemId: string) {
    if (queueStatus.value !== 'idle') {
      await stopQueue();
    }
    const item = queueItems.value.find(i => i.id === itemId);
    if (!item) return;

    item.status = 'pending';
    item.timeRemaining = item.durationMinutes * 60 + item.durationSeconds;
    item.elapsedSeconds = 0;

    activeItemId.value = itemId;
    queueStatus.value = 'running';
    await processCurrentItem();
  }

  function clearAllTimers() {
    if (timerInterval !== null) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    if (transitionInterval !== null) {
      clearInterval(transitionInterval);
      transitionInterval = null;
    }
  }

  return {
    // State
    queueItems,
    queueStatus,
    activeItemId,
    currentItem,
    activeItemIndex,
    transitionCountdown,

    // Settings
    defaultDurationMinutes,
    defaultDurationSeconds,
    transitionDelaySeconds,
    repeatQueue,
    soundEnabled,

    // Computed
    isQueueRunning,
    isQueueActive,
    pendingCount,
    completedCount,
    totalItems,
    currentProgressPercent,
    totalQueueRemainingSeconds,

    // Actions
    addToQueue,
    addMultipleToQueue,
    addPlaynightItems,
    removeFromQueue,
    updateItemDuration,
    applyDefaultDurationToAll,
    moveItemUp,
    moveItemDown,
    clearQueue,
    clearCompleted,
    resetQueue,

    // Execution controls
    startQueue,
    pauseQueue,
    resumeQueue,
    stopQueue,
    skipCurrent,
    runSpecificItemNow,

    // Helpers
    formatSeconds,
  };
});

