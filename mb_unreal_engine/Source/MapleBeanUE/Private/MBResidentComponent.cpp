#include "MBResidentComponent.h"

#include "MBCafeCharacter.h"
#include "MBLayoutSubsystem.h"
#include "GameFramework/CharacterMovementComponent.h"

UMBResidentComponent::UMBResidentComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
}

AMBCafeCharacter* UMBResidentComponent::Person() const
{
	return Cast<AMBCafeCharacter>(GetOwner());
}

void UMBResidentComponent::BeginPlay()
{
	Super::BeginPlay();
	Timer = StartDelay;
	if (AMBCafeCharacter* P = Person())
	{
		P->GetCharacterMovement()->MaxWalkSpeed = 95.f; // regulars stroll at .95 m/s
		P->OnArrived.AddDynamic(this, &UMBResidentComponent::HandleArrived);
		P->OnSeated.AddDynamic(this, &UMBResidentComponent::HandleSeated);
		P->OnStood.AddDynamic(this, &UMBResidentComponent::HandleStood);
	}
}

void UMBResidentComponent::GoToCounter()
{
	AMBCafeCharacter* P = Person();
	UMBLayoutSubsystem* L = GetWorld()->GetSubsystem<UMBLayoutSubsystem>();
	const FMBStation* Coffee = L->GetStations().FindByPredicate([](const FMBStation& S) { return S.Kind == EMBStationKind::Coffee; });
	if (!Coffee) return;
	// Spread the queue sideways so regulars don't stand inside each other (web: ±0.7 m).
	const float Offset = ((Visits + P->PersonId.ToString().Len()) % 3 - 1) * 70.f;
	const FVector Right = FRotator(0.f, Coffee->Yaw, 0.f).RotateVector(FVector::RightVector);
	FVector Target = Coffee->Approach + Right * Offset;
	Target.Z = P->GetActorLocation().Z;
	if (P->WalkTo(Target)) Phase = EMBResidentPhase::ToCounter;
	else Timer = 3.f;
}

void UMBResidentComponent::PickSeat()
{
	AMBCafeCharacter* P = Person();
	UMBLayoutSubsystem* L = GetWorld()->GetSubsystem<UMBLayoutSubsystem>();
	TArray<const FMBStation*> Free = L->FreeSeats();
	if (Free.IsEmpty())
	{
		Timer = 4.f;
		return;
	}
	const FMBStation* const* Study = bPrefersStudy ? Free.FindByPredicate([](const FMBStation* S) { return S->Kind == EMBStationKind::Study; }) : nullptr;
	const FMBStation* Seat = Study ? *Study : Free[(Visits + SeatOffset) % Free.Num()];
	P->bHasCup = true;
	if (P->SitOn(Seat->Id)) Phase = EMBResidentPhase::ToSeat;
	else Timer = 3.f;
}

void UMBResidentComponent::HandleArrived(bool bOk)
{
	if (Phase == EMBResidentPhase::ToCounter)
	{
		if (!bOk) { Phase = EMBResidentPhase::Idle; Timer = 3.f; return; }
		Phase = EMBResidentPhase::Ordering;
		Person()->Activity = EMBActivity::Order;
		// Face the counter (web: n.angle = PI).
		Person()->SetActorRotation(FRotator(0.f, UMBLayoutSubsystem::ToWorldYaw(PI), 0.f));
		Timer = 4.f + Visits % 3;
		bServed = false;
	}
	else if (Phase == EMBResidentPhase::Leaving)
	{
		Phase = EMBResidentPhase::Away;
		Timer = AwaySeconds;
		AMBCafeCharacter* P = Person();
		P->bHasCup = false;
		P->SetActorHiddenInGame(true);
		P->SetActorEnableCollision(false);
	}
}

void UMBResidentComponent::HandleSeated(bool bOk)
{
	if (Phase != EMBResidentPhase::ToSeat) return;
	if (!bOk) { Phase = EMBResidentPhase::Idle; Timer = 3.f; return; }
	Phase = EMBResidentPhase::Seated;
	Timer = SeatedSeconds;
}

void UMBResidentComponent::HandleStood(bool /*bOk*/)
{
	AMBCafeCharacter* P = Person();
	P->bHasCup = false;
	FVector Door = GetWorld()->GetSubsystem<UMBLayoutSubsystem>()->EntranceSpawn();
	Door.Z = P->GetActorLocation().Z;
	if (P->WalkTo(Door)) Phase = EMBResidentPhase::Leaving;
	else { Phase = EMBResidentPhase::Idle; Timer = 3.f; }
}

void UMBResidentComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
	AMBCafeCharacter* P = Person();
	if (!P || bPaused) return;
	P->bSipping = false;
	// Stuck on the way somewhere for 8 s: give up and try again later (web: stalledFor > 8).
	const bool bRouting = Phase == EMBResidentPhase::ToCounter || Phase == EMBResidentPhase::ToSeat || Phase == EMBResidentPhase::Leaving;
	Stalled = bRouting && P->Posture == EMBPosture::Stand && P->GetVelocity().SizeSquared2D() < 25.f ? Stalled + DeltaTime : 0.f;
	if (Stalled > 8.f)
	{
		Stalled = 0.f;
		P->StopMoving();
		Phase = EMBResidentPhase::Idle;
		Timer = 3.f;
		return;
	}
	switch (Phase)
	{
	case EMBResidentPhase::Seated:
		Timer -= DeltaTime;
		P->bSipping = P->bHasCup && Timer > 2.f && FMath::Fmod(Timer, 8.f) < 1.8f;
		if (Timer <= 0.f) P->StandUp(); // HandleStood takes over once they've sidled out
		break;
	case EMBResidentPhase::Ordering:
		Timer -= DeltaTime;
		if (bWaitForService ? bServed : Timer <= 0.f)
		{
			P->Activity = EMBActivity::None;
			PickSeat();
		}
		break;
	case EMBResidentPhase::Idle:
	case EMBResidentPhase::Away:
		Timer -= DeltaTime;
		if (Timer > 0.f) break;
		if (Phase == EMBResidentPhase::Away)
		{
			FVector Spawn = GetWorld()->GetSubsystem<UMBLayoutSubsystem>()->EntranceSpawn();
			Spawn.Z = P->GetActorLocation().Z;
			P->SetActorLocation(Spawn);
			P->SetActorHiddenInGame(false);
			P->SetActorEnableCollision(true);
		}
		++Visits;
		GoToCounter();
		break;
	default:
		break;
	}
}
