// Claude AI API Service
const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1024;
const API_TIMEOUT = 30000;

const WMS_SYSTEM_PROMPT = `You are an AI assistant for KOB-WMS (Warehouse Management System). You help warehouse staff with:
- Order management (pick, pack, scan, dispatch workflows)
- Inventory queries and stock levels
- Shipping & logistics (couriers, AWB, tracking)
- KPI and performance questions
- System troubleshooting and best practices
- Odoo ERP integration questions

Keep answers concise and actionable. Use bullet points when listing steps. If asked about specific order data, remind users you can only see what they share in chat. Respond in the same language the user writes in.`;

const fetchWithTimeout = async (url, options, timeout = API_TIMEOUT) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (err) {
        clearTimeout(id);
        throw err;
    }
};

export const sendMessage = async (apiKey, messages, systemPrompt) => {
    if (!apiKey) throw new Error('API key not configured');

    const response = await fetchWithTimeout(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': API_VERSION,
            'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
            model: DEFAULT_MODEL,
            max_tokens: MAX_TOKENS,
            system: systemPrompt || WMS_SYSTEM_PROMPT,
            messages,
        }),
    });

    if (!response.ok) {
        const status = response.status;
        if (status === 401) throw new Error('Invalid API key. Check your Claude API key in Settings.');
        if (status === 429) throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        if (status >= 500) throw new Error('Claude service is temporarily unavailable. Try again later.');
        throw new Error('Failed to get a response. Please try again.');
    }

    const data = await response.json();
    return data.content?.[0]?.text || '';
};

export const testConnection = async (apiKey) => {
    try {
        const response = await fetchWithTimeout(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': API_VERSION,
                'anthropic-dangerous-direct-browser-access': 'true',
            },
            body: JSON.stringify({
                model: DEFAULT_MODEL,
                max_tokens: 20,
                messages: [{ role: 'user', content: 'Hi' }],
            }),
        }, 10000);
        return { success: response.ok, status: response.status };
    } catch (err) {
        return { success: false, error: err.message };
    }
};
