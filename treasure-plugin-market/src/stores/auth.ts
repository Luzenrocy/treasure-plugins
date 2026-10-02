import { defineStore } from 'pinia';

export const useAuthStore = defineStore('auth', {
  state: () => ({ token: '', loggedIn: false, mfaPending: false }),
  actions: {
    setSession(token: string) { this.token = token; this.loggedIn = true; this.mfaPending = false; },
    requireMfa(token: string) { this.token = token; this.mfaPending = true; },
    logout() { this.token = ''; this.loggedIn = false; this.mfaPending = false; },
  },
});
