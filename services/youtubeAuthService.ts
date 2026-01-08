import { db } from './storageService';
import { YouTubeChannelDetails } from '../types';

export const FEATURE_YOUTUBE_CONNECT = true;

/**
 * Mocks the Backend OAuth Flow for this frontend-only demo.
 * In production, endpoints like 'generateAuthUrl' and 'exchangeToken'
 * would exist on a secure Node.js server.
 */

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.upload'
];

// 1. Start OAuth Flow
export const generateAuthUrl = async (): Promise<string> => {
  const config = await db.getYouTubeConfig();
  if (!config || !config.clientId) {
    throw new Error("Client ID not configured.");
  }

  const baseUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const state = Math.random().toString(36).substring(7); // In prod: cryptographically secure
  localStorage.setItem('oauth_state', state);

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: window.location.origin + '/integrations/youtube/callback', // Dynamic Redirect
    response_type: 'token', // Using Implicit Flow for this demo as we don't have a backend to swap Code
    scope: SCOPES.join(' '),
    state: state,
    include_granted_scopes: 'true',
    access_type: 'online', // 'offline' requires backend to store Refresh Token securely
    prompt: 'consent'
  });

  return `${baseUrl}?${params.toString()}`;
};

// 2. Callback & Token Exchange (Simulated)
// For implicit flow (demo), we get the access_token directly in the hash.
// For Code flow (prod), we would send 'code' to backend.
export const handleAuthCallback = async (hash: string): Promise<{ accessToken: string }> => {
  const params = new URLSearchParams(hash.replace('#', '?'));
  const accessToken = params.get('access_token');
  const state = params.get('state');
  const error = params.get('error');

  const savedState = localStorage.getItem('oauth_state');

  if (error) throw new Error(`OAuth Error: ${error}`);
  if (state !== savedState) throw new Error("Security Error: State mismatch (CSRF detected).");
  if (!accessToken) throw new Error("No access token received.");

  return { accessToken };
};

// 3. List Channels
export const fetchUserChannels = async (accessToken: string): Promise<YouTubeChannelDetails[]> => {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`YouTube API Error: ${err}`);
  }

  const data = await response.json();
  
  return data.items.map((item: any) => ({
    id: item.id,
    title: item.snippet.title,
    thumbnail: item.snippet.thumbnails.default.url,
    customUrl: item.snippet.customUrl
  }));
};

// 4. Link Channel (Backend Logic Simulation)
export const linkChannelToApp = async (appChannelId: string, youtubeChannel: YouTubeChannelDetails, refreshTokenMock?: string) => {
  const channels = await db.getChannels();
  const target = channels.find(c => c.id === appChannelId);
  
  if (!target) throw new Error("App Channel not found");

  const updatedChannel = {
    ...target,
    linkedYouTubeChannel: {
      youtubeChannelId: youtubeChannel.id,
      title: youtubeChannel.title,
      thumbnailUrl: youtubeChannel.thumbnail,
      linkedAt: new Date().toISOString(),
      refreshToken: refreshTokenMock // In prod, this is encrypted
    }
  };

  await db.saveChannel(updatedChannel);
  return updatedChannel;
};
