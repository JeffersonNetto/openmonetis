"use server";

import { generateText, Output } from "ai";
import { resolveLanguageModel } from "@/shared/lib/ai/providers";
import { getUser } from "@/shared/lib/auth/server";
import {
	normalizeInsightsResponse,
	RawInsightsResponseSchema,
	type InsightsResponse,
	InsightsResponseSchema,
} from "@/shared/lib/schemas/insights";
import { AVAILABLE_MODELS, INSIGHTS_SYSTEM_PROMPT } from "../constants";
import { aggregateMonthData } from "./aggregate";
import type { ActionResult } from "./types";

const PERIOD_REGEX = /^\d{4}-\d{2}$/;

function extractJsonObjectFromText(text: string): unknown {
	const fencedJsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
	if (fencedJsonMatch?.[1]) {
		return JSON.parse(fencedJsonMatch[1]);
	}

	const firstBrace = text.indexOf("{");
	const lastBrace = text.lastIndexOf("}");
	if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
		throw new Error("JSON não encontrado na resposta do modelo.");
	}

	return JSON.parse(text.slice(firstBrace, lastBrace + 1));
}

export async function generateInsightsAction(
	period: string,
	modelId: string,
): Promise<ActionResult<InsightsResponse>> {
	try {
		const user = await getUser();

		if (!PERIOD_REGEX.test(period)) {
			return {
				success: false,
				error: "Período inválido (formato esperado: YYYY-MM)",
			};
		}

		const resolvedModel = resolveLanguageModel(modelId, AVAILABLE_MODELS);
		if (!resolvedModel.ok) {
			return {
				success: false,
				error: resolvedModel.error,
			};
		}

		const aggregatedData = await aggregateMonthData(user.id, period);

		const basePrompt = `Analise os seguintes dados financeiros agregados do período ${period}.

Dados agregados:
${JSON.stringify(aggregatedData, null, 2)}

DADOS IMPORTANTES PARA SUA ANÁLISE:

**Tendência de 3 meses:**
- Os dados incluem tendência dos últimos 3 meses (threeMonthTrend)
- Use isso para identificar padrões crescentes, decrescentes ou estáveis
- Compare o mês atual com a média dos 3 meses

**Análise de Recorrência:**
- Gastos recorrentes representam ${aggregatedData.recurringExpenses.percentageOfTotal.toFixed(1)}% das despesas
- ${aggregatedData.recurringExpenses.count} gastos identificados como recorrentes
- Use isso para avaliar previsibilidade e oportunidades de otimização

**Gastos Parcelados:**
- ${aggregatedData.installments.currentMonthInstallments} parcelas ativas no mês
- Comprometimento futuro de R$ ${aggregatedData.installments.futureCommitment.toFixed(2)}
- Use isso para alertas sobre comprometimento de renda futura

Organize suas observações nas 4 categories especificadas no prompt do sistema:
1. Comportamentos Observados (behaviors): 3-6 itens
2. Gatilhos de Consumo (triggers): 3-6 itens
3. Recomendações Práticas (recommendations): 3-6 itens
4. Melhorias Sugeridas (improvements): 3-6 itens

Cada item deve ser conciso, direto e acionável. Use os novos dados para dar contexto temporal e identificar padrões mais profundos.

Responda APENAS com um JSON válido seguindo exatamente o schema especificado.`;

		let rawOutput: unknown;

		try {
			const result = await generateText({
				model: resolvedModel.model,
				output: Output.object({
					schema: RawInsightsResponseSchema,
				}),
				system: INSIGHTS_SYSTEM_PROMPT,
				prompt: basePrompt,
			});

			rawOutput = result.output;
		} catch (structuredError) {
			console.error(
				"Structured output failed for insights generation, trying text fallback:",
				structuredError,
			);

			const fallbackResult = await generateText({
				model: resolvedModel.model,
				system: INSIGHTS_SYSTEM_PROMPT,
				prompt: `${basePrompt}\n\nSe necessário, não use markdown. Retorne somente JSON bruto.`,
			});

			rawOutput = extractJsonObjectFromText(fallbackResult.text);
		}

		const parsedRawOutput = RawInsightsResponseSchema.parse(rawOutput);
		const normalizedOutput = InsightsResponseSchema.parse(
			normalizeInsightsResponse(parsedRawOutput),
		);

		return {
			success: true,
			data: normalizedOutput,
		};
	} catch (error) {
		console.error("Error generating insights:", error);
		return {
			success: false,
			error: "Erro ao gerar insights. Tente novamente.",
		};
	}
}
