import {runModeratorSweep} from '../../../lib/moderator';
import {json,me} from '../../../lib/store';

export async function POST(){
 const user=await me();
 if(!user)return json({error:'Sign in to Cat Chat first.'},401);
 const result=await runModeratorSweep();
 return json({ok:true,checked:result.checkedCount,removed:result.removedCount,skipped:result.skipped});
}
