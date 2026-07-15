import { apiFetch as fetch } from './api';

export const trackEvent = async (event: string, targetId?: string, source?: string, metadata: any = {}) => {
  try {
    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, targetId, source, metadata })
    });
  } catch (err) {
    console.error('Tracking failed:', err);
  }
};
