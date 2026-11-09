<script setup lang="ts">
import { ref, computed, useTemplateRef, shallowRef, provide } from 'vue';
import { onClickOutside } from '@vueuse/core';
import { invoke } from '@tauri-apps/api/core';
import { randomString } from '@/utils/random-string';
import { GameActionsProvider, GameExecutable, type Game } from '@/types/types';
import IconVerified from '@/components/IconVerified.vue';
import GameExecutables from '@/components/GameExecutables.vue';
import { GameActionsKey } from '@/constants/constants';
import { path } from '@tauri-apps/api';
import { useFetchGameList } from '@/composables/fetch-gamelist';
import { useGameSearch } from '@/composables/use-game-search';
import { Pages, useGlobalState } from '@/composables/app-state';
import { useQueue } from '@/composables/use-queue';
import TimedNotification from '@/components/TimedNotification.vue';
import PlaynightModal from '@/components/PlaynightModal.vue';

const {
    gameDB,
    isLoadingBundled,
    isLoadingDiscord,
    isLoadingGH,
    fetchGameList,
    isReadyGH,
    isReadyBundled,
    isReadyDiscord,
    allFetchDone,
} = useFetchGameList();

const { addLog, setPage } = useGlobalState();
const {
    queueStatus,
    isQueueRunning,
    isQueueActive,
    currentItem,
    activeItemIndex,
    totalItems,
    formatSeconds,
    pauseQueue,
    resumeQueue,
    skipCurrent,
    stopQueue,
    addToQueue,
} = useQueue();

// Fast zero-freeze game search
const { searchQuery, searchResults } = useGameSearch(gameDB);
const showPlaynightModal = ref(false);

function handleAddFromSearchToQueue(game: Game) {
    addToQueue(game);
}

// Single-game auto-close timer
const singleGameAutoClose = ref(false);
const singleGameDurationMinutes = ref(15);
const singleGameRemainingSeconds = ref(0);
let singleGameInterval: number | null = null;

const shouldShowNotificationContainer = computed(() => {
    return isLoadingGH.value || isLoadingDiscord.value || isLoadingBundled.value ||
           (isReadyGH.value || isReadyDiscord.value || isReadyBundled.value);
});

const searchResultContainerRef = useTemplateRef<HTMLElement>('searchResultContainerRef');
const searchResultsIsOpen = ref(false);
const isOnSearchResults = ref(false);

// Game status
const currentlyPlaying = ref<string | null>(null);

onClickOutside(searchResultContainerRef, () => {
    searchResultsIsOpen.value = false;
});

// Selected games list
const gameList = ref<Game[]>([]);
const selectedGameId = ref<string | null | undefined>(null);

const selectedGame = computed(() => {
    if (!selectedGameId.value) return null;
    return gameList.value.find(g => g.uid === selectedGameId.value) || null;
});

function closeSearchResults() {
    searchResultsIsOpen.value = false;
}
function openSearchResults() {
    searchResultsIsOpen.value = true;
}

// Function to add a game to the selected list
function addGameToList(game: Game) {
    if (!gameList.value.some(g => g.id === game.id)) {
        gameList.value.push({
            uid: randomString(),
            ...game
        });
    }
    closeSearchResults();
}

const forceRerenderKey = ref(0); 
function removeGameFromList(game: Game) {
    const gameId = game.uid;
    gameList.value = gameList.value.filter(g => g.uid !== gameId);
    if (selectedGame.value?.uid === gameId) { 
        selectedGameId.value = null;
        forceRerenderKey.value++; 
    }
}

function selectGame(game: Game) {
    selectedGameId.value = game?.uid;
    searchResultsIsOpen.value = false;
}

function canPlayGame(game: Game | null) {
    if (!game) return false;
    return (game.is_installed && !game.is_running) ?? false;
}

function isExecutableRunning(executable: GameExecutable) {
    return executable.is_running ?? false;
}

function isGameExecutableInstalled(executable: GameExecutable) {
    return executable.is_installed ?? false;
}

function isGameInstalled(game: Game | null) {
    if (!game) return false;
    return game.is_installed ?? false;
}

// Create a dummy game
async function createDummyGame(game: Game | null, executable: GameExecutable) {
    if (!game) return;
    const gameUid = game.uid;
    const gameToInstall = gameList.value.find(g => g.uid === gameUid);
    const executableItem = gameToInstall?.executables.find(exe => exe.name === executable.name);
    if (gameToInstall && executableItem) {
        const payload = { 
            path: executable.path,
            executable_name: executable.filename,
            path_len: executable.segments,
            app_id: Number(gameToInstall.id),
            display_name: gameToInstall.name,
        };
        const result = await invoke('create_fake_game', payload);
        console.log('Game created:', result);
        gameToInstall.is_installed = true;
        executableItem.is_installed = true;
        return true;
    }
}

