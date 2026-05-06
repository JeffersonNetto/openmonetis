import type { LanguageModel } from "ai";

export type SupportedAIProvider =
	| "openai"
	| "anthropic"
	| "google"
	| "openrouter"
	| "ollama"
	| "lm-studio";

export interface AvailableAIModel {
	id: string;
	provider: SupportedAIProvider;
}

export type ResolveLanguageModelResult =
	| {
			ok: true;
			model: LanguageModel;
			provider: SupportedAIProvider;
	  }
	| {
			ok: false;
			error: string;
	  };
