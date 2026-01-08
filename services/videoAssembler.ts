
import { SceneDefinition } from '../types';

export const assembleVideo = async (
    scenes: SceneDefinition[], 
    aspectRatio: '16:9' | '9:16' = '16:9', 
    globalAudioUrl?: string,
    backgroundMusicUrl?: string,
    musicVolumeDb: number = -18
): Promise<Blob> => {
  const canvas = document.createElement('canvas');
  
  if (aspectRatio === '9:16') {
      canvas.width = 720;
      canvas.height = 1280;
  } else {
      canvas.width = 1280;
      canvas.height = 720;
  }

  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error("Could not get canvas context");

  // --- Audio Context Setup ---
  // We need to mix audio into a MediaStreamDestination to record it.
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioDest = audioCtx.createMediaStreamDestination();
  
  // Basic styling for text
  const fontSize = aspectRatio === '9:16' ? 48 : 32;
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.direction = 'rtl'; // Enable RTL for Arabic

  let globalAudioBuffer: AudioBuffer | null = null;
  let musicBuffer: AudioBuffer | null = null;
  let visualTimeScale = 1.0;

  // 1. Load Global Audio (Narration) if present
  if (globalAudioUrl) {
      try {
          const response = await fetch(globalAudioUrl);
          const arrayBuffer = await response.arrayBuffer();
          globalAudioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
          
          // Calculate scale factor to match visual duration to audio duration
          const totalPlannedVisualTime = scenes.reduce((sum, s) => sum + (s.duration_seconds || 5), 0);
          const audioDuration = globalAudioBuffer.duration;
          
          if (totalPlannedVisualTime > 0 && audioDuration > 0) {
              visualTimeScale = audioDuration / totalPlannedVisualTime;
              console.log(`Global Audio Detected. Duration: ${audioDuration.toFixed(2)}s. Visual Scale Factor: ${visualTimeScale.toFixed(2)}`);
          }
      } catch (e) {
          console.error("Failed to load global audio", e);
      }
  }

  // 2. Load Background Music if present
  if (backgroundMusicUrl) {
      try {
          const response = await fetch(backgroundMusicUrl);
          const arrayBuffer = await response.arrayBuffer();
          musicBuffer = await audioCtx.decodeAudioData(arrayBuffer);
          console.log(`Background Music Loaded. Duration: ${musicBuffer.duration.toFixed(2)}s`);
      } catch (e) {
          console.warn("Failed to load background music", e);
      }
  }

  // Prepare Scenes with loaded assets
  const loadedScenes = await Promise.all(scenes.map(async (scene) => {
      let visualElement: HTMLImageElement | HTMLVideoElement | null = null;
      let isVideoSource = false;
      let audioBuffer: AudioBuffer | null = null;
      
      // Determine duration
      let durationMs = (scene.duration_seconds || 5) * 1000;
      
      // If Global Audio exists, scale duration to match fit.
      if (globalAudioBuffer) {
          durationMs = durationMs * visualTimeScale;
      } else {
          // Legacy: Load per-scene audio to determine true duration
          if (scene.generatedAudioUrl) {
              try {
                  const response = await fetch(scene.generatedAudioUrl);
                  const arrayBuffer = await response.arrayBuffer();
                  audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
                  durationMs = audioBuffer.duration * 1000;
              } catch (e) {
                  console.warn(`Failed to decode audio for scene ${scene.scene_id}`, e);
              }
          }
      }

      // 2. Load Visuals
      if (scene.generatedVideoUrl) {
          const vid = document.createElement('video');
          vid.src = scene.generatedVideoUrl;
          vid.crossOrigin = "anonymous";
          vid.muted = true; // Important for canvas capture
          await new Promise((resolve) => {
              vid.onloadeddata = resolve;
              vid.onerror = resolve;
          });
          visualElement = vid;
          isVideoSource = true;
      } else if (scene.generatedImageUrl) {
          const img = new Image();
          img.src = scene.generatedImageUrl;
          img.crossOrigin = "anonymous";
          await new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve;
          });
          visualElement = img;
      }

      return {
          ...scene,
          visualElement,
          isVideoSource,
          audioBuffer, // Will be null if globalAudioBuffer is used
          actualDurationMs: durationMs
      };
  }));

  // --- Stream Setup ---
  const canvasStream = canvas.captureStream(30); // 30 FPS
  
  // Combine Canvas Video Track + WebAudio Audio Track
  const combinedTracks = [
      ...canvasStream.getVideoTracks(),
      ...audioDest.stream.getAudioTracks()
  ];
  const combinedStream = new MediaStream(combinedTracks);

  // Fallback to simpler codec if VP9 not available
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
      ? 'video/webm;codecs=vp9' 
      : 'video/webm';

  const mediaRecorder = new MediaRecorder(combinedStream, { 
      mimeType,
      videoBitsPerSecond: 2500000 // 2.5 Mbps
  });
  
  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return new Promise(async (resolve, reject) => {
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      // Close Audio Context
      audioCtx.close();
      resolve(blob);
    };

    mediaRecorder.start();

    // --- Playback & Recording Loop ---
    
    // We need to schedule audio playback relative to AudioContext time
    let startTime = audioCtx.currentTime;

    // Schedule Global Audio ONE time at start if exists (Narration)
    if (globalAudioBuffer) {
        const source = audioCtx.createBufferSource();
        source.buffer = globalAudioBuffer;
        source.connect(audioDest);
        source.start(startTime);
    }

    // Schedule Background Music if exists
    if (musicBuffer) {
        const source = audioCtx.createBufferSource();
        source.buffer = musicBuffer;
        source.loop = true; // Loop the music
        
        // Convert dB to linear gain
        // Formula: gain = 10 ^ (dB / 20)
        const gainValue = Math.pow(10, musicVolumeDb / 20);
        
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = gainValue;
        
        source.connect(gainNode);
        gainNode.connect(audioDest);
        
        source.start(startTime);
    }

    for (const scene of loadedScenes) {
        if (!scene.visualElement) continue;

        // Schedule Per-Scene Audio (Legacy / Fallback)
        if (scene.audioBuffer && !globalAudioBuffer) {
            const source = audioCtx.createBufferSource();
            source.buffer = scene.audioBuffer;
            source.connect(audioDest);
            source.start(startTime);
        }

        // Play Video Element if exists
        if (scene.isVideoSource) {
            const vid = scene.visualElement as HTMLVideoElement;
            vid.currentTime = 0;
            // Adjust playback rate if we are scaling video duration
            if (globalAudioBuffer) {
                 // original duration vs scaled duration
                 // Assuming original video is roughly the prompt duration (e.g. 5s)
                 // This is tricky without knowing exact source video duration. 
                 // For Veo it's usually ~5-7s. We won't stretch playback rate to avoid weird motion, we'll just loop or cut.
                 // Actually, if we scale down, we cut. If we scale up, we pause on last frame (simpler than looping).
            }
            vid.play().catch(e => console.error("Video play failed", e));
        }

        // Animation Loop for this Scene
        const sceneStartTimestamp = Date.now();
        while (Date.now() - sceneStartTimestamp < scene.actualDurationMs) {
            // Draw Visual
            ctx.fillStyle = '#000'; // Clear black
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            if (scene.isVideoSource) {
                 const vid = scene.visualElement as HTMLVideoElement;
                 drawImageProp(ctx, vid, 0, 0, canvas.width, canvas.height);
            } else {
                 const img = scene.visualElement as HTMLImageElement;
                 // Simple Zoom Effect (Ken Burns Lite)
                 const elapsed = Date.now() - sceneStartTimestamp;
                 const scale = 1 + (elapsed / scene.actualDurationMs) * 0.05; // 5% zoom
                 
                 const cx = canvas.width / 2;
                 const cy = canvas.height / 2;
                 
                 ctx.save();
                 ctx.translate(cx, cy);
                 ctx.scale(scale, scale);
                 ctx.translate(-cx, -cy);
                 drawImageProp(ctx, img, 0, 0, canvas.width, canvas.height);
                 ctx.restore();
            }
            
            // Overlay Subtitles
            if (scene.narration_text) {
                const text = scene.narration_text;
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                const measure = ctx.measureText(text);
                const textW = Math.min(measure.width, canvas.width - 40); 
                
                // Background bar
                const barY = canvas.height - 100;
                ctx.fillRect((canvas.width - textW - 40) / 2, barY, textW + 40, 70);
                
                ctx.fillStyle = 'white';
                // Very basic wrapping or truncation
                if (measure.width > (canvas.width - 40)) {
                     ctx.fillText(text.substring(0, 80) + "...", canvas.width / 2, barY + 50);
                } else {
                     ctx.fillText(text, canvas.width / 2, barY + 50);
                }
            }
            
            await new Promise(r => requestAnimationFrame(r));
        }

        if (scene.isVideoSource) {
            (scene.visualElement as HTMLVideoElement).pause();
        }

        // Advance start time for next audio calculation
        if (globalAudioBuffer) {
             startTime += (scene.actualDurationMs / 1000);
        } else {
             startTime += (scene.actualDurationMs / 1000);
        }
    }

    // Slightly extend recording to ensure last frame/audio tail is caught
    await new Promise(r => setTimeout(r, 500)); 
    mediaRecorder.stop();
  });
};

