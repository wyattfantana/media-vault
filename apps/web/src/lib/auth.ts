import { createAuthClient } from 'better-auth/react';
import { API_URL } from './config';

export const authClient = createAuthClient({
  baseURL: API_URL,
  fetchOptions: {
    onError(context) {
      // Handle rate limit errors gracefully
      if (context.response.status === 429) {
        console.warn('Rate limited - retrying after delay');
      }
    },
  },
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient;
