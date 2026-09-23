#include "MBPlayerController.h"

#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "InputAction.h"
#include "InputMappingContext.h"
#include "InputModifiers.h"
#include "MBCafeCharacter.h"
#include "MBCameraRig.h"
#include "MBLayoutSubsystem.h"
#include "Engine/World.h"

namespace
{
UInputAction* MakeAction(UObject* Outer, const TCHAR* Name, EInputActionValueType Type)
{
	UInputAction* A = NewObject<UInputAction>(Outer, Name);
	A->ValueType = Type;
	return A;
}

void MapKey(UInputMappingContext* Ctx, UInputAction* A, FKey Key, bool bNegate = false, bool bSwizzle = false)
{
	FEnhancedActionKeyMapping& M = Ctx->MapKey(A, Key);
	if (bSwizzle) M.Modifiers.Add(NewObject<UInputModifierSwizzleAxis>(Ctx));
	if (bNegate) M.Modifiers.Add(NewObject<UInputModifierNegate>(Ctx));
}
}

AMBPlayerController::AMBPlayerController()
{
	bShowMouseCursor = true;
	bEnableClickEvents = true;
}

AMBCafeCharacter* AMBPlayerController::Me() const
{
	return Cast<AMBCafeCharacter>(GetPawn());
}

void AMBPlayerController::BeginPlay()
{
	Super::BeginPlay();
	Rig = GetWorld()->SpawnActor<AMBCameraRig>();
	Rig->Target = GetPawn();
	SetViewTarget(Rig);
	FInputModeGameAndUI Mode;
	Mode.SetHideCursorDuringCapture(false);
	SetInputMode(Mode);
	if (AMBCafeCharacter* P = Me())
	{
		P->OnSeated.AddDynamic(this, &AMBPlayerController::HandleSeated);
		P->OnStood.AddDynamic(this, &AMBPlayerController::HandleStood);
	}
}

void AMBPlayerController::SetupInputComponent()
{
	Super::SetupInputComponent();
	Context = NewObject<UInputMappingContext>(this, TEXT("IMC_MapleBean"));
	MoveAction = MakeAction(this, TEXT("IA_Move"), EInputActionValueType::Axis2D);
	LookAction = MakeAction(this, TEXT("IA_Look"), EInputActionValueType::Axis2D);
	ClickAction = MakeAction(this, TEXT("IA_Click"), EInputActionValueType::Boolean);
	StandAction = MakeAction(this, TEXT("IA_Stand"), EInputActionValueType::Boolean);
	OverviewAction = MakeAction(this, TEXT("IA_CamOverview"), EInputActionValueType::Boolean);
	FollowAction = MakeAction(this, TEXT("IA_CamFollow"), EInputActionValueType::Boolean);
	RoomAction = MakeAction(this, TEXT("IA_CamRoom"), EInputActionValueType::Boolean);

	// WASD → X = right, Y = forward.
	MapKey(Context, MoveAction, EKeys::D);
	MapKey(Context, MoveAction, EKeys::A, true);
	MapKey(Context, MoveAction, EKeys::W, false, true);
	MapKey(Context, MoveAction, EKeys::S, true, true);
	MapKey(Context, LookAction, EKeys::Mouse2D);
	MapKey(Context, ClickAction, EKeys::LeftMouseButton);
	MapKey(Context, StandAction, EKeys::E);
	MapKey(Context, OverviewAction, EKeys::One);
	MapKey(Context, FollowAction, EKeys::Two);
	MapKey(Context, RoomAction, EKeys::Three);

	if (UEnhancedInputLocalPlayerSubsystem* Sub = ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(GetLocalPlayer()))
		Sub->AddMappingContext(Context, 0);
	if (UEnhancedInputComponent* In = Cast<UEnhancedInputComponent>(InputComponent))
	{
		In->BindAction(MoveAction, ETriggerEvent::Triggered, this, &AMBPlayerController::Move);
		In->BindAction(LookAction, ETriggerEvent::Triggered, this, &AMBPlayerController::Look);
		In->BindAction(ClickAction, ETriggerEvent::Started, this, &AMBPlayerController::Click);
		In->BindAction(StandAction, ETriggerEvent::Started, this, &AMBPlayerController::Stand);
		In->BindAction(OverviewAction, ETriggerEvent::Started, this, &AMBPlayerController::CamOverview);
		In->BindAction(FollowAction, ETriggerEvent::Started, this, &AMBPlayerController::CamFollow);
		In->BindAction(RoomAction, ETriggerEvent::Started, this, &AMBPlayerController::CamRoom);
	}
}

