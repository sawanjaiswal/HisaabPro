import { api } from './client';
import type { BusinessSummary, BusinessJoinRequest } from '../../types';

export const businessAPI = {
  /** List all businesses owned by the current user */
  list: async (): Promise<BusinessSummary[]> => {
    const response = await api.get('/business');
    return response.data.data;
  },

  /** Create a 2nd+ business (returns new business + join URL hint) */
  create: async (data: { name: string; type?: string }): Promise<{
    business: BusinessSummary;
    dataUserId: string;
    tokens: { accessToken: string; refreshToken: string };
  }> => {
    const response = await api.post('/business', data);
    return response.data.data;
  },

  /** Switch active business — server returns new tokens */
  switch: async (businessId: string): Promise<{
    business: BusinessSummary;
    tokens: { accessToken: string; refreshToken: string };
  }> => {
    const response = await api.post('/business/switch', { businessId });
    return response.data.data;
  },

  /** Join a business via 6-char code */
  join: async (joinCode: string): Promise<{ businessId: string; businessName: string }> => {
    const response = await api.post('/business/join', { joinCode });
    return response.data.data;
  },

  /** Update business metadata */
  update: async (id: string, data: { name?: string; type?: string; logoUrl?: string | null }) => {
    const response = await api.patch(`/business/${id}`, data);
    return response.data.data;
  },

  /** Regenerate join code */
  regenerateCode: async (id: string): Promise<{ joinCode: string }> => {
    const response = await api.post(`/business/${id}/regenerate-code`);
    return response.data.data;
  },

  /** List pending join requests (owner view) */
  listJoinRequests: async (businessId: string): Promise<BusinessJoinRequest[]> => {
    const response = await api.get(`/business/${businessId}/join-requests`);
    return response.data.data;
  },

  /** Approve or reject a join request */
  handleJoinRequest: async (
    businessId: string,
    requestId: string,
    action: 'approve' | 'reject'
  ) => {
    const response = await api.post(`/business/${businessId}/join-requests/${requestId}`, { action });
    return response.data.data;
  },
};
