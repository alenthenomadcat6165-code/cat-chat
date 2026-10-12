import {env} from 'cloudflare:workers';
import {json,me,setup} from '../../../lib/store';

const ONLINE_WINDOW=30000;

async function activeUser(){
 const user=await me();
 if(!user)return null;
 if(user.banned||user.accountStatus!=='active')return null;
 return user;
}

export async function GET(){
 await setup();
 const user=await activeUser();
 if(!user)return json({error:'Please sign in before continuing.'},401);
 const cutoff=Date.now()-ONLINE_WINDOW;
 const people=await env.DB.prepare(`SELECT users.id,users.username,users.name,users.avatar_key AS avatarKey,users.role,users.created_at AS createdAt,CASE WHEN user_presence.updated_at>? THEN 1 ELSE 0 END AS online FROM users LEFT JOIN user_presence ON user_presence.user_id=users.id WHERE users.banned=0 AND users.account_status='active' ORDER BY online DESC, users.name COLLATE NOCASE ASC`).bind(cutoff).all();
 return json({people:people.results.map((person:any)=>({...person,online:Boolean(person.online)}))});
}

export async function POST(){
 await setup();
 const user=await activeUser();
 if(!user)return json({error:'Please sign in before continuing.'},401);
 await env.DB.prepare('INSERT INTO user_presence(user_id,updated_at) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET updated_at=excluded.updated_at').bind(user.id,Date.now()).run();
 return json({ok:true});
}
