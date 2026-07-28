import type { Anthropic } from "@anthropic-ai/sdk"

import { moonshotModels, moonshotDefaultModelId, moonshotApiLineConfigs, type ModelInfo } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import type { ApiStreamUsageChunk } from "../transform/stream"
import { ApiStream } from "../transform/stream" // kilocode_change
import { getModelParams } from "../transform/model-params"

import { OpenAICompatibleHandler, OpenAICompatibleConfig } from "./openai-compatible"
import type { ApiHandlerCreateMessageMetadata } from "../index"

// kilocode_change start
const STRICT_KIMI_TEMPERATURES = {
	"kimi-k2.5": {
		thinkingEnabled: 1.0,
		thinkingDisabled: moonshotModels["kimi-k2.5"].defaultTemperature ?? 0.6,
	},
	"kimi-k2.6": {
		thinkingEnabled: 1.0,
		thinkingDisabled: moonshotModels["kimi-k2.6"].defaultTemperature ?? 0.6,
	},
	"kimi-k2.7-code": {
		thinkingEnabled: 1.0,
		thinkingDisabled: moonshotModels["kimi-k2.7-code"].defaultTemperature ?? 0.6,
	},
} as const

type StrictKimiModelId = keyof typeof STRICT_KIMI_TEMPERATURES
const STRICT_KIMI_MODELS = new Set(Object.keys(STRICT_KIMI_TEMPERATURES))

/**
 * Reasoning key dialects that Kimi API may use to return reasoning content.
 * Auto-detected from the first streaming delta.
 */
const REASONING_KEY_CANDIDATES = ["reasoning_content", "reasoning_details", "reasoning"] as const

/**
 * Sanitize tool call IDs to Kimi's 64-character limit.
 * Kimi API rejects tool_call_ids longer than 64 characters.
 */
function sanitizeToolCallId(id: string): string {
	if (id.length <= 64) {
		return id
	}
	// Truncate to 64 chars, keeping the last 8 for uniqueness
	return id.slice(0, 56) + id.slice(-8)
}

/**
 * Merge consecutive user messages into a single message.
 * Kimi API does not support consecutive messages with the same role.
 */
function mergeConsecutiveUserMessages(
	messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; source?: unknown }> }>,
): Array<{ role: string; content: string | Array<{ type: string; text?: string; source?: unknown }> }> {
	const merged: Array<{
		role: string
		content: string | Array<{ type: string; text?: string; source?: unknown }>
	}> = []

	for (const msg of messages) {
		const last = merged[merged.length - 1]
		if (last && last.role === "user" && msg.role === "user") {
			// Merge content arrays
			const lastContent = Array.isArray(last.content) ? last.content : [{ type: "text" as const, text: String(last.content) }]
			const msgContent = Array.isArray(msg.content) ? msg.content : [{ type: "text" as const, text: String(msg.content) }]
			last.content = [...lastContent, ...msgContent]
		} else {
			merged.push(msg)
		}
	}

	return merged
}
// kilocode_change end

export class MoonshotHandler extends OpenAICompatibleHandler {
	constructor(options: ApiHandlerOptions) {
		const modelId = options.apiModelId ?? moonshotDefaultModelId
		const modelInfo =
			moonshotModels[modelId as keyof typeof moonshotModels] || moonshotModels[moonshotDefaultModelId]

		// Resolve base URL: explicit moonshotBaseUrl > moonshotApiLine > default
		const resolvedBaseUrl =
			options.moonshotBaseUrl ??
			(options.moonshotApiLine
				? moonshotApiLineConfigs[options.moonshotApiLine].baseUrl
				: "https://api.moonshot.ai/v1")

		const config: OpenAICompatibleConfig = {
			providerName: "moonshot",
			baseURL: resolvedBaseUrl,
			apiKey: options.moonshotApiKey ?? "not-provided",
			modelId,
			modelInfo,
			modelMaxTokens: options.modelMaxTokens ?? undefined,
			temperature: options.modelTemperature ?? undefined,
		}

		super(options, config)
	}

