import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placePresidencyLabels } from './presidency-board-layout.ts';
test('nearby map labels separate with measured dimensions before a dock',()=>{
 const points=[{x:650,y:40},{x:550,y:80},{x:830,y:190},{x:900,y:100},{x:307,y:124},{x:480,y:224}];
 const boxes=placePresidencyLabels(points.map(p=>({...p,width:160,height:44})),820,450);
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j]; assert.ok(a.x+a.width+6<=b.x||b.x+b.width+6<=a.x||a.y+a.height+6<=b.y||b.y+b.height+6<=a.y);}
 for(const b of boxes) assert.ok(b.x>=8&&b.y>=8&&b.x+b.width<=812&&b.y+b.height<=442);
});
