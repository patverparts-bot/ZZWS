package am.zzws.admin

import android.animation.ValueAnimator
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.*
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.*
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties

internal const val CATALOG_LOADING_TITLE="Պատրաստում ենք կատալոգը"
internal const val ORDER_PREPARATION_TITLE="Ձեր պատվերը պատրաստում ենք առաքման"
internal const val ORDER_SCENE_NOTE="Սպասեք պատվերի հաստատմանը։"

internal data class OrderScenePosition(val truck:Float,val cargoX:Float,val cargoY:Float,val forklift:Float,val lift:Float)
/** Cargo coordinates are local to the truck. They stay fixed for the entire drive. */
internal fun orderScenePosition(progress:Float):OrderScenePosition{
 val p=progress.coerceIn(0f,1f)
 fun segment(a:Float,b:Float)=((p-a)/(b-a)).coerceIn(0f,1f)
 val loaded=segment(.22f,.45f);val lift=segment(.08f,.22f)
 val retreat=segment(.52f,.75f)
 return OrderScenePosition(290f*segment(.60f,1f),-140f*(1-loaded),28f*(1-lift),140f*loaded*(1-retreat),-28f*lift*(1-retreat))
}

@Composable internal fun LoadingSceneTheme(dark:Boolean=isSystemInDarkTheme(),content:@Composable ()->Unit){
 MaterialTheme(colorScheme=if(dark)darkColorScheme(background=Color(0xFF111F2E),surface=Color(0xFF111F2E),onSurface=Color(0xFFE2EDF5),onSurfaceVariant=Color(0xFFB4C7D3),primary=Color(0xFF61BDCF))else lightColorScheme(background=Color(0xFFF8FAFC),surface=Color.White,onSurface=Color(0xFF274759),onSurfaceVariant=Color(0xFF64748B),primary=Color(0xFF1684A0)),content=content)
}

@Composable internal fun LoadingSceneLogo(modifier:Modifier=Modifier){
 val dark=MaterialTheme.colorScheme.background.luminance()<.5f
 androidx.compose.foundation.Image(painterResource(if(dark)R.drawable.zzws_loading_logo_dark else R.drawable.zzws_loading_logo),contentDescription="ZIGZAG",modifier=modifier.testTag(if(dark)"loading-logo-dark"else"loading-logo-light"))
}

@Composable internal fun CatalogueLoadingScene(reducedMotion:Boolean = !ValueAnimator.areAnimatorsEnabled()){
 val phase=if(reducedMotion)0f else {
  val transition=rememberInfiniteTransition(label="catalogue-loading")
  transition.animateFloat(0f,1f,infiniteRepeatable(tween(2800,easing=LinearEasing)),label="warehouse-to-catalogue").value
 }
 Box(Modifier.fillMaxWidth().aspectRatio(900f/310f).testTag("session-restoring-progress").semantics{progressBarRangeInfo=ProgressBarRangeInfo.Indeterminate}){
  LoadingSceneCanvas(false,phase,Modifier.fillMaxSize(),static=reducedMotion)
 }
}

@Composable internal fun OrderPreparationScene(onComplete:()->Unit,reducedMotion:Boolean = !ValueAnimator.areAnimatorsEnabled()){
 val progress=remember{Animatable(0f)}
 val complete by rememberUpdatedState(onComplete)
 LaunchedEffect(reducedMotion){
  if(!reducedMotion)progress.animateTo(1f,tween(4400,easing=LinearEasing))
  complete()
 }
 if(!reducedMotion)Dialog(onDismissRequest={complete()},properties=DialogProperties(usePlatformDefaultWidth=false)){
  LoadingSceneTheme{
   Surface(Modifier.padding(12.dp).widthIn(max=800.dp).fillMaxWidth().testTag("order-preparation-scene"),shape=MaterialTheme.shapes.extraLarge,color=MaterialTheme.colorScheme.surface){
    Column(Modifier.verticalScroll(rememberScrollState()).padding(horizontal=14.dp,vertical=24.dp),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.spacedBy(20.dp)){
     LoadingSceneLogo(Modifier.width(198.dp).height(46.dp))
     LocalizedText(ORDER_PREPARATION_TITLE,fontSize=20.sp,fontWeight=FontWeight.Bold,textAlign=TextAlign.Center)
     LoadingSceneCanvas(true,progress.value,Modifier.fillMaxWidth().aspectRatio(900f/310f))
     LocalizedText(ORDER_SCENE_NOTE,fontSize=12.sp,textAlign=TextAlign.Center,color=MaterialTheme.colorScheme.onSurfaceVariant)
     OutlinedButton(onClick={complete()}){LocalizedText("Շարունակել")}
    }
   }
  }
 }
}

