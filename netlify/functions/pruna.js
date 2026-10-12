const MODELS = new Set(['p-image','p-image-ideogram','p-image-edit','p-image-upscale','p-image-try-on','p-video','p-video-2','p-video-2-pro','p-video-edit','p-video-animate','p-video-replace','p-video-avatar']);
const json = (statusCode,data) => ({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(data)});
exports.handler = async function(event) {
 if(event.httpMethod!=='POST')return json(405,{error:'Metodo non consentito'});
 const headers=Object.fromEntries(Object.entries(event.headers||{}).map(([k,v])=>[k.toLowerCase(),v]));
 const key=headers['x-pruna-key'];if(!key)return json(401,{error:'API Key mancante'});
 const model=headers['x-pruna-model']||'p-image';const check=headers['x-pruna-check-url'];let url='https://api.pruna.ai/v1/predictions',body;
 if(check){try{const u=new URL(check,'https://api.pruna.ai');if(u.origin!=='https://api.pruna.ai'||u.username||u.password||!/^\/v1\/predictions\/status\/[A-Za-z0-9_-]+$/.test(u.pathname)||u.search||u.hash)throw Error();url=u.href;}catch{return json(400,{error:'URL di stato non consentito'});}}
 else {if(!MODELS.has(model))return json(400,{error:'Modello non supportato'});try{body=JSON.parse(event.body||'');if(!body.input||typeof body.input!=='object'||Array.isArray(body.input))throw Error();body=JSON.stringify({input:body.input});}catch{return json(400,{error:'Payload non valido'});}}
 try{const response=await fetch(url,{method:check?'GET':'POST',headers:{apikey:key,...(!check?{'Content-Type':'application/json',Model:model,'Try-Sync':'false'}:{})},body:check?undefined:body,redirect:'error',signal:AbortSignal.timeout(25000)});const data=await response.json();return json(response.status,data);}catch{return json(502,{error:'Pruna non risponde. Se la richiesta era già stata inviata, verifica la dashboard prima di riprovare.'});}
};
