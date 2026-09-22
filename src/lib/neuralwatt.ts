/**
 * OpenAI-compatible AI client.
 *
 * Primary provider: CommandCode (`https://api.commandcode.ai/provider/v1`),
 * serving `deepseek/deepseek-v4.1-flash` for both website/app chat and receipt
 * vision.
 *
 * Fallback provider: OpenRouter's free router, used only when its key is set and
 * the primary call fails. This keeps a single missing key from silently killing
 * auto-approval, which is exactly what happened before.
 *
 * The exported names still say "Neuralwatt" on purpose: they are imported by the
 * receipt verifier and both chat routes, and renaming them here would only move
 * churn into call sites that do not care which provider sits underneath.
 */

const RETRYABLE_STATUSES = new Set([402, 408, 429, 500, 502, 503]);
const MAX_ATTEMPTS_PER_PROVIDER = 2;

export const COMMANDCODE_DEFAULT_BASE_URL = "https://api.commandcode.ai/provider/v1";
export const OPENROUTER_DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
export const COMMANDCODE_DEFAULT_MODEL = "deepseek/deepseek-v4.1-flash";
export const FREE_MODELS_ROUTER = "openrouter/free";

function envValue(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
}

function stripTrailingSlash(url: string) {
  return url.replace(/\/+$/, "");
}

type Provider = {
  name: string;
  baseUrl: string;
  apiKey: string;
  chatModel: string;
  visionModel: string;
  headers: Record<string, string>;
};

function commandCodeProvider(): Provider | null {
  const apiKey = envValue("COMMANDCODE_API_KEY");
  if (!apiKey) return null;
  return {
    name: "commandcode",
    baseUrl:
      stripTrailingSlash(envValue("COMMANDCODE_BASE_URL")) || COMMANDCODE_DEFAULT_BASE_URL,
    apiKey,
    chatModel: envValue("COMMANDCODE_CHAT_MODEL") || COMMANDCODE_DEFAULT_MODEL,
    visionModel: envValue("COMMANDCODE_VISION_MODEL") || COMMANDCODE_DEFAULT_MODEL,
    headers: {},
  };
}

function openRouterProvider(): Provider | null {
  const apiKey = envValue("OPENROUTER_API_KEY", "NEURALWATT_API_KEY");
  if (!apiKey) return null;
  return {
    name: "openrouter",
    baseUrl:
      stripTrailingSlash(envValue("OPENROUTER_BASE_URL", "NEURALWATT_BASE_URL")) ||
      OPENROUTER_DEFAULT_BASE_URL,
    apiKey,
    chatModel: envValue("OPENROUTER_CHAT_MODEL", "NEURALWATT_CHAT_MODEL") || FREE_MODELS_ROUTER,
    visionModel:
      envValue("OPENROUTER_VISION_MODEL", "NEURALWATT_VISION_MODEL") || FREE_MODELS_ROUTER,
    headers: {
      "HTTP-Referer": "https://faceboosting.vercel.app",
      "X-Title": "BoostSocial",
    },
  };
}

function providers(): Provider[] {
  return [commandCodeProvider(), openRouterProvider()].filter(
    (provider): provider is Provider => provider !== null
  );
}

function primaryProvider(): Provider | null {
  return providers()[0] ?? null;
}

export const NEURALWATT_CHAT_MODEL = primaryProvider()?.chatModel || COMMANDCODE_DEFAULT_MODEL;

export const NEURALWATT_VISION_MODEL = primaryProvider()?.visionModel || COMMANDCODE_DEFAULT_MODEL;

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
  model?: string;
  messages: NeuralwattMessage[];
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  tools?: NeuralwattTool[];
  toolChoice?: NeuralwattToolChoice;
  responseFormat?: Record<string, unknown>;
  thinkingTokenBudget?: number;
  disableThinking?: boolean;
  /** Which of the request's two model slots to use. Defaults to "chat". */
  task?: "chat" | "vision";
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

function buildBody(options: CompletionOptions, model: string, includeResponseFormat: boolean) {
  const body: Record<string, unknown> = {
    model,
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
  // Expressed as a reasoning object, the OpenAI-compatible way. Providers or
  // models that do not support it ignore the field.
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

function isAbortError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

export function hasNeuralwattApiKey() {
  return providers().length > 0;
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

async function requestFromProvider(
  provider: Provider,
  options: CompletionOptions,
  useRequestedModel: boolean
): Promise<NeuralwattCompletion> {
  const providerModel =
    options.task === "vision" ? provider.visionModel : provider.chatModel;
  // The caller's model name only makes sense on the provider it was configured
  // for. A fallback provider has its own catalogue, so it gets its own model.
  const model = (useRequestedModel && options.model) || providerModel;
  let includeResponseFormat = Boolean(options.responseFormat);

  for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_PROVIDER; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
          ...provider.headers,
        },
        body: JSON.stringify(buildBody(options, model, includeResponseFormat)),
        signal: AbortSignal.timeout(options.timeoutMs ?? 25_000),
        cache: "no-store",
      });
    } catch (error) {
      // A second attempt would double the worst-case wall time and can push the
      // whole serverless request past its limit, so a timeout is final.
      if (isAbortError(error) || attempt >= MAX_ATTEMPTS_PER_PROVIDER - 1) throw error;
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

    // Some models reject the strict JSON schema. Drop the structured-output
    // request and try once more: the receipt verifier already parses plain JSON
    // out of the message content when no tool call is present.
    if (response.status === 400 && includeResponseFormat) {
      includeResponseFormat = false;
      await response.body?.cancel();
      continue;
    }

    const apiError = new NeuralwattApiError(response.status, detail);
    const shouldRetry = apiError.retryable && attempt < MAX_ATTEMPTS_PER_PROVIDER - 1;
    if (!shouldRetry) {
      throw apiError;
    }

    await response.body?.cancel();
    await wait(retryDelayMs(response, attempt));
  }

  throw new Error("AI API request failed");
}

export async function requestNeuralwattChat(
  options: CompletionOptions
): Promise<NeuralwattCompletion> {
  const chain = providers();

  if (!chain.length) {
    throw new Error(
      "No AI provider is configured. Set COMMANDCODE_API_KEY (preferred) or OPENROUTER_API_KEY."
    );
  }

  let lastError: unknown;
  let isFirst = true;

  for (const provider of chain) {
    try {
      return await requestFromProvider(provider, options, isFirst);
    } catch (error) {
      lastError = error;
      // A rejected request (bad schema, bad key) will be rejected the same way
      // everywhere, so only fall through on errors a second provider can fix.
      const worthTryingNext =
        isAbortError(error) ||
        (error instanceof NeuralwattApiError && (error.retryable || error.status === 401 || error.status === 403));
      if (!worthTryingNext) throw error;
    } finally {
      isFirst = false;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("AI API request failed");
}