@Composable internal fun LoadingSceneCanvas(order:Boolean,phase:Float,modifier:Modifier=Modifier,static:Boolean=false){
 val dark=MaterialTheme.colorScheme.background.luminance()<.5f
 val surface=if(dark)Color(0xFF203445)else Color.White
 val line=if(dark)Color(0xFF6C929E)else Color(0xFFA7C1C9)
 val soft=if(dark)Color(0xFF283F4E)else Color(0xFFE7F1F2)
 val ink=if(dark)Color(0xFF61BDCF)else Color(0xFF287D94)
 Canvas(modifier.testTag(if(order)"order-loading-canvas"else"catalogue-loading-canvas")){
  scale(size.width/900f,size.height/310f,pivot=Offset.Zero){
   drawRect(if(dark)Color(0xFF182C3B)else Color(0xFFF0F8F9),size=Size(900f,310f))
   fun rect(x:Float,y:Float,w:Float,h:Float,color:Color,r:Float=0f,border:Color?=null){drawRoundRect(color,Offset(x,y),Size(w,h),CornerRadius(r));if(border!=null)drawRoundRect(border,Offset(x,y),Size(w,h),CornerRadius(r),style=Stroke(2f))}
   fun line(x:Float,y:Float,x2:Float,y2:Float,color:Color,width:Float=3f){drawLine(color,Offset(x,y),Offset(x2,y2),width,StrokeCap.Round)}
   fun polygon(points:List<Offset>,color:Color){drawPath(Path().apply{moveTo(points[0].x,points[0].y);points.drop(1).forEach{lineTo(it.x,it.y)};close()},color)}
   fun fridge(x:Float,y:Float){rect(x,y,44f,66f,surface,5f,line);line(x+3,y+31,x+41,y+31,line,2f);line(x+34,y+9,x+34,y+23,line);line(x+34,y+40,x+34,y+57,line)}
   fun washer(x:Float,y:Float){rect(x,y,48f,55f,surface,5f,line);drawCircle(Color(0xFFBFE5EB),15f,Offset(x+24,y+32));drawCircle(line,15f,Offset(x+24,y+32),style=Stroke(2f))}
   fun tv(x:Float,y:Float){rect(x,y,62f,41f,Color(0xFFBFE5EB),4f,line);line(x+31,y+42,x+31,y+51,line);line(x+17,y+51,x+45,y+51,line)}
   drawRect(soft,Offset(0f,245f),Size(900f,65f))
   rect(32f,83f,225f,162f,surface,border=line)
   polygon(listOf(Offset(20f,83f),Offset(44f,57f),Offset(245f,57f),Offset(270f,83f)),soft)
   line(53f,139f,237f,139f,line,5f);line(53f,202f,237f,202f,line,5f)
   rect(65f,104f,40f,31f,Color(0xFFE9B460),3f);rect(174f,104f,45f,31f,Color(0xFFE9B460),3f);rect(118f,166f,43f,32f,Color(0xFFE9B460),3f)
   if(!order){
    drawLine(Color(0xFF68B9C9),Offset(200f,165f),Offset(545f,165f),4f,pathEffect=PathEffect.dashPathEffect(floatArrayOf(3f,12f)))
    rect(540f,58f,325f,182f,surface,15f,line);line(559f,88f,846f,88f,line,5f)
    for(x in listOf(560f,660f,760f))rect(x,108f,86f,108f,soft,7f)
    fridge(581f,123f);washer(679f,130f);tv(772f,133f)
    if(!static)for(i in 0..2){val p=(phase+i/3f)%1f;if(p in .04f.. .90f){val moving=((p-.04f)/.82f).coerceIn(0f,1f);val x=175f+406f*moving;val y=154f-31f*moving;when(i){0->fridge(x,y);1->washer(x,y);else->tv(x,y)}}}
   }else{
    val motion=orderScenePosition(phase)
    polygon(listOf(Offset(760f,150f),Offset(820f,103f),Offset(880f,150f)),soft);rect(771f,150f,98f,115f,surface,border=line);rect(786f,171f,25f,29f,Color(0xFFBFE5EB),3f);rect(828f,171f,25f,29f,Color(0xFFBFE5EB),3f)
    drawLine(line,Offset(0f,278f),Offset(900f,278f),5f,pathEffect=PathEffect.dashPathEffect(floatArrayOf(24f,16f)))
    // A single parent transform carries both the truck and its loaded refrigerator.
    translate(340f+motion.truck,160f){
     rect(0f,0f,180f,95f,surface,7f,ink);polygon(listOf(Offset(180f,27f),Offset(223f,27f),Offset(254f,62f),Offset(254f,95f),Offset(180f,95f)),Color(0xFF1684A0));polygon(listOf(Offset(190f,37f),Offset(217f,37f),Offset(237f,61f),Offset(190f,61f)),Color(0xFFBFE5EB));rect(0f,80f,180f,15f,Color(0xFF1684A0))
     fridge(35f+motion.cargoX,5f+motion.cargoY)
     for(x in listOf(37f,171f,229f)){drawCircle(Color(0xFF294959),16f,Offset(x,100f));drawCircle(line,16f,Offset(x,100f),style=Stroke(3f))}
    }
    translate(155f+motion.forklift,245f){
     rect(0f,-30f,53f,35f,Color(0xFFF1C15F),border=Color(0xFFBD8D35));polygon(listOf(Offset(9f,-30f),Offset(9f,-73f),Offset(39f,-73f),Offset(52f,-30f)),Color(0xFFF1C15F))
     line(56f,-94f,56f,13f,line,5f);line(64f,-94f,64f,13f,line,5f);line(57f,14f+motion.lift,127f,14f+motion.lift,line,5f)
     for(x in listOf(9f,44f))drawCircle(Color(0xFF294959),10f,Offset(x,9f))
    }
   }
  }
 }
}
