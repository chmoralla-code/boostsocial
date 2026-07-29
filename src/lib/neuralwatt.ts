const DEFAULT_NEURALWATT_BASE_URL = "https://api.neuralwatt.com/v1";
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503]);
const MAX_ATTEMPTS = 2;

export const NEURALWATT_CHAT_MODEL =
  process.env.NEURALWATT_CHAT_MODEL?.trim() || "deepseek-v4-flash";
export const NEURALWATT_VISION_MODEL =
  process.env.NEURALWATT_VISION_MODEL?.trim() || "kimi-k2.7-code";

export type NeuralwattTextPart = {
  type: "text";
  text: string;
};

export type NeuralwattImagePart = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type NeuralwattMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | Array<NeuralwattTextPart | NeuralwattImagePart>;
  name?: string;
  tool_call_id?: string;
};

export type NeuralwattTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type NeuralwattToolChoice =
  | "auto"
  | "none"
  | "required"
  | {
      type: "function";
      function: {
        name: string;
      };
    };

export type NeuralwattToolCall = {
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
};

export type NeuralwattCompletion = {
  message: {
    role?: string;
    content?: string | null;
    reasoning?: string | null;
    reasoning_content?: string | null;
    function_call?: {
      name?: string;
      arguments?: string;
    };
    tool_calls?: NeuralwattToolCall[];
  };
  finishReason?: string | null;
  model?: string;
  usage?: Record<string, unknown>;
  energy?: Record<string, unknown>;
};

type CompletionOptions = {
  model: string;
  messages: NeuralwattMessage[];
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  tools?: NeuralwattTool[];
  toolChoice?: NeuralwattToolChoice;
  responseFormat?: Record<string, unknown>;
  thinkingTokenBudget?: number;
  disableThinking?: boolean;
};

export class NeuralwattApiError extends Error {
  readonly status: number;
  readonly retryable: boolean;

  constructor(status: number) {
    super(`NeuralWatt API request failed with status ${status}`);
    this.name = "NeuralwattApiError";
    this.status = status;
    this.retryable = RETRYABLE_STATUSES.has(status);
  }
}

function apiBaseUrl() {
  return (
    process.env.NEURALWATT_BASE_URL?.trim().replace(/\/+$/, "") ||
    DEFAULT_NEURALWATT_BASE_URL
  );
}

function retryDelayMs(response: Response, attempt: number) {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1_000, 5_000);
    }

    const dateMs = Date.parse(retryAfter);
    if (Number.isFinite(dateMs)) {
      return Math.min(Math.max(dateMs - Date.now(), 0), 5_000);
    }
  }

  return 400 * 2 ** attempt;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function hasNeuralwattApiKey() {
  return Boolean(process.env.NEURALWATT_API_KEY?.trim());
}

export async function requestNeuralwattChat(
  options: CompletionOptions
): Promise<NeuralwattCompletion> {
  const apiKey = process.env.NEURALWATT_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("NEURALWATT_API_KEY is not configured");
  }

  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
    max_tokens: options.maxTokens ?? 500,
    temperature: options.temperature ?? 0.6,
  };

  if (options.tools?.length) {
    body.tools = options.tools;
    body.tool_choice = options.toolChoice ?? "auto";
  }
  if (options.responseFormat) {
    body.response_format = options.responseFormat;
  }
  if (typeof options.thinkingTokenBudget === "number") {
    body.thinking_token_budget = options.thinkingTokenBudget;
  }
  if (options.disableThinking) {
    body.chat_template_kwargs = { enable_thinking: false };
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${apiBaseUrl()}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(options.timeoutMs ?? 25_000),
        cache: "no-store",
      });
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS - 1) throw error;
      await wait(400 * 2 ** attempt);
      continue;
    }

    if (response.ok) {
      const data = (await response.json()) as {
        choices?: Array<{
          message?: NeuralwattCompletion["message"];
          finish_reason?: string | null;
        }>;
        model?: string;
        usage?: Record<string, unknown>;
        energy?: Record<string, unknown>;
      };
      const message = data.choices?.[0]?.message;

      if (!message) {
        throw new Error("NeuralWatt API returned an empty completion");
      }

      return {
        message,
        finishReason: data.choices?.[0]?.finish_reason,
        model: data.model,
        usage: data.usage,
        energy: data.energy,
      };
    }

    const apiError = new NeuralwattApiError(response.status);
    const shouldRetry = apiError.retryable && attempt < MAX_ATTEMPTS - 1;
    if (!shouldRetry) {
      throw apiError;
    }

    await response.body?.cancel();
    await wait(retryDelayMs(response, attempt));
  }

  throw new Error("NeuralWatt API request failed");
}
