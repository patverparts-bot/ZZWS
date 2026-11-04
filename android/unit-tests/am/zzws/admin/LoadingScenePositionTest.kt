package am.zzws.admin
import org.junit.Assert.*
import org.junit.Test
class LoadingScenePositionTest {
 @Test fun loadedRefrigeratorHasOneFixedPositionInsideTheMovingTruck(){
  val loaded=orderScenePosition(.60f)
  for(p in listOf(.65f,.75f,.9f,1f)){val position=orderScenePosition(p);assertEquals(0f,position.cargoX,0f);assertEquals(0f,position.cargoY,0f);assertTrue(position.truck>loaded.truck)}
 }
 @Test fun refrigeratorIsLiftedBeforeLoadingAndTruckWaitsForTheForklift(){
  val start=orderScenePosition(0f);val lifted=orderScenePosition(.22f);val loaded=orderScenePosition(.45f)
  assertEquals(-140f,start.cargoX,0f);assertEquals(28f,start.cargoY,0f);assertEquals(start.cargoX,lifted.cargoX,0f);assertEquals(0f,lifted.cargoY,0f);assertEquals(0f,loaded.cargoX,0f);assertEquals(0f,loaded.truck,0f);assertEquals(140f,loaded.forklift,0f)
 }
}
