using ShouldIBuyThisCar.Api.Models;

namespace ShouldIBuyThisCar.Api.Services;

public interface ICarAnalysisService
{
    Task<AnalyseCarResponse> AnalyseAsync(AnalyseCarRequest request, CancellationToken cancellationToken = default);
}

