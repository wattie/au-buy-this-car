import type { AnalyseCarRequest, AnalyseCarResponse } from "@/src/types";

export async function analyseCar(
  payload: AnalyseCarRequest
): Promise<AnalyseCarResponse> {
  const response = await fetch("/api/analyse-car", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const message =
      (await response.text()) || "The analysis service could not be reached.";
    throw new Error(message);
  }

  return response.json() as Promise<AnalyseCarResponse>;
}
