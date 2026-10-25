import type { DemoState } from '../../types';
export type SampleRange='August'|'September'|'October'|'All months';
export const MONTHS=[{key:'2026-08',label:'Aug'},{key:'2026-09',label:'Sep'},{key:'2026-10',label:'Oct'}];
export function analytics(state:DemoState,range:SampleRange='All months'){
 const month=range==='August'?'2026-08':range==='September'?'2026-09':range==='October'?'2026-10':null;
 const cases=state.cases.filter(c=>!month||c.submitted.startsWith(month));
 const appointments=state.appointments.filter(a=>!month||a.date.startsWith(month));
 const users=state.users.filter(u=>!month||u.joined.startsWith(month));
 return {cases,appointments,users,
  trend:MONTHS.filter(m=>!month||m.key===month).map(m=>({name:m.label,cases:cases.filter(c=>c.submitted.startsWith(m.key)).length,appointments:appointments.filter(a=>a.date.startsWith(m.key)).length,users:users.filter(u=>u.joined.startsWith(m.key)).length})),
  workflow:['Submitted','Assigned','Reviewed','Closed'].map(name=>({name,value:cases.filter(c=>c.status===name).length})),
  roles:['patient','doctor','admin'].map(name=>({name,value:users.filter(u=>u.role===name).length})),
  appointmentStates:['Requested','Confirmed','Completed','Cancelled'].map(name=>({name,value:appointments.filter(a=>a.status===name).length})),
 };
}
