namespace ShouldIBuyThisCar.Api.Models;

public sealed record AnalyseCarRequest(
    string ListingInput,
    decimal Budget,
    string IntendedUse,
    string? Location
);