void AMBPlayerController::Move(const FInputActionValue& V)
{
	AMBCafeCharacter* P = Me();
	if (!P || P->Posture != EMBPosture::Stand) return;
	const FVector2D Axis = V.Get<FVector2D>();
	P->StopMoving(); // keyboard overrides a click-to-walk route, like the web build
	if (Rig && Rig->Mode == EMBCameraMode::Overview) Rig->SetMode(EMBCameraMode::Follow);
	const FRotator Yaw(0.f, Rig ? Rig->GetViewYaw() : GetControlRotation().Yaw, 0.f);
	P->AddMovementInput(Yaw.RotateVector(FVector::ForwardVector), Axis.Y);
	P->AddMovementInput(Yaw.RotateVector(FVector::RightVector), Axis.X);
}

void AMBPlayerController::Look(const FInputActionValue& V)
{
	// Drag to look: only while the right mouse button is held.
	if (!Rig || !IsInputKeyDown(EKeys::RightMouseButton)) return;
	const FVector2D D = V.Get<FVector2D>();
	Rig->AddOrbit(D.X * 2.f, D.Y * 2.f);
}

void AMBPlayerController::Click()
{
	AMBCafeCharacter* P = Me();
	FHitResult Hit;
	if (!P || !GetHitResultUnderCursor(ECC_Visibility, false, Hit)) return;
	UMBLayoutSubsystem* L = GetWorld()->GetSubsystem<UMBLayoutSubsystem>();
	// A click close to a free seat means "sit there".
	const FMBStation* Best = nullptr;
	float BestD = 90.f;
	for (const FMBStation& S : L->GetStations())
	{
		const float D = FVector::Dist2D(S.Location, Hit.ImpactPoint);
		if (S.IsSeat() && D < BestD && L->IsFree(S.Id)) { Best = &S; BestD = D; }
	}
	if (Best)
	{
		UseStation(Best->Id);
		return;
	}
	if (P->Posture == EMBPosture::Seated) P->StandUp();
	else P->WalkTo(Hit.ImpactPoint);
}

bool AMBPlayerController::UseStation(FName StationId)
{
	AMBCafeCharacter* P = Me();
	if (!P) return false;
	if (P->Posture == EMBPosture::Seated)
	{
		P->StandUp();
		return false; // the web build also asks for a second click once standing
	}
	if (Rig && Rig->Mode == EMBCameraMode::Overview) Rig->SetMode(EMBCameraMode::Follow);
	return P->SitOn(StationId);
}

void AMBPlayerController::HandleSeated(bool bOk)
{
	if (bOk && Rig) Rig->SetMode(EMBCameraMode::Interaction);
}

void AMBPlayerController::HandleStood(bool /*bOk*/)
{
	if (Rig && Rig->Mode == EMBCameraMode::Interaction) Rig->SetMode(EMBCameraMode::Follow);
}

void AMBPlayerController::Stand()
{
	if (AMBCafeCharacter* P = Me()) P->StandUp();
}

void AMBPlayerController::CamOverview() { if (Rig) Rig->SetMode(EMBCameraMode::Overview); }
void AMBPlayerController::CamFollow() { if (Rig) Rig->SetMode(EMBCameraMode::Follow); }
void AMBPlayerController::CamRoom() { if (Rig) Rig->SetMode(EMBCameraMode::Room); }

void AMBPlayerController::PlayerTick(float DeltaTime)
{
	Super::PlayerTick(DeltaTime);
	AMBCafeCharacter* P = Me();
	if (!P || !Rig) return;
	// Keep the room camera framing whichever room the player walks into.
	UMBLayoutSubsystem* L = GetWorld()->GetSubsystem<UMBLayoutSubsystem>();
	const FName Zone = L->ZoneAt(P->GetActorLocation());
	if (Zone == LastZone) return;
	LastZone = Zone;
	const FMBRoom* Room = L->GetRooms().FindByPredicate([Zone](const FMBRoom& R) { return R.Id == Zone; });
	Rig->SetRoomFraming(Room ? Room->Bounds : FBox(UMBLayoutSubsystem::ToWorld(-10.f, -7.f), UMBLayoutSubsystem::ToWorld(10.f, 7.f, 4.f)));
}
