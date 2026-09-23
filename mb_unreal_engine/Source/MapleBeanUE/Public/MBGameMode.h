// Spawns the player as Maya at the entrance and the regulars listed in Regulars.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "MBGameMode.generated.h"

class AMBCafeCharacter;

USTRUCT(BlueprintType)
struct FMBRegular
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FName PersonId;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) TSubclassOf<AMBCafeCharacter> Class;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) float StartDelay = 2.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) bool bPrefersStudy = false;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) float SeatedSeconds = 22.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) float AwaySeconds = 12.f;
	/** Added to the visit count when picking a seat (web: Claire +3). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 SeatOffset = 0;
};

UCLASS()
class MAPLEBEANUE_API AMBGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	AMBGameMode();

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Maple Bean") TArray<FMBRegular> Regulars;

protected:
	virtual void BeginPlay() override;
	virtual AActor* ChoosePlayerStart_Implementation(AController* Player) override;
	virtual APawn* SpawnDefaultPawnAtTransform_Implementation(AController* NewPlayer, const FTransform& SpawnTransform) override;
};
