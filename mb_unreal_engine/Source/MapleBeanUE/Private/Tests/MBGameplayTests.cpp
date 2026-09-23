// Maple Bean automation tests.
//   MapleBean.Layout.*  — layout + seat reservation in a throwaway world (fast, no PIE).
//   MapleBean.Play.*    — a real Play-In-Editor session on L_Cafe: the player walks, sits and stands through
//                         AMBPlayerController::UseStation, Claire runs counter → seat → leave, and no two people
//                         ever hold the same seat. Screenshots land in Saved/QA/pie/ when a viewport renders.
// Run: Scripts/ue_run.sh movement-qa test MapleBean
#include "Misc/AutomationTest.h"

#if WITH_DEV_AUTOMATION_TESTS && WITH_EDITOR

#include "Editor.h"
#include "EngineUtils.h"
#include "MBAnimInstance.h"
#include "MBCafeCharacter.h"
#include "MBLayoutSubsystem.h"
#include "MBPlayerController.h"
#include "MBResidentComponent.h"
#include "NavigationSystem.h"
#include "UnrealClient.h"
#include "Misc/Paths.h"
#include "Tests/AutomationCommon.h"
#include "Tests/AutomationEditorCommon.h"

namespace MBTest
{
constexpr EAutomationTestFlags Flags = EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter;
const FName PlayerSeat = TEXT("community-0");

void Shot(const FString& Name)
{
	const FString Path = FPaths::ProjectSavedDir() / TEXT("QA/pie") / (Name + TEXT(".png"));
	FScreenshotRequest::RequestScreenshot(Path, false, false);
	UE_LOG(LogTemp, Display, TEXT("[MBTest] screenshot requested: %s"), *Path);
}
}

// ------------------------------------------------------------------------------------------------ layout

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FMBLayoutReservationTest, "MapleBean.Layout.StationsAndReservations", MBTest::Flags)

bool FMBLayoutReservationTest::RunTest(const FString&)
{
	UWorld* World = UWorld::CreateWorld(EWorldType::Game, false, TEXT("MBLayoutTest"));
	UMBLayoutSubsystem* L = World ? World->GetSubsystem<UMBLayoutSubsystem>() : nullptr;
	if (!TestNotNull(TEXT("layout subsystem"), L)) return false;

	TestEqual(TEXT("stations loaded"), L->GetStations().Num(), 43);
	TestEqual(TEXT("rooms loaded"), L->GetRooms().Num(), 2);
	int32 Seats = 0;
	for (const FMBStation& S : L->GetStations()) Seats += S.IsSeat() ? 1 : 0;
	TestEqual(TEXT("free seats at start"), L->FreeSeats().Num(), Seats);

	AActor* A = World->SpawnActor<AActor>();
	AActor* B = World->SpawnActor<AActor>();
	const FName Seat = TEXT("sofa");
	TestTrue(TEXT("A reserves the sofa"), L->Reserve(Seat, A));
	TestFalse(TEXT("B cannot take A's sofa"), L->Reserve(Seat, B));
	TestTrue(TEXT("re-reserving your own seat is fine"), L->Reserve(Seat, A));
	TestFalse(TEXT("sofa no longer free"), L->IsFree(Seat));
	TestEqual(TEXT("one fewer free seat"), L->FreeSeats().Num(), Seats - 1);
	L->Release(Seat, B);
	TestFalse(TEXT("B cannot release A's seat"), L->IsFree(Seat));
	L->Release(Seat, A);
	TestTrue(TEXT("released"), L->IsFree(Seat));
	TestTrue(TEXT("B can now take it"), L->Reserve(Seat, B));
	L->Release(Seat, B);

	// entryPoint(): the sofa is approached from the front, the side chairs from the side with more room.
	FMBStation Sofa, West;
	bool bFront = false;
	if (TestTrue(TEXT("sofa exists"), L->FindStation(Seat, Sofa)))
	{
		const FVector E = L->EntryPoint(Sofa, bFront);
		TestTrue(TEXT("sofa entered from the front"), bFront);
		TestTrue(TEXT("sofa entry is its approach"), E.Equals(Sofa.Approach, 1.f));
	}
	if (TestTrue(TEXT("original-west exists"), L->FindStation(TEXT("original-west"), West)))
	{
		const FVector E = L->EntryPoint(West, bFront);
		TestFalse(TEXT("chair entered from the side"), bFront);
		TestTrue(TEXT("side entry ~0.5 m from the chair"), FMath::IsNearlyEqual(FVector::Dist2D(E, West.Location), 51.f, 6.f));
	}
	TestEqual(TEXT("layout -> world axis mapping"), UMBLayoutSubsystem::ToWorld(1.f, 2.f), FVector(100.f, 200.f, 0.f));
	World->DestroyWorld(false);
	return true;
}

