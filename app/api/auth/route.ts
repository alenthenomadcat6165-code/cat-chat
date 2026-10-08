import {env} from 'cloudflare:workers';
import {bytes,clearSession,hash,json,me,session,setup} from '../../../lib/store';

export async function GET(){await setup();return json({user:await me()})}

export async function POST(req:Request){
 await setup();
 const b=await req.json() as {action:string;username?:string;name?:string;password?:string;remember?:boolean};
 if(b.action==='logout')return json({ok:true},200,{'Set-Cookie':clearSession()});
 const username=(b.username??'').trim().toLowerCase(),password=b.password??'';
 if(!/^[a-z0-9._-]{3,20}$/.test(username))return json({error:'Use 3–20 letters, numbers, dots, dashes, or underscores.'},400);
 if(password.length<8)return json({error:'Password needs at least 8 characters.'},400);
 let user:any;
 if(b.action==='register'){
  const name=(b.name??'').trim();
  if(name.length<2||name.length>30)return json({error:'Enter a display name.'},400);
  const salt=bytes(16),passwordHash=await hash(password,salt);
  try{
   const role='member';
   const result=await env.DB.prepare('INSERT INTO users(username,name,password_hash,salt,role,created_at) VALUES(?,?,?,?,?,?)').bind(username,name,passwordHash,salt,role,Date.now()).run();
   user={id:Number(result.meta.last_row_id),username,name,avatarKey:null,role,banned:0};
  }catch{return json({error:'That username is already used.'},409)}
 }else{
  const row=await env.DB.prepare('SELECT id,username,name,avatar_key AS avatarKey,role,banned,account_status AS accountStatus,suspended_until AS suspendedUntil,password_hash AS passwordHash,salt FROM users WHERE username=?').bind(username).first<any>();
  if(!row||await hash(password,row.salt)!==row.passwordHash)return json({error:'Username or password is wrong.'},401);
  if(row.accountStatus==='suspended'&&row.suspendedUntil&&row.suspendedUntil<=Date.now()){await env.DB.prepare("UPDATE users SET account_status='active',suspended_until=NULL WHERE id=?").bind(row.id).run();row.accountStatus='active';row.suspendedUntil=null}
  if(row.banned||row.accountStatus==='banned')return json({error:'This account has been banned.'},403);
  if(row.accountStatus==='paused')return json({error:'This account is paused. Ask a staff member for help.'},403);
  if(row.accountStatus==='suspended')return json({error:`This account is suspended until ${new Date(row.suspendedUntil).toLocaleString()}.`},403);
  user={id:row.id,username:row.username,name:row.name,avatarKey:row.avatarKey,role:row.role,banned:row.banned,accountStatus:row.accountStatus,suspendedUntil:row.suspendedUntil};
 }
 const token=bytes();
 await env.DB.prepare('INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)').bind(token,user.id,Date.now()+2592000000).run();
 return json({user},200,{'Set-Cookie':session(token,!!b.remember)});
}
