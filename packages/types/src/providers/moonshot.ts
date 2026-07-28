import type { ModelInfo } from "../model.js"
import { MoonshotApiLine } from "../provider-settings.js"

// https://platform.moonshot.ai/
export type MoonshotModelId = keyof typeof moonshotModels

export const moonshotDefaultModelId: MoonshotModelId = "kimi-k2-thinking"

export const moonshotModels = {
	// kilocode_change start
	"kimi-k3": {
		maxTokens: 131_072,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoningBinary: true,
		supportsAdaptiveThinking: true,
		preserveReasoning: true,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		supportsTemperature: false,
		defaultTemperature: 0.6,
		inputPrice: 0.6,
		outputPrice: 2.5,
		cacheWritesPrice: 0,
		cacheReadsPrice: 0.15,
		supportsReasoningEffort: ["low", "high", "max"],
		reasoningEffort: "max",
		description: "Kimi K3 is Kimi's latest flagship model with 1M context window, always-thinking, and multimodal capabilities (supports text, image, and video input).",
	},
	"kimi-k2.7-code": {
		maxTokens: 32_000,
		contextWindow: 262_144,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoningBinary: true,
		supportsAdaptiveThinking: true,
		inputPrice: 0.6,
		outputPrice: 2.5,
		cacheWritesPrice: 0,
		cacheReadsPrice: 0.15,
		preserveReasoning: true,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		supportsTemperature: false,
		defaultTemperature: 0.6,
		description: "Kimi K2.7 Code - optimized for coding tasks with thinking, image, and video capabilities.",
	},
	"kimi-k2.7-code-highspeed": {
		maxTokens: 32_000,
		contextWindow: 262_144,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoningBinary: true,
		supportsAdaptiveThinking: true,
		preserveReasoning: true,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		supportsTemperature: false,
		defaultTemperature: 0.6,
		inputPrice: 0.6,
		outputPrice: 2.5,
		cacheWritesPrice: 0,
		cacheReadsPrice: 0.15,
		description: "High-speed variant of kimi-k2.7-code with faster response times, supports image and video input.",
	},
	// kilocode_change end
	"kimi-k2-0711-preview": {
		maxTokens: 32_000,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: true,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		inputPrice: 0.6, // $0.60 per million tokens (cache miss)
		outputPrice: 2.5, // $2.50 per million tokens
		cacheWritesPrice: 0, // $0 per million tokens (cache miss)
		cacheReadsPrice: 0.15, // $0.15 per million tokens (cache hit)
		description: `Kimi K2 is a state-of-the-art mixture-of-experts (MoE) language model with 32 billion activated parameters and 1 trillion total parameters.`,
	},
	"kimi-k2-0905-preview": {
		maxTokens: 16384,
		contextWindow: 262144,
		supportsImages: false,
		supportsPromptCache: true,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		inputPrice: 0.6,
		outputPrice: 2.5,
		cacheReadsPrice: 0.15,
		description:
			"Kimi K2 model gets a new version update: Agentic coding: more accurate, better generalization across scaffolds. Frontend coding: improved aesthetics and functionalities on web, 3d, and other tasks. Context length: extended from 128k to 256k, providing better long-horizon support.",
	},
	"kimi-k2-turbo-preview": {
		maxTokens: 32_000,
		contextWindow: 262_144,
		supportsImages: false,
		supportsPromptCache: true,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		inputPrice: 2.4, // $2.40 per million tokens (cache miss)
		outputPrice: 10, // $10.00 per million tokens
		cacheWritesPrice: 0, // $0 per million tokens (cache miss)
		cacheReadsPrice: 0.6, // $0.60 per million tokens (cache hit)
		description: `Kimi K2 Turbo is a high-speed version of the state-of-the-art Kimi K2 mixture-of-experts (MoE) language model, with the same 32 billion activated parameters and 1 trillion total parameters, optimized for output speeds of up to 60 tokens per second, peaking at 100 tokens per second.`,
	},

	"kimi-k2-thinking-turbo": {
		maxTokens: 32_000,
		contextWindow: 262144,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 1.15, // $1.15 per million tokens (cache miss)
		outputPrice: 8.0, // $8.00 per million tokens
		cacheWritesPrice: 0, // $0 per million tokens (cache miss)
		cacheReadsPrice: 0.15, // $0.15 per million tokens (cache hit)
		supportsNativeTools: true,
		preserveReasoning: true,
		defaultTemperature: 1.0,
		description: `High-speed version of kimi-k2-thinking, suitable for scenarios requiring both deep reasoning and extremely fast responses`,
	},
	"kimi-k2-thinking": {
		maxTokens: 16_000, // Recommended ≥ 16,000
		contextWindow: 262_144, // 262,144 tokens
		supportsImages: false, // Text-only (no image/vision support)
		supportsPromptCache: true,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		inputPrice: 0.6, // $0.60 per million tokens (cache miss)
		outputPrice: 2.5, // $2.50 per million tokens
		cacheWritesPrice: 0, // $0 per million tokens (cache miss)
		cacheReadsPrice: 0.15, // $0.15 per million tokens (cache hit)
		supportsTemperature: true, // Default temperature: 1.0
		preserveReasoning: true,
		defaultTemperature: 1.0,
		description: `The kimi-k2-thinking model is a general-purpose agentic reasoning model developed by Moonshot AI. Thanks to its strength in deep reasoning and multi-turn tool use, it can solve even the hardest problems.`,
	},
	// kilocode_change start
	"kimi-k2.5": {
		maxTokens: 16_384,
		contextWindow: 262_144,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoningBinary: true,
		supportsAdaptiveThinking: true,
		preserveReasoning: true,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		inputPrice: 0.6, // $0.60 per million tokens (cache miss)
		outputPrice: 3.0, // $3.00 per million tokens
		cacheReadsPrice: 0.1, // $0.10 per million tokens (cache hit)
		supportsTemperature: false,
		defaultTemperature: 0.6,
		description:
			"Kimi K2.5 is the latest generation of Moonshot AI's Kimi series, featuring improved reasoning capabilities and enhanced performance across diverse tasks.",
	},
	"kimi-k2.6": {
		maxTokens: 16_384,
		contextWindow: 262_144,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoningBinary: true,
		supportsAdaptiveThinking: true,
		preserveReasoning: true,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		inputPrice: 0.95, // $0.95 per million tokens (cache miss)
		outputPrice: 4.0, // $4.00 per million tokens
		cacheReadsPrice: 0.16, // $0.16 per million tokens (cache hit)
		supportsTemperature: false,
		defaultTemperature: 0.6,
		description:
			"Kimi K2.6 is Kimi's most intelligent model to date, featuring stronger and more stable long-horizon code writing capabilities and significantly enhanced autonomous execution capabilities.",
	},
	// kilocode_change end
} as const satisfies Record<string, ModelInfo>

export const MOONSHOT_DEFAULT_TEMPERATURE = 0.6

export const moonshotApiLineConfigs = {
	international: {
		name: "International (api.moonshot.ai)",
		baseUrl: "https://api.moonshot.ai/v1",
		isChina: false,
	},
	china: {
		name: "China (api.moonshot.cn)",
		baseUrl: "https://api.moonshot.cn/v1",
		isChina: true,
	},
	managed: {
		name: "Managed (api.kimi.com/coding)",
		baseUrl: "https://api.kimi.com/coding/v1",
		isChina: true,
	},
} satisfies Record<MoonshotApiLine, { name: string; baseUrl: string; isChina: boolean }>
