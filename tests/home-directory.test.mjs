import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readDirectory,showDirectory} from '../src/home-directory.js';
const now=Date.UTC(2026,10,22,11);
const packet=models=>({schemaVersion:1,kind:'public-model-directory',source:'https://astelume.cc.cd/pricing',observedAt:new Date(now).toISOString(),validUntil:new Date(now+300000).toISOString(),models});
const fixture=pairs=>pairs.map(([name,brand])=>({name,brand}));
const rows=fixture([['gpt-sample','OpenAI'],['claude-sample','Anthropic'],['gemini-sample','Google'],['grok-sample','xAI'],['deepseek-sample','DeepSeek'],['qwen3-sample','Alibaba'],['Qwen3-SAMPLE','阿里巴巴'],['glm-sample','Z.AI'],['chatglm-sample','智谱'],['minimax-m2-test','MiniMax (minimax.cn)'],['MiniMax-M3-sample','MiniMax'],['kimi-sample','Moonshot AI']]);
const rejected=fixture([['gemini-4-argon-sample','Gemini 4 argon'],['gpt-nobrand',null],['qwen-test','unreviewed'],['unrelated','Alibaba'],['gpt-other','Google'],['qwenish','Alibaba'],['minimax-music','MiniMax'],['unknown','MiniMax (other.invalid)'],['imagen-sample','Google'],['whisper-sample','OpenAI']]);
const titles=['GPT','Claude','Gemini','Grok','DeepSeek','Qwen','GLM','MiniMax M 系列','Kimi'];
const marks=[['openai-black.svg','openai-white.svg'],['claude.svg'],['gemini.png'],['grok.jpg'],['deepseek.png'],['qwen-47a769cd.png'],['glm-79d08d48.png'],['minimax-94944f81.png'],['kimi-08380815.png']];
const project=rs=>readDirectory(packet(rs),now).families;
test('Require both official owner and model family; merge aliases without manufacturing extra or missing families',()=>{
  const actual=project([...rows,...rejected].reverse());assert.deepEqual(actual.map(b=>b.family.name),titles);assert.deepEqual(actual.map(b=>b.family.marks),marks);
  for(const [name,models] of [['Qwen',['qwen3-sample','Qwen3-SAMPLE']],['GLM',['glm-sample','chatglm-sample']],['MiniMax M 系列',['minimax-m2-test','MiniMax-M3-sample']],['Gemini',['gemini-sample']]])assert.deepEqual(actual.find(b=>b.family.name===name).members,new Set(models));
  assert.equal(project(rejected).length,0);assert.equal(project([]).length,0);assert.deepEqual(project([{name:'minimax-m7',brand:'MiniMax（minimax.cn）'}]).map(b=>b.family.name),['MiniMax M 系列']);
});
test('Reject malformed or expired packets even if the family is not displayed',()=>{
  const ok={name:'a',brand:'unknown'};for(const v of [packet([ok,ok]),packet([{...ok,price:1}]),packet([{...ok,brand:'<script>'}]),packet([{...ok,name:'bad\nname'}]),{...packet([ok]),secret:'x'},{...packet([ok]),source:'https://example.invalid/pricing'},{...packet([ok]),validUntil:new Date(now+300001).toISOString()}])assert.throws(()=>readDirectory(v,now));assert.throws(()=>readDirectory(packet([ok]),now+300000));assert.throws(()=>readDirectory(packet([ok]),now-1));
});
class E{constructor(tag){this.tag=tag;this.children=[];this.classList={add:n=>{this.className+=' '+n;}};}setAttribute(k,v){this[k]=v;}append(...xs){this.children.push(...xs);}replaceChildren(...xs){this.children=xs;}}
const walk=x=>[x,...x.children.flatMap(walk)];
test('Each passive card gets the exact family mark, no model IDs or manufacturer labels, with at most two eligible groups',async()=>{
  const prev=globalThis.document;globalThis.document={createElement:t=>new E(t)};
  try {
    const grid=new E('ul');const update=showDirectory(grid,project([...rows,...rejected]));
    update([{model:'qwen3-sample',group:'A組'},{model:'Qwen3-SAMPLE',group:'B組'},{model:'qwen3-sample',group:'A組'},{model:'qwen3-sample',group:'C組'},{model:'gemini-sample',group:'ＧＥＭＩＮＩ－４ argon'},{model:'gemini-sample',group:'gemini 4'},{model:'gemini-sample',group:'gemini'},{model:'gemini-4-argon-sample',group:'wrong label'},{model:'unrelated',group:'wrong product'},{model:'gpt-nobrand',group:'wrong owner'},{model:'claude-sample',group:'<bad>'}]);
    const parts=walk(grid),chips=c=>walk(c).filter(x=>x.className==='brand-chip').map(x=>x.textContent);
    const card=name=>grid.children.find(el=>walk(el).some(n=>n.tag==='h3'&&n.textContent===name));
    assert.deepEqual(parts.filter(n=>n.tag==='h3').map(n=>n.textContent),titles);assert.deepEqual(chips(card('Qwen')),['A組','B組']);assert.deepEqual(chips(card('Gemini')),['gemini']);assert.deepEqual(chips(card('Claude')),[]);
    assert.ok(parts.every(x=>['ul','li','p','span','div','h3','img'].includes(x.tag)&&x.tabIndex===undefined&&!x.title));assert.equal(parts.filter(x=>x.tag==='ul').length,1);assert.equal(parts.filter(x=>x.tag==='li').length,9);
    assert.ok(parts.every(x=>![...rows,...rejected].some(r=>r.name===x.textContent)));assert.ok(parts.every(x=>!['directory-names','directory-model','directory-number','text-mark'].includes(x.className)));
    for(const [i,title] of titles.entries()){const images=walk(card(title)).filter(x=>x.tag==='img');assert.deepEqual(images.map(el=>el.src),marks[i].map(n=>'/astelume/marks/'+n));for(const el of images){assert.equal(el.alt,'');assert.ok((await readFile(new URL('../public'+el.src,import.meta.url))).length>100);}}
    update([]);assert.deepEqual(walk(grid).filter(x=>x.className==='brand-chip'),[]);assert.equal(grid.children.length,9);
  }finally{if(prev)globalThis.document=prev;else delete globalThis.document;}
});
