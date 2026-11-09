import { shallowRef, ref, watch, type ShallowRef, type Ref } from 'vue';
import { Game } from '@/types/types';

export interface SearchResultItem {
  item: Game;
}

interface IndexedGame {
  game: Game;
  cleanName: string;
  cleanAliases: string[];
  exeNames: string[];
  // Has at least one valid executable for the current OS (windows)
  hasWindowsExe: boolean;
}

const STRIP_SYMBOLS_REGEX = /[\u00A9\u2122\u00AE]/g;

function cleanString(str: string): string {
  return str.toLowerCase().replace(STRIP_SYMBOLS_REGEX, '').trim();
}

/**
 * High-performance, zero-freeze search indexer for 20,000+ Discord games.
 * Avoids deep reactive proxies and runs in < 5ms without blocking the UI thread.
 */
export function useGameSearch(gameDB: ShallowRef<Game[]> | Ref<Game[]>) {
  const searchQuery = ref('');
  const searchResults = shallowRef<SearchResultItem[]>([]);
  const isSearching = ref(false);

  let indexedGames: IndexedGame[] = [];

  function buildIndex(games: Game[]) {
    if (!games || games.length === 0) {
      indexedGames = [];
      return;
    }
    
    const count = games.length;
    const nextIndex: IndexedGame[] = new Array(count);

    for (let i = 0; i < count; i++) {
      const g = games[i];
      const cleanName = g.name ? cleanString(g.name) : '';
      const cleanAliases = g.aliases && g.aliases.length > 0 
        ? g.aliases.map(a => cleanString(a)) 
        : [];
      
      let hasWin = false;
      const exeNames: string[] = [];
      if (g.executables && g.executables.length > 0) {
        for (let j = 0; j < g.executables.length; j++) {
          const exe = g.executables[j];
          if (exe.name) {
            exeNames.push(exe.name.toLowerCase());
          }
          if (exe.os === 'win32' || !exe.os) {
            hasWin = true;
          }
        }
      }

      nextIndex[i] = {
        game: g,
        cleanName,
        cleanAliases,
        exeNames,
        hasWindowsExe: hasWin,
      };
    }

    indexedGames = nextIndex;
  }

  // Re-build index whenever game catalog updates
  watch(
    () => gameDB.value,
    (newGames) => {
      buildIndex(newGames);
      if (searchQuery.value) {
        executeSearch(searchQuery.value);
      }
    },
    { immediate: true }
  );

  function executeSearch(rawQuery: string, limit: number = 12): SearchResultItem[] {
    const q = cleanString(rawQuery);
    if (!q || indexedGames.length === 0) {
      searchResults.value = [];
      return [];
    }

    const exact: SearchResultItem[] = [];
    const prefix: SearchResultItem[] = [];
    const wordBoundary: SearchResultItem[] = [];
    const contains: SearchResultItem[] = [];
    const aliasOrExe: SearchResultItem[] = [];

    const total = indexedGames.length;
    for (let i = 0; i < total; i++) {
      const entry = indexedGames[i];
      const name = entry.cleanName;

      if (name === q) {
        exact.push({ item: entry.game });
      } else if (name.startsWith(q)) {
        prefix.push({ item: entry.game });
      } else if (name.includes(' ' + q)) {
        wordBoundary.push({ item: entry.game });
      } else if (name.includes(q)) {
        contains.push({ item: entry.game });
      } else if (
        entry.cleanAliases.some(a => a.includes(q)) ||
        entry.exeNames.some(e => e.includes(q))
      ) {
        aliasOrExe.push({ item: entry.game });
      }

      // Early break if we have accumulated plenty of high-quality matches
      if (exact.length + prefix.length + wordBoundary.length >= limit * 2) {
        break;
      }
    }

    const merged = [
      ...exact,
      ...prefix,
      ...wordBoundary,
      ...contains,
      ...aliasOrExe,
    ].slice(0, limit);

    searchResults.value = merged;
    return merged;
  }

  // Instant reactive search on query input (micro-throttled to avoid redundant passes on microsecond typing)
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;
  watch(searchQuery, (newQuery) => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    // Instant clear when empty
    if (!newQuery || !newQuery.trim()) {
      searchResults.value = [];
      return;
    }
    // 30ms throttle: feels completely instantaneous to human perception without blocking frame rate
    searchTimeout = setTimeout(() => {
      executeSearch(newQuery);
    }, 30);
  });

  /**
   * Returns a random selection of games that have Windows executables.
   */
  function getRandomGames(count: number, excludeIds: Set<string> = new Set()): Game[] {
    const eligible: Game[] = [];
    for (let i = 0; i < indexedGames.length; i++) {
      const entry = indexedGames[i];
      if (entry.hasWindowsExe && entry.game.id && !excludeIds.has(String(entry.game.id))) {
        eligible.push(entry.game);
      }
    }

    if (eligible.length === 0) return [];

    // Fisher-Yates partial shuffle to pick 'count' unique random games
    const selected: Game[] = [];
    const pool = [...eligible];
    const n = Math.min(count, pool.length);

    for (let i = 0; i < n; i++) {
      const randIdx = i + Math.floor(Math.random() * (pool.length - i));
      const chosen = pool[randIdx];
      pool[randIdx] = pool[i];
      pool[i] = chosen;
      selected.push(chosen);
    }

    return selected;
  }

  return {
    searchQuery,
    searchResults,
    isSearching,
    executeSearch,
    getRandomGames,
  };
}

