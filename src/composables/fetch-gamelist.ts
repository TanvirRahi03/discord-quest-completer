import { Game } from '@/types/types';
import { shallowRef, ref, markRaw } from 'vue';
import { tryOnMounted } from '@vueuse/core';
import { invoke } from '@tauri-apps/api/core';
import { useGlobalState } from './app-state';

// Global singleton state so we only ever load and parse the 11MB catalog once across the entire app
const gameDB = shallowRef<Game[]>([]);
const isReadyBundled = ref(false);
const isReadyGH = ref(false);
const isReadyDiscord = ref(false);
const isLoadingBundled = ref(false);
const isLoadingGH = ref(false);
const isLoadingDiscord = ref(false);
const allFetchDone = ref(false);
const fetchError = ref<string | null>(null);

let hasInitiatedFetch = false;

function isValidGameList(data: any): boolean {
  return Array.isArray(data) && data.length > 0 && data[0] && 'name' in data[0] && 'executables' in data[0];
}

export function useFetchGameList() {
  const { addLog } = useGlobalState();

  async function loadBundledFallback() {
    if (isReadyBundled.value || gameDB.value.length > 0) return;
    isLoadingBundled.value = true;
    try {
      addLog('info', 'Loading bundled game catalog...');
      const mod = await import('../assets/gamelist.json');
      const data = markRaw(mod.default || mod);
      if (isValidGameList(data)) {
        if (gameDB.value.length === 0) {
          gameDB.value = data as Game[];
        }
        isReadyBundled.value = true;
        addLog('info', `Loaded ${data.length} games from bundled catalog.`);
      }
    } catch (e) {
      addLog('error', `Failed to load bundled games: ${e}`);
    } finally {
      isLoadingBundled.value = false;
    }
  }

  async function fetchGameList() {
    allFetchDone.value = false;
    fetchError.value = null;

    // 1. Immediately ensure bundled catalog is available for zero wait time
    await loadBundledFallback();

    // 2. Asynchronously check GitHub mirror
    isLoadingGH.value = true;
    try {
      addLog('info', 'Checking online game list mirror...');
      const response = await invoke('fetch_gamelist_gh_mirror');
      let parsed: any = response;
      if (typeof response === 'string') {
        try { parsed = JSON.parse(response); } catch {}
      }
      if (isValidGameList(parsed)) {
        gameDB.value = markRaw(parsed as Game[]);
        isReadyGH.value = true;
        addLog('info', `Updated game catalog from online mirror (${parsed.length} entries).`);
      }
    } catch (errGH) {
      addLog('warning', 'Online mirror unavailable, checking Discord directly...');
      // 3. Fallback to direct Discord endpoint if mirror fails
      isLoadingDiscord.value = true;
      try {
        const response = await invoke('fetch_gamelist_from_discord');
        let parsed: any = response;
        if (typeof response === 'string') {
          try { parsed = JSON.parse(response); } catch {}
        }
        if (isValidGameList(parsed)) {
          gameDB.value = markRaw(parsed as Game[]);
          isReadyDiscord.value = true;
          addLog('info', `Updated game catalog directly from Discord (${parsed.length} entries).`);
        }
      } catch (errDiscord) {
        addLog('warning', 'Could not reach Discord API; using offline bundled catalog.');
      } finally {
        isLoadingDiscord.value = false;
      }
    } finally {
      isLoadingGH.value = false;
      allFetchDone.value = true;
    }
  }

  tryOnMounted(() => {
    if (!hasInitiatedFetch) {
      hasInitiatedFetch = true;
      fetchGameList();
    }
  });

  return {
    gameDB,
    isReadyBundled,
    isReadyGH,
    isReadyDiscord,
    isLoadingBundled,
    isLoadingGH,
    isLoadingDiscord,
    allFetchDone,
    fetchError,
    fetchGameList,
  };
}
