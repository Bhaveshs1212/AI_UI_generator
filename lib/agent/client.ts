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

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify(
          useChatCompletions
            ? {
                model: options.model,
                messages: [{ role: "user", content: prompt }],
                temperature: 0,
                stream: false,
              }
            : {
                model: options.model,
                input: prompt,
                temperature: 0,
                top_p: 1,
              }
        ),
      });

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
