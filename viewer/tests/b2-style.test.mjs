import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const style=JSON.parse(fs.readFileSync(new URL('../../case/style.json',import.meta.url),'utf8'));
const plan=JSON.parse(fs.readFileSync(new URL('../../case/plan.json',import.meta.url),'utf8'));
test('approved warm dollhouse style is explicit and not pure white',()=>{
 const s=style.styles[0];
 assert.equal(s.id,'st-warm-dollhouse');
 const roles=new Map(s.palette.map(p=>[p.role,p.hex.toUpperCase()]));
 for(const role of ['wall','floor','wood','fabric','frame']) assert.ok(roles.has(role),role);
 assert.notEqual(roles.get('wall'),'#FFFFFF');
 assert.equal(s.lighting.status,'inferred');
 const roomIds=new Set(plan.rooms.map(r=>r.id));
 for(const role of s.furnitureRoles) assert.ok(roomIds.has(role.room),role.id);
});