export type Msg = { role: 'user' | 'assistant'; content: string };

/**
 * One text completion for Claude or Hermes models in Deno Edge Functions (PSI-098).
 * Spec format: "anthropic:<model_id>" | "hermes:<model_id>"
 *
 * Spec reference: docs/backend-architecture/agent-layer-mcp.md § "Edge Function adapter"
 */
export async function complete(
  spec: string,
  system: string,
  messages: Msg[],
  maxTokens = 1500,
): Promise<string> {
  const [provider, ...rest] = spec.split(':');
  const modelId = rest.join(':');

  if (!modelId) {
    throw new Error(`Invalid model spec "${spec}": missing model identifier`);
  }

  if (provider === 'anthropic') {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: modelId,
        system,
        messages,
        max_tokens: maxTokens,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`anthropic error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.content
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('');
  }

  if (provider === 'hermes') {
    const baseUrl = Deno.env.get('HERMES_BASE_URL') || 'https://api.nousresearch.com/v1';
    const apiKey = Deno.env.get('HERMES_API_KEY') || '';

    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    if (apiKey) {
      headers['authorization'] = `Bearer ${apiKey}`;
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'system', content: system }, ...messages],
        max_tokens: maxTokens,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`hermes error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  throw new Error(`Unknown model provider "${provider}" in "${spec}"`);
}