// ------------------------------------------------------------------------------------------------ PIE

struct FMBPlayState
{
	enum class EStep { WaitWorld, WaitNav, Walk, Sit, Stand, ClaireRoutine, Done };
	EStep Step = EStep::WaitWorld;
	double StepStart = 0.0;
	FVector WalkTarget = FVector::ZeroVector;
	TArray<EMBResidentPhase> ClairePhases;
	bool bContentionChecked = false;
	bool bClaireShot = false;
	int32 SeatConflicts = 0;
	float StandingHipsZ = 0.f;
	bool bWalkSeen = false;
};

/** Hips height above the actor's feet (cm), from the evaluated pose. */
static float HipsAboveFeet(const AMBCafeCharacter* C)
{
	const USkeletalMeshComponent* M = C->GetMesh();
	return M->GetBoneLocation(TEXT("hips")).Z - M->GetComponentLocation().Z;
}

DEFINE_LATENT_AUTOMATION_COMMAND_TWO_PARAMETER(FMBPlayScript, FAutomationTestBase*, Test, TSharedRef<FMBPlayState>, S);

bool FMBPlayScript::Update()
{
	using EStep = FMBPlayState::EStep;
	UWorld* World = GEditor ? GEditor->PlayWorld.Get() : nullptr;
	const double Now = FPlatformTime::Seconds();
	if (S->StepStart == 0.0) S->StepStart = Now;
	const double InStep = Now - S->StepStart;
	auto Next = [&](EStep To, const TCHAR* Msg)
	{
		UE_LOG(LogTemp, Display, TEXT("[MBTest] %s (%.1fs)"), Msg, InStep);
		S->Step = To;
		S->StepStart = Now;
	};
	auto Fail = [&](const FString& Why)
	{
		Test->AddError(FString::Printf(TEXT("[MBTest] %s"), *Why));
		S->Step = EStep::Done;
		return true;
	};

	if (!World)
		return InStep > 90.0 ? Fail(TEXT("PIE world never started")) : false;

	AMBPlayerController* PC = Cast<AMBPlayerController>(World->GetFirstPlayerController());
	AMBCafeCharacter* Maya = PC ? Cast<AMBCafeCharacter>(PC->GetPawn()) : nullptr;
	AMBCafeCharacter* Claire = nullptr;
	for (TActorIterator<AMBCafeCharacter> It(World); It; ++It)
		if (It->PersonId == TEXT("claire")) Claire = *It;
	UMBResidentComponent* Life = Claire ? Claire->FindComponentByClass<UMBResidentComponent>() : nullptr;
	UMBLayoutSubsystem* L = World->GetSubsystem<UMBLayoutSubsystem>();

	// Invariant, every frame: nobody shares a seat.
	if (S->Step > EStep::WaitWorld)
	{
		TMap<FName, AMBCafeCharacter*> Held;
		for (TActorIterator<AMBCafeCharacter> It(World); It; ++It)
		{
			if (!It->bHasSeat) continue;
			if (AMBCafeCharacter** Other = Held.Find(It->Seat.Id))
			{
				++S->SeatConflicts;
				Test->AddError(FString::Printf(TEXT("[MBTest] seat %s held by both %s and %s"), *It->Seat.Id.ToString(),
				                               *(*Other)->PersonId.ToString(), *It->PersonId.ToString()));
			}
			Held.Add(It->Seat.Id, *It);
		}
	}
	// Record Claire's routine as it happens.
	if (Life && (S->ClairePhases.IsEmpty() || S->ClairePhases.Last() != Life->Phase))
	{
		S->ClairePhases.Add(Life->Phase);
		UE_LOG(LogTemp, Display, TEXT("[MBTest] claire phase -> %s"), *UEnum::GetValueAsString(Life->Phase));
	}

	switch (S->Step)
	{
	case EStep::WaitWorld:
		if (!PC || !Maya || !Claire || !Life || !L)
			return InStep > 60.0 ? Fail(TEXT("player controller, Maya or Claire missing (is MBGameMode the game mode?)")) : false;
		Test->TestEqual(TEXT("PIE layout stations"), L->GetStations().Num(), 43);
		Test->TestEqual(TEXT("PIE layout rooms"), L->GetRooms().Num(), 2);
		Test->TestTrue(TEXT("Maya has a skeletal mesh"), Maya->GetMesh()->GetSkeletalMeshAsset() != nullptr);
		Test->TestTrue(TEXT("Claire has a skeletal mesh"), Claire->GetMesh()->GetSkeletalMeshAsset() != nullptr);
		Test->TestTrue(TEXT("Claire does not wear Maya's mesh"),
		               Claire->GetMesh()->GetSkeletalMeshAsset() != Maya->GetMesh()->GetSkeletalMeshAsset());
		{
			const UMBAnimInstance* Anim = Cast<UMBAnimInstance>(Maya->GetMesh()->GetAnimInstance());
			Test->TestNotNull(TEXT("Maya runs UMBAnimInstance / ABP_MapleBean"), Anim);
			Test->TestTrue(TEXT("Maya has retargeted Idle + Walk"), Anim && Anim->IdleClip && Anim->WalkClip);
			Test->TestNotNull(TEXT("Claire runs UMBAnimInstance"), Cast<UMBAnimInstance>(Claire->GetMesh()->GetAnimInstance()));
			S->StandingHipsZ = HipsAboveFeet(Maya);
		}
		Life->SeatedSeconds = 6.f; // keep the test short
		Life->AwaySeconds = 2.f;
		Next(EStep::WaitNav, TEXT("world ready"));
		return false;

	case EStep::WaitNav:
	{
		UNavigationSystemV1* Nav = FNavigationSystem::GetCurrent<UNavigationSystemV1>(World);
		FNavLocation OnNav;
		const bool bReady = Nav && Nav->GetDefaultNavDataInstance() && !Nav->IsNavigationBuildInProgress()
		                 && Nav->ProjectPointToNavigation(Maya->GetActorLocation(), OnNav, FVector(100.f, 100.f, 300.f));
		if (!bReady) return InStep > 120.0 ? Fail(TEXT("no NavMesh under the player (bounds volume / collision?)")) : false;
		S->WalkTarget = UMBLayoutSubsystem::ToWorld(-1.f, 3.f);
		S->WalkTarget.Z = Maya->GetActorLocation().Z;
		Test->TestTrue(TEXT("WalkTo accepted"), Maya->WalkTo(S->WalkTarget));
		MBTest::Shot(TEXT("pie_01_start"));
		Next(EStep::Walk, TEXT("navmesh ready, walking"));
		return false;
	}

	case EStep::Walk:
		if (const UMBAnimInstance* Anim = Cast<UMBAnimInstance>(Maya->GetMesh()->GetAnimInstance()); Anim && Anim->Speed > 100.f && !S->bWalkSeen)
		{
			S->bWalkSeen = true;
			UE_LOG(LogTemp, Display, TEXT("[MBTest] anim speed while walking %.0f cm/s"), Anim->Speed);
		}
		if (FVector::Dist2D(Maya->GetActorLocation(), S->WalkTarget) > 60.f || Maya->IsWalking())
			return InStep > 40.0 ? Fail(FString::Printf(TEXT("walk did not arrive; %.0f cm short"),
			                                            FVector::Dist2D(Maya->GetActorLocation(), S->WalkTarget))) : false;
		Test->TestTrue(TEXT("anim instance saw walking speed"), S->bWalkSeen);
		Test->TestTrue(TEXT("UseStation(community-0) accepted"), PC->UseStation(MBTest::PlayerSeat));
		Next(EStep::Sit, TEXT("walked to point; sitting"));
		return false;

	case EStep::Sit:
		if (Maya->Posture != EMBPosture::Seated)
			return InStep > 45.0 ? Fail(FString::Printf(TEXT("never sat; posture %s"), *UEnum::GetValueAsString(Maya->Posture))) : false;
		Test->TestEqual(TEXT("seated on the chosen seat"), Maya->Seat.Id, MBTest::PlayerSeat);
		Test->TestFalse(TEXT("seat reserved while seated"), L->IsFree(MBTest::PlayerSeat));
		Test->TestTrue(TEXT("sit pose fully blended"), FMath::IsNearlyEqual(Maya->SitAlpha, 1.f));
		Test->TestTrue(TEXT("facing the seat's direction"),
		               FMath::Abs(FRotator::NormalizeAxis(Maya->GetActorRotation().Yaw - Maya->Seat.Yaw)) < 5.f);
		{
			const float Seated = HipsAboveFeet(Maya);
			UE_LOG(LogTemp, Display, TEXT("[MBTest] hips above feet: standing %.0f cm, seated %.0f cm (seat %.0f cm)"),
			       S->StandingHipsZ, Seated, Maya->Seat.SeatHeight * 100.f);
			Test->TestTrue(TEXT("sit pose lowers the hips by 20+ cm"), S->StandingHipsZ - Seated > 20.f);
		}
		MBTest::Shot(TEXT("pie_02_maya_seated"));
		PC->UseStation(MBTest::PlayerSeat); // seated: UseStation stands up (like pressing E)
		Next(EStep::Stand, TEXT("seated; standing"));
		return false;

	case EStep::Stand:
		if (Maya->Posture != EMBPosture::Stand)
			return InStep > 15.0 ? Fail(TEXT("never stood up")) : false;
		Test->TestTrue(TEXT("seat released after standing"), L->IsFree(MBTest::PlayerSeat));
		Test->TestTrue(TEXT("sit pose cleared"), Maya->SitAlpha < .01f);
		Next(EStep::ClaireRoutine, TEXT("stood; watching Claire"));
		return false;

	case EStep::ClaireRoutine:
		if (Life->Phase == EMBResidentPhase::Seated && Claire->bHasSeat && !S->bContentionChecked)
		{
			S->bContentionChecked = true;
			Test->TestFalse(TEXT("Maya cannot sit in Claire's seat"), Maya->SitOn(Claire->Seat.Id));
			Test->TestFalse(TEXT("layout refuses a second reservation"), L->Reserve(Claire->Seat.Id, Maya));
			MBTest::Shot(TEXT("pie_03_claire_seated"));
		}
		if (Life->Phase != EMBResidentPhase::Away || S->ClairePhases.Num() < 6)
			return InStep > 240.0 ? Fail(TEXT("Claire did not finish counter -> seat -> leave")) : false;
		{
			const TArray<EMBResidentPhase> Want = {EMBResidentPhase::ToCounter, EMBResidentPhase::Ordering, EMBResidentPhase::ToSeat,
			                                       EMBResidentPhase::Seated, EMBResidentPhase::Leaving, EMBResidentPhase::Away};
			int32 k = 0;
			for (EMBResidentPhase P : S->ClairePhases) if (k < Want.Num() && P == Want[k]) ++k;
			Test->TestEqual(TEXT("Claire's phases in order (counter, order, seat, sit, leave, away)"), k, Want.Num());
			Test->TestTrue(TEXT("contention checked while Claire sat"), S->bContentionChecked);
			Test->TestEqual(TEXT("seat conflicts"), S->SeatConflicts, 0);
		}
		Next(EStep::Done, TEXT("Claire left the café"));
		return true;

	case EStep::Done:
		return true;
	}
	return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FMBPlaySessionTest, "MapleBean.Play.CafeSession", MBTest::Flags)

bool FMBPlaySessionTest::RunTest(const FString&)
{
	if (!AutomationOpenMap(TEXT("/Game/MapleBean/Maps/L_Cafe"))) return false;
	ADD_LATENT_AUTOMATION_COMMAND(FStartPIECommand(false));
	ADD_LATENT_AUTOMATION_COMMAND(FMBPlayScript(this, MakeShared<FMBPlayState>()));
	ADD_LATENT_AUTOMATION_COMMAND(FWaitLatentCommand(1.f)); // let the last screenshot flush
	ADD_LATENT_AUTOMATION_COMMAND(FEndPlayMapCommand());
	return true;
}

#endif
