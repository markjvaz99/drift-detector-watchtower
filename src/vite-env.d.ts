/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Dev-only convenience fallback for the Anthropic API key — see src/recommendations/apiKeyStore.ts. */
  readonly VITE_ANTHROPIC_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
