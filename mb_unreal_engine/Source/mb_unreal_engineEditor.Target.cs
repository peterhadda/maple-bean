using UnrealBuildTool;

public class mb_unreal_engineEditorTarget : TargetRules
{
	public mb_unreal_engineEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.V5;
		IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_6;
		ExtraModuleNames.Add("MapleBeanUE");
	}
}
