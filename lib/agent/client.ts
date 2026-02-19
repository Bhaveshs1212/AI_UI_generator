import type { AgentClient } from "./planner";

interface OpenAIClientOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface OpenAIResponse {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

function parseRetryAfterSeconds(message: string): number | null {
  const match = message.match(/try again in\s*([0-9.]+)s/iu);
  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function extractOutputText(response: OpenAIResponse): string {
  if (response.output_text) {
    return response.output_text;
  }

  const chunks: string[] = [];
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" || content.type === "text") {
        if (content.text) {
          chunks.push(content.text);
        }
      }
    }
  }

  return chunks.join("\n");
}

function extractChatText(response: ChatCompletionResponse): string {
  return response.choices?.[0]?.message?.content?.trim() ?? "";
}

function isLocalBaseUrl(baseUrl: string): boolean {
  return /localhost|127\.0\.0\.1/u.test(baseUrl);
}

export function createOpenAIClient(options: OpenAIClientOptions): AgentClient {
  return {
    async complete(prompt: string): Promise<string> {
      const forceChatCompletions =
        process.env.OPENAI_USE_CHAT_COMPLETIONS?.toLowerCase() === "true";
      const useChatCompletions = forceChatCompletions || isLocalBaseUrl(options.baseUrl);
      const endpoint = useChatCompletions
        ? `${options.baseUrl}/chat/completions`
        : `${options.baseUrl}/responses`;
      const fallbackModel =
        process.env.OPENAI_FALLBACK_MODEL?.trim() || "gpt-4o";

      const buildPayload = (model: string) =>
        useChatCompletions
          ? {
              model,
              messages: [{ role: "user", content: prompt }],
              temperature: 0,
              stream: false,
            }
          : {
              model,
              input: prompt,
              temperature: 0,
              top_p: 1,
            };

      const sendRequest = async (model: string) => {
        return fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${options.apiKey}`,
          },
          body: JSON.stringify(buildPayload(model)),
        });
      };

      const maxRetries = Number(process.env.OPENAI_MAX_RETRIES ?? "2");
      const minWaitMs = 1000;
      const requestWithRetry = async (model: string) => {
        let attempt = 0;
        while (true) {
          const response = await sendRequest(model);
          if (response.ok) {
            return response;
          }

          if (response.status === 429 && attempt < maxRetries) {
            const text = await response.text();
            const retryAfterSeconds = parseRetryAfterSeconds(text);
            const waitMs = Math.max(
              minWaitMs,
              Math.ceil((retryAfterSeconds ?? 1.5) * 1000)
            );
            await sleep(waitMs);
            attempt += 1;
            continue;
          }

          return response;
        }
      };

      let response = await requestWithRetry(options.model);

      if (!response.ok && response.status === 404 && options.model !== fallbackModel) {
        const text = await response.text();
        if (text.includes("model_not_found")) {
          response = await requestWithRetry(fallbackModel);
        } else {
          throw new Error(`OpenAI error (${response.status}): ${text}`);
        }
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenAI error (${response.status}): ${text}`);
      }

      const data = (await response.json()) as OpenAIResponse & ChatCompletionResponse;
      const output = useChatCompletions
        ? extractChatText(data)
        : extractOutputText(data).trim();
      if (!output) {
        throw new Error("OpenAI response was empty.");
      }

      return output;
    },
  };
}