async function installAndPlay({game, executable}: {game: Game, executable: GameExecutable}) {
    if (!game) return;
    const gameCreated = await createDummyGame(game, executable);
    if (gameCreated) {
        playGame({game, executable});
    } else {
        addLog('error', 'Failed to create game');
    }
}

// Play game function
async function playGame({game, executable}: {game: Game, executable: GameExecutable}) {
    if (!game) return;
    const gameUid = game.uid;
    try {
        addLog('info', `Playing game: ${game.name}`);
        addLog('info', `Executable: ${executable.name}`);
        currentlyPlaying.value = game.id;
        const gameToPlay = gameList.value.find(g => g.uid === gameUid);
        const executableItem = gameToPlay?.executables.find(exe => exe.name === executable.name);
        if (gameToPlay && executableItem) {
            const payload = { 
                name: game.name,
                path: executable.path,
                executable_name: executable.filename,
                path_len: executable.segments,
                app_id: Number(gameToPlay.id),
                exec_path: path.join(executable.path!, executable.filename!),
            };
            await invoke('run_background_process', payload);
            gameToPlay.is_running = true;
            executableItem.is_running = true; 

            // Single game auto-close timer if enabled
            if (singleGameAutoClose.value && singleGameDurationMinutes.value > 0) {
                if (singleGameInterval) clearInterval(singleGameInterval);
                singleGameRemainingSeconds.value = singleGameDurationMinutes.value * 60;
                addLog('info', `Auto-close armed: will automatically close in ${singleGameDurationMinutes.value} minutes.`);
                singleGameInterval = window.setInterval(async () => {
                    if (singleGameRemainingSeconds.value > 0) {
                        singleGameRemainingSeconds.value--;
                    }
                    if (singleGameRemainingSeconds.value <= 0) {
                        if (singleGameInterval) clearInterval(singleGameInterval);
                        singleGameInterval = null;
                        addLog('info', `Auto-close timer elapsed. Closing "${game.name}"...`);
                        await stopPlaying({ game, executable });
                    }
                }, 1000);
            }
        }
    } catch (error) {
        console.error('Failed to launch game:', error);
    }
}

// Stop playing
async function stopPlaying({game, executable}: {game: Game, executable: GameExecutable}) {
    if (singleGameInterval) {
        clearInterval(singleGameInterval);
        singleGameInterval = null;
        singleGameRemainingSeconds.value = 0;
    }
    if (!game) return;
    
    currentlyPlaying.value = null;
    const gameUid = game.uid;
    const gameToPlay = gameList.value.find(g => g.uid === gameUid);
    const executableItem = gameToPlay?.executables.find(exe => exe.name === executable.name);
    if (gameToPlay && executableItem) {
        try {
            await invoke('stop_process', {
                exec_name: executable.filename!
            });
            addLog('info', `Stopped game process: ${game.name}`);
        } catch (error) {
            const errorMessage = (error instanceof Error) ? error.message : String(error);
            addLog('error', 'Failed to stop game process: ' + errorMessage);
        } finally {
            gameToPlay.is_running = false;
            executableItem.is_running = false;
        }
    }
}

function handleSearchBlur() {
    setTimeout(() => {
        if (!isOnSearchResults.value) {
            searchResultsIsOpen.value = false;
        }
    }, 200);
}

provide<GameActionsProvider>(GameActionsKey, {
    canPlayGame,
    isGameInstalled,
    isExecutableRunning,
    isGameExecutableInstalled,
});
</script>

