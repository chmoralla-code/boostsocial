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
const DEFAULT_MAX_TOKENS = 500;
const DEFAULT_TIMEOUT_MS = 25_000;
/** Budget multiplier used when a model burns its whole allowance on reasoning. */
const EMPTY_CONTENT_RETRY_MULTIPLIER = 4;
/** Hard ceiling for the enlarged retry so a request cannot run away in time. */
const EMPTY_CONTENT_RETRY_CEILING = 4096;
const MAX_EMPTY_CONTENT_RETRIES = 1;
/** Never spend less than this on a retry; bail out and use what we have. */
const MIN_RETRY_REMAINING_MS = 4_000;

export const COMMANDCODE_DEFAULT_BASE_URL = "https://api.commandcode.ai/provider/v1";
export const OPENROUTER_DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
export const COMMANDCODE_DEFAULT_MODEL = "deepseek/deepseek-v4.1-flash";
export const FREE_MODELS_ROUTER = "openrouter/free";

/**
 * Some dashboards store a whole `KEY=value` string in the value field by
 * mistake. That produced a URL that was literally
 * "COMMANDCODE_BASE_URL=https://..." and killed every AI call with an invalid
 * URL, which then surfaced as a canned fallback reply. Strip the leading
 * assignment and any stray quotes so the client keeps working either way.
 */
function normalizeEnvValue(raw: string) {
  let value = raw.trim().replace(/^["']|["']$/g, "").trim();
  const assignment = value.match(/^[A-Za-z][A-Za-z0-9_]*=([\s\S]*)$/);
  if (assignment) {
    value = assignment[1].trim().replace(/^["']|["']$/g, "").trim();
  }
  return value;
}

function envValue(...names: string[]) {
  for (const name of names) {
    const raw = process.env[name];
    if (!raw) continue;
    const value = normalizeEnvValue(raw);
    if (value) return value;
  }
  return "";
}

function stripTrailingSlash(url: string) {
  return url.replace(/\/+$/, "");
}

/**
 * A malformed base URL used to fail later as "Failed to parse URL from ..."
 * inside `fetch`, where the only symptom the customer saw was a canned reply.
 * Rejecting it here skips that provider instead, so the chain moves on to one
 * that can actually answer.
 */
function validBaseUrl(url: string) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return stripTrailingSlash(url);
  } catch {
    return "";
  }
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
  const baseUrl =
    validBaseUrl(envValue("COMMANDCODE_BASE_URL")) || COMMANDCODE_DEFAULT_BASE_URL;
  return {
    name: "commandcode",
    baseUrl,
    apiKey,
    chatModel: envValue("COMMANDCODE_CHAT_MODEL") || COMMANDCODE_DEFAULT_MODEL,
    visionModel: envValue("COMMANDCODE_VISION_MODEL") || COMMANDCODE_DEFAULT_MODEL,
    headers: {},
  };
}

function openRouterProvider(): Provider | null {
  const apiKey = envValue("OPENROUTER_API_KEY", "NEURALWATT_API_KEY");
  if (!apiKey) return null;
  const baseUrl =
    validBaseUrl(envValue("OPENROUTER_BASE_URL", "NEURALWATT_BASE_URL")) ||
    OPENROUTER_DEFAULT_BASE_URL;
  return {
    name: "openrouter",
    baseUrl,
    apiKey,
    chatModel: envValue("OPENROUTER_CHAT_MODEL", "NEURALWATT_CHAT_MODEL") || FREE_MODELS_ROUTER,
    visionModel:
      envValue("OPENROUTER_VISION_MODEL", "NEURALWATT_VISION_MODEL") || FREE_MODELS_ROUTER,
    headers: {
      "HTTP-Referer": "https://pinoyboosting.com",
      "X-Title": "BoostSocial",
    },
  };
}

function providers(): Provider[] {
  return [commandCodeProvider(), openRouterProvider()].filter(
    (provider): provider is Provider => provider !== null
  );
}

/** Configured providers in fallback order, without secrets (for diagnostics). */
export function describeAiProviders() {
  return providers().map((provider) => ({
    name: provider.name,
    host: new URL(provider.baseUrl).host,
    chatModel: provider.chatModel,
    visionModel: provider.visionModel,
  }));
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
    max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
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

function readMessageText(message: NeuralwattCompletion["message"]) {
  return typeof message.content === "string" ? message.content.trim() : "";
}

/** Reasoning models stream their thinking into `reasoning` / `reasoning_content`. */
function readReasoningText(message: NeuralwattCompletion["message"]) {
  const reasoning = message.reasoning ?? message.reasoning_content;
  return typeof reasoning === "string" ? reasoning.trim() : "";
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

  // A reasoning model can spend the whole budget thinking and come back with an
  // empty `content`. Retry once with a larger budget, then fall back to the
  // reasoning text so a chat reply is never silently dropped.
  let currentOptions = options;
  let enlargedAttempts = 0;
  const requestStartedAt = Date.now();

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
        body: JSON.stringify(buildBody(currentOptions, model, includeResponseFormat)),
        signal: AbortSignal.timeout(currentOptions.timeoutMs ?? DEFAULT_TIMEOUT_MS),
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

      const finishReason = data.choices?.[0]?.finish_reason;

      if (!readMessageText(message)) {
        const currentBudget = currentOptions.maxTokens ?? DEFAULT_MAX_TOKENS;
        const callerTimeout = currentOptions.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        const remainingMs = callerTimeout - (Date.now() - requestStartedAt);

        // Only stretch the budget when there is time left to actually use it.
        // Without this the retry starts a fresh long timeout and the whole
        // request outlives the caller's timeout (and the function's duration).
        const shouldEnlarge =
          finishReason === "length" &&
          enlargedAttempts < MAX_EMPTY_CONTENT_RETRIES &&
          currentBudget < EMPTY_CONTENT_RETRY_CEILING &&
          remainingMs >= MIN_RETRY_REMAINING_MS;

        if (shouldEnlarge) {
          enlargedAttempts += 1;
          currentOptions = {
            ...currentOptions,
            maxTokens: Math.min(currentBudget * EMPTY_CONTENT_RETRY_MULTIPLIER, EMPTY_CONTENT_RETRY_CEILING),
            timeoutMs: remainingMs,
            disableThinking: false,
            thinkingTokenBudget: undefined,
          };
          await response.body?.cancel();
          continue;
        }

        const reasoning = readReasoningText(message);
        if (reasoning) {
          return {
            message: { ...message, content: reasoning },
            finishReason,
            model: data.model,
            usage: data.usage,
            energy: data.energy,
          };
        }
      }

      return {
        message,
        finishReason,
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
      // Only fall through on errors a second provider can actually fix. A
      // timeout is not one of them: the caller's 45s budget plus a second 45s
      // attempt would outlive the route's 60s limit, so the request would be
      // killed instead of recording a reason. Stopping here keeps the worst
      // case inside the limit and leaves a readable error on the row.
      const worthTryingNext =
        error instanceof NeuralwattApiError &&
        (error.retryable || error.status === 401 || error.status === 403);
      if (!worthTryingNext) throw error;
    } finally {
      isFirst = false;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("AI API request failed");
}
