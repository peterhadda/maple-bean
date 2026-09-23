#include "MBLayoutSubsystem.h"

#include "Dom/JsonObject.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

DEFINE_LOG_CATEGORY_STATIC(LogMapleLayout, Log, All);

namespace
{
EMBStationKind KindFromString(const FString& S)
{
	if (S == TEXT("coffee")) return EMBStationKind::Coffee;
	if (S == TEXT("seat")) return EMBStationKind::Seat;
	if (S == TEXT("read")) return EMBStationKind::Read;
	if (S == TEXT("study")) return EMBStationKind::Study;
	if (S == TEXT("talk")) return EMBStationKind::Talk;
	if (S == TEXT("game")) return EMBStationKind::Game;
	if (S == TEXT("plant")) return EMBStationKind::Plant;
	return EMBStationKind::Unknown;
}

FVector2D LayoutXZ(const FVector& World)
{
	// Inverse of ToWorld.
	return FVector2D(World.X / 100.f, World.Y / 100.f);
}
}

// Interchange imports the glTF (three.js, Y up, metres) as UE X = x, Y = z, Z = y, in centimetres —
// the axis swap is the right→left-handed conversion. Confirmed by the imported café bounds:
// the games wing (layout z -14.4..-7) sits at world Y -1440..-700 and the entrance (z +9) at Y +900.
FVector UMBLayoutSubsystem::ToWorld(float X, float Z, float Height)
{
	return FVector(X * 100.f, Z * 100.f, Height * 100.f);
}

float UMBLayoutSubsystem::ToWorldYaw(float LayoutAngle)
{
	const FVector F = ToWorld(FMath::Sin(LayoutAngle), FMath::Cos(LayoutAngle));
	return FMath::RadiansToDegrees(FMath::Atan2(F.Y, F.X));
}

void UMBLayoutSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	LoadLayout(FPaths::ProjectContentDir() / TEXT("MapleBean/Data/layout.json"));
}

bool UMBLayoutSubsystem::LoadLayout(const FString& Path)
{
	FString Text;
	if (!FFileHelper::LoadFileToString(Text, *Path))
	{
		UE_LOG(LogMapleLayout, Warning, TEXT("Layout not found: %s"), *Path);
		return false;
	}
	TSharedPtr<FJsonObject> Root;
	if (!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Text), Root) || !Root.IsValid())
	{
		UE_LOG(LogMapleLayout, Error, TEXT("Layout is not valid JSON: %s"), *Path);
		return false;
	}

	for (const TSharedPtr<FJsonValue>& V : Root->GetArrayField(TEXT("stations")))
	{
		const TSharedPtr<FJsonObject> O = V->AsObject();
		FMBStation S;
		S.Id = FName(O->GetStringField(TEXT("id")));
		S.Label = FText::FromString(O->GetStringField(TEXT("label")));
		S.Kind = KindFromString(O->GetStringField(TEXT("kind")));
		S.LayoutAngle = O->HasField(TEXT("angle")) ? O->GetNumberField(TEXT("angle")) : 0.f;
		S.SeatHeight = O->HasField(TEXT("seatHeight")) ? O->GetNumberField(TEXT("seatHeight")) : 0.f;
		S.Location = ToWorld(O->GetNumberField(TEXT("x")), O->GetNumberField(TEXT("z")));
		const TArray<TSharedPtr<FJsonValue>>* A = nullptr;
		S.Approach = O->TryGetArrayField(TEXT("approach"), A) && A->Num() == 2
			? ToWorld((*A)[0]->AsNumber(), (*A)[1]->AsNumber())
			: S.Location;
		S.Yaw = ToWorldYaw(S.LayoutAngle);
		Stations.Add(S);
	}
	const TArray<TSharedPtr<FJsonValue>>* RoomValues = nullptr;
	if (Root->TryGetArrayField(TEXT("rooms"), RoomValues))
	{
		for (const TSharedPtr<FJsonValue>& V : *RoomValues)
		{
			const TSharedPtr<FJsonObject> O = V->AsObject();
			FMBRoom R;
			R.Id = FName(O->GetStringField(TEXT("id")));
			R.Name = FText::FromString(O->GetStringField(TEXT("name")));
			R.Bounds = FBox(ToWorld(O->GetNumberField(TEXT("x0")), O->GetNumberField(TEXT("z0")), 0.f),
			                ToWorld(O->GetNumberField(TEXT("x1")), O->GetNumberField(TEXT("z1")), 4.f));
			R.Bounds = FBox(R.Bounds.Min.ComponentMin(R.Bounds.Max), R.Bounds.Min.ComponentMax(R.Bounds.Max));
			Rooms.Add(R);
		}
	}
	UE_LOG(LogMapleLayout, Log, TEXT("Loaded %d stations, %d rooms"), Stations.Num(), Rooms.Num());
	return true;
}

