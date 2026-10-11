import { Engine } from '/workspace/500SIGNATURESV2/site/node_modules/@babylonjs/core/Engines/engine';
import { Scene } from '/workspace/500SIGNATURESV2/site/node_modules/@babylonjs/core/scene';
import { ArcRotateCamera } from '/workspace/500SIGNATURESV2/site/node_modules/@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '/workspace/500SIGNATURESV2/site/node_modules/@babylonjs/core/Maths/math.vector';
import { HemisphericLight } from '/workspace/500SIGNATURESV2/site/node_modules/@babylonjs/core/Lights/hemisphericLight';
import { buildLandscape, landHeight } from '/workspace/500SIGNATURESV2/site/src/mandats/map-landscape.ts';
import { buildCities } from '/workspace/500SIGNATURESV2/site/src/mandats/map-cities.ts';
import { loadAssetKit } from '/workspace/500SIGNATURESV2/site/src/mandats/map-asset-kit.ts';
import { MODEL_URLS } from '/workspace/500SIGNATURESV2/site/src/mandats/map-model-revisions.ts';
import '/workspace/500SIGNATURESV2/site/node_modules/@babylonjs/core/Shaders/default.vertex';
import '/workspace/500SIGNATURESV2/site/node_modules/@babylonjs/core/Shaders/default.fragment';
import '/workspace/500SIGNATURESV2/site/node_modules/@babylonjs/core/Shaders/pbr.vertex';
import '/workspace/500SIGNATURESV2/site/node_modules/@babylonjs/core/Shaders/pbr.fragment';
const canvas = document.querySelector('canvas')!;
const engine = new Engine(canvas, true);
const scene = new Scene(engine);
const camera = new ArcRotateCamera('probe',-.9,.9,1.8,Vector3.Zero(),scene);
new HemisphericLight('probe-light',new Vector3(-1,2,-1),scene).intensity=1;
const report:any={purpose:'Same source builders and distributed GLB, isolated scene; separate from native game captures.',models:MODEL_URLS,houses:[]};
try {
 await buildLandscape(scene);
 await buildCities(scene);
 const houses=scene.transformNodes.filter(n=>n.metadata?.domestic&&n.metadata.asset==='maison_alsace_01');
 if(!houses.length)throw Error('No adopted house in the real city builder');
 report.totalHouses=scene.metadata.authoredUrban.houses;
 for(const root of houses){
  const parts=root.getChildMeshes().filter(m=>m.getTotalVertices()>0);
  if(parts.length!==1)throw Error('House surface count changed');
  root.computeWorldMatrix(true);
  const part:any=parts[0];part.computeWorldMatrix(true);
  const lod=part.sourceMesh.getLODLevels();
  if(lod.length!==1||!lod[0].mesh||lod[0].mesh===part.sourceMesh)throw Error('Distant house not paired');
  if(lod[0].mesh.material===part.sourceMesh.material)throw Error('Probe did not exercise different atlases');
  const bottom=part.getBoundingInfo().boundingBox.minimumWorld.y;
  const positions=part.getVerticesData('position'),world=root.getWorldMatrix(),samples=[];
  const minX=Math.min(...Array.from({length:positions.length/3},(_,i)=>positions[i*3])),
    maxX=Math.max(...Array.from({length:positions.length/3},(_,i)=>positions[i*3]));
  const minZ=Math.min(...Array.from({length:positions.length/3},(_,i)=>positions[i*3+2])),
    maxZ=Math.max(...Array.from({length:positions.length/3},(_,i)=>positions[i*3+2]));
  for(let i=0;i<=8;i++)for(let j=0;j<=8;j++){
   const p=Vector3.TransformCoordinates(new Vector3(minX+(maxX-minX)*i/8,0,minZ+(maxZ-minZ)*j/8),world);
   samples.push(landHeight(p.x,p.z));
  }
  const maxGround=Math.max(...samples),minGround=Math.min(...samples),clearance=bottom-maxGround;
  if(clearance<-.0001)throw Error('Adopted house penetrates its surveyed terrain');
  if(clearance>.010)throw Error('Adopted house floats above its surveyed footprint');
  const location=root.getAbsolutePosition().asArray();
  camera.target=Vector3.FromArray(location);camera.radius=25;camera.getViewMatrix(true);
  const far=part.sourceMesh.getLOD(camera,part.getBoundingInfo().boundingSphere);
  camera.radius=.15;camera.getViewMatrix(true);
  const near=part.sourceMesh.getLOD(camera,part.getBoundingInfo().boundingSphere);
  if(far!==lod[0].mesh||near!==part.sourceMesh)throw Error('Actual camera LoD switch failed');
  report.houses.push({name:root.name,frontage:root.metadata.frontage,town:root.metadata.town,location,
    surfaces:parts.length,detailIndices:part.getTotalIndices(),distantIndices:lod[0].mesh.getTotalIndices(),
    bottom,maxGround,minGround,clearance,far:far.name,near:near.name});
 }
 // A diagnostic model board, distinct from the game. It makes both actual
 // imported materials visible without changing the city's saved placements.
 for(const mesh of scene.meshes)mesh.setEnabled(false);
 for(const root of scene.transformNodes)root.setEnabled(false);
 const kit=await loadAssetKit(scene,MODEL_URLS.architecture);
 const close=kit.instantiate('maison_alsace_01');
 close.root.scaling.setAll(.5);close.root.position.x=-.38;
 const low=kit.instantiate('maison_alsace_01_distant');
 low.root.scaling.setAll(.5);low.root.position.x=.38;
 camera.setTarget(new Vector3(0,.28,0));camera.radius=1.9;camera.alpha=-1.12;camera.beta=1.03;
 scene.render();
 await scene.whenReadyAsync();scene.render();
 report.status='placement-and-camera-lod-passed';
 (window as any).report=report;
 document.querySelector('p')!.textContent='Détail à gauche, distance à droite. Diagnostic 3D hors du jeu.';
}catch(error){(window as any).report={...report,status:'failed',error:String(error)};throw error;}
