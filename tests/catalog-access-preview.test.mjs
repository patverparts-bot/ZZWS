import test from 'node:test';
import assert from 'node:assert/strict';
import {canAccess} from '../supabase/functions/zzws-api/operations.mjs';
test('customer catalogue preview requires user-management permission and POST',()=>{
 assert.equal(canAccess('owner','admin/access/preview','POST'),true);
 assert.equal(canAccess('owner','admin/access/preview','GET'),false);
 for(const scope of ['manager','price','viewer','unknown'])assert.equal(canAccess(scope,'admin/access/preview','POST'),false);
});
