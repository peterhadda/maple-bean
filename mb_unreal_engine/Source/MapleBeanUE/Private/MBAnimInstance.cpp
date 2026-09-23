#include "MBAnimInstance.h"

#include "AnimationRuntime.h"
#include "Animation/AnimNodeBase.h"
#include "Animation/AnimSequenceBase.h"
#include "MBCafeCharacter.h"
#include "Engine/SkeletalMesh.h"
#include "Components/SkeletalMeshComponent.h"

namespace
{
// Bone names of the Maple Bean 41-bone rig (root, hips, spine, chest, neck, head, upper/lower/hand, thigh/shin/foot).
const FName NRoot("root"), NHips("hips"), NHead("head"), NEyeL("eye_L"), NEyeR("eye_R");
const FName NThigh[2] = {"thigh_L", "thigh_R"}, NShin[2] = {"shin_L", "shin_R"}, NFoot[2] = {"foot_L", "foot_R"};
const FName NUpper[2] = {"upper_L", "upper_R"}, NLower[2] = {"lower_L", "lower_R"}, NHand[2] = {"hand_L", "hand_R"};

FCompactPoseBoneIndex Bone(const FCompactPose& Pose, FName Name)
{
	const FBoneContainer& BC = Pose.GetBoneContainer();
	const int32 MeshIndex = BC.GetPoseBoneIndexForBoneName(Name);
	return MeshIndex == INDEX_NONE ? FCompactPoseBoneIndex(INDEX_NONE) : BC.MakeCompactPoseIndex(FMeshPoseBoneIndex(MeshIndex));
}

/** Component-space transform, walking up the (tiny) hierarchy. */
FTransform CS(const FCompactPose& Pose, FCompactPoseBoneIndex I)
{
	FTransform T = Pose[I];
	for (FCompactPoseBoneIndex P = Pose.GetParentBoneIndex(I); P.IsValid(); P = Pose.GetParentBoneIndex(P)) T = T * Pose[P];
	return T;
}

FTransform ParentCS(const FCompactPose& Pose, FCompactPoseBoneIndex I)
{
	const FCompactPoseBoneIndex P = Pose.GetParentBoneIndex(I);
	return P.IsValid() ? CS(Pose, P) : FTransform::Identity;
}

/** Rotate bone I (in component space) so the direction to its child Child approaches Target, by Alpha. */
void Aim(FCompactPose& Pose, FCompactPoseBoneIndex I, FCompactPoseBoneIndex Child, const FVector& Target, float Alpha)
{
	if (!I.IsValid() || !Child.IsValid()) return;
	const FTransform Me = CS(Pose, I);
	const FVector Dir = (CS(Pose, Child).GetLocation() - Me.GetLocation()).GetSafeNormal();
	if (Dir.IsNearlyZero()) return;
	const FQuat Delta = FQuat::Slerp(FQuat::Identity, FQuat::FindBetweenNormals(Dir, Target.GetSafeNormal()), Alpha);
	const FQuat NewCS = Delta * Me.GetRotation();
	Pose[I].SetRotation((ParentCS(Pose, I).GetRotation().Inverse() * NewCS).GetNormalized());
}

/** Restore a bone's component-space rotation (e.g. keep the feet flat after the legs move). */
void KeepCSRotation(FCompactPose& Pose, FCompactPoseBoneIndex I, const FQuat& WantCS, float Alpha)
{
	if (!I.IsValid()) return;
	const FQuat Now = CS(Pose, I).GetRotation();
	const FQuat NewCS = FQuat::Slerp(Now, WantCS, Alpha);
	Pose[I].SetRotation((ParentCS(Pose, I).GetRotation().Inverse() * NewCS).GetNormalized());
}
}

// ---------------------------------------------------------------- game thread

