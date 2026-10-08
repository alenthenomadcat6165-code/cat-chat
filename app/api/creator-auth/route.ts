import {env} from 'cloudflare:workers';
import {bytes,hash,json,session,setup} from '../../../lib/store';

export async function POST(req:Request){
 await setup();
 const b=await req.json() as {username?:string;password?:string};
 const username=(b.username??'').trim().toLowerCase(),password=b.password??'';
 if(!env.CREATOR_USERNAME||username!==env.CREATOR_USERNAME.toLowerCase())return json({error:'Creator username or password is wrong.'},401);
 const user=await env.DB.prepare('SELECT id,username,name,avatar_key AS avatarKey,role,banned,password_hash AS passwordHash,salt FROM users WHERE username=?').bind(username).first<any>();
 if(!user||await hash(password,user.salt)!==user.passwordHash)return json({error:'Creator username or password is wrong.'},401);
 if(user.banned)return json({error:'This account is paused.'},403);
 await env.DB.batch([
  env.DB.prepare("UPDATE users SET role='member' WHERE role='creator' AND id!=?").bind(user.id),
  env.DB.prepare("UPDATE users SET role='creator' WHERE id=?").bind(user.id)
 ]);
 const token=bytes();
 await env.DB.prepare('INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)').bind(token,user.id,Date.now()+2592000000).run();
 return json({ok:true},200,{'Set-Cookie':session(token,true)});
}
