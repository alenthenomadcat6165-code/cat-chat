import {getModeratorStatus,runModeratorSweep} from '../../lib/moderator';

const protocolVersion='2026-07-28';
type RpcRequest={jsonrpc?:unknown;id?:unknown;method?:unknown;params?:{name?:unknown}};
const tools=[
 {name:'moderate_chat_now',description:'Run the Cat Chat automatic safety moderator. It checks recent visible messages for profanity, bullying, threats, spam, unsafe scripts, and hacking payloads, then removes violations using fixed server-side rules.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'get_moderator_status',description:'Read the most recent Cat Chat automatic moderator result without exposing message content or account details.',inputSchema:{type:'object',properties:{},additionalProperties:false}}
];

function reply(id:unknown,result:unknown,status=200){return Response.json({jsonrpc:'2.0',id:id??null,result},{status})}
function failure(id:unknown,code:number,message:string,status=400){return Response.json({jsonrpc:'2.0',id:id??null,error:{code,message}},{status})}

export async function POST(request:Request){
 let body:RpcRequest;
 try{body=await request.json() as RpcRequest}catch{return failure(null,-32700,'Parse error')}
 if(body?.jsonrpc!=='2.0'||typeof body?.method!=='string')return failure(body?.id,-32600,'Invalid request');
 if(body.method==='server/discover')return reply(body.id,{supportedVersions:[protocolVersion],capabilities:{tools:{}}});
 if(body.method==='tools/list')return reply(body.id,{tools});
 if(body.method==='tools/call'){
  const name=body.params?.name;
  if(!tools.some(tool=>tool.name===name))return failure(body.id,-32601,'Tool not found',404);
  try{
   const data=name==='moderate_chat_now'?await runModeratorSweep():await getModeratorStatus();
   return reply(body.id,{content:[{type:'text',text:JSON.stringify(data??{lastRunAt:null,summary:'The moderator has not run yet.'})}]});
  }catch(error){return reply(body.id,{content:[{type:'text',text:error instanceof Error?error.message:'The moderator could not run.'}],isError:true},500)}
 }
 return failure(body.id,-32601,'Method not found',404);
}