void UMBAnimInstance::NativeUpdateAnimation(float DeltaSeconds)
{
	Super::NativeUpdateAnimation(DeltaSeconds);
	const AMBCafeCharacter* Person = Cast<AMBCafeCharacter>(TryGetPawnOwner());
	if (!Person) return;
	SitAlpha = Person->SitAlpha;
	SeatHeight = Person->bHasSeat && Person->Seat.SeatHeight > 0.f ? Person->Seat.SeatHeight * 100.f : 45.f;
	// Speed from the actual displacement, so the scripted sidle beside a chair also walks;
	// the sit/stand lerp and teleports (a regular re-entering) never do.
	const bool bSeatMotion = Person->Posture == EMBPosture::SittingDown || Person->Posture == EMBPosture::StandingUp
	                      || Person->Posture == EMBPosture::Seated;
	const FVector Here = Person->GetActorLocation();
	const float Moved = DeltaSeconds > 0.f && bHasLastLocation ? FVector::Dist2D(Here, LastLocation) / DeltaSeconds : 0.f;
	LastLocation = Here;
	bHasLastLocation = true;
	Speed = bSeatMotion || Moved > 400.f ? 0.f : FMath::FInterpTo(Speed, Moved, DeltaSeconds, 12.f);
}

bool UMBAnimInstance::LoadClipsFor(const FString& PersonId)
{
	FString Name = PersonId.ToLower();
	if (Name.IsEmpty()) return false;
	Name[0] = FChar::ToUpper(Name[0]);
	auto Load = [&Name](const TCHAR* Clip)
	{
		const FString Path = FString::Printf(TEXT("/Game/MapleBean/Animations/%s/A_%s_%s.A_%s_%s"), *Name, *Name, Clip, *Name, Clip);
		return LoadObject<UAnimSequenceBase>(nullptr, *Path, nullptr, LOAD_NoWarn | LOAD_Quiet);
	};
	// Clips are per skeleton; one retargeted for another variant's skeleton would scramble the pose.
	const USkeleton* Mine = GetSkelMeshComponent() && GetSkelMeshComponent()->GetSkeletalMeshAsset()
		? GetSkelMeshComponent()->GetSkeletalMeshAsset()->GetSkeleton() : nullptr;
	auto Fits = [Mine](UAnimSequenceBase* A) { return A && (!Mine || A->GetSkeleton() == Mine) ? A : nullptr; };
	if (!IdleClip) IdleClip = Fits(Load(TEXT("Idle")));
	if (!WalkClip) WalkClip = Fits(Load(TEXT("Walk")));
	return IdleClip && WalkClip;
}

// ---------------------------------------------------------------- worker thread

void FMBAnimProxy::PreUpdate(UAnimInstance* Instance, float DeltaSeconds)
{
	FAnimInstanceProxy::PreUpdate(Instance, DeltaSeconds);
	const UMBAnimInstance* A = CastChecked<UMBAnimInstance>(Instance);
	Idle = A->IdleClip;
	Walk = A->WalkClip;
	Speed = A->Speed;
	WalkClipSpeed = FMath::Max(A->WalkClipSpeed, 10.f);
	SitAlpha = A->SitAlpha;
	SeatHeight = A->SeatHeight;
}

void FMBAnimProxy::Update(float DeltaSeconds)
{
	WalkWeight = FMath::Clamp((Speed - 8.f) / 50.f, 0.f, 1.f) * (1.f - SitAlpha);
	const float Rate = FMath::Clamp(Speed / WalkClipSpeed, .55f, 1.6f);
	if (Idle) IdleTime = FMath::Fmod(IdleTime + DeltaSeconds, FMath::Max(Idle->GetPlayLength(), .01f));
	if (Walk) WalkTime = FMath::Fmod(WalkTime + DeltaSeconds * Rate, FMath::Max(Walk->GetPlayLength(), .01f));
}

