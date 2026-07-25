"use client";

// Re-exported from the shared provider so all existing
// `import { useLocalData } from "@/lib/offline/useLocalData"` call sites keep
// working, but now read from a single app-level cache instead of each
// re-reading IndexedDB on mount (which caused the tab-switch lag).
export { useLocalData } from "@/components/LocalDataProvider";
