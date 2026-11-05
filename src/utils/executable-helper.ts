import { Game, GameExecutable } from '@/types/types';
import { getCurrentOS } from '@/constants/constants';

export function isValidExecutablePath(name: string): boolean {
  const illegalChars = ['>', '<', ':', '"', '|', '?', '*'];
  return !illegalChars.some(char => name.includes(char));
}

export function splitExecutableName(executable: { name: string }): string[] {
  const allSections = executable.name.split(/\\|\//);
  const last = allSections[allSections.length - 1];
  const name = last?.split('.').slice(0, -1).join('.') || last;
  return [
    ...allSections.slice(0, -1),
    name,
  ];
}

export function getExecutablePath(executable: { name: string }): string {
  const allSections = executable.name.split(/\\|\//);
  return allSections.slice(0, -1).join('/');
}

export function getFilename(executable: { name: string }): string {
  const allSections = executable.name.split(/\\|\//);
  return allSections[allSections.length - 1] || '';
}

export function prepareExecutable(executable: GameExecutable): {
  path: string;
  filename: string;
  segments: number;
} {
  return {
    path: getExecutablePath(executable),
    filename: getFilename(executable),
    segments: splitExecutableName(executable).length,
  };
}

export function getBestExecutable(game: Game, preferredOs?: string): GameExecutable | null {
  if (!game.executables || game.executables.length === 0) return null;
  const targetOs = preferredOs || getCurrentOS();
  const valid = game.executables.filter(e => isValidExecutablePath(e.name));
  if (valid.length === 0) return null;

  const matching = valid.filter(e => e.os === targetOs);
  if (matching.length > 0) return matching[0];

  return valid[0];
}

