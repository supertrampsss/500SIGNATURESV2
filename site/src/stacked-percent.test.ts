import assert from "node:assert/strict";
import { test } from "node:test";
import { stackedPercent } from "./stacked-percent.ts";
const composition = { partLabel: "Retraites", remainderLabel: "Autres crédits" };
test("la composition conserve une échelle fixe et des proportions accessibles approximatives", () => {
 const html=stackedPercent([{label:"Défense",value:12.2},{label:"Culture & patrimoine",value:.3}],composition);
 assert.match(html,/width:12.2%/);assert.match(html,/width:87.8%/);
 assert.match(html,/environ 12,2 %/);assert.match(html,/moins de 1 %/);
 assert.match(html,/Culture &amp; patrimoine/);
 for(const tick of [0,25,50,75,100]) assert.ok(html.includes(`<span>${tick} %</span>`));
});
test("les proportions invalides ne deviennent pas des barres",()=>{
 for(const value of [-1,101,NaN,Infinity]) assert.throws(()=>stackedPercent([{label:"Test",value}],composition),RangeError);
});
