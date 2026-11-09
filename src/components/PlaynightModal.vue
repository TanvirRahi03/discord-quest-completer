<template>
  <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
    <div 
      class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
    >
      <!-- Header -->
      <div class="px-6 py-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl shadow-inner border border-white/10">
            🌙
          </div>
          <div>
            <h2 class="text-xl font-bold tracking-tight flex items-center gap-2">
              <span>Playnight Generator</span>
              <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/30 border border-indigo-400/40 text-indigo-200">
                Auto-Quest
              </span>
            </h2>
            <p class="text-xs text-indigo-200/80">
              Queue random games with randomized times within your chosen total duration.
            </p>
          </div>
        </div>

        <button 
          @click="closeModal" 
          class="text-indigo-200 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          title="Close"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Body / Config Controls -->
      <div class="p-6 overflow-y-auto space-y-5 flex-1">
        <!-- Grid: Number of Games & Total Time -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <!-- Game Count -->
          <div class="bg-gray-50 dark:bg-gray-900/60 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
            <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              Amount of Random Games
            </label>
            <div class="flex items-center gap-3">
              <input
                v-model.number="gameCount"
                type="number"
                min="1"
                max="30"
                class="w-20 px-3 py-1.5 text-base font-bold font-mono text-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
              <span class="text-xs text-gray-500 dark:text-gray-400">games</span>
            </div>

            <!-- Quick Count Presets -->
            <div class="flex items-center gap-1.5 mt-3">
              <span class="text-[11px] text-gray-400">Presets:</span>
              <button
                v-for="preset in [3, 4, 5, 6, 8, 10]"
                :key="preset"
                @click="setGameCount(preset)"
                class="px-2 py-0.5 text-xs rounded border transition-colors font-mono"
                :class="[
                  gameCount === preset
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                ]"
              >
                {{ preset }}
              </button>
            </div>
          </div>

          <!-- Total Duration -->
          <div class="bg-gray-50 dark:bg-gray-900/60 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
            <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              Total Night Duration
            </label>
            <div class="flex items-center gap-2">
              <div class="flex items-center gap-1">
                <input
                  v-model.number="totalHours"
                  type="number"
                  min="0"
                  max="24"
                  class="w-16 px-2 py-1.5 text-base font-bold font-mono text-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
                <span class="text-xs text-gray-500">hr</span>
              </div>
              <div class="flex items-center gap-1">
                <input
                  v-model.number="totalMinutes"
                  type="number"
                  min="0"
                  max="59"
                  class="w-16 px-2 py-1.5 text-base font-bold font-mono text-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
                <span class="text-xs text-gray-500">min</span>
              </div>
            </div>

            <!-- Quick Duration Presets -->
            <div class="flex items-center gap-1.5 mt-3 flex-wrap">
              <span class="text-[11px] text-gray-400">Presets:</span>
              <button
                v-for="p in durationPresets"
                :key="p.label"
                @click="setDurationPreset(p.h, p.m)"
                class="px-2 py-0.5 text-xs rounded border transition-colors font-mono"
                :class="[
                  totalHours === p.h && totalMinutes === p.m
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                ]"
              >
                {{ p.label }}
              </button>
            </div>
          </div>
        </div>

        <!-- Mode & Options -->
        <div class="bg-gray-50 dark:bg-gray-900/40 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
              Time Distribution Style
            </span>
            <div class="flex items-center gap-2">
              <label class="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                <input 
                  type="radio" 
                  value="random_split" 
                  v-model="distributionMode" 
                  class="text-indigo-600 focus:ring-indigo-500" 
                />
                <span>Random Slice (Sum = Exact Total)</span>
              </label>
              <label class="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 cursor-pointer ml-3">
                <input 
                  type="radio" 
                  value="quest_safe" 
                  v-model="distributionMode" 
                  class="text-indigo-600 focus:ring-indigo-500" 
                />
                <span>Quest Optimal (~15-18m each)</span>
              </label>
            </div>
          </div>

          <label class="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
            <input 
              type="checkbox" 
              v-model="excludeQueued" 
              class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" 
            />
            <span>Skip games already in queue</span>
          </label>
        </div>

        <!-- Generated Games Preview Header -->
        <div class="flex items-center justify-between pt-2">
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>Selected Preview</span>
              <span class="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-mono">
                {{ previewItems.length }} Games
              </span>
            </h3>
            <span class="text-xs text-gray-400 font-mono">
              (Total: {{ formatSeconds(previewTotalSeconds) }})
            </span>
          </div>

          <button
            @click="regeneratePreview"
            class="px-3 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5 transition-colors"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>🎲 Re-roll / Shuffle</span>
          </button>
        </div>

        <!-- Preview Games List -->
        <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
          <div 
            v-if="previewItems.length === 0" 
            class="p-6 text-center text-xs text-gray-400 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg"
          >
            No games found. Try clicking "Re-roll / Shuffle".
          </div>
          <div
            v-for="(item, idx) in previewItems"
            :key="item.game.id"
            class="flex items-center justify-between p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs shadow-2xs"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 font-mono text-[10px] flex items-center justify-center font-bold">
                {{ idx + 1 }}
              </span>
              <div class="truncate">
                <div class="font-semibold text-gray-800 dark:text-white truncate">
                  {{ item.game.name }}
                </div>
                <div class="text-[11px] font-mono text-gray-400 truncate">
                  {{ item.executableFilename }}
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <span class="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800/60">
                {{ item.durationMinutes }}m {{ item.durationSeconds }}s
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Buttons -->
      <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
        <button
          @click="closeModal"
          class="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          Cancel
        </button>

        <div class="flex items-center gap-2">
          <button
            @click="handleAddToQueue"
            :disabled="previewItems.length === 0"
            class="px-4 py-2 rounded-xl text-xs font-semibold border border-indigo-500 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors disabled:opacity-40"
          >
            + Add to Queue
          </button>

          <button
            @click="handleStartPlaynight"
            :disabled="previewItems.length === 0"
            class="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-md transition-all active:scale-95 disabled:opacity-40 flex items-center gap-1.5"
          >
            <span>🚀 Start Playnight Now</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Game } from '@/types/types';
