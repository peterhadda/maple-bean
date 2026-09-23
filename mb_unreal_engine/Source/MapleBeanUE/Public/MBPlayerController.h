// Player input, matching the web build: WASD to walk, drag to look, click the floor to walk there,
// click near a seat to sit on it, E to stand, 1/2/3 to switch overview / follow / room cameras.
// Input actions are built in code so the project needs no input assets yet.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "InputActionValue.h"
#include "MBPlayerController.generated.h"

class AMBCafeCharacter;
class AMBCameraRig;
class UInputAction;
class UInputMappingContext;

UCLASS()
class MAPLEBEANUE_API AMBPlayerController : public APlayerController
{
	GENERATED_BODY()

public:
	AMBPlayerController();

	UPROPERTY(BlueprintReadOnly, Category = "Maple Bean") TObjectPtr<AMBCameraRig> Rig;

	/** Walk to a station and use it (sit/study/read). Called by the room menu UI too. */
	UFUNCTION(BlueprintCallable, Category = "Maple Bean") bool UseStation(FName StationId);

protected:
	virtual void BeginPlay() override;
	virtual void SetupInputComponent() override;
	virtual void PlayerTick(float DeltaTime) override;

private:
	AMBCafeCharacter* Me() const;
	void Move(const FInputActionValue& V);
	void Look(const FInputActionValue& V);
	void Click();
	void Stand();
	void CamOverview();
	void CamFollow();
	void CamRoom();
	UFUNCTION() void HandleSeated(bool bOk);
	UFUNCTION() void HandleStood(bool bOk);

	UPROPERTY() TObjectPtr<UInputMappingContext> Context;
	UPROPERTY() TObjectPtr<UInputAction> MoveAction;
	UPROPERTY() TObjectPtr<UInputAction> LookAction;
	UPROPERTY() TObjectPtr<UInputAction> ClickAction;
	UPROPERTY() TObjectPtr<UInputAction> StandAction;
	UPROPERTY() TObjectPtr<UInputAction> OverviewAction;
	UPROPERTY() TObjectPtr<UInputAction> FollowAction;
	UPROPERTY() TObjectPtr<UInputAction> RoomAction;
	FName LastZone;
};
