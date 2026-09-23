#include "MBGameMode.h"

#include "MBCafeCharacter.h"
#include "MBLayoutSubsystem.h"
#include "MBPlayerController.h"
#include "MBResidentComponent.h"
#include "Engine/World.h"

AMBGameMode::AMBGameMode()
{
	DefaultPawnClass = AMBCafeCharacter::StaticClass();
	PlayerControllerClass = AMBPlayerController::StaticClass();
	// Maya is the player (PersonId default); Claire lingers longer, as in cafe-life.js.
	FMBRegular Claire;
	Claire.PersonId = TEXT("claire");
	Claire.StartDelay = 3.f;
	Claire.SeatedSeconds = 22.f + 13.f; // cafe-life.js: 22 + (claire ? 13 : 0)
	Claire.AwaySeconds = 12.f + 9.f;    // 12 + (claire ? 9 : 0)
	Claire.SeatOffset = 3;
	Regulars.Add(Claire);
}

APawn* AMBGameMode::SpawnDefaultPawnAtTransform_Implementation(AController* NewPlayer, const FTransform& SpawnTransform)
{
	// The player's pawn must not grab an AI controller first (AMBCafeCharacter auto-possesses AI for the regulars).
	FActorSpawnParameters P;
	P.Instigator = GetInstigator();
	P.ObjectFlags |= RF_Transient;
	P.bDeferConstruction = true;
	UClass* PawnClass = GetDefaultPawnClassForController(NewPlayer);
	APawn* Pawn = GetWorld()->SpawnActor<APawn>(PawnClass, SpawnTransform, P);
	if (Pawn)
	{
		Pawn->AutoPossessAI = EAutoPossessAI::Disabled;
		Pawn->FinishSpawning(SpawnTransform);
	}
	return Pawn;
}

AActor* AMBGameMode::ChoosePlayerStart_Implementation(AController* Player)
{
	// A placed PlayerStart wins; otherwise the player walks in through the front door.
	return Super::ChoosePlayerStart_Implementation(Player);
}

void AMBGameMode::BeginPlay()
{
	Super::BeginPlay();
	UMBLayoutSubsystem* L = GetWorld()->GetSubsystem<UMBLayoutSubsystem>();
	int32 i = 0;
	for (const FMBRegular& R : Regulars)
	{
		const FVector At = L->EntranceSpawn() + FVector((i++ % 3 - 1) * 80.f, 0.f, 100.f);
		// Deferred, so PersonId is set before BeginPlay runs ApplyLook (otherwise every regular looks like Maya).
		AMBCafeCharacter* C = GetWorld()->SpawnActorDeferred<AMBCafeCharacter>(R.Class ? *R.Class : AMBCafeCharacter::StaticClass(),
			FTransform(At), nullptr, nullptr, ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn);
		if (!C) continue;
		C->PersonId = R.PersonId;
		UMBResidentComponent* Life = NewObject<UMBResidentComponent>(C, TEXT("Resident"));
		Life->StartDelay = R.StartDelay;
		Life->bPrefersStudy = R.bPrefersStudy;
		Life->SeatedSeconds = R.SeatedSeconds;
		Life->AwaySeconds = R.AwaySeconds;
		Life->SeatOffset = R.SeatOffset;
		C->AddInstanceComponent(Life);
		C->FinishSpawning(FTransform(At));
		Life->RegisterComponent();
	}
}
