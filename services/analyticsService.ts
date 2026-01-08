/**
 * YouTube Analytics API Service (Phase 8)
 * Fetches REAL data from the YouTube API.
 * Requirement: The user must authenticate with a token having 'https://www.googleapis.com/auth/yt-analytics.readonly' scope.
 */

interface AnalyticsReport {
  rows: any[][];
  columnHeaders: { name: string; dataType: string; columnType: string }[];
}

export const getChannelAnalytics = async (
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<AnalyticsReport> => {
  if (!accessToken) throw new Error("Access Token is required for Real Analytics.");

  // Metrics: Views, Watch Time, Avg Duration, Subs Gained
  const metrics = 'views,estimatedMinutesWatched,averageViewDuration,subscribersGained';
  // Dimensions: Day (for charts)
  const dimensions = 'day';
  const ids = 'channel==MINE';
  const sort = 'day';

  const url = `https://youtubeanalytics.googleapis.com/v2/reports?ids=${ids}&startDate=${startDate}&endDate=${endDate}&metrics=${metrics}&dimensions=${dimensions}&sort=${sort}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`YouTube Analytics API Error: ${response.status} ${errorText}`);
    }

    const data: AnalyticsReport = await response.json();
    return data;

  } catch (error: any) {
    console.error("Failed to fetch analytics", error);
    throw error;
  }
};
