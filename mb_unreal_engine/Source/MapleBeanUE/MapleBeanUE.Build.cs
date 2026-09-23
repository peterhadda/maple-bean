using UnrealBuildTool;

public class MapleBeanUE : ModuleRules
{
	public MapleBeanUE(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		PublicDependencyModuleNames.AddRange(new[] {
			"Core", "CoreUObject", "Engine", "InputCore", "EnhancedInput",
			"AIModule", "NavigationSystem", "Json", "JsonUtilities"
		});
		// Automation tests (Private/Tests) drive Play-In-Editor sessions.
		if (Target.bBuildEditor)
		{
			PrivateDependencyModuleNames.AddRange(new[] { "UnrealEd" });
		}
	}
}
