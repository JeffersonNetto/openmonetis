import { z } from "zod";

/**
 * Categorias de insights
 */
export const INSIGHT_CATEGORIES = {
	behaviors: {
		id: "behaviors",
		title: "Comportamentos Observados",
		icon: "RiEyeLine",
		color: "blue",
	},
	triggers: {
		id: "triggers",
		title: "Gatilhos de Consumo",
		icon: "RiFlashlightLine",
		color: "amber",
	},
	recommendations: {
		id: "recommendations",
		title: "Recomendações Práticas",
		icon: "RiLightbulbLine",
		color: "green",
	},
	improvements: {
		id: "improvements",
		title: "Melhorias Sugeridas",
		icon: "RiRocketLine",
		color: "purple",
	},
} as const;

export type InsightCategoryId = keyof typeof INSIGHT_CATEGORIES;

/**
 * Schema para item individual de insight
 */
const InsightItemSchema = z.object({
	text: z.string().min(1),
});

/**
 * Schema tolerante para resposta bruta do LLM
 */
export const RawInsightItemSchema = z.union([
	InsightItemSchema,
	z.string().min(1),
]);

/**
 * Schema para categoria de insights
 */
const InsightCategorySchema = z.object({
	category: z.enum([
		"behaviors",
		"triggers",
		"recommendations",
		"improvements",
	]),
	items: z.array(InsightItemSchema).min(1).max(6),
});

export const RawInsightCategorySchema = z.object({
	category: z.enum([
		"behaviors",
		"triggers",
		"recommendations",
		"improvements",
	]),
	items: z.array(RawInsightItemSchema).min(1).max(6),
});

/**
 * Schema for complete insights response from AI
 */
export const InsightsResponseSchema = z.object({
	month: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM
	generatedAt: z.string(), // ISO datetime
	categories: z.array(InsightCategorySchema).length(4),
});

export const RawInsightsResponseSchema = z.object({
	month: z.string().regex(/^\d{4}-\d{2}$/),
	generatedAt: z.string(),
	categories: z.array(RawInsightCategorySchema).length(4),
});

/**
 * TypeScript types derived from schemas
 */
export type InsightsResponse = z.infer<typeof InsightsResponseSchema>;

export type RawInsightsResponse = z.infer<typeof RawInsightsResponseSchema>;

export function normalizeInsightsResponse(
	data: RawInsightsResponse,
): InsightsResponse {
	return {
		...data,
		categories: data.categories.map((category) => ({
			...category,
			items: category.items.map((item) =>
				typeof item === "string" ? { text: item } : item,
			),
		})),
	};
}