bool FMBAnimProxy::Evaluate(FPoseContext& Output)
{
	auto Sample = [](UAnimSequenceBase* Seq, double Time, FPoseContext& Ctx)
	{
		FAnimationPoseData Data(Ctx);
		Seq->GetAnimationPose(Data, FAnimExtractContext(Time, false));
	};
	if (Idle && Walk && WalkWeight > .01f && WalkWeight < .99f)
	{
		FPoseContext A(Output), B(Output);
		Sample(Idle, IdleTime, A);
		Sample(Walk, WalkTime, B);
		FAnimationPoseData Out(Output);
		FAnimationRuntime::BlendTwoPosesTogether(FAnimationPoseData(A), FAnimationPoseData(B), 1.f - WalkWeight, Out);
	}
	else if (UAnimSequenceBase* Seq = (WalkWeight >= .99f && Walk) ? Walk.Get() : (Idle ? Idle.Get() : Walk.Get()))
	{
		Sample(Seq, Seq == Walk ? WalkTime : IdleTime, Output);
	}
	else
	{
		Output.ResetToRefPose();
	}
	// The capsule moves the character; keep any authored root travel out of the pose.
	const FCompactPoseBoneIndex Root = Bone(Output.Pose, NRoot);
	if (Root.IsValid()) Output.Pose[Root].SetTranslation(Output.Pose.GetRefPose(Root).GetTranslation());
	if (SitAlpha > .001f) ApplySit(Output);
	return true;
}

void FMBAnimProxy::ApplySit(FPoseContext& Output) const
{
	FCompactPose& Pose = Output.Pose;
	const FCompactPoseBoneIndex Hips = Bone(Pose, NHips), Head = Bone(Pose, NHead);
	if (!Hips.IsValid()) return;
	const float A = SitAlpha;

	// Facing, from the eyes relative to the head (the glTF rig faces +Y in mesh space, but don't assume).
	FVector Fwd(0.f, 1.f, 0.f);
	const FCompactPoseBoneIndex EyeL = Bone(Pose, NEyeL), EyeR = Bone(Pose, NEyeR);
	if (Head.IsValid() && EyeL.IsValid() && EyeR.IsValid())
	{
		FVector F = (CS(Pose, EyeL).GetLocation() + CS(Pose, EyeR).GetLocation()) * .5f - CS(Pose, Head).GetLocation();
		F.Z = 0.f;
		if (F.Normalize()) Fwd = F;
	}
	const FVector Up = FVector::UpVector;

	// Feet stay flat: remember their standing orientation.
	FQuat FootCS[2];
	const FCompactPoseBoneIndex None(INDEX_NONE);
	FCompactPoseBoneIndex Thigh[2] = {None, None}, Shin[2] = {None, None}, Foot[2] = {None, None};
	float ThighZ = 0.f;
	for (int32 S = 0; S < 2; ++S)
	{
		Thigh[S] = Bone(Pose, NThigh[S]);
		Shin[S] = Bone(Pose, NShin[S]);
		Foot[S] = Bone(Pose, NFoot[S]);
		FootCS[S] = Foot[S].IsValid() ? CS(Pose, Foot[S]).GetRotation() : FQuat::Identity;
		ThighZ += Thigh[S].IsValid() ? CS(Pose, Thigh[S]).GetLocation().Z * .5f : 0.f;
	}

	// 1. Lower the pelvis so the hip joints rest a little above the seat, and ease it back over the seat.
	const FTransform HipsCS = CS(Pose, Hips);
	FVector HipsAt = HipsCS.GetLocation();
	HipsAt.Z += (SeatHeight + 8.f - ThighZ) * A;
	HipsAt -= Fwd * 4.f * A;
	Pose[Hips].SetTranslation(ParentCS(Pose, Hips).InverseTransformPosition(HipsAt));

	for (int32 S = 0; S < 2; ++S)
	{
		// 2. Thighs forward (level with the seat), shins down to the floor, feet flat.
		Aim(Pose, Thigh[S], Shin[S], Fwd - Up * .06f, A);
		Aim(Pose, Shin[S], Foot[S], -Up + Fwd * .12f, A);
		KeepCSRotation(Pose, Foot[S], FootCS[S], A);
		// 3. Hands resting on the thighs.
		const FCompactPoseBoneIndex Upper = Bone(Pose, NUpper[S]), Lower = Bone(Pose, NLower[S]), Hand = Bone(Pose, NHand[S]);
		Aim(Pose, Upper, Lower, -Up + Fwd * .35f, A * .85f);
		Aim(Pose, Lower, Hand, Fwd - Up * .45f, A * .85f);
	}
}
