const http=require('http');
http.createServer((q,r)=>{let b='';q.on('data',d=>b+=d);q.on('end',()=>{
 const body=b?JSON.parse(b):{};
 if(!q.url.includes('chat/completions')){r.writeHead(200,{'content-type':'application/json'});return r.end(JSON.stringify({data:[{id:'fake',object:'model'}]}));}
 const msg={role:'assistant',content:'hello from fake'};
 if(body.stream){r.writeHead(200,{'content-type':'text/event-stream'});
  r.write('data: '+JSON.stringify({id:'1',object:'chat.completion.chunk',model:'fake',choices:[{index:0,delta:msg,finish_reason:null}]})+'\n\n');
  r.write('data: '+JSON.stringify({id:'1',object:'chat.completion.chunk',model:'fake',choices:[{index:0,delta:{},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}})+'\n\n');
  r.end('data: [DONE]\n\n');}
 else{r.writeHead(200,{'content-type':'application/json'});r.end(JSON.stringify({id:'1',object:'chat.completion',model:'fake',choices:[{index:0,message:msg,finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}}));}
});}).listen(18080);
