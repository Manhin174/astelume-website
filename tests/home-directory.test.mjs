import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readDirectory,showDirectory} from '../src/home-directory.js';
const now=Date.UTC(2026,10,22,11);
const packet=models=>({schemaVersion:1,kind:'public-model-directory',source:'https://astelume.cc.cd/pricing',observedAt:new Date(now).toISOString(),validUntil:new Date(now+300000).toISOString(),models});
const rows=[['one','OpenAI'],['two','Anthropic'],['three','Google'],['four','xAI'],['five','DeepSeek'],['q','Alibaba'],['Q','阿里巴巴'],['g','Z.AI'],['G','智谱'],['m','MiniMax (minimax.cn)'],['M','MiniMax'],['k','Moonshot AI'],['x','Gemini 4 argon'],['z',null],['q2','Alibaba reseller'],['m2','MiniMax (other.invalid)'],['gpt-invented',null]].map(([name,brand])=>({name,brand}));
const project=rs=>readDirectory(packet(rs),now).brands;
test('Only present official manufacturers appear; exact aliases share a card, never classify by model prefix',()=>{
  const actual=project(rows);assert.deepEqual(actual.map(b=>b.maker.name),['OpenAI','Anthropic','Google','xAI','DeepSeek','阿里巴巴','智谱','MiniMax','Moonshot AI']);
  for(const [name,models] of [['阿里巴巴',['q','Q']],['智谱',['g','G']],['MiniMax',['m','M']],['Google',['three']]])assert.deepEqual([...actual.find(b=>b.maker.name===name).members],models);
  assert.equal(project([{name:'gpt-x',brand:'unlabelled'},{name:'gemini-4-test',brand:'Gemini 4 argon'},{name:'mini',brand:null}]).length,0);
  assert.equal(project([]).length,0);assert.deepEqual(project([{name:'other',brand:'MiniMax（minimax.cn）'}]).map(b=>b.maker.name),['MiniMax']);
});
test('Reject stale or malformed packets even for non-displayed manufacturers',()=>{
  const ok={name:'a',brand:'unknown'};for(const v of [packet([ok,ok]),packet([{...ok,price:1}]),packet([{...ok,brand:'<script>'}]),packet([{...ok,name:'bad\nname'}]),{...packet([ok]),secret:'x'},{...packet([ok]),source:'https://example.invalid/pricing'},{...packet([ok]),validUntil:new Date(now+300001).toISOString()}])assert.throws(()=>readDirectory(v,now));assert.throws(()=>readDirectory(packet([ok]),now+300000));assert.throws(()=>readDirectory(packet([ok]),now-1));
});
class E{constructor(tag){this.tag=tag;this.children=[];this.classList={add:n=>{this.className+=' '+n;}};}setAttribute(k,v){this[k]=v;}append(...xs){this.children.push(...xs);}replaceChildren(...xs){this.children=xs;}}
const walk=x=>[x,...x.children.flatMap(walk)];
test('Cards render only names, real artwork and at most two current public group examples; missing groups do not remove brands',async()=>{
  const prev=globalThis.document;globalThis.document={createElement:t=>new E(t)};
  try {
    const grid=new E('ul');const update=showDirectory(grid,project(rows));
    update([{model:'q',group:'A組'},{model:'Q',group:'B組'},{model:'Q',group:'A組'},{model:'q',group:'C組'},{model:'three',group:'ＧＥＭＩＮＩ－４ argon'},{model:'three',group:'gemini 4'},{model:'three',group:'gemini'},{model:'x',group:'not from Google'},{model:'missing',group:'Do not show'},{model:'q2',group:'Wrong alias'},{model:'two',group:'<bad>'}]);
    const parts=walk(grid), chips=c=>walk(c).filter(x=>x.className==='brand-chip').map(x=>x.textContent);
    const card=name=>grid.children.find(el=>walk(el).some(n=>n.tag==='h3'&&n.textContent===name));
    assert.equal(grid.children.length,9);assert.deepEqual(chips(card('阿里巴巴')),['A組','B組']);assert.deepEqual(chips(card('Google')),['gemini']);assert.deepEqual(chips(card('Anthropic')),[]);
    assert.ok(parts.every(x=>['ul','li','p','span','div','h3','img'].includes(x.tag)&&x.tabIndex===undefined&&!x.title));
    assert.equal(parts.filter(x=>x.tag==='ul').length,1);assert.equal(parts.filter(x=>x.tag==='li').length,9);
    assert.ok(parts.every(x=>!rows.some(r=>r.name===x.textContent)));assert.ok(parts.every(x=>!['directory-names','directory-model','directory-number','text-mark'].includes(x.className)));
    for(const el of parts.filter(x=>x.tag==='img')){assert.match(el.src,/^\/astelume\/marks\/[\w-]+\.(?:svg|png)$/);assert.equal(el.alt,'');assert.ok((await readFile(new URL('../public'+el.src,import.meta.url))).length>100);}
    update([]);assert.deepEqual(walk(grid).filter(x=>x.className==='brand-chip'),[]);assert.equal(grid.children.length,9);
  }finally{if(prev)globalThis.document=prev;else delete globalThis.document;}
});
