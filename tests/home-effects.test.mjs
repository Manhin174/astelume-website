import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {countAt} from '../src/home-effects.js';

test('The displayed count starts at zero, increases without overshoot, and ends at its exact authored target',()=>{
  for (const goal of [10,50,100]) {
    assert.equal(countAt(goal,-16),0); assert.equal(countAt(goal,0),0);
    assert.equal(countAt(goal,600),Math.floor(goal*.75));
    const frames=Array.from({length:76},(_,n)=>countAt(goal,n*16));
    assert.ok(frames.every((v,i)=>Number.isInteger(v)&&v<=goal&&(!i||v>=frames[i-1])));
    assert.equal(frames.at(-1),goal); assert.equal(countAt(goal,2000),goal);
  }
});
test('Without JavaScript the four complete non-link numbers and labels still exist',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const list=html.match(/<dl class="guide-facts">([\s\S]*?)<\/dl>/)[1];
  assert.deepEqual([...list.matchAll(/<dt>([^<]+)<\/dt><dd>(\d+\+)<\/dd>/g)].map(m=>[m[1],m[2]]),[
    ['上游服务适配','50+'],['模型计费支持','100+'],['兼容 API 路由','50+'],['调度控制能力','10+']]);
  assert.doesNotMatch(list,/<a\b|<button|tabindex|aria-live/);
});
