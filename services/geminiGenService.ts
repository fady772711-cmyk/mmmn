
const API_BASE = 'https://api.geminigen.ai/uapi/v1';
const CORS_PROXY = 'https://corsproxy.io/?'; 

async function fetchWithFallback(url: string, options: RequestInit): Promise<Response> {
    try {
        // Try direct call
        return await fetch(url, options);
    } catch (e: any) {
        if (e.message === 'Failed to fetch' || e.name === 'TypeError') {
            console.warn("Direct fetch failed (likely CORS). Retrying with Proxy...", url);
            // Retry with Proxy
            // Note: corsproxy.io takes the target URL as a query param or appended
            const proxyUrl = CORS_PROXY + encodeURIComponent(url);
            
            // Ensure no caching for proxy requests to avoid stale error states
            const proxyOptions = { ...options, cache: 'no-store' as RequestCache };
            
            return await fetch(proxyUrl, proxyOptions);
        }
        throw e;
    }
}

export const generateGeminiGenSpeech = async (text: string, voiceId: string, apiKey: string): Promise<Blob> => {
    // 1. Request Creation
    const response = await fetchWithFallback(`${API_BASE}/text-to-speech`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey
        },
        body: JSON.stringify({
            model: "tts-flash",
            voices: [
                {
                    name: "Voice",
                    voice: {
                        id: voiceId, // e.g. GM013
                        name: "Voice"
                    }
                }
            ],
            speed: 1,
            input: text,
            output_format: "mp3"
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`GeminiGen API Error: ${err}`);
    }

    const data = await response.json();
    if (!data.success) throw new Error("GeminiGen API reported failure: " + (data.error_message || "Unknown error"));

    // 2. Check for immediate result or Poll
    let audioUrl: string | null = null;

    if (data.result?.generate_result) {
        audioUrl = data.result.generate_result;
    } else if (data.result?.uuid) {
        audioUrl = await pollForCompletion(data.result.uuid, apiKey);
    } else {
        throw new Error("No result URL or UUID returned from GeminiGen");
    }

    // 3. Fetch Audio Blob
    if (!audioUrl) throw new Error("Failed to retrieve audio URL");

    // The result URL might also need proxying if it doesn't allow CORS
    const audioRes = await fetchWithFallback(audioUrl, { method: 'GET' });
    if (!audioRes.ok) throw new Error("Failed to download generated audio file");
    
    return await audioRes.blob();
};

async function pollForCompletion(uuid: string, apiKey: string): Promise<string> {
    const maxRetries = 30; // 60 seconds max
    const interval = 2000;

    for (let i = 0; i < maxRetries; i++) {
        await new Promise(r => setTimeout(r, interval));
        
        try {
            const res = await fetchWithFallback(`${API_BASE}/text-to-speech/${uuid}`, {
                headers: { 'x-api-key': apiKey }
            });

            if (res.ok) {
                const data = await res.json();
                if (data.success && data.result) {
                    if (data.result.generate_result) {
                        return data.result.generate_result;
                    }
                    if (data.result.status === 3 || data.result.status === 'failed') {
                        throw new Error(`Generation failed: ${data.result.error_message || 'Unknown'}`);
                    }
                }
            }
        } catch (e) {
            console.warn("Polling error, retrying...", e);
        }
    }
    throw new Error("Voice generation timed out");
}
