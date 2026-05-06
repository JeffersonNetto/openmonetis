import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { createOpenAI, openai } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type {
	AvailableAIModel,
	ResolveLanguageModelResult,
	SupportedAIProvider,
} from "@/shared/lib/ai/types";

const OPENROUTER_MODEL_REGEX = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$/;
const OLLAMA_PREFIX = "ollama/";
const LM_STUDIO_PREFIX = "lm-studio/";

function normalizeBaseUrl(baseUrl: string) {
	return baseUrl.trim().replace(/\/$/, "");
}

function modelIdFromPrefix(modelId: string, prefix: string) {
	return modelId.slice(prefix.length).trim();
}

function resolveCustomProvider(modelId: string): SupportedAIProvider | null {
	if (modelId.startsWith(OLLAMA_PREFIX)) {
		return "ollama";
	}

	if (modelId.startsWith(LM_STUDIO_PREFIX)) {
		return "lm-studio";
	}

	if (OPENROUTER_MODEL_REGEX.test(modelId)) {
		return "openrouter";
	}

	return null;
}

export function resolveLanguageModel(
	modelId: string,
	availableModels: ReadonlyArray<AvailableAIModel>,
): ResolveLanguageModelResult {
	const selectedModel = availableModels.find((model) => model.id === modelId);

	if (selectedModel) {
		switch (selectedModel.provider) {
			case "openai":
				return { ok: true, model: openai(modelId), provider: "openai" };
			case "anthropic":
				return { ok: true, model: anthropic(modelId), provider: "anthropic" };
			case "google":
				return { ok: true, model: google(modelId), provider: "google" };
			default:
				return {
					ok: false,
					error: "Provider de modelo não suportado.",
				};
		}
	}

	const customProvider = resolveCustomProvider(modelId);
	if (!customProvider) {
		return {
			ok: false,
			error: "Modelo inválido.",
		};
	}

	if (customProvider === "openrouter") {
		const apiKey = process.env.OPENROUTER_API_KEY;
		if (!apiKey) {
			return {
				ok: false,
				error:
					"OPENROUTER_API_KEY não configurada. Adicione a chave no arquivo .env",
			};
		}

		const openrouter = createOpenRouter({ apiKey });
		return {
			ok: true,
			model: openrouter.chat(modelId),
			provider: "openrouter",
		};
	}

	if (customProvider === "ollama") {
		const baseURL = process.env.OLLAMA_BASE_URL;
		if (!baseURL) {
			return {
				ok: false,
				error:
					"OLLAMA_BASE_URL não configurada. Adicione o endpoint no arquivo .env",
			};
		}

		const ollamaModelId = modelIdFromPrefix(modelId, OLLAMA_PREFIX);
		if (!ollamaModelId) {
			return {
				ok: false,
				error: "Modelo do Ollama inválido.",
			};
		}

		const ollama = createOpenAI({
			name: "ollama",
			baseURL: normalizeBaseUrl(baseURL),
			apiKey: process.env.OLLAMA_API_KEY ?? "ollama",
		});

		return {
			ok: true,
			model: ollama.chat(ollamaModelId),
			provider: "ollama",
		};
	}

	const lmStudioBaseUrl = process.env.LM_STUDIO_BASE_URL;
	if (!lmStudioBaseUrl) {
		return {
			ok: false,
			error:
				"LM_STUDIO_BASE_URL não configurada. Adicione o endpoint no arquivo .env",
		};
	}

	const lmStudioModelId = modelIdFromPrefix(modelId, LM_STUDIO_PREFIX);
	if (!lmStudioModelId) {
		return {
			ok: false,
			error: "Modelo do LM Studio inválido.",
		};
	}

	const lmStudio = createOpenAI({
		name: "lm-studio",
		baseURL: normalizeBaseUrl(lmStudioBaseUrl),
		apiKey: process.env.LM_STUDIO_API_KEY ?? "lm-studio",
	});

	return {
		ok: true,
		model: lmStudio.chat(lmStudioModelId),
		provider: "lm-studio",
	};
}
