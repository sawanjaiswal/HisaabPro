/**
 * Active Network Detector (Heartbeat Pinger)
 * Dispatches reliable online/offline events by pinging /api/health
 */

type NetworkStatusListener = (isOnline: boolean) => void;

class NetworkDetectorImpl {
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private listeners: Set<NetworkStatusListener> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.checkConnectivity());
      window.addEventListener('offline', () => this.setOnline(false));

      // Active health ping every 15 seconds
      setInterval(() => {
        this.checkConnectivity();
      }, 15000);
    }
  }

  public getStatus(): boolean {
    return this.isOnline;
  }

  public subscribe(listener: NetworkStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.isOnline);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async checkConnectivity(): Promise<boolean> {
    if (typeof window === 'undefined') return true;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch('/api/health', { // ssot-allow: save/fetch data through the app API client — direct health check probe without interceptors
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);

      const online = res.ok;
      this.setOnline(online);
      return online;
    } catch {
      this.setOnline(false);
      return false;
    }
  }

  private setOnline(online: boolean) {
    if (this.isOnline !== online) {
      this.isOnline = online;
      for (const listener of this.listeners) {
        try {
          listener(online);
        } catch (err) {
          console.error('[NetworkDetector] Listener error', err);
        }
      }
    }
  }
}

export const NetworkDetector = new NetworkDetectorImpl();
