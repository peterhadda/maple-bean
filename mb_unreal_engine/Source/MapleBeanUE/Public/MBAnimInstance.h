// Native animation for every café person: speed-driven idle/walk blend (retargeted UE5 Manny clips)
// plus a procedural sit pose driven by AMBCafeCharacter::SitAlpha. The pose is built in a custom proxy,
// so no Anim Graph is needed; ABP_MapleBean is a Blueprint child of this class that only sets the clips.
#pragma once

#include "CoreMinimal.h"
#include "Animation/AnimInstance.h"
#include "Animation/AnimInstanceProxy.h"
#include "MBAnimInstance.generated.h"

class UAnimSequenceBase;
class UMBAnimInstance;

struct FMBAnimProxy : public FAnimInstanceProxy
{
	FMBAnimProxy() = default;
	explicit FMBAnimProxy(UAnimInstance* Instance) : FAnimInstanceProxy(Instance) {}

	virtual void PreUpdate(UAnimInstance* Instance, float DeltaSeconds) override;
	virtual void Update(float DeltaSeconds) override;
	virtual bool Evaluate(FPoseContext& Output) override;

private:
	void ApplySit(FPoseContext& Output) const;

	TObjectPtr<UAnimSequenceBase> Idle, Walk;
	float Speed = 0.f, WalkClipSpeed = 150.f, SitAlpha = 0.f, SeatHeight = 45.f, WalkWeight = 0.f;
	double IdleTime = 0.0, WalkTime = 0.0;
};

UCLASS(Blueprintable, Transient)
class MAPLEBEANUE_API UMBAnimInstance : public UAnimInstance
{
	GENERATED_BODY()

public:
	/** Retargeted clips; ApplyLook fills these from /Game/MapleBean/Animations/<Name>/ when unset. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Maple Bean") TObjectPtr<UAnimSequenceBase> IdleClip;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Maple Bean") TObjectPtr<UAnimSequenceBase> WalkClip;
	/** Ground speed (cm/s) the walk clip was authored at; playback rate scales around it. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Maple Bean") float WalkClipSpeed = 150.f;

	UPROPERTY(BlueprintReadOnly, Category = "Maple Bean") float Speed = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "Maple Bean") float SitAlpha = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "Maple Bean") float SeatHeight = 45.f;

	/** Loads Idle/Walk for a person id (e.g. "maya"); false if the retargeted clips are missing. */
	bool LoadClipsFor(const FString& PersonId);

protected:
	virtual void NativeUpdateAnimation(float DeltaSeconds) override;
	virtual FAnimInstanceProxy* CreateAnimInstanceProxy() override { return new FMBAnimProxy(this); }
	virtual void DestroyAnimInstanceProxy(FAnimInstanceProxy* Proxy) override { delete Proxy; }

	FVector LastLocation = FVector::ZeroVector;
	bool bHasLastLocation = false;

	friend struct FMBAnimProxy;
};
