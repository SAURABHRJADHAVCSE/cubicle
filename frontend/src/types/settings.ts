export interface ClaudeAuthStatus {
  logged_in: boolean;
  auth_method: string;
}

export interface ClaudeAuthStart {
  auth_url: string;
}