<template>
    <div class="container mx-auto px-4 py-8">
        <div class="flex items-center justify-between mb-6">
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
                Game Quest Launcher
            </h1>

            <!-- Playnight Trigger Button -->
            <button
                @click="showPlaynightModal = true"
                class="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl shadow-md flex items-center gap-2 transition-all active:scale-95"
                title="Automatically generate random games with random times for a full night of quest completion"
            >
                <span class="text-sm">🌙</span>
                <span>Playnight Generator</span>
            </button>
        </div>

        <!-- Active Queue Notification Banner -->
        <div v-if="isQueueActive && currentItem" class="mb-6 p-4 rounded-xl border border-indigo-300 dark:border-indigo-800 bg-indigo-50/90 dark:bg-indigo-950/60 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-3">
                <span class="relative flex h-3 w-3">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                <div>
                    <div class="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                        Quest Queue Active [{{ (activeItemIndex ?? 0) + 1 }}/{{ totalItems }}]
                    </div>
                    <div class="text-sm font-bold text-gray-900 dark:text-white">
                        {{ currentItem.gameName }}
                        <span class="font-mono font-normal text-xs text-gray-500 dark:text-gray-400 ml-1">
                            ({{ currentItem.executableFilename }})
                        </span>
                    </div>
                </div>
            </div>

            <div class="flex items-center gap-3">
                <div class="text-right">
                    <div class="text-xs text-gray-400">Time Left</div>
                    <div class="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-lg">
                        {{ formatSeconds(currentItem.timeRemaining) }}
                    </div>
                </div>
                <div class="flex items-center gap-1.5 border-l border-indigo-200 dark:border-indigo-800 pl-3">
                    <button
                        v-if="queueStatus === 'running'"
                        @click="pauseQueue"
                        class="px-2.5 py-1 text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white rounded shadow-xs"
                    >
                        Pause
                    </button>
                    <button
                        v-else-if="queueStatus === 'paused'"
                        @click="resumeQueue"
                        class="px-2.5 py-1 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded shadow-xs"
                    >
                        Resume
                    </button>
                    <button
                        @click="skipCurrent"
                        class="px-2.5 py-1 text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white rounded shadow-xs"
                    >
                        Skip
                    </button>
                    <button
                        @click="stopQueue"
                        class="px-2.5 py-1 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded shadow-xs"
                    >
                        Stop
                    </button>
                    <button
                        @click="setPage(Pages.QUEUE)"
                        class="px-3 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded shadow-xs ml-1"
                    >
                        View Queue →
                    </button>
                </div>
            </div>
        </div>

        <!-- Catalog fetch status indicators -->
        <Transition 
            enter-active-class="transition-opacity duration-300 delay-100 ease-in-out"
            leave-active-class="transition-opacity duration-600 delay-100 ease-in-out"  
            enter-from-class="opacity-0 translate-y-2 ease-in-out"
            enter-to-class="opacity-100 translate-y-0 ease-in-out"
        >
            <div class="absolute top-20 left-4 z-20" v-if="shouldShowNotificationContainer && !allFetchDone">
                <div v-if="isLoadingGH" class="text-xs text-gray-500 dark:text-gray-400">
                    Updating game catalog from mirror...
                    <div class="border-full h-2 w-2 bg-green-500 rounded-full inline-block ml-1 animate-pulse"></div>
                </div>
                <TimedNotification :is-ready="isReadyGH" :duration="1200" container-class="text-xs text-gray-500 dark:text-gray-400">
                    Catalog updated from mirror <span class="text-green-400">✓</span>
                </TimedNotification>
                <div v-if="isLoadingDiscord" class="text-xs text-gray-500 dark:text-gray-400">
                    Connecting to Discord API...
                    <div class="border-full h-2 w-2 bg-green-500 rounded-full inline-block ml-1 animate-pulse"></div>
                </div>
            </div>
        </Transition>

        <!-- Search Bar -->
        <div class="mb-8">
            <div class="relative" ref="searchResultContainerRef">
               <div class="flex items-center gap-2">
                 <input 
                    v-model="searchQuery" 
                    type="text" 
                    placeholder="Search 20,000+ Discord Verified games (instant, no freeze)..."
                    class="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white text-sm"
                    @focus="openSearchResults" 
                    @blur="handleSearchBlur" 
                 />

                 <!-- button to refetch game list -->
                 <button
                    @click="fetchGameList()"
                    class="px-3 py-2 text-xs bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-white rounded-xl whitespace-nowrap shrink-0 transition-colors"
                    title="Reload online catalog"
                 >
                    Refetch Catalog
                 </button>   
               </div>

                <div 
                    v-if="searchResultsIsOpen && (searchQuery.trim().length > 0)" 
                    @click="isOnSearchResults = true"
                    class="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl max-h-72 overflow-y-auto"
                >
                    <div v-if="searchResults.length > 0">
                        <div 
                            v-for="game in searchResults" 
                            :key="game.item.id"
                            class="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/60 border-b border-gray-100 dark:border-gray-700/50 last:border-b-0"
                        >
                            <div class="flex justify-between items-center gap-3">
                                <div class="min-w-0">
                                    <div class="font-semibold text-gray-800 dark:text-white text-sm truncate">
                                        {{ game.item.name }}
                                    </div>
                                    <div class="text-xs text-gray-400 font-mono">ID: {{ game.item.id }}</div>
                                    <div class="text-[11px] text-gray-400 truncate">
                                        Executables: {{ game.item.executables?.map(e => e.name).join(', ') || 'None' }}
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    <button 
                                        @click="handleAddFromSearchToQueue(game.item)"
                                        class="px-2.5 py-1 text-xs border border-indigo-400 dark:border-indigo-600 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg font-semibold whitespace-nowrap transition-colors"
                                        title="Add directly to Quest Queue"
                                    >
                                        + Queue
                                    </button>
                                    <button 
                                        @click="addGameToList(game.item)"
                                        class="px-3 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg whitespace-nowrap transition-colors"
                                    >
                                        Add to List
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div v-else class="p-4 text-center text-xs text-gray-400">
                        No games matching "{{ searchQuery }}" found.
                    </div>
                </div>
            </div>
        </div>

        <!-- Two-Column Layout -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
            <!-- Left Column: Selected Games -->
            <div class="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-lg font-bold text-gray-900 dark:text-white">Selected Games</h2>
                    <span class="text-xs font-mono px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500">
                        {{ gameList.length }}
                    </span>
                </div>

                <div v-if="gameList.length === 0" class="text-gray-400 text-center py-10 text-xs">
                    No games added yet. Search above to add games to this list.
                </div>
                <div v-else class="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                    <div 
                        v-for="game in gameList" 
                        :key="game.id" 
                        class="p-3 border rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-all cursor-pointer" 
                        :class="[
                            selectedGame?.uid === game.uid
                                ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20 ring-1 ring-indigo-500/50'
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                        ]" 
                        @click="selectGame(game)"
                    >
                        <div class="flex justify-between items-center gap-2">
                            <div class="flex items-center gap-1.5 min-w-0">
                                <div class="font-semibold text-sm text-gray-800 dark:text-white truncate">{{ game.name }}</div>
                                <IconVerified class="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0"></IconVerified>
                            </div>
                            <div class="flex items-center gap-2 shrink-0">
                                <button 
                                    @click.stop="handleAddFromSearchToQueue(game)" 
                                    class="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-semibold"
                                >
                                    + Queue
                                </button>
                                <button 
                                    @click.stop="removeGameFromList(game)" 
                                    class="text-xs text-red-400 hover:text-red-500"
                                    v-if="!game.is_running"
                                > 
                                    Remove
                                </button>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 mt-1 text-xs">
                            <span v-if="game.is_running" class="text-green-500 font-semibold flex items-center gap-1">
                                <span class="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
                                Running
                            </span>
                            <span v-else class="text-gray-400 font-mono text-[11px]">
                                {{ game.executables?.length || 0 }} executable(s)
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Column: Game Actions -->
            <div class="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700 md:sticky md:top-4 self-start" :key="forceRerenderKey">
                <h2 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Game Actions</h2>
                <div class="space-y-4">
                    <div class="text-gray-400 text-xs" v-if="!selectedGame">
                        Select a game from the left to launch or configure auto-close.
                    </div>
                    
                    <div v-if="selectedGame" class="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-700 text-xs">
                        <div class="font-bold text-sm text-gray-800 dark:text-white mb-1">{{ selectedGame.name }}</div>
                        <div class="text-gray-400 font-mono text-[11px]">ID: {{ selectedGame.id }}</div>
                        <div v-if="selectedGame.aliases && selectedGame.aliases.length > 0" class="mt-2 text-gray-400">
                            Aliases: <span class="font-mono text-gray-600 dark:text-gray-300">{{ selectedGame.aliases.join(', ') }}</span>
                        </div>
                    </div>

                    <!-- Single-game auto-close config -->
                    <div v-if="selectedGame" class="p-3.5 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-700 text-xs">
                        <div class="flex items-center justify-between gap-2">
                            <label class="flex items-center gap-2 text-gray-700 dark:text-gray-300 cursor-pointer font-medium">
                                <input type="checkbox" v-model="singleGameAutoClose" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                <span>Auto-close window after:</span>
                            </label>
                            <div class="flex items-center gap-1">
                                <input 
                                    v-model.number="singleGameDurationMinutes" 
                                    :disabled="!singleGameAutoClose" 
                                    type="number" 
                                    min="1" 
                                    max="720"
                                    class="w-14 px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-center font-mono disabled:opacity-40" 
                                />
                                <span class="text-gray-400">min</span>
                            </div>
                        </div>
                        <div v-if="singleGameRemainingSeconds > 0" class="mt-2 text-right text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                            Closing automatically in: {{ formatSeconds(singleGameRemainingSeconds) }}
                        </div>
                    </div>

                    <GameExecutables v-if="selectedGame" :game="selectedGame" 
                        @play="playGame"
                        @stop="stopPlaying"
                        @install_and_play="installAndPlay"
                    />
                </div>

                <!-- Status Panel -->
                <div class="mt-5 p-3.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-800/40 text-xs">
                    <div class="font-semibold text-gray-700 dark:text-gray-300 mb-1">Status</div>
                    <div v-if="currentlyPlaying" class="text-green-600 dark:text-green-400 font-medium flex items-center gap-1.5">
                        <span class="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
                        Currently playing: {{ gameList.find(g => g.id === currentlyPlaying)?.name }}
                    </div>
                    <div v-else class="text-gray-400">
                        Not playing any single game window.
                    </div>
                </div>
            </div>
        </div>

        <!-- Playnight Modal -->
        <PlaynightModal v-model="showPlaynightModal" />
    </div>
</template>
