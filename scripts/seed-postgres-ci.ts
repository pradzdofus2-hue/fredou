/** Ephemeral CI-only PostgreSQL fixture. Refuses non-local databases. */
import {GAME_CONFIG,BOOSTERS} from '../src/server/config';
import {pgPool,pgTransaction} from '../src/server/postgres';

async function main(){
 const raw=process.env.DATABASE_URL||'';
 const url=new URL(raw);
 if(!['localhost','127.0.0.1','::1','[::1]'].includes(url.hostname))throw Error('CI seed refuses external databases');
 if(process.env.FREDOU_EPHEMERAL_PG_CI!=='true')throw Error('Explicit ephemeral CI guard required');
 try{
  await pgTransaction(async db=>{
   const existing=await db.query<{n:number}>('SELECT COUNT(*)::integer n FROM cards');
   if(existing.rows[0].n!==0)throw Error('CI seed only accepts empty card catalogue');
   const series=['astrub','sylve','forges','frigost'];
   for(const id of series)await db.query('INSERT INTO series(id,name,description,color) VALUES($1,$2,$3,$4)',[id,id,'Catalogue de validation isolé','#abcdef']);
   let number=0;
   for(const id of series)for(let rarity=0;rarity<6;rarity++)for(let i=0;i<20;i++){
    number++;
    const level=GAME_CONFIG.rarities[rarity];
    await db.query('INSERT INTO cards(id,number,name,rarity,series_id,description,image,recycle_value,collection_points) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[
     'ci-'+number,number,'Test '+number,rarity,id,'Carte de validation CI','/art/dofus/1.png',level.recycleValue,level.collectionPoints
    ]);
   }
   await db.query('INSERT INTO events(id,name,description,starts_at,ends_at,active,color,reward) VALUES($1,$2,$3,$4,$5,1,$6,$7)',[
    'convergence','Événement CI','Validation isolée','2020-01-01T00:00:00.000Z','2099-01-01T00:00:00.000Z','#123456',25
   ]);
   for(const b of BOOSTERS)await db.query('INSERT INTO boosters(id,name,description,kind,price,color,guarantee,weights,pity_limit,cooldown_seconds,event_id,series_id,capacity) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[
    b.id,b.name,b.description,b.kind,b.price,b.color,b.guarantee,JSON.stringify(b.weights),b.pityLimit,b.cooldownSeconds,b.eventId,b.seriesId,b.capacity
   ]);
   const definitions=[
    ['first-opening','Premier éclat',1,20],['ten-unique','Une histoire commence',10,30],
    ['first-legendary','Une légende se lève',1,60],['first-mythic','Au-delà du mythe',1,150],
    ['first-album','Archiviste accompli',1,200],['first-recycle','Rien ne se perd',1,15],
    ['first-transaction','Les liens du marché',1,25],['fifty-unique','Collection remarquable',50,100],
    ['ten-openings','Le rituel des étoiles',10,75]
   ] as const;
   for(const [id,name,target,reward] of definitions)await db.query(
    'INSERT INTO achievements(id,name,description,icon,target,reward) VALUES($1,$2,$3,$4,$5,$6)',
    [id,name,'Succès de test CI','star',target,reward]);
  });
  console.log('EPHEMERAL PG FIXTURE OK: 480 cards, 4 series, 5 boosters, 9 achievements');
 }finally{await pgPool().end();}
}
main().catch(e=>{console.error('EPHEMERAL PG FIXTURE FAILED: '+(e instanceof Error?e.message:String(e)));process.exitCode=1;});
