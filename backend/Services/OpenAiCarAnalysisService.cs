using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using ShouldIBuyThisCar.Api.Configuration;
using ShouldIBuyThisCar.Api.Models;

namespace ShouldIBuyThisCar.Api.Services;

public sealed class OpenAiCarAnalysisService : ICarAnalysisService
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    private readonly HttpClient _httpClient;
    private readonly ILogger<OpenAiCarAnalysisService> _logger;
    private readonly MockCarAnalysisService _fallbackService;
    private readonly OpenAiOptions _options;

    public OpenAiCarAnalysisService(
        HttpClient httpClient,
        ILogger<OpenAiCarAnalysisService> logger,
        MockCarAnalysisService fallbackService,
        IConfiguration configuration)
    {
        _httpClient = httpClient;
        _logger = logger;
        _fallbackService = fallbackService;
        _options = configuration.GetSection(OpenAiOptions.SectionName).Get<OpenAiOptions>() ?? new OpenAiOptions();

        if (Uri.TryCreate(_options.BaseUrl, UriKind.Absolute, out var baseUri))
        {
            _httpClient.BaseAddress = baseUri;
        }
    }

    public async Task<AnalyseCarResponse> AnalyseAsync(AnalyseCarRequest request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            _logger.LogInformation("OpenAI API key is not configured. Falling back to mock car analysis.");
            return await _fallbackService.AnalyseAsync(request, cancellationToken);
        }

        try
        {
            using var httpRequest = BuildHttpRequest(request);
            using var response = await _httpClient.SendAsync(httpRequest, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogWarning(
                    "OpenAI analysis request failed with status code {StatusCode}. Falling back to mock analysis. Body: {Body}",
                    response.StatusCode,
                    errorBody);

                return await _fallbackService.AnalyseAsync(request, cancellationToken);
            }

            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
            var parsed = ParseAnalyseResponse(responseBody);

            return parsed ?? await _fallbackService.AnalyseAsync(request, cancellationToken);
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException or JsonException)
        {
            _logger.LogWarning(exception, "OpenAI analysis failed. Falling back to mock analysis.");
            return await _fallbackService.AnalyseAsync(request, cancellationToken);
        }
    }

    private HttpRequestMessage BuildHttpRequest(AnalyseCarRequest request)
    {
        var prompt = BuildPrompt(request);

        var payload = new
        {
            model = _options.Model,
            input = prompt,
            text = new
            {
                format = new
                {
                    type = "json_schema",
                    strict = true,
                    name = "car_analysis_response",
                    schema = BuildResponseSchema()
                }
            }
        };

        var requestMessage = new HttpRequestMessage(HttpMethod.Post, "responses");
        requestMessage.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);
        requestMessage.Content = new StringContent(
            JsonSerializer.Serialize(payload, SerializerOptions),
            Encoding.UTF8,
            "application/json");

        return requestMessage;
    }

    private AnalyseCarResponse? ParseAnalyseResponse(string responseBody)
    {
        using var document = JsonDocument.Parse(responseBody);
        var root = document.RootElement;

        if (!root.TryGetProperty("output_text", out var outputTextElement))
        {
            _logger.LogWarning("OpenAI response was missing output_text. Falling back to mock analysis.");
            return null;
        }

        var outputText = outputTextElement.GetString();
        if (string.IsNullOrWhiteSpace(outputText))
        {
            _logger.LogWarning("OpenAI response output_text was empty. Falling back to mock analysis.");
            return null;
        }

        try
        {
            var parsed = JsonSerializer.Deserialize<AnalyseCarResponse>(outputText, SerializerOptions);
            if (parsed is null || !IsValidAnalyseResponse(parsed))
            {
                _logger.LogWarning("OpenAI returned JSON that did not match the expected analysis response shape. Falling back to mock analysis.");
                return null;
            }

            return parsed;
        }
        catch (JsonException exception)
        {
            _logger.LogWarning(exception, "OpenAI returned invalid JSON for car analysis. Falling back to mock analysis.");
            return null;
        }
    }

    private static bool IsValidAnalyseResponse(AnalyseCarResponse response)
    {
        return response.BuyScore is >= 0 and <= 100
            && !string.IsNullOrWhiteSpace(response.Verdict)
            && !string.IsNullOrWhiteSpace(response.PricingSummary)
            && !string.IsNullOrWhiteSpace(response.ConfidenceLevel)
            && !string.IsNullOrWhiteSpace(response.ConfidenceSummary)
            && !string.IsNullOrWhiteSpace(response.RunningCostEstimate)
            && !string.IsNullOrWhiteSpace(response.Summary)
            && response.KeyRisks.Count > 0
            && response.ScoreBreakdown.Count == 5
            && response.SellerRedFlags.Count > 0
            && !string.IsNullOrWhiteSpace(response.NegotiationScript);
    }

    private static string BuildPrompt(AnalyseCarRequest request)
    {
        var location = string.IsNullOrWhiteSpace(request.Location) ? "Not provided" : request.Location.Trim();

        return $"""
You are a used-car buying assistant for an Australian demo app called "Should I Buy This Car?".

Analyse the listing details and return only JSON that matches the required schema.
Be decisive, practical, and consumer-friendly.
Assume the user wants a recommendation for whether this used car is worth buying.

User context:
- Budget: {request.Budget}
- Intended use: {request.IntendedUse}
- Location: {location}

Listing content:
{request.ListingInput.Trim()}

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
- Do not wrap the JSON in markdown or prose.
""";
    }

    private static object BuildResponseSchema()
    {
        return new
        {
            type = "object",
            additionalProperties = false,
            required = new[]
            {
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
            },
            properties = new
            {
                buyScore = new { type = "integer", minimum = 0, maximum = 100 },
                verdict = new { type = "string", @enum = new[] { "Buy", "Maybe", "Avoid" } },
                estimatedFairPrice = new { type = "number" },
                estimatedListingPrice = new { type = "number" },
                pricingSummary = new { type = "string" },
                confidenceLevel = new { type = "string", @enum = new[] { "High", "Medium", "Low" } },
                confidenceSummary = new { type = "string" },
                runningCostEstimate = new { type = "string" },
                summary = new { type = "string" },
                keyRisks = new
                {
                    type = "array",
                    items = new
                    {
                        type = "object",
                        additionalProperties = false,
                        required = new[] { "label", "severity" },
                        properties = new
                        {
                            label = new { type = "string" },
                            severity = new { type = "string", @enum = new[] { "low", "medium", "high" } }
                        }
                    }
                },
                negotiationTips = new
                {
                    type = "array",
                    items = new { type = "string" }
                },
                questionsToAskSeller = new
                {
                    type = "array",
                    items = new { type = "string" }
                },
                highlights = new
                {
                    type = "array",
                    items = new { type = "string" }
                },
                scoreBreakdown = new
                {
                    type = "array",
                    minItems = 5,
                    maxItems = 5,
                    items = new
                    {
                        type = "object",
                        additionalProperties = false,
                        required = new[] { "category", "score", "summary" },
                        properties = new
                        {
                            category = new { type = "string" },
                            score = new { type = "integer", minimum = 0, maximum = 100 },
                            summary = new { type = "string" }
                        }
                    }
                },
                sellerRedFlags = new
                {
                    type = "array",
                    items = new { type = "string" }
                },
                negotiationScript = new { type = "string" }
            }
        };
    }
}

