'use client';
import {FormEvent,useEffect,useState} from 'react';

export type RolePrivileges={deleteMessages:boolean;viewDeletedMessages:boolean;warnAccounts:boolean;suspendDays:number;pauseAccounts:boolean;banAccounts:boolean;viewAccountDetails:boolean;reviewReports:boolean;manageRoomMembers:boolean};
export type CustomRole={id:number;name:string;color:string;privileges:RolePrivileges};
export type RoleTagInfo=Pick<CustomRole,'id'|'name'|'color'>;

const empty:RolePrivileges={deleteMessages:false,viewDeletedMessages:false,warnAccounts:false,suspendDays:0,pauseAccounts:false,banAccounts:false,viewAccountDetails:false,reviewReports:false,manageRoomMembers:false};
const options:[keyof Omit<RolePrivileges,'suspendDays'>,string][]=[
 ['deleteMessages','Delete other people’s messages'],
 ['viewDeletedMessages','See deleted messages'],
 ['warnAccounts','Give account warnings'],
 ['pauseAccounts','Pause accounts'],
 ['banAccounts','Permanently ban accounts'],
 ['viewAccountDetails','View usernames and join dates'],
 ['reviewReports','Review reports'],
 ['manageRoomMembers','Remove people from rooms']
];

export function CustomRoleBadge({role,roles,className='chat-role'}:{role:string;roles:RoleTagInfo[];className?:string}){
 const id=Number(role.slice(7)),definition=role.startsWith('custom:')?roles.find(item=>item.id===id):undefined;
 if(!definition)return null;
 return <b className={`${className} role-custom`} style={{backgroundColor:definition.color,color:contrast(definition.color)}}>{definition.name}</b>;
}

function contrast(hex:string){const channels=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return .2126*channels[0]+.7152*channels[1]+.0722*channels[2]>.45?'#24172c':'#ffffff'}

export function CustomRoles({roles,onSaved}:{roles:CustomRole[];onSaved:()=>Promise<void>}){
 const [editing,setEditing]=useState<number|null>(null),[name,setName]=useState(''),[color,setColor]=useState('#b57ee8'),[privileges,setPrivileges]=useState<RolePrivileges>(empty),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{if(editing!==null&&!roles.some(role=>role.id===editing))setEditing(null)},[roles,editing]);
 function choose(role:CustomRole){setEditing(role.id);setName(role.name);setColor(role.color);setPrivileges(role.privileges);setNotice('')}
 function clear(){setEditing(null);setName('');setColor('#b57ee8');setPrivileges(empty);setNotice('')}
 async function submit(event:FormEvent){event.preventDefault();setBusy(true);setNotice('');try{
  const response=await fetch('/api/roles',{method:editing===null?'POST':'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({id:editing,name,color,privileges})});
  const result=await response.json() as {error?:string};
  if(!response.ok){setNotice(result.error??'The role could not be saved.');return}
  await onSaved();clear();setNotice(editing===null?'The custom role was created.':'The custom role was updated.');
 }catch{setNotice('The role could not be saved. Please try again.')}finally{setBusy(false)}}
 return <section className="roles-section"><div className="section-title"><div><h2>Custom roles</h2><p>Choose a name, tag color, and the permissions this role should have. Only you can create, edit, or assign custom roles.</p></div><span>{roles.length} roles</span></div>
  <div className="role-editor"><form onSubmit={submit}><h3>{editing===null?'Add custom role':`Edit ${name}`}</h3><div className="role-editor-head"><label>Role name<input value={name} onChange={event=>setName(event.target.value)} maxLength={24} required placeholder="Example: Helper"/></label><label>Tag color<input type="color" value={color} onChange={event=>setColor(event.target.value)}/></label><span className="tag-preview" style={{backgroundColor:color,color:contrast(color)}}>{name.trim()||'New role'}</span></div><fieldset><legend>Privileges</legend>{options.map(([key,label])=><label key={key} className="role-check"><input type="checkbox" checked={privileges[key]} onChange={event=>setPrivileges(previous=>({...previous,[key]:event.target.checked}))}/>{label}</label>)}<label className="role-suspend">Suspend accounts for up to<select value={privileges.suspendDays} onChange={event=>setPrivileges(previous=>({...previous,suspendDays:Number(event.target.value)}))}><option value="0">No suspension access</option><option value="3">3 days</option><option value="7">7 days</option><option value="365">365 days</option></select></label></fieldset><p className="role-scope">Custom roles can act on regular members and suggesters. They cannot manage the founder, admins, secretaries, staff, or other custom roles.</p><div className="role-editor-actions"><button disabled={busy}>{busy?'Saving…':editing===null?'Add custom role':'Save changes'}</button>{editing!==null&&<button type="button" className="secondary" onClick={clear}>Cancel</button>}</div>{notice&&<p className="role-notice">{notice}</p>}</form><div className="role-list"><h3>Roles you created</h3>{roles.length===0?<p>No custom roles have been added yet.</p>:roles.map(role=><article key={role.id}><CustomRoleBadge role={`custom:${role.id}`} roles={roles} className="role-badge"/><span>{[...options.filter(([key])=>role.privileges[key]).map(([,label])=>label),...(role.privileges.suspendDays?[`Suspend up to ${role.privileges.suspendDays} days`]:[])].join(' · ')||'No extra privileges'}</span><button onClick={()=>choose(role)}>Edit</button></article>)}</div></div></section>;
}
