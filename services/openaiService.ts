
/**
 * OpenAI Service Wrapper
 * Handles interactions with GPT-4o and other OpenAI models.
 * Simulates Structured Output using json_object response format.
 */

// Helper to clean JSON string from GPT
function cleanAndParseJson(text: string): any {
    let clean = text.replace(/```json\n?|```/g, "").trim();
    try {
        return JSON.parse(clean);
    } catch (e) {
        console.warn("OpenAI JSON Parse retry...", clean);
        throw new Error("Failed to parse OpenAI JSON response");
    }
}

export const generateOpenAIContent = async (
    apiKey: string,
    model: string,
    prompt: string,
    systemInstruction: string,
    temperature: number = 0.7,
    maxTokens: number = 2000
): Promise<{ data: any; usage: { prompt: number; candidates: number; total: number } }> => {
    
    if (!apiKey) throw new Error("OpenAI API Key is missing");

    const payload = {
        model: model || "gpt-4o",
        messages: [
            { role: "system", content: systemInstruction + " Respond in valid JSON only." },
            { role: "user", content: prompt }
        ],
        temperature: temperature,
        max_tokens: maxTokens,
        response_format: { type: "json_object" } // Force JSON
    };

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`OpenAI API Error ${response.status}: ${err}`);
        }

        const json = await response.json();
        const content = json.choices[0]?.message?.content;
        
        if (!content) throw new Error("No content returned from OpenAI");

        const data = cleanAndParseJson(content);
        const usage = {
            prompt: json.usage?.prompt_tokens || 0,
            candidates: json.usage?.completion_tokens || 0,
            total: json.usage?.total_tokens || 0
        };

        return { data, usage };

    } catch (error: any) {
        console.error("OpenAI Service Error:", error);
        throw error;
    }
};
