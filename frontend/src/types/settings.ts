export interface ClaudeAuthStatus {
  connected: boolean;
}

export interface ClaudeAuthStart {
  auth_url: string;
}

export interface ApiKeysStatus {
  has_anthropic_key: boolean;
  has_sarvam_key: boolean;
}

export interface ApiKeysUpdate {
  // Omit a field to leave it untouched, "" to clear it, a value to set/rotate it.
  anthropic_api_key?: string;
  sarvam_api_key?: string;
}
