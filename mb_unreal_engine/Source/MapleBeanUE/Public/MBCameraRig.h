// One camera that eases between the café's framing modes, like the web build's
// overview → walk → room cameras. The player controller sets the mode; the rig blends.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "MBCameraRig.generated.h"

class UCameraComponent;

UENUM(BlueprintType)
enum class EMBCameraMode : uint8
{
	Overview,    // isometric-style view of the whole café
	Follow,      // third person behind the player
	Room,        // framing the room the player is in
	Interaction, // close-up on the player while seated / using something
	Cinematic    // driven by Sequencer; the rig stops moving
};

UCLASS()
class MAPLEBEANUE_API AMBCameraRig : public AActor
{
	GENERATED_BODY()

public:
	AMBCameraRig();

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TObjectPtr<UCameraComponent> Camera;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Maple Bean") TObjectPtr<AActor> Target;
	UPROPERTY(BlueprintReadOnly, Category = "Maple Bean") EMBCameraMode Mode = EMBCameraMode::Overview;

	UPROPERTY(EditAnywhere, Category = "Maple Bean|Overview") FVector OverviewFocus = FVector(0.f, -200.f, 0.f);
	UPROPERTY(EditAnywhere, Category = "Maple Bean|Overview") FRotator OverviewRotation = FRotator(-42.f, 40.f, 0.f);
	UPROPERTY(EditAnywhere, Category = "Maple Bean|Overview") float OverviewDistance = 3000.f;
	UPROPERTY(EditAnywhere, Category = "Maple Bean|Follow") float FollowDistance = 420.f;
	UPROPERTY(EditAnywhere, Category = "Maple Bean|Follow") float FollowPitch = -18.f;
	UPROPERTY(EditAnywhere, Category = "Maple Bean") float BlendSpeed = 3.f;

	UFUNCTION(BlueprintCallable, Category = "Maple Bean") void SetMode(EMBCameraMode NewMode);
	UFUNCTION(BlueprintCallable, Category = "Maple Bean") void SetRoomFraming(const FBox& RoomBounds);
	/** Drag-to-look in Follow mode (degrees). */
	UFUNCTION(BlueprintCallable, Category = "Maple Bean") void AddOrbit(float DeltaYaw, float DeltaPitch);
	UFUNCTION(BlueprintPure, Category = "Maple Bean") float GetViewYaw() const { return GetActorRotation().Yaw; }

	virtual void Tick(float DeltaSeconds) override;

private:
	void Desired(FVector& OutLoc, FRotator& OutRot) const;
	FBox Room = FBox(ForceInit);
	float OrbitYaw = 0.f;
	float OrbitPitch = 0.f;
	bool bSnap = true;
};
