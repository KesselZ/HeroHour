import { create } from 'zustand';

interface WorldEvent {
  id: string;
  title: string;
  text: string;
  type: string;
  year: number;
  season: string;
  timestamp: number;
}

interface WorldState {
  eventHistory: WorldEvent[];
  hasUnreadEvents: boolean;
  addEvent: (event: WorldEvent) => void;
  setEvents: (events: WorldEvent[]) => void;
  markAllRead: () => void;
}

export const useWorldStore = create<WorldState>((set) => ({
  eventHistory: [],
  hasUnreadEvents: false,
  addEvent: (event) => set((state) => ({
    eventHistory: [event, ...state.eventHistory].slice(0, 50),
    hasUnreadEvents: true
  })),
  setEvents: (events) => set({ eventHistory: events }),
  markAllRead: () => set({ hasUnreadEvents: false }),
}));
