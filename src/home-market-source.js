// The visitor may use only the reviewed same-origin projection, never the raw market API.
export function homeMarketSource(loc=location, request=fetch) {
  if(loc.origin!=='https://astelume.cc.cd' && !(loc.protocol==='http:' && loc.hostname==='127.0.0.1'))return undefined;
  let nextAttempt=0;
  return {canRead:()=>Date.now()>=nextAttempt,nextAttemptAt:()=>nextAttempt,minimumRefreshMs:55_000,
    async read({signal}){
      if(Date.now()<nextAttempt) throw new Error('Market cooling down');
      const url=new URL('/astelume/live-group-quotes',loc.origin);
      const response=await request(url,{method:'GET',mode:'same-origin',credentials:'omit',redirect:'error',cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(52000)]),headers:{Accept:'application/json'}});
      if(!response.ok){const h=response.headers.get('retry-after');const wait=h&&/^\d+$/.test(h)?Number(h)*1000:60_000;nextAttempt=Date.now()+Math.max(60000,wait);throw new Error('No verified group prices');}
      if(!/^application\/json\b/i.test(response.headers.get('content-type')||''))throw new Error('Unexpected quote type');
      return await response.json();
    }};
}
