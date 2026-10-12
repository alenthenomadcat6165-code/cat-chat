import {runModeratorSweep} from '../../../lib/moderator';
import {json,me} from '../../../lib/store';

export async function POST(){
 const user=await me();
 if(!user)return json({error:'Please sign in to Cat Thing before continuing.'},401);
 const result=await runModeratorSweep();
 return json({ok:true,checked:result.checkedCount,removed:result.removedCount,skipped:result.skipped});
}
