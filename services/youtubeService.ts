/**
 * YouTube Data API v3 Service
 * Handles authenticated uploads using multipart/related content type.
 */

export interface VideoMetadata {
  title: string;
  description: string;
  tags?: string[];
  privacyStatus: 'private' | 'unlisted' | 'public';
}

export const uploadVideoToYouTube = async (
  videoBlob: Blob,
  metadata: VideoMetadata,
  accessToken: string
): Promise<string> => {
  if (!accessToken) throw new Error("YouTube Access Token is required.");

  const metadataPart = {
    snippet: {
      title: metadata.title,
      description: metadata.description,
      tags: metadata.tags || ['AutoVideoFactory'],
      categoryId: "22" // People & Blogs default
    },
    status: {
      privacyStatus: metadata.privacyStatus
    }
  };

  // Create multipart body manually
  const boundary = 'foo_bar_baz';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const body = 
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadataPart) +
    delimiter +
    'Content-Type: video/mp4\r\n' +
    'Content-Transfer-Encoding: base64\r\n\r\n'; // Note: For fetch body with Blob, we construct differently below

  // Modern browsers support passing a Multipart body as a Blob/FormData 
  // but YouTube API requires specific multipart/related structure which standard FormData doesn't perfectly match for JSON+Binary in one go simply.
  // We will use the explicit byte construction for reliability.

  const textEncoder = new TextEncoder();
  const metaBuffer = textEncoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadataPart)}\r\n`
  );
  
  const videoHeaderBuffer = textEncoder.encode(
    `--${boundary}\r\nContent-Type: video/mp4\r\n\r\n`
  );

  const footerBuffer = textEncoder.encode(`\r\n--${boundary}--`);

  // Convert Video Blob to ArrayBuffer
  const videoBuffer = await videoBlob.arrayBuffer();

  // Combine
  const combinedBuffer = new Uint8Array(
    metaBuffer.length + videoHeaderBuffer.length + videoBuffer.byteLength + footerBuffer.length
  );

  let offset = 0;
  combinedBuffer.set(metaBuffer, offset); offset += metaBuffer.length;
  combinedBuffer.set(videoHeaderBuffer, offset); offset += videoHeaderBuffer.length;
  combinedBuffer.set(new Uint8Array(videoBuffer), offset); offset += videoBuffer.byteLength;
  combinedBuffer.set(footerBuffer, offset);

  // Send Request
  try {
    const response = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': combinedBuffer.byteLength.toString()
      },
      body: combinedBuffer
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`YouTube API Error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.id; // Return the new Video ID

  } catch (error: any) {
    console.error("Upload failed", error);
    throw new Error(error.message || "Unknown upload error");
  }
};
