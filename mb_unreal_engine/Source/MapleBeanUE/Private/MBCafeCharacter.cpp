#include "MBCafeCharacter.h"

#include "AIController.h"
#include "Blueprint/AIBlueprintHelperLibrary.h"
#include "Components/CapsuleComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Navigation/PathFollowingComponent.h"
#include "Engine/SkeletalMesh.h"
#include "MBAnimInstance.h"
#include "Engine/World.h"
#include "HAL/IConsoleManager.h"

static TAutoConsoleVariable<FString> CVarMBCharacterVariant(
	TEXT("mb.CharacterVariant"), TEXT("Current"),
	TEXT("Maple Bean character art set: Current or V2 (folder under /Game/MapleBean/Characters/<Name>/)."));

namespace
{
float Smoothstep(float T)
{
	T = FMath::Clamp(T, 0.f, 1.f);
	return T * T * (3.f - 2.f * T);
}
}

AMBCafeCharacter::AMBCafeCharacter()
{
	PrimaryActorTick.bCanEverTick = true;
	AutoPossessAI = EAutoPossessAI::PlacedInWorldOrSpawned;
	AIControllerClass = AAIController::StaticClass();
	GetCapsuleComponent()->InitCapsuleSize(24.f, 88.f); // .24 m walking radius from navigation.js
	UCharacterMovementComponent* Move = GetCharacterMovement();
	Move->MaxWalkSpeed = 175.f; // player 1.75 m/s; residents override to 95
	Move->bOrientRotationToMovement = true;
	Move->RotationRate = FRotator(0.f, 420.f, 0.f);
	Move->bCanWalkOffLedges = false; // the floor slabs end at the walls (navigation.js isWalkable)
	Move->bUseRVOAvoidance = true; // people step around each other like clearOfPeople()
	Move->AvoidanceConsiderationRadius = 50.f;
	bUseControllerRotationYaw = false;
}

void AMBCafeCharacter::BeginPlay()
{
	Super::BeginPlay();
	ApplyLook();
	StandingZ = GetActorLocation().Z;
}

void AMBCafeCharacter::ApplyLook()
{
	USkeletalMeshComponent* Body = GetMesh();
	if (!Body || Body->GetSkeletalMeshAsset()) return;
	const FString Id = PersonId.ToString().ToLower();
	FString Name = Id;
	Name[0] = FChar::ToUpper(Name[0]);
	// mb.CharacterVariant picks the art set: Current -> <Name>/Current/<id>/..., V2 -> <Name>/V2/<id>_v2/...
	auto MeshPath = [&](const FString& Variant)
	{
		const FString Suffix = Variant == TEXT("Current") ? FString() : TEXT("_") + Variant.ToLower();
		return FString::Printf(TEXT("/Game/MapleBean/Characters/%s/%s/%s%s/SkeletalMeshes/%s%s.%s%s"),
		                       *Name, *Variant, *Id, *Suffix, *Id, *Suffix, *Id, *Suffix);
	};
	const FString Variant = CVarMBCharacterVariant.GetValueOnGameThread();
	USkeletalMesh* Look = LoadObject<USkeletalMesh>(nullptr, *MeshPath(Variant), nullptr, LOAD_NoWarn | LOAD_Quiet);
	if (!Look && Variant != TEXT("Current")) Look = LoadObject<USkeletalMesh>(nullptr, *MeshPath(TEXT("Current")));
	if (Look)
	{
		Body->SetSkeletalMeshAsset(Look);
		// The glTF characters stand on their origin and face +Y; a Character's capsule is centred and faces +X.
		Body->SetRelativeLocationAndRotation(FVector(0.f, 0.f, -GetCapsuleComponent()->GetScaledCapsuleHalfHeight()),
		                                     FRotator(0.f, -90.f, 0.f));
	}
	if (!Body->GetSkeletalMeshAsset()) return;
	// ABP_MapleBean (a template Anim Blueprint child of UMBAnimInstance) if it exists, else the native class.
	UClass* AnimClass = LoadClass<UMBAnimInstance>(nullptr, TEXT("/Game/MapleBean/Animations/ABP_MapleBean.ABP_MapleBean_C"),
	                                               nullptr, LOAD_NoWarn | LOAD_Quiet);
	Body->SetAnimationMode(EAnimationMode::AnimationBlueprint);
	Body->SetAnimInstanceClass(AnimClass ? AnimClass : UMBAnimInstance::StaticClass());
	if (UMBAnimInstance* Anim = Cast<UMBAnimInstance>(Body->GetAnimInstance()); Anim && !Anim->LoadClipsFor(Id))
		UE_LOG(LogTemp, Warning, TEXT("[MapleBean] %s: retargeted Idle/Walk clips not found, using the bind pose"), *Id);
}