// Helper function to simulate 'object-fit: cover' on Canvas
function drawImageProp(ctx: CanvasRenderingContext2D, img: HTMLImageElement | HTMLVideoElement, x: number, y: number, w: number, h: number, offsetX: number = 0.5, offsetY: number = 0.5) {
    if (arguments.length === 2) {
        x = y = 0;
        w = ctx.canvas.width;
        h = ctx.canvas.height;
    }

    // default offset is center
    offsetX = typeof offsetX === "number" ? offsetX : 0.5;
    offsetY = typeof offsetY === "number" ? offsetY : 0.5;

    // keep bounds [0.0, 1.0]
    if (offsetX < 0) offsetX = 0;
    if (offsetY < 0) offsetY = 0;
    if (offsetX > 1) offsetX = 1;
    if (offsetY > 1) offsetY = 1;

    let iw = (img instanceof HTMLVideoElement) ? img.videoWidth : img.width,
        ih = (img instanceof HTMLVideoElement) ? img.videoHeight : img.height,
        r = Math.min(w / iw, h / ih),
        nw = iw * r,   // new prop. width
        nh = ih * r,   // new prop. height
        cx, cy, cw, ch, ar = 1;

    // decide which gap to fill    
    if (nw < w) ar = w / nw;                             
    if (Math.abs(ar - 1) < 1e-14 && nh < h) ar = h / nh;  // updated
    nw *= ar;
    nh *= ar;

    // calc source rectangle
    cw = iw / (nw / w);
    ch = ih / (nh / h);

    cx = (iw - cw) * offsetX;
    cy = (ih - ch) * offsetY;

    // make sure source rectangle is valid
    if (cx < 0) cx = 0;
    if (cy < 0) cy = 0;
    if (cw > iw) cw = iw;
    if (ch > ih) ch = ih;

    // fill image in dest. rectangle
    ctx.drawImage(img, cx, cy, cw, ch,  x, y, w, h);
}
