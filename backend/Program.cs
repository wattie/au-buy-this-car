using ShouldIBuyThisCar.Api.Configuration;
using ShouldIBuyThisCar.Api.Models;
using ShouldIBuyThisCar.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<CarAnalysisOptions>(
    builder.Configuration.GetSection(CarAnalysisOptions.SectionName));
builder.Services.Configure<OpenAiOptions>(
    builder.Configuration.GetSection(OpenAiOptions.SectionName));

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy
            .WithOrigins("http://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddSingleton<MockCarAnalysisService>();
builder.Services.AddHttpClient<OpenAiCarAnalysisService>();
builder.Services.AddSingleton<ICarAnalysisService>(serviceProvider =>
{
    var configuration = serviceProvider.GetRequiredService<IConfiguration>();
    var analysisOptions = configuration.GetSection(CarAnalysisOptions.SectionName).Get<CarAnalysisOptions>() ?? new CarAnalysisOptions();
    var openAiOptions = configuration.GetSection(OpenAiOptions.SectionName).Get<OpenAiOptions>() ?? new OpenAiOptions();
    var logger = serviceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("CarAnalysisServiceRegistration");

    var useOpenAi =
        string.Equals(analysisOptions.Provider, "OpenAI", StringComparison.OrdinalIgnoreCase)
        && !string.IsNullOrWhiteSpace(openAiOptions.ApiKey);

    if (useOpenAi)
    {
        logger.LogInformation("Using OpenAiCarAnalysisService for car analysis.");
        return serviceProvider.GetRequiredService<OpenAiCarAnalysisService>();
    }

    if (string.Equals(analysisOptions.Provider, "OpenAI", StringComparison.OrdinalIgnoreCase))
    {
        logger.LogInformation("OpenAI provider requested but no API key is configured. Falling back to MockCarAnalysisService.");
    }

    return serviceProvider.GetRequiredService<MockCarAnalysisService>();
});

var app = builder.Build();

app.UseCors();

app.MapGet("/", () => Results.Ok(new { name = "Should I Buy This Car API", status = "ok" }));

app.MapPost("/api/analyse-car", async (AnalyseCarRequest request, ICarAnalysisService service, CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.ListingInput))
    {
        return Results.BadRequest("Listing input is required.");
    }

    if (request.Budget <= 0)
    {
        return Results.BadRequest("Budget must be greater than zero.");
    }

    var response = await service.AnalyseAsync(request, cancellationToken);
    return Results.Ok(response);
});

app.Run();
