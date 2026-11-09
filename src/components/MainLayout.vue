<script setup lang="ts">
import { ref } from 'vue';
import { Pages, useGlobalState } from '@/composables/app-state';
import { useQueue } from '@/composables/use-queue';
import IconRustLang from './IconRustLang.vue';
import IconVueJs from './IconVueJs.vue';
import PlaynightModal from './PlaynightModal.vue';

// Layout component for consistent page structure

const appState = useGlobalState();
const { page, setPage } = appState;
const { totalItems, isQueueRunning } = useQueue();
const showPlaynightModal = ref(false);

</script>

<template>
  <div class="flex flex-col h-dvh overflow-hidden bg-gray-100 dark:bg-gray-900">
    <header class="bg-white dark:bg-gray-800 shadow-md">
      <div class="container mx-auto px-4 py-3.5 flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <img src="/logo.svg" alt="Logo" class="h-8 w-8" />
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">Discord Quest Completer</h2>
        </div>
        <nav>
          <ul class="flex items-center space-x-5">
            <li>
              <button
                @click="showPlaynightModal = true"
                class="px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-lg shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
                title="Open Playnight Auto-Generator"
              >
                <span>🌙 Playnight</span>
              </button>
            </li>
            <li>
              <a href="#" 
                class="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium text-sm"
                :class="{ 'text-indigo-600 dark:text-indigo-400': page === Pages.HOME }"
                @click.prevent="setPage(Pages.HOME)"
              >
                Home
              </a>
            </li> 
            <li>
              <a href="#" 
                class="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium text-sm"
                :class="{ 'text-indigo-600 dark:text-indigo-400': page === Pages.QUEUE }"
                @click.prevent="setPage(Pages.QUEUE)"
              >
                <span>Queue</span>
                <span v-if="isQueueRunning" class="relative flex h-2 w-2">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span v-if="totalItems > 0" class="px-1.5 py-0.2 text-xs rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-semibold">
                  {{ totalItems }}
                </span>
              </a>
            </li>
            <li>
              <a href="#" 
                class="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium text-sm"
                :class="{ 'text-indigo-600 dark:text-indigo-400': page === Pages.PLAYGROUND }"
                @click.prevent="setPage(Pages.PLAYGROUND)"
              >
                Playground
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </header>
    
    <main class="flex-grow overflow-y-auto">
      <slot></slot>
    </main>

    <!-- Global Playnight Modal -->
    <PlaynightModal v-model="showPlaynightModal" />
    
    <footer class="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-auto">
      <div class="container mx-auto px-4 py-3 text-center text-xs text-gray-600 dark:text-gray-400">
        &copy; 2025 Discord Quest Completer &bull; Built with <IconRustLang class="inline-block h-3.5 w-3.5 text-red-400 dark:text-white mx-0.5"/> Rust and <IconVueJs class="h-3.5 w-3.5 inline-block text-[#4FC08D] mx-0.5"/> Vue.js
      </div>
    </footer>
  </div>
</template>