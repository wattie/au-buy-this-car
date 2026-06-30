import { NextResponse } from "next/server";
import { analyseCarRequestSchema, analyseCarResponseSchema } from "@/src/server/analysis-schema";
import { enrichListingInput } from "@/src/server/listing-enrichment";
import { analyseWithOpenAi } from "@/src/server/openai-analysis";
import { analyseWithMockService } from "@/src/server/mock-analysis";

function createErrorResponse(message: string, status: number) {
  return new Response(message, { status });
}

function getProvider() {
  return (
    process.env.CAR_ANALYSIS_PROVIDER ??
    process.env.CarAnalysis__Provider ??
    "Mock"
  );
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return createErrorResponse("Request body must be valid JSON.", 400);
  }

  const parsedRequest = analyseCarRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return createErrorResponse("Listing input, budget, and intended use are required.", 400);
  }

  const input = parsedRequest.data;
  if (input.listingInput.trim().length === 0) {
    return createErrorResponse("Listing input is required.", 400);
  }

  if (input.budget <= 0) {
    return createErrorResponse("Budget must be greater than zero.", 400);
  }

  const enrichedInput = await enrichListingInput(input);
  const useOpenAi = getProvider().toLowerCase() === "openai";
  const analysis = useOpenAi
    ? await analyseWithOpenAi(enrichedInput)
    : await analyseWithMockService(enrichedInput);

  const parsedResponse = analyseCarResponseSchema.safeParse(analysis);
  if (!parsedResponse.success) {
    return createErrorResponse("The analysis service returned an invalid response.", 502);
  }

  return NextResponse.json(parsedResponse.data);
}