bool UMBLayoutSubsystem::FindStation(FName Id, FMBStation& Out) const
{
	const FMBStation* S = Stations.FindByPredicate([Id](const FMBStation& X) { return X.Id == Id; });
	if (S) Out = *S;
	return S != nullptr;
}

FName UMBLayoutSubsystem::ZoneAt(const FVector& World) const
{
	for (const FMBRoom& R : Rooms)
	{
		if (World.X >= R.Bounds.Min.X && World.X <= R.Bounds.Max.X && World.Y >= R.Bounds.Min.Y && World.Y <= R.Bounds.Max.Y)
			return R.Id;
	}
	return TEXT("main");
}

bool UMBLayoutSubsystem::Reserve(FName SeatId, AActor* Who)
{
	TWeakObjectPtr<AActor>& Slot = Reserved.FindOrAdd(SeatId);
	if (Slot.IsValid() && Slot.Get() != Who) return false;
	Slot = Who;
	return true;
}

void UMBLayoutSubsystem::Release(FName SeatId, AActor* Who)
{
	if (const TWeakObjectPtr<AActor>* Slot = Reserved.Find(SeatId); Slot && (!Slot->IsValid() || Slot->Get() == Who))
		Reserved.Remove(SeatId);
}

bool UMBLayoutSubsystem::IsFree(FName SeatId) const
{
	const TWeakObjectPtr<AActor>* Slot = Reserved.Find(SeatId);
	return !Slot || !Slot->IsValid();
}

TArray<const FMBStation*> UMBLayoutSubsystem::FreeSeats() const
{
	TArray<const FMBStation*> Out;
	for (const FMBStation& S : Stations)
		if (S.IsSeat() && IsFree(S.Id)) Out.Add(&S);
	return Out;
}

FVector UMBLayoutSubsystem::EntryPoint(const FMBStation& Seat, bool& bFromFront) const
{
	// Work in layout metres so the numbers match cafe-life.js exactly.
	const FVector2D P = LayoutXZ(Seat.Location), Ap = LayoutXZ(Seat.Approach);
	const float A = Seat.LayoutAngle;
	const FVector2D F(FMath::Sin(A), FMath::Cos(A));
	const FVector2D ToApproach = Ap - P;
	if (FVector2D::DotProduct(ToApproach, F) > .3f)
	{
		bFromFront = true;
		return Seat.Approach;
	}
	bFromFront = false;
	const FVector2D R(FMath::Cos(A), -FMath::Sin(A));
	float Side = FVector2D::DotProduct(ToApproach, R);
	if (FMath::Abs(Side) < .3f)
	{
		auto Room = [&](float S)
		{
			float Best = 9.f;
			const FVector2D Probe = P + R * S * .5f;
			for (const FMBStation& O : Stations)
			{
				if (&O == &Seat || O.Id == Seat.Id || !O.IsSeat()) continue;
				Best = FMath::Min(Best, FVector2D::Distance(LayoutXZ(O.Location), Probe) / (IsFree(O.Id) ? 1.f : 2.f));
			}
			return Best;
		};
		Side = Room(1.f) >= Room(-1.f) ? 1.f : -1.f;
	}
	Side = FMath::Sign(Side);
	const FVector2D E = P + R * Side * .5f - F * .12f;
	return ToWorld(E.X, E.Y);
}
