import { io, type Socket } from "socket.io-client";

import { getAuthToken, onAuthTokenChange } from "@/lib/authToken";
import { WS_URL } from "@/lib/constants";
import type { ClientToServerEvents, ServerToClientEvents } from "@/types/events";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

/** Lazily creates the single shared Socket.io connection for this tab.
 * Doesn't connect until a device token exists (see AuthGate) — the server
 * refuses unauthenticated connections outright (app/ws/manager.py). */
export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (!socket) {
    socket = io(WS_URL, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      auth: (cb) => cb({ token: getAuthToken() }),
    });
    onAuthTokenChange((token) => {
      if (token) {
        socket?.connect();
      } else {
        socket?.disconnect();
      }
    });
    if (getAuthToken()) socket.connect();
  }
  return socket;
}
