#include "MBCameraRig.h"

#include "Camera/CameraComponent.h"

AMBCameraRig::AMBCameraRig()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.TickGroup = TG_PostUpdateWork; // after characters have moved
	Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Camera"));
	RootComponent = Camera;
	Camera->SetFieldOfView(50.f);
}

void AMBCameraRig::SetMode(EMBCameraMode NewMode)
{
	if (NewMode == EMBCameraMode::Follow && Mode != EMBCameraMode::Follow && Target)
	{
		OrbitYaw = Target->GetActorRotation().Yaw;
		OrbitPitch = FollowPitch;
	}
	Mode = NewMode;
}

void AMBCameraRig::SetRoomFraming(const FBox& RoomBounds)
{
	Room = RoomBounds;
}

void AMBCameraRig::AddOrbit(float DeltaYaw, float DeltaPitch)
{
	OrbitYaw += DeltaYaw;
	OrbitPitch = FMath::Clamp(OrbitPitch + DeltaPitch, -60.f, -5.f);
}

void AMBCameraRig::Desired(FVector& OutLoc, FRotator& OutRot) const
{
	const FVector T = Target ? Target->GetActorLocation() : OverviewFocus;
	switch (Mode)
	{
	case EMBCameraMode::Follow:
	{
		OutRot = FRotator(OrbitPitch, OrbitYaw, 0.f);
		OutLoc = T + FVector(0.f, 0.f, 60.f) - OutRot.Vector() * FollowDistance;
		return;
	}
	case EMBCameraMode::Room:
	{
		const FBox B = Room.IsValid ? Room : FBox(T - FVector(500.f), T + FVector(500.f));
		const FVector C = B.GetCenter();
		const float Size = FMath::Max(B.GetExtent().X, B.GetExtent().Y);
		OutRot = FRotator(-50.f, OverviewRotation.Yaw, 0.f);
		OutLoc = FVector(C.X, C.Y, T.Z) - OutRot.Vector() * (Size * 2.4f + 300.f);
		return;
	}
	case EMBCameraMode::Interaction:
	{
		// Three-quarter close-up in front of the character, slightly above eye level.
		const FRotator Facing = Target ? Target->GetActorRotation() : FRotator::ZeroRotator;
		const FVector Eye = T + FVector(0.f, 0.f, 20.f);
		OutLoc = Eye + Facing.RotateVector(FVector(170.f, 90.f, 35.f));
		OutRot = (Eye - OutLoc).Rotation();
		return;
	}
	case EMBCameraMode::Cinematic:
		OutLoc = GetActorLocation();
		OutRot = GetActorRotation();
		return;
	default:
		OutRot = OverviewRotation;
		OutLoc = OverviewFocus - OverviewRotation.Vector() * OverviewDistance;
	}
}

void AMBCameraRig::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	FVector Loc;
	FRotator Rot;
	Desired(Loc, Rot);
	if (bSnap)
	{
		SetActorLocationAndRotation(Loc, Rot);
		bSnap = false;
		return;
	}
	const float A = 1.f - FMath::Exp(-BlendSpeed * DeltaSeconds); // frame-rate independent ease
	SetActorLocationAndRotation(FMath::Lerp(GetActorLocation(), Loc, A),
	                            FQuat::Slerp(FQuat(GetActorRotation()), FQuat(Rot), A).Rotator());
}
