namespace ShouldIBuyThisCar.Api.Configuration;

public sealed class CarAnalysisOptions
{
    public const string SectionName = "CarAnalysis";

    public string Provider { get; set; } = "Mock";
}

