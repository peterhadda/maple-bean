// Ambient routine for a café regular: arrive → queue at the counter → order → wait for the
// drink → find a free seat → sit and sip → stand → leave → come back later.
// Port of updateResident() in cafe-life.js; movement and seating live on AMBCafeCharacter.
#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "MBResidentComponent.generated.h"

class AMBCafeCharacter;

UENUM(BlueprintType)
enum class EMBResidentPhase : uint8
{
	Idle, ToCounter, Ordering, ToSeat, Seated, Leaving, Away
};

UCLASS(ClassGroup = (MapleBean), meta = (BlueprintSpawnableComponent))
class MAPLEBEANUE_API UMBResidentComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UMBResidentComponent();

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Maple Bean") float StartDelay = 2.f;
	/** Seconds seated per visit (the web build gives Claire 13 s longer). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Maple Bean") float SeatedSeconds = 22.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Maple Bean") float AwaySeconds = 12.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Maple Bean") int32 SeatOffset = 0;
	/** Prefer study desks (Noah). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Maple Bean") bool bPrefersStudy = false;
	/** Wait at the counter until a barista calls Serve(). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Maple Bean") bool bWaitForService = false;
	/** Paused while talking to the player or running a scripted scene. */
	UPROPERTY(BlueprintReadWrite, Category = "Maple Bean") bool bPaused = false;

	UPROPERTY(BlueprintReadOnly, Category = "Maple Bean") EMBResidentPhase Phase = EMBResidentPhase::Idle;
	UPROPERTY(BlueprintReadOnly, Category = "Maple Bean") int32 Visits = 0;

	UFUNCTION(BlueprintCallable, Category = "Maple Bean") void Serve() { bServed = true; }

	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

protected:
	virtual void BeginPlay() override;

private:
	UFUNCTION() void HandleArrived(bool bOk);
	UFUNCTION() void HandleSeated(bool bOk);
	UFUNCTION() void HandleStood(bool bOk);
	void GoToCounter();
	void PickSeat();
	AMBCafeCharacter* Person() const;

	float Timer = 0.f;
	float Stalled = 0.f;
	bool bServed = false;
};
