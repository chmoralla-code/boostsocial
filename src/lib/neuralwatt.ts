/**
 * OpenAI-compatible AI client.
 *
 * The provider is OpenRouter. Both chat and receipt-vision requests default to
 * the `openrouter/free` router, which picks an available free model per request
 * and automatically filters for the features the request needs (image input,
 * structured outputs, tool calling).
 *
 * The exported names still say "Neuralwatt" on purpose: they are imported by the
 * receipt verifier and both chat routes, and renaming them here would only move
 * churn into call sites that do not care which provider sits underneath.
 */

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const RETRYABLE_STATUSES = new Set([402, 408, 429, 500, 502, 503]);
const MAX_ATTEMPTS = 2;

export const FREE_MODELS_ROUTER = "openrouter/free";

function envValue(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
}

export const NEURALWATT_CHAT_MODEL =
  envValue("OPENROUTER_CHAT_MODEL", "NEURALWATT_CHAT_MODEL") || FREE_MODELS_ROUTER;

export const NEURALWATT_VISION_MODEL =
  envValue("OPENROUTER_VISION_MODEL", "NEURALWATT_VISION_MODEL") || FREE_MODELS_ROUTER;

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
  readonly detail?: string;

  constructor(status: number, detail?: string) {
    super(
      detail
        ? `Vision/chat API request failed with status ${status}: ${detail}`
        : `Vision/chat API request failed with status ${status}`
    );
    this.name = "NeuralwattApiError";
    this.status = status;
    this.retryable = RETRYABLE_STATUSES.has(status);
    this.detail = detail;
  }
}

function apiBaseUrl() {
  return (
    envValue("OPENROUTER_BASE_URL", "NEURALWATT_BASE_URL").replace(/\/+$/, "") || DEFAULT_BASE_URL
  );
}

function apiKey() {
  return envValue("OPENROUTER_API_KEY", "NEURALWATT_API_KEY");
}

function buildBody(options: CompletionOptions, includeResponseFormat: boolean) {
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
  if (includeResponseFormat && options.responseFormat) {
    body.response_format = options.responseFormat;
  }
  // OpenRouter expresses "do not reason" as a reasoning object. Free models that
  // do not support it simply ignore the field.
  if (options.disableThinking) {
    body.reasoning = { enabled: false, exclude: true };
  } else if (typeof options.thinkingTokenBudget === "number") {
    body.reasoning = { max_tokens: options.thinkingTokenBudget };
  }

  return body;
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
  return Boolean(apiKey());
}

async function readErrorDetail(response: Response) {
  try {
    const text = await response.text();
    if (!text) return undefined;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
      const nested = parsed.error;
      if (typeof nested === "string") return nested.slice(0, 300);
      if (nested && typeof nested.message === "string") return nested.message.slice(0, 300);
      if (typeof parsed.message === "string") return parsed.message.slice(0, 300);
    } catch {
      return text.slice(0, 300);
    }
    return text.slice(0, 300);
  } catch {
    return undefined;
  }
}

export async function requestNeuralwattChat(
  options: CompletionOptions
): Promise<NeuralwattCompletion> {
  const key = apiKey();
  if (!key) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  let includeResponseFormat = Boolean(options.responseFormat);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${apiBaseUrl()}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://faceboosting.vercel.app",
          "X-Title": "BoostSocial",
        },
        body: JSON.stringify(buildBody(options, includeResponseFormat)),
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
        throw new Error("AI API returned an empty completion");
      }

      return {
        message,
        finishReason: data.choices?.[0]?.finish_reason,
        model: data.model,
        usage: data.usage,
        energy: data.energy,
      };
    }

    const detail = await readErrorDetail(response);

    // A free model may reject the strict JSON schema or the tool schema. Drop the
    // structured-output request and try once more: the receipt verifier already
    // parses plain JSON out of the message content when no tool call is present.
    if (response.status === 400 && includeResponseFormat) {
      includeResponseFormat = false;
      await response.body?.cancel();
      continue;
    }

    const apiError = new NeuralwattApiError(response.status, detail);
    const shouldRetry = apiError.retryable && attempt < MAX_ATTEMPTS - 1;
    if (!shouldRetry) {
      throw apiError;
    }

    await response.body?.cancel();
    await wait(retryDelayMs(response, attempt));
  }

  throw new Error("AI API request failed");
}
