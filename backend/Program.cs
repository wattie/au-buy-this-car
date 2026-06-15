using ShouldIBuyThisCar.Api.Models;
using ShouldIBuyThisCar.Api.Services;

var builder = WebApplication.CreateBuilder(args);

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

builder.Services.AddSingleton<CarAnalysisService>();
// TODO: Register an OpenAI-backed analysis service here once real model inference is added.

var app = builder.Build();

app.UseCors();

app.MapGet("/", () => Results.Ok(new { name = "Should I Buy This Car API", status = "ok" }));

app.MapPost("/api/analyse-car", (AnalyseCarRequest request, CarAnalysisService service) =>
{
    if (string.IsNullOrWhiteSpace(request.ListingInput))
    {
        return Results.BadRequest("Listing input is required.");
    }

    if (request.Budget <= 0)
    {
        return Results.BadRequest("Budget must be greater than zero.");
    }

    var response = service.Analyse(request);
    return Results.Ok(response);
});

app.Run();
