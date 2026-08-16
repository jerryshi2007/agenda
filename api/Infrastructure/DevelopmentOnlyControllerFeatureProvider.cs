using System.Reflection;
using Microsoft.AspNetCore.Mvc.ApplicationParts;
using Microsoft.AspNetCore.Mvc.Controllers;

namespace Agenda.Api.Infrastructure;

/// <summary>
/// 从控制器发现结果中移除指定类型，使测试专用端点仅在目标环境注册。
/// </summary>
public class DevelopmentOnlyControllerFeatureProvider : IApplicationFeatureProvider<ControllerFeature>
{
    private readonly Type[] _controllerTypes;

    public DevelopmentOnlyControllerFeatureProvider(params Type[] controllerTypes)
    {
        _controllerTypes = controllerTypes;
    }

    public void PopulateFeature(IEnumerable<ApplicationPart> parts, ControllerFeature feature)
    {
        foreach (var controllerType in _controllerTypes)
        {
            feature.Controllers.Remove(controllerType.GetTypeInfo());
        }
    }
}