import { useQueue } from '@/composables/use-queue';
import { useFetchGameList } from '@/composables/fetch-gamelist';
import { useGameSearch } from '@/composables/use-game-search';
import { prepareExecutable, getBestExecutable } from '@/utils/executable-helper';
import { Pages, useGlobalState } from '@/composables/app-state';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
}>();

const { gameDB } = useFetchGameList();
const { getRandomGames } = useGameSearch(gameDB);
const { queueItems, addPlaynightItems, startQueue, formatSeconds } = useQueue();
const { setPage, addLog } = useGlobalState();

// User config
const gameCount = ref(5);
const totalHours = ref(1);
const totalMinutes = ref(30);
const distributionMode = ref<'random_split' | 'quest_safe'>('random_split');
const excludeQueued = ref(true);

const durationPresets = [
  { label: '45m', h: 0, m: 45 },
  { label: '1h', h: 1, m: 0 },
  { label: '1.5h', h: 1, m: 30 },
  { label: '2h', h: 2, m: 0 },
  { label: '3h', h: 3, m: 0 },
];

interface PlaynightPreviewItem {
  game: Game;
  executableFilename: string;
  durationMinutes: number;
  durationSeconds: number;
}

const previewItems = ref<PlaynightPreviewItem[]>([]);

const previewTotalSeconds = computed(() => {
  return previewItems.value.reduce(
    (sum, item) => sum + item.durationMinutes * 60 + item.durationSeconds,
    0
  );
});

function setGameCount(c: number) {
  gameCount.value = c;
}

function setDurationPreset(h: number, m: number) {
  totalHours.value = h;
  totalMinutes.value = m;
}

function closeModal() {
  emit('update:modelValue', false);
}

function regeneratePreview() {
  const count = Math.max(1, Math.min(30, gameCount.value || 5));
  const excludeIds = new Set<string>();
  if (excludeQueued.value) {
    for (const item of queueItems.value) {
      excludeIds.add(String(item.gameId));
    }
  }

  const selectedGames = getRandomGames(count, excludeIds);
  if (selectedGames.length === 0) {
    previewItems.value = [];
    return;
  }

  const n = selectedGames.length;
  let durations: { minutes: number; seconds: number }[] = [];

  if (distributionMode.value === 'quest_safe') {
    // Each game gets a random time between 15m 10s and 18m 00s (guaranteeing quest completion with natural jitter)
    durations = Array.from({ length: n }, () => {
      const sec = 15 * 60 + 10 + Math.floor(Math.random() * 170);
      return {
        minutes: Math.floor(sec / 60),
        seconds: sec % 60,
      };
    });
  } else {
    // Random split partitioning total time
    const totalSec = Math.max(n * 60, (totalHours.value * 60 + totalMinutes.value) * 60);
    const minSecPerGame = Math.max(60, Math.floor((totalSec / n) * 0.4));
    const baseTotal = minSecPerGame * n;
    const pool = Math.max(0, totalSec - baseTotal);

    const weights = Array.from({ length: n }, () => 0.3 + Math.random() * 0.7);
    const weightSum = weights.reduce((a, b) => a + b, 0);

    let allocated = 0;
    durations = [];
    for (let i = 0; i < n; i++) {
      if (i === n - 1) {
        const sec = Math.max(60, totalSec - allocated);
        durations.push({
          minutes: Math.floor(sec / 60),
          seconds: sec % 60,
        });
      } else {
        const add = Math.round(pool * (weights[i] / weightSum));
        const sec = minSecPerGame + add;
        allocated += sec;
        durations.push({
          minutes: Math.floor(sec / 60),
          seconds: sec % 60,
        });
      }
    }
  }

  const nextItems: PlaynightPreviewItem[] = [];
  for (let i = 0; i < selectedGames.length; i++) {
    const game = selectedGames[i];
    const exec = getBestExecutable(game);
    const prep = exec ? prepareExecutable(exec) : null;
    nextItems.push({
      game,
      executableFilename: prep?.filename || 'game.exe',
      durationMinutes: durations[i]?.minutes ?? 15,
      durationSeconds: durations[i]?.seconds ?? 0,
    });
  }

  previewItems.value = nextItems;
}

watch(
  [gameCount, totalHours, totalMinutes, distributionMode, () => props.modelValue],
  () => {
    if (props.modelValue) {
      regeneratePreview();
    }
  },
  { immediate: true }
);

function handleAddToQueue() {
  if (previewItems.value.length === 0) return;
  const count = addPlaynightItems(
    previewItems.value.map(item => ({
      game: item.game,
      durationMinutes: item.durationMinutes,
      durationSeconds: item.durationSeconds,
    }))
  );
  addLog('info', `🌙 Playnight: Added ${count} random games to queue!`);
  closeModal();
}

function handleStartPlaynight() {
  handleAddToQueue();
  setPage(Pages.QUEUE);
  startQueue();
}
</script>

