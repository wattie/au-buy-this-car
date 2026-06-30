import { analyseCarRequestSchema, analyseCarResponseSchema, AnalyseCarRequestInput, AnalyseCarResponseOutput } from "@/src/server/analysis-schema";
import { analyseWithMockService } from "@/src/server/mock-analysis";

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "buyScore",
    "verdict",
    "estimatedFairPrice",
    "estimatedListingPrice",
    "pricingSummary",
    "confidenceLevel",
    "confidenceSummary",
    "runningCostEstimate",
    "summary",
    "keyRisks",
    "negotiationTips",
    "questionsToAskSeller",
    "highlights",
    "scoreBreakdown",
    "sellerRedFlags",
    "negotiationScript"
  ],
  properties: {
    buyScore: { type: "number" },
    verdict: { type: "string", enum: ["Buy", "Maybe", "Avoid"] },
    estimatedFairPrice: { type: "number" },
    estimatedListingPrice: { type: "number" },
    pricingSummary: { type: "string" },
    confidenceLevel: { type: "string", enum: ["High", "Medium", "Low"] },
    confidenceSummary: { type: "string" },
    runningCostEstimate: { type: "string" },
    summary: { type: "string" },
    keyRisks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "severity"],
        properties: {
          label: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high"] }
        }
      }
    },
    negotiationTips: { type: "array", items: { type: "string" } },
    questionsToAskSeller: { type: "array", items: { type: "string" } },
    highlights: { type: "array", items: { type: "string" } },
    scoreBreakdown: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "score", "summary"],
        properties: {
          category: {
            type: "string",
            enum: ["Price", "Reliability", "Running costs", "Resale", "Suitability"]
          },
          score: { type: "number" },
          summary: { type: "string" }
        }
      }
    },
    sellerRedFlags: { type: "array", items: { type: "string" } },
    negotiationScript: { type: "string" }
  }
} as const;

export async function analyseWithOpenAi(
  request: AnalyseCarRequestInput
): Promise<AnalyseCarResponseOutput> {
  const parsedRequest = analyseCarRequestSchema.parse(request);
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.OpenAI__ApiKey;

  if (!apiKey) {
    return analyseWithMockService(parsedRequest);
  }

  const baseUrl = process.env.OPENAI_BASE_URL ?? process.env.OpenAI__BaseUrl ?? "https://api.openai.com/v1/";
  const model = process.env.OPENAI_MODEL ?? process.env.OpenAI__Model ?? "gpt-4.1-mini";

  try {
    const response = await fetch(new URL("responses", baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input: buildPrompt(parsedRequest),
        text: {
          format: {
            type: "json_schema",
            strict: true,
            name: "car_analysis_response",
            schema: responseSchema
          }
        }
      })
    });

    if (!response.ok) {
      return analyseWithMockService(parsedRequest);
    }

    const responseBody = (await response.json()) as OpenAiResponsesPayload;
    const outputText = responseBody.output_text ?? tryGetOutputMessageText(responseBody.output);

    if (!outputText) {
      return analyseWithMockService(parsedRequest);
    }

    const parsedOutput = JSON.parse(outputText) as unknown;
    const validated = analyseCarResponseSchema.safeParse(parsedOutput);

    return validated.success
      ? validated.data
      : await analyseWithMockService(parsedRequest);
  } catch {
    return analyseWithMockService(parsedRequest);
  }
}

function buildPrompt(request: AnalyseCarRequestInput) {
  const location = request.location?.trim() || "Not provided";

  return `You are a used-car buying assistant for an Australian demo app called "Should I Buy This Car?".

Analyse the listing details and return only JSON that matches the required schema.
Be decisive, practical, and consumer-friendly.
Assume the user wants a recommendation for whether this used car is worth buying.

User context:
- Budget: ${request.budget}
- Intended use: ${request.intendedUse}
- Location: ${location}

Listing content:
${request.listingInput.trim()}

Instructions:
- Return a buyScore from 0 to 100.
- Choose a verdict of Buy, Maybe, or Avoid.
- Estimate fair price and listing price as numbers only.
- Include concise Australian-English guidance.
- Make the scoreBreakdown exactly five items in this order:
  1. Price
  2. Reliability
  3. Running costs
  4. Resale
  5. Suitability
- Each key risk must include a severity of low, medium, or high.
- The negotiationScript should sound like a natural sentence the buyer could actually say to the seller.
- Do not wrap the JSON in markdown or prose.`;
}

function tryGetOutputMessageText(output: OpenAiOutputItem[] | undefined) {
  if (!output) {
    return null;
  }

  for (const outputItem of output) {
    if (outputItem.type !== "message") {
      continue;
    }

    for (const contentItem of outputItem.content ?? []) {
      if (contentItem.type === "output_text" && typeof contentItem.text === "string") {
        return contentItem.text;
      }
    }
  }

  return null;
}

interface OpenAiResponsesPayload {
  output_text?: string;
  output?: OpenAiOutputItem[];
}

interface OpenAiOutputItem {
  type?: string;
  content?: Array<{
    type?: string;
    text?: string;
  }>;
}
