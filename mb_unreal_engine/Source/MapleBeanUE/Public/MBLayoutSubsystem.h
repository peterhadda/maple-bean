// Café layout shared by the player, the regulars and the cameras.
// Port of assets/layout.json + the seat helpers in cafe-life.js / navigation.js.
#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "MBLayoutSubsystem.generated.h"

UENUM(BlueprintType)
enum class EMBStationKind : uint8
{
	Coffee, Seat, Read, Study, Talk, Game, Plant, Unknown
};

USTRUCT(BlueprintType)
struct FMBStation
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly) FName Id;
	UPROPERTY(BlueprintReadOnly) FText Label;
	UPROPERTY(BlueprintReadOnly) EMBStationKind Kind = EMBStationKind::Unknown;
	/** World-space seat/station point (cm). */
	UPROPERTY(BlueprintReadOnly) FVector Location = FVector::ZeroVector;
	/** Where a person stands before the final choreographed step. */
	UPROPERTY(BlueprintReadOnly) FVector Approach = FVector::ZeroVector;
	/** Direction a seated person faces, as a world yaw in degrees. */
	UPROPERTY(BlueprintReadOnly) float Yaw = 0.f;
	/** Layout-space facing angle (radians), kept for the seating maths. */
	float LayoutAngle = 0.f;
	UPROPERTY(BlueprintReadOnly) float SeatHeight = 0.f;

	bool IsSeat() const { return Kind == EMBStationKind::Seat || Kind == EMBStationKind::Read || Kind == EMBStationKind::Study; }
};

USTRUCT(BlueprintType)
struct FMBRoom
{
	GENERATED_BODY()
	UPROPERTY(BlueprintReadOnly) FName Id;
	UPROPERTY(BlueprintReadOnly) FText Name;
	UPROPERTY(BlueprintReadOnly) FBox Bounds = FBox(ForceInit);
};

UCLASS()
class MAPLEBEANUE_API UMBLayoutSubsystem : public UWorldSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;

	/** Layout metres (x right, z toward the entrance) → world centimetres. Single source of the axis mapping. */
	static FVector ToWorld(float X, float Z, float Height = 0.f);
	/** Layout angle (radians, facing = (sin a, cos a)) → world yaw (degrees). */
	static float ToWorldYaw(float LayoutAngle);

	UFUNCTION(BlueprintPure, Category = "Maple Bean") const TArray<FMBStation>& GetStations() const { return Stations; }
	UFUNCTION(BlueprintPure, Category = "Maple Bean") const TArray<FMBRoom>& GetRooms() const { return Rooms; }
	UFUNCTION(BlueprintCallable, Category = "Maple Bean") bool FindStation(FName Id, FMBStation& Out) const;
	UFUNCTION(BlueprintPure, Category = "Maple Bean") FName ZoneAt(const FVector& World) const;
	UFUNCTION(BlueprintPure, Category = "Maple Bean") FVector EntranceSpawn() const { return ToWorld(0.f, 8.5f); }

	/** Seat reservation, so two people never take the same chair. */
	UFUNCTION(BlueprintCallable, Category = "Maple Bean") bool Reserve(FName SeatId, AActor* Who);
	UFUNCTION(BlueprintCallable, Category = "Maple Bean") void Release(FName SeatId, AActor* Who);
	UFUNCTION(BlueprintPure, Category = "Maple Bean") bool IsFree(FName SeatId) const;
	TArray<const FMBStation*> FreeSeats() const;

	/**
	 * Where the final sit-down movement starts: in front of a sofa approached from the front,
	 * otherwise beside the chair on the side with more room (occupied neighbours count double).
	 * Port of entryPoint() in cafe-life.js.
	 */
	UFUNCTION(BlueprintCallable, Category = "Maple Bean") FVector EntryPoint(const FMBStation& Seat, bool& bFromFront) const;

private:
	bool LoadLayout(const FString& Path);

	TArray<FMBStation> Stations;
	TArray<FMBRoom> Rooms;
	TMap<FName, TWeakObjectPtr<AActor>> Reserved;
};
