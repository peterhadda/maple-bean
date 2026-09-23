using UnrealBuildTool;

public class mb_unreal_engineTarget : TargetRules
{
	public mb_unreal_engineTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.V5;
		IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_6;
		ExtraModuleNames.Add("MapleBeanUE");
	}
}