UMBLayoutSubsystem* AMBCafeCharacter::Layout() const
{
	return GetWorld() ? GetWorld()->GetSubsystem<UMBLayoutSubsystem>() : nullptr;
}

bool AMBCafeCharacter::IsWalking() const
{
	return Posture == EMBPosture::Stand && GetVelocity().SizeSquared2D() > 25.f;
}

bool AMBCafeCharacter::WalkTo(const FVector& Target)
{
	if (Posture != EMBPosture::Stand || !GetController()) return false;
	Pending = Pending == EPending::ToSeat ? EPending::ToSeat : EPending::WalkOnly;
	if (FVector::Dist2D(GetActorLocation(), Target) < 10.f)
	{
		OnMoveFinished(true);
		return true;
	}
	// Works for both the player's controller and the regulars' AI controllers.
	UAIBlueprintHelperLibrary::SimpleMoveToLocation(GetController(), Target);
	const UPathFollowingComponent* PF = GetController()->FindComponentByClass<UPathFollowingComponent>();
	if (!PF || PF->GetStatus() == EPathFollowingStatus::Idle)
	{
		Pending = EPending::None;
		return false;
	}
	bWasFollowingPath = true;
	return true;
}

void AMBCafeCharacter::StopMoving()
{
	if (AController* C = GetController()) C->StopMovement();
	if (Pending == EPending::ToSeat && bHasSeat && Posture == EMBPosture::Stand)
	{
		if (UMBLayoutSubsystem* L = Layout()) L->Release(Seat.Id, this);
		bHasSeat = false;
	}
	Pending = EPending::None;
	bWasFollowingPath = false;
}

bool AMBCafeCharacter::SitOn(FName SeatId)
{
	UMBLayoutSubsystem* L = Layout();
	if (!L) return false;
	if (Posture == EMBPosture::Seated && bHasSeat && Seat.Id == SeatId) return true;
	if (Posture != EMBPosture::Stand) return false;
	FMBStation Target;
	if (!L->FindStation(SeatId, Target) || !Target.IsSeat() || !L->Reserve(SeatId, this)) return false;
	if (bHasSeat && Seat.Id != SeatId) L->Release(Seat.Id, this);
	Seat = Target;
	bHasSeat = true;
	Pending = EPending::ToSeat;
	FVector Goal = Target.Approach;
	Goal.Z = GetActorLocation().Z;
	if (!WalkTo(Goal))
	{
		L->Release(SeatId, this);
		bHasSeat = false;
		Pending = EPending::None;
		return false;
	}
	return true;
}

bool AMBCafeCharacter::StandUp()
{
	if (Posture != EMBPosture::Seated) return false;
	Posture = EMBPosture::StandingUp;
	SeatMotionFrom = GetActorLocation();
	SeatMotionTo = FVector(Entry.X, Entry.Y, StandingZ);
	SeatMotionT = 0.f;
	bSipping = false;
	Activity = EMBActivity::None;
	return true;
}

void AMBCafeCharacter::OnMoveFinished(bool bSuccess)
{
	bWasFollowingPath = false;
	const EPending Was = Pending;
	Pending = EPending::None;
	if (Was == EPending::ToSeat && bSuccess && bHasSeat)
	{
		bool bFront = false;
		Entry = Layout()->EntryPoint(Seat, bFront);
		Entry.Z = GetActorLocation().Z;
		StandingZ = Entry.Z;
		Posture = EMBPosture::Sidling;
		SidleBlocked = 0.f;
		GetCharacterMovement()->DisableMovement();
		return;
	}
	if (Was == EPending::ToSeat && !bSuccess && bHasSeat)
	{
		Layout()->Release(Seat.Id, this);
		bHasSeat = false;
		OnSeated.Broadcast(false);
		return;
	}
	OnArrived.Broadcast(bSuccess);
}