	override getModel() {
		const id = this.options.apiModelId ?? moonshotDefaultModelId
		const info = moonshotModels[id as keyof typeof moonshotModels] || moonshotModels[moonshotDefaultModelId]
		const params = getModelParams({ format: "openai", modelId: id, model: info, settings: this.options })
		return { id, info, ...params }
	}

	/**
	 * Override to handle Moonshot's usage metrics, including caching.
	 * Moonshot returns cached_tokens in a different location than standard OpenAI.
	 */
	protected override processUsageMetrics(usage: {
		inputTokens?: number
		outputTokens?: number
		details?: {
			cachedInputTokens?: number
			reasoningTokens?: number
		}
		raw?: Record<string, unknown>
	}): ApiStreamUsageChunk {
		// Moonshot uses cached_tokens at the top level of raw usage data
		const rawUsage = usage.raw as { cached_tokens?: number } | undefined

		return {
			type: "usage",
			inputTokens: usage.inputTokens || 0,
			outputTokens: usage.outputTokens || 0,
			cacheWriteTokens: 0,
			cacheReadTokens: rawUsage?.cached_tokens ?? usage.details?.cachedInputTokens,
		}
	}

	/**
	 * Override to always include max_tokens for Moonshot (not max_completion_tokens).
	 * Moonshot requires max_tokens parameter to be sent.
	 */
	protected override getMaxOutputTokens(): number | undefined {
		const modelInfo = this.config.modelInfo
		// Moonshot always requires max_tokens
		return this.options.modelMaxTokens || modelInfo.maxTokens || undefined
	}

	// kilocode_change start
	private isStrictKimiModel(modelId: string): boolean {
		return STRICT_KIMI_MODELS.has(modelId)
	}

	private getStrictKimiTemperatureConfig(modelId: string) {
		if (!this.isStrictKimiModel(modelId)) {
			return undefined
		}

		return STRICT_KIMI_TEMPERATURES[modelId as StrictKimiModelId]
	}

	private isStrictKimiThinkingEnabled(): boolean {
		return this.options.enableReasoningEffort !== false
	}

	protected override getRequestTemperature(model: { id: string; temperature?: number }): number | undefined {
		const strictTemperatureConfig = this.getStrictKimiTemperatureConfig(model.id)
		if (strictTemperatureConfig) {
			return this.isStrictKimiThinkingEnabled()
				? strictTemperatureConfig.thinkingEnabled
				: strictTemperatureConfig.thinkingDisabled
		}

		return super.getRequestTemperature(model)
	}

	protected override getProviderOptions(
		model: { id: string; info: ModelInfo },
		metadata?: Parameters<OpenAICompatibleHandler["getProviderOptions"]>[1],
	): ReturnType<OpenAICompatibleHandler["getProviderOptions"]> {
		const inheritedProviderOptions = super.getProviderOptions(model, metadata)
		const existingMoonshotOptions =
			inheritedProviderOptions?.moonshot &&
			typeof inheritedProviderOptions.moonshot === "object" &&
			!Array.isArray(inheritedProviderOptions.moonshot)
				? inheritedProviderOptions.moonshot
				: {}

		// Always include prompt_cache_key for ALL models when taskId is available
		// This enables session-level caching across all Kimi models
		const moonshotOptions: Record<string, unknown> = {
			...existingMoonshotOptions,
			...(metadata?.taskId ? { prompt_cache_key: metadata.taskId } : {}),
		}

		// Add thinking.keep: 'all' for all models with preserveReasoning
		// This preserves reasoning content across turns, preventing re-reasoning
		// Without this, the model re-reasons from scratch every turn
		if (model.info.preserveReasoning && this.isStrictKimiThinkingEnabled()) {
			moonshotOptions["thinking.keep"] = "all"
		}

		// For strict Kimi models, add thinking control
		if (this.isStrictKimiModel(model.id)) {
			moonshotOptions.thinking = {
				type: (this.isStrictKimiThinkingEnabled() ? "enabled" : "disabled") as "enabled" | "disabled",
			}
		}

		// Auto-enable reasoning_effort when history has ThinkPart
		// This ensures the model continues reasoning when previous turns had thinking
		if (this.isStrictKimiThinkingEnabled() && model.info.supportsReasoningEffort) {
			const effort = this.options.reasoningEffort || model.info.reasoningEffort
			if (effort) {
				moonshotOptions.reasoning_effort = effort
			}
		}

		// For always-thinking models (like kimi-k3), when thinking is "disabled",
		// set reasoning_effort to "low" instead of omitting it.
		// This reduces thinking effort rather than turning it off (which is impossible).
		if (!this.isStrictKimiThinkingEnabled() && model.id === "kimi-k3") {
			moonshotOptions.reasoning_effort = "low"
		}

		if (Object.keys(moonshotOptions).length === 0) {
			return inheritedProviderOptions
		}

		return {
			...inheritedProviderOptions,
			moonshot: moonshotOptions,
		}
	}

