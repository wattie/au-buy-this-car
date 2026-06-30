import type { AnalyseCarRequestInput } from "@/src/server/analysis-schema";

const userAgent =
  "Mozilla/5.0 (compatible; ShouldIBuyThisCarBot/1.0; +https://example.com/demo)";

export async function enrichListingInput(
  request: AnalyseCarRequestInput
): Promise<AnalyseCarRequestInput> {
  const url = extractFirstUrl(request.listingInput);
  if (!url) {
    return request;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const response = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
        Accept: "text/html,application/xhtml+xml"
      },
      signal: controller.signal,
      redirect: "follow"
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return request;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return request;
    }

    const html = await response.text();
    const extracted = extractListingSignals(html, url);

    if (!extracted) {
      return request;
    }

    return {
      ...request,
      listingInput: buildEnrichedListingInput(request.listingInput, extracted)
    };
  } catch {
    return request;
  }
}

function extractFirstUrl(input: string) {
  const match = input.match(/https?:\/\/[^\s]+/i);
  return match?.[0] ?? null;
}

function buildEnrichedListingInput(originalInput: string, extracted: ExtractedListing) {
  const parts = [
    originalInput.trim(),
    "Fetched listing details:",
    `Source URL: ${extracted.url}`
  ];

  if (extracted.title) {
    parts.push(`Title: ${extracted.title}`);
  }

  if (extracted.price) {
    parts.push(`Price: ${extracted.price}`);
  }

  if (extracted.description) {
    parts.push(`Description: ${extracted.description}`);
  }

  if (extracted.visibleText) {
    parts.push("Visible listing text:");
    parts.push(extracted.visibleText);
  }

  return parts.join("\n\n");
}

function extractListingSignals(html: string, url: string): ExtractedListing | null {
  const title =
    decodeHtml(getMetaContent(html, "property", "og:title")) ??
    decodeHtml(getMetaContent(html, "name", "twitter:title")) ??
    decodeHtml(getTagContent(html, "title"));

  const description =
    decodeHtml(getMetaContent(html, "property", "og:description")) ??
    decodeHtml(getMetaContent(html, "name", "description")) ??
    decodeHtml(getMetaContent(html, "name", "twitter:description"));

  const jsonLdPrice = extractJsonLdPrice(html);
  const metaPrice =
    getMetaContent(html, "property", "product:price:amount") ??
    getMetaContent(html, "property", "og:price:amount") ??
    getMetaContent(html, "name", "price");
  const regexPrice = extractPriceFromText(stripHtml(html));
  const price = normalizePrice(jsonLdPrice ?? metaPrice ?? regexPrice);

  const visibleText = truncate(stripHtml(html), 3500);
  if (!title && !description && !price && !visibleText) {
    return null;
  }

  return {
    url,
    title: title ? truncate(title, 180) : null,
    description: description ? truncate(description, 500) : null,
    price,
    visibleText: visibleText ? truncate(visibleText, 3500) : null
  };
}

function getMetaContent(html: string, attribute: "name" | "property", value: string) {
  const pattern = new RegExp(
    `<meta[^>]+${attribute}=["']${escapeForRegex(value)}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const reversePattern = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+${attribute}=["']${escapeForRegex(value)}["'][^>]*>`,
    "i"
  );

  return pattern.exec(html)?.[1] ?? reversePattern.exec(html)?.[1] ?? null;
}

function getTagContent(html: string, tagName: string) {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i");
  return pattern.exec(html)?.[1]?.trim() ?? null;
}

function extractJsonLdPrice(html: string) {
  const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? [];

  for (const script of scripts) {
    const jsonText = script
      .replace(/<script[^>]*>/i, "")
      .replace(/<\/script>/i, "")
      .trim();

    try {
      const parsed = JSON.parse(jsonText) as unknown;
      const price = findPriceInJsonLd(parsed);
      if (price) {
        return price;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function findPriceInJsonLd(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findPriceInJsonLd(item);
      if (found) {
        return found;
      }
    }

    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.price === "string" || typeof record.price === "number") {
    return String(record.price);
  }

  if (record.offers) {
    const found = findPriceInJsonLd(record.offers);
    if (found) {
      return found;
    }
  }

  for (const nestedValue of Object.values(record)) {
    const found = findPriceInJsonLd(nestedValue);
    if (found) {
      return found;
    }
  }

  return null;
}

function stripHtml(html: string) {
  return (
    decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
    ) ?? ""
  );
}

function extractPriceFromText(text: string) {
  const match = text.match(/(?:\$|aud\s?)(\d{1,3}(?:,\d{3})+|\d{4,6})/i);
  return match?.[0] ?? null;
}

function normalizePrice(price: string | null) {
  if (!price) {
    return null;
  }

  const trimmed = price.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return `AUD ${Number(trimmed).toLocaleString("en-AU", {
      maximumFractionDigits: 0
    })}`;
  }

  return trimmed;
}

function decodeHtml(value: string | null) {
  if (!value) {
    return null;
  }

  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeForRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function truncate(value: string, maxLength: number) {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}...`;
}

interface ExtractedListing {
  url: string;
  title: string | null;
  description: string | null;
  price: string | null;
  visibleText: string | null;
}
