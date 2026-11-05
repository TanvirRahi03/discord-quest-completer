<template>
  <div class="container mx-auto px-4 py-8 max-w-5xl">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span>Quest Queue</span>
          <span 
            v-if="queueStatus === 'running'" 
            class="text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30 flex items-center gap-1.5"
          >
            <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Running
          </span>
          <span 
            v-else-if="queueStatus === 'waiting_transition'" 
            class="text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 flex items-center gap-1.5"
          >
            <span class="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>
            Transitioning
          </span>
          <span 
            v-else-if="queueStatus === 'paused'" 
            class="text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
          >
            Paused
          </span>
          <span 
            v-else 
            class="text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
          >
            Idle
          </span>
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Automatically open, play for a user-defined time, close, and transition to the next queued window.
        </p>
      </div>

      <!-- Queue Statistics Badges -->
      <div class="flex items-center gap-2 text-xs">
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg shadow-xs text-center">
          <div class="text-gray-400">Total</div>
          <div class="font-bold text-gray-800 dark:text-white text-base">{{ totalItems }}</div>
        </div>
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg shadow-xs text-center">
          <div class="text-gray-400">Pending</div>
          <div class="font-bold text-indigo-600 dark:text-indigo-400 text-base">{{ pendingCount }}</div>
        </div>
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg shadow-xs text-center">
          <div class="text-gray-400">Completed</div>
          <div class="font-bold text-green-600 dark:text-green-400 text-base">{{ completedCount }}</div>
        </div>
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg shadow-xs text-center">
          <div class="text-gray-400">Est. Remaining</div>
          <div class="font-bold text-amber-600 dark:text-amber-400 text-base font-mono">
            {{ formatSeconds(totalQueueRemainingSeconds) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Active Window Hero Card (when running or in transition) -->
    <div 
      v-if="isQueueActive && currentItem" 
      class="mb-6 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/40 dark:from-indigo-950/40 dark:via-gray-800 dark:to-gray-800 p-5 shadow-md"
    >
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">
            <span v-if="queueStatus === 'waiting_transition'" class="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400">
              <span class="w-2 h-2 rounded-full bg-cyan-500 animate-ping"></span>
              Closing & Opening Next Window
            </span>
            <span v-else class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
              Currently Active Window ({{ (activeItemIndex ?? 0) + 1 }} of {{ totalItems }})
            </span>
          </div>

          <h2 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            {{ currentItem.gameName }}
            <span class="text-xs font-mono font-normal px-2 py-0.5 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              {{ currentItem.executableFilename }}
            </span>
          </h2>

          <div v-if="queueStatus === 'waiting_transition'" class="mt-2 text-sm text-cyan-600 dark:text-cyan-300 font-medium">
            Previous window closed. Launching next window in <span class="font-mono font-bold text-base">{{ transitionCountdown }}s</span>...
          </div>
          <div v-else class="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Total Target Duration: {{ currentItem.durationMinutes }}m {{ currentItem.durationSeconds }}s
          </div>
        </div>

        <!-- Countdown Display & Controls -->
        <div class="flex items-center gap-4">
          <div class="text-right">
            <div class="text-xs uppercase font-semibold text-gray-400">Time Remaining</div>
            <div class="text-3xl font-black font-mono tracking-tight text-indigo-600 dark:text-indigo-400">
              {{ formatSeconds(currentItem.timeRemaining) }}
            </div>
          </div>

          <div class="flex items-center gap-2 border-l border-gray-200 dark:border-gray-700 pl-4">
            <button
              v-if="queueStatus === 'running'"
              @click="pauseQueue"
              class="px-3 py-1.5 text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors shadow-xs"
              title="Pause countdown"
            >
              Pause
            </button>
            <button
              v-else-if="queueStatus === 'paused'"
              @click="resumeQueue"
              class="px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors shadow-xs"
              title="Resume countdown"
            >
              Resume
            </button>

            <button
              @click="skipCurrent"
              class="px-3 py-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors shadow-xs"
              title="Close current window and immediately open next"
            >
              Skip Next
            </button>

            <button
              @click="stopQueue"
              class="px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-xs"
              title="Stop queue and close window"
            >
              Stop
            </button>
          </div>
        </div>
      </div>

      <!-- Progress Bar -->
      <div class="mt-4">
        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
          <div 
            class="bg-indigo-600 dark:bg-indigo-500 h-2.5 rounded-full transition-all duration-500 ease-out" 
            :style="{ width: `${currentProgressPercent}%` }"
          ></div>
        </div>
        <div class="flex justify-between items-center text-xs text-gray-400 mt-1">
          <span>Elapsed: {{ formatSeconds(currentItem.elapsedSeconds) }}</span>
          <span>{{ currentProgressPercent }}%</span>
          <span>Target: {{ formatSeconds(currentItem.durationMinutes * 60 + currentItem.durationSeconds) }}</span>
        </div>
      </div>
    </div>

    <!-- Main Queue Card: Controls, Settings & Quick Add -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-5 mb-6">
      <!-- Action Toolbar -->
      <div class="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
        <!-- Play / Pause / Stop main buttons -->
        <div class="flex items-center gap-2">
          <button
            v-if="!isQueueRunning"
            @click="startQueue"
            :disabled="totalItems === 0"
            class="px-5 py-2 rounded-lg font-semibold text-white shadow-sm transition-all flex items-center gap-2 text-sm"
            :class="[
              totalItems === 0
                ? 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed opacity-60'
                : 'bg-green-600 hover:bg-green-700 active:scale-95'
            ]"
          >
            <svg class="w-4 h-4 fill-current" viewBox="0 0 20 20">
              <path d="M4 4l12 6-12 6V4z" />
            </svg>
            {{ queueStatus === 'paused' ? 'Resume Queue' : 'Start Queue' }}
          </button>

          <button
            v-if="queueStatus === 'running'"
            @click="pauseQueue"
            class="px-4 py-2 rounded-lg font-medium bg-amber-500 hover:bg-amber-600 text-white text-sm transition-all flex items-center gap-1.5"
          >
            <svg class="w-4 h-4 fill-current" viewBox="0 0 20 20">
              <path d="M5 4h3v12H5V4zm7 0h3v12h-3V4z" />
            </svg>
            Pause
          </button>

          <button
            v-if="isQueueActive"
            @click="stopQueue"
            class="px-4 py-2 rounded-lg font-medium bg-red-600 hover:bg-red-700 text-white text-sm transition-all flex items-center gap-1.5"
          >
            <svg class="w-4 h-4 fill-current" viewBox="0 0 20 20">
              <path d="M4 4h12v12H4V4z" />
            </svg>
            Stop
          </button>

          <button
            v-if="isQueueActive"
            @click="skipCurrent"
            class="px-3 py-2 rounded-lg font-medium bg-purple-600 hover:bg-purple-700 text-white text-sm transition-all flex items-center gap-1.5"
          >
            <svg class="w-4 h-4 fill-current" viewBox="0 0 20 20">
              <path d="M4 5l7 5-7 5V5zm8 0h3v10h-3V5z" />
            </svg>
            Skip
          </button>
        </div>

        <!-- Secondary Queue actions -->
        <div class="flex items-center gap-2 text-xs">
          <button
            @click="resetQueue"
            :disabled="totalItems === 0 || isQueueRunning"
            class="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Reset All to Pending
          </button>
          <button
            @click="clearCompleted"
            :disabled="completedCount === 0 || isQueueRunning"
            class="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Clear Completed
          </button>
          <button
            @click="clearQueue"
            :disabled="totalItems === 0"
            class="px-3 py-1.5 rounded-md border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Clear All
          </button>
        </div>
      </div>

      <!-- User-Defined Timer Settings Section -->
      <div class="pt-4 pb-2">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-1.5">
          <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          User-Defined Timer Settings
        </h3>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <!-- Default Play Time per Window -->
          <div>
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Duration per Window
            </label>
            <div class="flex items-center gap-2">
              <div class="flex items-center gap-1">
                <input
                  v-model.number="defaultDurationMinutes"
                  type="number"
                  min="0"
                  max="1440"
                  class="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-center font-mono focus:ring-2 focus:ring-indigo-500"
                />
                <span class="text-xs text-gray-500">min</span>
              </div>
              <div class="flex items-center gap-1">
                <input
                  v-model.number="defaultDurationSeconds"
                  type="number"
                  min="0"
                  max="59"
                  class="w-14 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-center font-mono focus:ring-2 focus:ring-indigo-500"
                />
                <span class="text-xs text-gray-500">sec</span>
              </div>
            </div>

            <!-- Quick Presets -->
            <div class="flex items-center gap-1 mt-2 text-xs">
              <span class="text-gray-400 mr-0.5">Presets:</span>
              <button
                v-for="preset in [1, 5, 10, 15, 30]"
                :key="preset"
                @click="setDurationPreset(preset)"
                class="px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 hover:text-indigo-600 dark:hover:text-indigo-300 font-mono text-[11px]"
              >
                {{ preset }}m
              </button>
            </div>

            <button
              @click="applyDefaultDurationToAll"
              :disabled="pendingCount === 0"
              class="mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-40 disabled:no-underline"
            >
              Apply this duration to all pending items
            </button>
          </div>

          <!-- Transition Delay -->
          <div>
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Delay Between Windows
            </label>
            <div class="flex items-center gap-2">
              <input
                v-model.number="transitionDelaySeconds"
                type="number"
                min="0"
                max="120"
                class="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-center font-mono focus:ring-2 focus:ring-indigo-500"
              />
              <span class="text-xs text-gray-500">seconds delay</span>
            </div>
            <p class="text-[11px] text-gray-400 mt-2">
              Gives Discord time to register previous window close before opening the next game.
            </p>
          </div>

          <!-- Behavior Toggles -->
          <div class="space-y-2.5">
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Queue Options
            </label>
            
            <label class="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
              <input 
                v-model="repeatQueue" 
                type="checkbox" 
                class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" 
              />
              <span>Repeat Queue (loop back to start when done)</span>
            </label>

            <label class="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
              <input 
                v-model="soundEnabled" 
                type="checkbox" 
                class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" 
              />
              <span>Audio Chime on window completion</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Quick Add to Queue Search Bar -->
      <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
          Search & Add Game to Queue
        </label>
        <div class="relative" ref="searchContainerRef">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Type a verified game name (e.g. Fortnite, Genshin, Overwatch, Dota 2)..."
            class="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
            @focus="isSearchOpen = true"
          />

          <!-- Search Dropdown Results -->
          <div 
            v-if="isSearchOpen && searchResults.length > 0"
            class="absolute z-30 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl max-h-60 overflow-y-auto"
          >
            <div
              v-for="result in searchResults"
              :key="result.item.id"
              class="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700/60 border-b border-gray-100 dark:border-gray-700/50 last:border-b-0 flex items-center justify-between gap-2"
            >
              <div>
                <div class="font-medium text-sm text-gray-800 dark:text-white">
                  {{ result.item.name }}
                </div>
                <div class="text-xs text-gray-400">
                  Executables: {{ result.item.executables?.length || 0 }}
                </div>
              </div>

              <button
                @click="handleAddFromSearch(result.item)"
                class="px-3 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors"
              >
                + Add to Queue
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Queued Windows List -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-5">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span>Queued Games & Windows</span>
          <span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-mono">
            {{ queueItems.length }}
          </span>
        </h2>
      </div>

      <!-- Empty Queue Placeholder -->
      <div 
        v-if="queueItems.length === 0" 
        class="py-12 px-4 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl"
      >
        <div class="w-12 h-12 mx-auto mb-3 text-gray-400">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h3 class="text-base font-semibold text-gray-800 dark:text-white mb-1">Queue is empty</h3>
        <p class="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-4">
          Add Discord Quest games using the search bar above, or go to the Home tab and click "+ Queue" next to any game.
        </p>
      </div>

      <!-- Items List -->
      <div v-else class="space-y-3">
        <div
          v-for="(item, index) in queueItems"
          :key="item.id"
          class="p-3.5 rounded-lg border transition-all"
          :class="[
            item.status === 'running'
              ? 'border-green-500/50 bg-green-50/40 dark:bg-green-950/20 ring-1 ring-green-500/40 shadow-xs'
              : item.status === 'completed'
              ? 'border-gray-200 dark:border-gray-700/60 bg-gray-50/60 dark:bg-gray-800/40 opacity-75'
              : item.status === 'skipped'
              ? 'border-amber-300 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/20 opacity-75'
              : item.status === 'failed'
              ? 'border-red-300 dark:border-red-900/40 bg-red-50/30 dark:bg-red-950/20'
              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
          ]"
        >
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <!-- Left: Reorder, Game Info -->
            <div class="flex items-center gap-3">
              <!-- Reorder Buttons -->
              <div class="flex flex-col gap-0.5" v-if="!isQueueRunning">
                <button
                  @click="moveItemUp(index)"
                  :disabled="index === 0"
                  class="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-20"
                  title="Move up in queue"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  @click="moveItemDown(index)"
                  :disabled="index === queueItems.length - 1"
                  class="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-20"
                  title="Move down in queue"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              <!-- Queue Index Number -->
              <span class="text-xs font-mono font-bold text-gray-400 w-5 text-center">
                #{{ index + 1 }}
              </span>

              <!-- Game & Executable Details -->
              <div>
                <div class="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                  <span>{{ item.gameName }}</span>
                  
                  <!-- Status Chip -->
                  <span
                    v-if="item.status === 'running'"
                    class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 flex items-center gap-1"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                    Running
                  </span>
                  <span
                    v-else-if="item.status === 'completed'"
                    class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                  >
                    Completed
                  </span>
                  <span
                    v-else-if="item.status === 'skipped'"
                    class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                  >
                    Skipped
                  </span>
                  <span
                    v-else-if="item.status === 'failed'"
                    class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                  >
                    Failed
                  </span>
                  <span
                    v-else
                    class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                  >
                    Pending
                  </span>
                </div>

                <div class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-0.5">
                  <span class="font-mono">{{ item.executableFilename }}</span>
                  <span class="text-gray-300 dark:text-gray-600">•</span>
                  <span class="uppercase text-[10px] bg-gray-100 dark:bg-gray-700 px-1.5 py-0.2 rounded">{{ item.executableOs }}</span>
                </div>

                <div v-if="item.error" class="text-xs text-red-500 mt-1">
                  {{ item.error }}
                </div>
              </div>
            </div>

            <!-- Right: Duration Configuration & Actions -->
            <div class="flex items-center gap-3">
              <!-- Duration controls (customizable per item when pending) -->
              <div v-if="item.status === 'pending'" class="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-900/50 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 text-xs">
                <span class="text-gray-400">Time:</span>
                <input
                  v-model.number="item.durationMinutes"
                  @change="updateItemDuration(item.id, item.durationMinutes, item.durationSeconds)"
                  type="number"
                  min="0"
                  max="720"
                  class="w-12 px-1 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-center font-mono"
                />
                <span class="text-gray-400">m</span>
                <input
                  v-model.number="item.durationSeconds"
                  @change="updateItemDuration(item.id, item.durationMinutes, item.durationSeconds)"
                  type="number"
                  min="0"
                  max="59"
                  class="w-10 px-1 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-center font-mono"
                />
                <span class="text-gray-400">s</span>
              </div>

              <!-- Running Countdown -->
              <div v-else-if="item.status === 'running'" class="font-mono font-bold text-sm text-green-600 dark:text-green-400">
                {{ formatSeconds(item.timeRemaining) }}
              </div>

              <!-- Completed Summary -->
              <div v-else-if="item.status === 'completed'" class="text-xs text-gray-400 font-mono">
                {{ item.durationMinutes }}m {{ item.durationSeconds }}s done
              </div>

              <!-- Action buttons -->
              <div class="flex items-center gap-1">
                <button
                  v-if="item.status === 'pending' && !isQueueRunning"
                  @click="runSpecificItemNow(item.id)"
                  class="px-2.5 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded"
                  title="Run this game immediately"
                >
                  Run Now
                </button>

                <button
                  @click="removeFromQueue(item.id)"
                  class="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  title="Remove from queue"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, shallowRef } from 'vue';