void AMBCafeCharacter::TickSidle(float Dt)
{
	const bool bIn = Posture == EMBPosture::Sidling;
	FVector To = bIn ? Entry : FVector(Seat.Approach.X, Seat.Approach.Y, StandingZ);
	FVector Here = GetActorLocation();
	FVector Delta = To - Here;
	Delta.Z = 0.f;
	const float D = Delta.Size();
	if (D > 2.f)
	{
		const FVector Step = Delta / D * FMath::Min(D, SidleSpeed * Dt);
		// peopleStepClear(): only other people block the sidle; the chair's own furniture blocker must not.
		FHitResult Hit;
		const FCollisionShape Body = GetCapsuleComponent()->GetCollisionShape(-2.f);
		const bool bBlocked = GetWorld()->SweepSingleByObjectType(Hit, Here, Here + Step, FQuat::Identity,
			FCollisionObjectQueryParams(ECC_Pawn), Body, FCollisionQueryParams(SCENE_QUERY_STAT(MBSidle), false, this));
		if (bBlocked && Cast<APawn>(Hit.GetActor()) && FVector::DotProduct(Hit.ImpactPoint - Here, Step) > 0.f)
		{
			SidleBlocked += Dt;
			if (SidleBlocked >= 1.5f) // give up, like the web build
			{
				Layout()->Release(Seat.Id, this);
				bHasSeat = false;
				Posture = EMBPosture::Stand;
				GetCharacterMovement()->SetMovementMode(MOVE_Walking);
				(bIn ? OnSeated : OnStood).Broadcast(false);
			}
			return;
		}
		SidleBlocked = 0.f;
		SetActorLocation(Here + Step);
		SetActorRotation(FMath::RInterpTo(GetActorRotation(), Delta.Rotation(), Dt, 8.f));
		return;
	}
	if (bIn)
	{
		Posture = EMBPosture::SittingDown;
		SeatMotionFrom = GetActorLocation();
		SeatMotionTo = FVector(Seat.Location.X, Seat.Location.Y, StandingZ);
		SeatMotionT = 0.f;
	}
	else
	{
		Posture = EMBPosture::Stand;
		Layout()->Release(Seat.Id, this);
		bHasSeat = false;
		GetCharacterMovement()->SetMovementMode(MOVE_Walking);
		OnStood.Broadcast(true);
	}
}

void AMBCafeCharacter::TickSeatMotion(float Dt)
{
	const bool bSitting = Posture == EMBPosture::SittingDown;
	const float Duration = bSitting ? SitSeconds : StandSeconds;
	SeatMotionT = FMath::Min(Duration, SeatMotionT + Dt);
	const float K = Smoothstep(SeatMotionT / Duration);
	SetActorLocation(FMath::Lerp(SeatMotionFrom, SeatMotionTo, K));
	SetActorRotation(FMath::RInterpTo(GetActorRotation(), FRotator(0.f, Seat.Yaw, 0.f), Dt, 10.f));
	SitAlpha = bSitting ? K : 1.f - K;
	SeatHeight = Seat.SeatHeight * 100.f;
	if (SeatMotionT < Duration) return;
	if (bSitting)
	{
		Posture = EMBPosture::Seated;
		SitAlpha = 1.f;
		SetActorRotation(FRotator(0.f, Seat.Yaw, 0.f));
		Activity = Seat.Kind == EMBStationKind::Study ? EMBActivity::Study
		         : Seat.Kind == EMBStationKind::Read ? EMBActivity::Read
		         : bHasCup ? EMBActivity::Drink : EMBActivity::None;
		OnSeated.Broadcast(true);
	}
	else
	{
		SitAlpha = 0.f;
		Posture = EMBPosture::SidlingOut;
	}
}

void AMBCafeCharacter::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	switch (Posture)
	{
	case EMBPosture::Sidling:
	case EMBPosture::SidlingOut: TickSidle(DeltaSeconds); break;
	case EMBPosture::SittingDown:
	case EMBPosture::StandingUp: TickSeatMotion(DeltaSeconds); break;
	default: break;
	}
	if (bWasFollowingPath)
	{
		const UPathFollowingComponent* PF = GetController() ? GetController()->FindComponentByClass<UPathFollowingComponent>() : nullptr;
		if (PF && PF->GetStatus() == EPathFollowingStatus::Idle)
		{
			const FVector Goal = Pending == EPending::ToSeat ? Seat.Approach : GetActorLocation();
			OnMoveFinished(Pending != EPending::ToSeat || FVector::Dist2D(GetActorLocation(), Goal) < 40.f);
		}
	}
}
