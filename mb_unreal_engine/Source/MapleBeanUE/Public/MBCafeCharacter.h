// A person in the café: the player or a regular. Walks on the NavMesh and performs the
// seat choreography from cafe-life.js / activities.js (step beside the chair, lower, stand, sidle out).
// Animation Blueprints read the public state below; nothing here plays animation directly.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "MBLayoutSubsystem.h"
#include "MBCafeCharacter.generated.h"

UENUM(BlueprintType)
enum class EMBPosture : uint8
{
	Stand, Sidling, SittingDown, Seated, StandingUp, SidlingOut
};

UENUM(BlueprintType)
enum class EMBActivity : uint8
{
	None, Drink, Study, Read, Game, Talk, Order
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FMBArrived, bool, bSuccess);

UCLASS()
class MAPLEBEANUE_API AMBCafeCharacter : public ACharacter
{
	GENERATED_BODY()

public:
	AMBCafeCharacter();

	// ---- identity
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Maple Bean") FName PersonId = TEXT("maya");
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Maple Bean") FName FavouriteDrink = TEXT("Latte");
	/** Loaded from /Game/MapleBean/Characters/<Name>/Current/<name> when no mesh is assigned. */
	UFUNCTION(BlueprintCallable, Category = "Maple Bean") void ApplyLook();

	// ---- state for the Animation Blueprint
	UPROPERTY(BlueprintReadOnly, Category = "Maple Bean|Anim") EMBPosture Posture = EMBPosture::Stand;
	UPROPERTY(BlueprintReadOnly, Category = "Maple Bean|Anim") EMBActivity Activity = EMBActivity::None;
	/** 0 standing … 1 fully seated; blends the sit pose (smoothstep, like the web build). */
	UPROPERTY(BlueprintReadOnly, Category = "Maple Bean|Anim") float SitAlpha = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "Maple Bean|Anim") bool bHasCup = false;
	UPROPERTY(BlueprintReadOnly, Category = "Maple Bean|Anim") bool bSipping = false;
	UPROPERTY(BlueprintReadOnly, Category = "Maple Bean|Anim") bool bHeadphones = false;
	UPROPERTY(BlueprintReadOnly, Category = "Maple Bean|Anim") bool bTalking = false;
	UPROPERTY(BlueprintReadOnly, Category = "Maple Bean|Anim") float SeatHeight = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "Maple Bean") FMBStation Seat;
	UPROPERTY(BlueprintReadOnly, Category = "Maple Bean") bool bHasSeat = false;

	UPROPERTY(BlueprintAssignable, Category = "Maple Bean") FMBArrived OnArrived;
	UPROPERTY(BlueprintAssignable, Category = "Maple Bean") FMBArrived OnSeated;
	UPROPERTY(BlueprintAssignable, Category = "Maple Bean") FMBArrived OnStood;

	/** Path-find and walk (NavMesh); fires OnArrived. */
	UFUNCTION(BlueprintCallable, Category = "Maple Bean") bool WalkTo(const FVector& Target);
	/** Walk to the seat's approach, step beside it, sit. Reserves the seat; fires OnSeated. */
	UFUNCTION(BlueprintCallable, Category = "Maple Bean") bool SitOn(FName SeatId);
	/** Stand up and sidle back to the approach point; fires OnStood. */
	UFUNCTION(BlueprintCallable, Category = "Maple Bean") bool StandUp();
	UFUNCTION(BlueprintCallable, Category = "Maple Bean") void StopMoving();
	UFUNCTION(BlueprintPure, Category = "Maple Bean") bool IsBusy() const { return Posture != EMBPosture::Stand && Posture != EMBPosture::Seated; }
	UFUNCTION(BlueprintPure, Category = "Maple Bean") bool IsWalking() const;

	static constexpr float SitSeconds = 1.0f;
	static constexpr float StandSeconds = .85f;
	static constexpr float SidleSpeed = 80.f; // cm/s, the web build's .8 m/s

	virtual void Tick(float DeltaSeconds) override;

protected:
	virtual void BeginPlay() override;
	void OnMoveFinished(bool bSuccess);
	void TickSeatMotion(float Dt);
	void TickSidle(float Dt);
	UMBLayoutSubsystem* Layout() const;

private:
	enum class EPending : uint8 { None, WalkOnly, ToSeat };
	EPending Pending = EPending::None;
	FVector Entry = FVector::ZeroVector;
	FVector SeatMotionFrom = FVector::ZeroVector, SeatMotionTo = FVector::ZeroVector;
	float SeatMotionT = 0.f;
	float SidleBlocked = 0.f;
	float StandingZ = 0.f;
	float LastPathRequest = -1.f;
	bool bWasFollowingPath = false;
};
