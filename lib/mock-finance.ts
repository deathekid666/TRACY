import { db } from "@/lib/db";
export async function seedMockFinance(caseId:string){
 const count=await db.transaction.count({where:{caseId}});
 if(count) return {created:0};
 const now=Date.now(), day=86400000;
 const rows=[
  {days:2,amount:-42.50,merchant:"Atlas Café",category:"Food",location:"Casablanca"},
  {days:4,amount:-699.00,merchant:"Tech Market",category:"Electronics",location:"Casablanca"},
  {days:8,amount:8500.00,counterparty:"Demo Employer",category:"Income",location:"Morocco"},
  {days:10,amount:-1200.00,counterparty:"Demo Transfer A",category:"Transfer",location:"Rabat"},
  {days:17,amount:-79.90,merchant:"Cloud Service",category:"Subscription",location:"Online"},
  {days:32,amount:-79.90,merchant:"Cloud Service",category:"Subscription",location:"Online"}
 ];
 await db.transaction.createMany({data:rows.map(x=>({caseId,occurredAt:new Date(now-x.days*day),amount:x.amount,currency:"MAD",merchant:x.merchant,counterparty:x.counterparty,category:x.category,location:x.location,synthetic:true}))});
 await db.event.create({data:{caseId,title:"Synthetic finance dataset created",description:"Added 6 mock transactions for development and UI testing.",occurredAt:new Date(),metadata:{synthetic:true}}});
 return {created:rows.length};
}
