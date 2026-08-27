export interface AuthStatus {
  password_set: boolean;
}

export interface DeviceToken {
  token: string;
  device_id: string;
  device_name: string;
}

export interface PairingToken {
  token: string;
  expires_in: number;
}

export interface Device {
  id: string;
  name: string;
  created_at: string;
  last_seen_at: string;
}

export interface PushConfig {
  configured: boolean;
  vapid_public_key: string | null;
}
