import { io, type Socket } from "socket.io-client";

import { WS_URL } from "@/lib/constants";
import type { ServerToClientEvents } from "@/types/events";

let socket: Socket<ServerToClientEvents> | null = null;

/** Lazily creates the single shared Socket.io connection for this tab. */
export function getSocket(): Socket<ServerToClientEvents> {
  if (!socket) {
    socket = io(WS_URL, { autoConnect: true, transports: ["websocket", "polling"] });
  }
  return socket;
}
