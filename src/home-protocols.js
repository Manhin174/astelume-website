// Display-only protocol samples. A tab switch or copy never contacts a model or accepts a real key.
const message = {role: 'user', content: '你好！'};
const key = '${ASTELUME_API_KEY}';
export const examples = Object.freeze({
  chat: {name:'Chat', path:'/v1/chat/completions', auth:[`Authorization: Bearer ${key}`], body:{model:'YOUR_MODEL_ID',messages:[message]}, response:{choices:[{message:{role:'assistant',content:'你好！'}}]}},
  responses: {name:'Responses', path:'/v1/responses', auth:[`Authorization: Bearer ${key}`], body:{model:'YOUR_MODEL_ID',input:'你好！'}, response:{output:[{type:'message',content:[{type:'output_text',text:'你好！'}]}]}},
  claude: {name:'Claude', path:'/v1/messages', auth:[`x-api-key: ${key}`,'anthropic-version: 2023-06-01'], body:{model:'YOUR_MODEL_ID',max_tokens:128,messages:[message]}, response:{content:[{type:'text',text:'你好！'}]}},
  gemini: {name:'Gemini', path:'/v1beta/models/YOUR_MODEL_ID:generateContent', auth:[`x-goog-api-key: ${key}`], body:{contents:[{role:'user',parts:[{text:'你好！'}]}]}, response:{candidates:[{content:{role:'model',parts:[{text:'你好！'}]}}]}}
});
const compact = value => JSON.stringify(value).replace(/":/g,'": ').replace(/,"/g,', "');
export const bodyPreview = body => '{\n'+Object.entries(body).map(([k,v])=>'  '+JSON.stringify(k)+': '+compact(v)).join(',\n')+'\n}';
export function curlExample(id) {
  if(!Object.hasOwn(examples,id))throw new TypeError('Unknown protocol');
  const e=examples[id], lines=[`curl -X POST "https://astelume.cc.cd${e.path}"`,...['Content-Type: application/json',...e.auth].map(h=>`  -H "${h}"`),`  -d '${bodyPreview(e.body)}'`];
  return lines.join(' \\\n');
}
function highlight(el,text) {
  const tokens=text.split(/("(?:[^"\\]|\\.)*"(?=\s*:)|"(?:[^"\\]|\\.)*"|\b\d+\b)/g),frag=document.createDocumentFragment();let index=0;
  for(const t of tokens){if(!t)continue;const end=index+t.length;if(t.startsWith('"')||/^\d+$/.test(t)){const span=document.createElement('span');span.className=t.startsWith('"')?(/^\s*:/.test(text.slice(end))?'code-key':'code-string'):'code-number';span.textContent=t;frag.append(span);}else frag.append(document.createTextNode(t));index=end;}el.replaceChildren(frag);
}
export function mountProtocols(root) {
  const buttons=[...root.querySelectorAll('[role="tab"]')],pane=root.querySelector('[role="tabpanel"]'),path=root.querySelector('[data-example-path]'),body=root.querySelector('[data-example-body]'),response=root.querySelector('[data-example-response]'),copy=root.querySelector('[data-copy-example]'),notice=root.querySelector('[data-copy-notice]'),manual=root.querySelector('[data-manual-copy]');let active;
  function choose(button,focus=false){const id=button.dataset.protocol,e=examples[id];active=id;for(const b of buttons){b.setAttribute('aria-selected',String(b===button));b.tabIndex=b===button?0:-1;}pane.setAttribute('aria-labelledby',button.id);path.textContent=e.path;highlight(body,bodyPreview(e.body));highlight(response,bodyPreview(e.response));notice.textContent='';manual.hidden=true;manual.value='';if(focus)button.focus();}
  for(const [i,b] of buttons.entries()){b.addEventListener('click',()=>choose(b));b.addEventListener('keydown',event=>{let j;switch(event.key){case 'ArrowRight':j=(i+1)%buttons.length;break;case 'ArrowLeft':j=(i+buttons.length-1)%buttons.length;break;case 'Home':j=0;break;case 'End':j=buttons.length-1;break;default:return;}event.preventDefault();choose(buttons[j],true);});}
  copy.addEventListener('click',async()=>{const id=active,text=curlExample(id);try{await navigator.clipboard.writeText(text);if(id===active)notice.textContent='已复制 '+examples[id].name+' 示例';}catch{if(id!==active)return;manual.value=text;manual.hidden=false;manual.focus();manual.select();notice.textContent='请手动复制已选中的命令。';}});
  choose(buttons.find(b=>b.getAttribute('aria-selected')==='true')||buttons[0]);
}
