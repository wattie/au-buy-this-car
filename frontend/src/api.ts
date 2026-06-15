import type { AnalyseCarRequest, AnalyseCarResponse } from "./types";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5052";

export async function analyseCar(
  payload: AnalyseCarRequest
): Promise<AnalyseCarResponse> {
  const response = await fetch(`${API_BASE_URL}/api/analyse-car`, {
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

