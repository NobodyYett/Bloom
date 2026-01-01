// client/src/lib/registryStorage.ts

export interface Registry {
  id: string;
  name: string;
  url: string;
  createdAt: string;
}

const STORAGE_KEY = "bump_registries";

function generateId(): string {
  return `reg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function getRegistries(): Registry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as Registry[];
    }
  } catch (e) {
    console.error("Failed to parse registries:", e);
  }
  return [];
}

export function saveRegistries(registries: Registry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(registries));
}

export function addRegistry(name: string, url: string): Registry {
  const registries = getRegistries();
  const newRegistry: Registry = {
    id: generateId(),
    name: name.trim(),
    url: url.trim(),
    createdAt: new Date().toISOString(),
  };
  registries.push(newRegistry);
  saveRegistries(registries);
  return newRegistry;
}

export function deleteRegistry(id: string): void {
  const registries = getRegistries();
  const filtered = registries.filter((r) => r.id !== id);
  saveRegistries(filtered);
}

export function isValidUrl(url: string): boolean {
  const trimmed = url.trim();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://");
}

export function getDomainFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