import { useQueue } from '@/composables/use-queue';
import { useFetchGameList } from '@/composables/fetch-gamelist';
import { useFuse } from '@vueuse/integrations/useFuse';
import { onClickOutside, refDebounced } from '@vueuse/core';
import { Game } from '@/types/types';

const {
  queueItems,
  queueStatus,
  currentItem,
  activeItemIndex,
  transitionCountdown,
  defaultDurationMinutes,
  defaultDurationSeconds,
  transitionDelaySeconds,
  repeatQueue,
  soundEnabled,
  isQueueRunning,
  isQueueActive,
  pendingCount,
  completedCount,
  totalItems,
  currentProgressPercent,
  totalQueueRemainingSeconds,
  addToQueue,
  removeFromQueue,
  updateItemDuration,
  applyDefaultDurationToAll,
  moveItemUp,
  moveItemDown,
  clearQueue,
  clearCompleted,
  resetQueue,
  startQueue,
  pauseQueue,
  resumeQueue,
  stopQueue,
  skipCurrent,
  runSpecificItemNow,
  formatSeconds,
} = useQueue();

// Quick add search
const { gameDB } = useFetchGameList();
const searchQuery = shallowRef('');
const debouncedSearch = refDebounced(searchQuery, 250);
const isSearchOpen = ref(false);
const searchContainerRef = ref<HTMLElement | null>(null);

onClickOutside(searchContainerRef, () => {
  isSearchOpen.value = false;
});

const fuseOptions = computed(() => ({
  fuseOptions: {
    keys: [
      { name: 'name', weight: 0.7 },
      { name: 'aliases', weight: 0.2 },
      { name: 'executables.name', weight: 0.1 },
    ],
    threshold: 0.4,
  },
  resultLimit: 8,
}));

const { results: searchResults } = useFuse(debouncedSearch, gameDB, fuseOptions);

function handleAddFromSearch(game: Game) {
  addToQueue(game);
  searchQuery.value = '';
  isSearchOpen.value = false;
}

function setDurationPreset(minutes: number) {
  defaultDurationMinutes.value = minutes;
  defaultDurationSeconds.value = 0;
}
</script>