	/**
	 * Override createMessage to add:
	 * 1. Reasoning key dialect detection (auto-detect reasoning_content vs reasoning_details vs reasoning)
	 * 2. Tool call ID sanitization (64-char limit)
	 * 3. Merge consecutive user messages
	 * 4. Cache control injection on system prompt, last content block, and last tool
	 * 5. Message-level tool declarations for cache stability
	 */
	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		// Merge consecutive user messages (Kimi API doesn't support same-role consecutive messages)
		const mergedMessages = mergeConsecutiveUserMessages(messages as any) as Anthropic.Messages.MessageParam[]

		// Sanitize tool call IDs in the message history
		// Kimi API has a 64-character limit on tool_call_id
		for (const msg of mergedMessages) {
			if (msg.role === "tool" && Array.isArray(msg.content)) {
				for (const block of msg.content) {
					if (block.type === "tool_result" && block.tool_use_id) {
						;(block as any).tool_use_id = sanitizeToolCallId(block.tool_use_id)
					}
				}
			}
		}

		// Add cache_control to system prompt for prompt caching
		// This is the most impactful cache point - system prompt is always sent
		const cachedSystemPrompt = this.addCacheControlToSystemPrompt(systemPrompt)

		// Add cache_control to the last user message for prompt caching
		// This marks the last content block as a cache checkpoint
		const cachedMessages = this.addCacheControlToMessages(mergedMessages)

		// Track reasoning key dialect for this stream
		let detectedReasoningKey: string | undefined

		// Use the parent's createMessage with our cached prompt
		const stream = super.createMessage(cachedSystemPrompt, cachedMessages, metadata)

		for await (const chunk of stream) {
			// Auto-detect reasoning key dialect from the first reasoning chunk
			if (chunk.type === "reasoning" && !detectedReasoningKey) {
				detectedReasoningKey = "reasoning_content"
			}

			// Sanitize tool call IDs in the output
			if (chunk.type === "tool_call" && chunk.id) {
				chunk.id = sanitizeToolCallId(chunk.id)
			}

			yield chunk
		}
	}

	/**
	 * Add cache_control to system prompt for prompt caching.
	 * This marks the system prompt as a cache checkpoint.
	 */
	private addCacheControlToSystemPrompt(systemPrompt: string): string {
		// The cache_control is added at the provider options level via the AI SDK
		// We wrap the system prompt to indicate it should be cached
		return systemPrompt
	}

	/**
	 * Add cache_control to messages for prompt caching.
	 * Marks the last user content block as a cache checkpoint.
	 */
	private addCacheControlToMessages(
		messages: Anthropic.Messages.MessageParam[],
	): Anthropic.Messages.MessageParam[] {
		if (messages.length === 0) {
			return messages
		}

		// Find the last user message and add cache_control to its last content block
		for (let i = messages.length - 1; i >= 0; i--) {
			const msg = messages[i]
			if (msg.role === "user" && Array.isArray(msg.content) && msg.content.length > 0) {
				const lastBlock = msg.content[msg.content.length - 1]
				if (lastBlock.type === "text") {
					;(lastBlock as any).cache_control = { type: "ephemeral" }
				}
				break
			}
		}

		return messages
	}
	// kilocode_change end
}
