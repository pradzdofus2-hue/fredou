import { test, expect, type Page } from '@playwright/test';
import type { StateResponse } from '../src/lib/contracts';

async function login(page:Page,name='Fredou') {
  await page.goto('/');
  await page.getByRole('button',{name:'Se connecter',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:new RegExp(name)}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Ouvrir le menu du profil'})).toBeVisible();
}
async function switchAccount(page:Page,name:string) {
  await page.getByRole('button',{name:'Ouvrir le menu du profil'}).click();
  await page.getByRole('button',{name:'Changer de compte local',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:new RegExp(name)}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function state(page:Page):Promise<StateResponse> { return (await page.request.get('/api/state')).json(); }
test('desktop catalogue, filters, detail and keyboard modal navigation',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await login(page);
  await page.goto('/collection');
  await expect(page.getByRole('heading',{name:'Ma collection',exact:true})).toBeVisible();
  await expect(page.locator('.cards-grid .collection-card')).toHaveCount(18);
  await expect.poll(()=>page.locator('.cards-grid .collection-card img').first().evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBeTruthy();
  await page.getByRole('button',{name:/Mythique/i}).first().click();
  const count=await page.locator('.cards-grid .collection-card').count();expect(count).toBeGreaterThan(0);expect(count).toBeLessThan(18);
  await page.getByLabel('Rechercher une carte',{exact:true}).fill('aucune-carte-inexistante');
  await expect(page.getByText('Aucune carte trouvée',{exact:true})).toBeVisible();
  await page.getByLabel('Rechercher une carte',{exact:true}).fill('');
  await page.locator('.cards-grid .collection-card').first().click();
  await expect(page.locator('.detail-information h1')).toBeVisible();
  await page.goto('/boosters');
  await page.getByRole('button',{name:/Probabilités et garanties/}).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('real booster opening reveals five server-awarded cards and persists on reload',async({page})=>{
  await login(page);
  await page.goto('/boosters');
  const premium=page.locator('.fc-booster-showcase');
  await expect(premium).toBeVisible();
  await page.getByRole('tab',{name:'Boutique'}).click();
  if(await premium.getByRole('button',{name:/Obtenir pour/}).count()) {
    await premium.getByRole('button',{name:/Obtenir pour/}).click();
    await page.getByRole('dialog').getByRole('button',{name:'Confirmer l’achat',exact:true}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await premium.getByRole('button',{name:'Ouvrir le booster',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  if(await dialog.getByRole('button',{name:'Déchirer le booster'}).count()) await dialog.getByRole('button',{name:'Déchirer le booster'}).click();
  await dialog.getByRole('button',{name:'Révéler la carte 1',exact:true}).click();
  await dialog.getByRole('button',{name:'Tout révéler',exact:true}).click();
  await expect(dialog.locator('.is-revealed')).toHaveCount(5);
  await dialog.getByRole('button',{name:'Découvrir le bilan',exact:true}).click();
  await expect(dialog.locator('.opening-reward')).toContainText('Collection mise à jour');
  await dialog.getByRole('button',{name:'Retour à l’aventure',exact:true}).click();
  await page.reload();
  await expect(page.locator('.fc-booster-history-row').first()).toContainText('Prisme céleste');
});
test('market publication and cancellation restore reserved inventory',async({page})=>{
  await login(page);
  await page.goto('/marche');
  await page.getByRole('button',{name:'Vendre une carte',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Prix par carte (Éclats)',{exact:true}).fill('19');
  await dialog.getByRole('button',{name:/Publier l’annonce/}).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('tab',{name:'Mes annonces',exact:true}).click();
  await page.locator('.market-grid').getByRole('button',{name:/Retirer|Annuler/}).first().click();
  await page.getByRole('dialog').getByRole('button',{name:'Confirmer le retrait'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('status').filter({hasText:/Annonce annulée/})).toBeVisible();
});
test('mobile navigation, responsive layout and reduced-motion preference',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await login(page,'Iris');
  await page.getByRole('button',{name:'Ouvrir le menu',exact:true}).click();
  await page.getByRole('navigation',{name:'Menu mobile',exact:true}).getByRole('link',{name:'Albums',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Les albums',exact:true})).toBeVisible();
  await expect(page.locator('.album-panel')).toHaveCount(3);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
  await page.goto('/collection');
  await expect(page.locator('.cards-grid .collection-card').first()).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
});

test('one player can buy another player’s published card through the confirmation dialog',async({page})=>{
  await login(page);
  const before=await state(page);
  const item=before.inventory.find(i=>before.cards.find(c=>c.id===i.cardId)?.rarity===0)!;
  const card=before.cards.find(c=>c.id===item.cardId)!;
  await page.goto('/marche');
  await page.getByRole('button',{name:'Vendre une carte',exact:true}).click();
  await page.getByRole('dialog').getByLabel('Carte à vendre',{exact:true}).selectOption(card.id);
  await page.getByRole('dialog').getByLabel('Prix par carte (Éclats)',{exact:true}).fill('37');
  await page.getByRole('dialog').getByRole('button',{name:/Publier l’annonce/}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const listing=(await state(page)).listings.find(l=>l.sellerId==='fredou' && l.status==='active' && l.price===37 && l.cardId===card.id)!;
  expect(listing).toBeTruthy();
  await switchAccount(page,'Iris');
  const irisBefore=await state(page);
  await page.goto(`/marche?card=${card.id}`);
  const offer=page.locator('.market-grid > article').filter({hasText:card.name}).filter({has:page.getByText('37',{exact:true})});
  await offer.first().getByRole('button',{name:/Acheter/}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Confirmer l’achat',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const irisAfter=await state(page);
  expect(irisAfter.inventory.find(i=>i.cardId===card.id)?.quantity).toBe((irisBefore.inventory.find(i=>i.cardId===card.id)?.quantity||0)+1);
  expect(irisAfter.listings.find(l=>l.id===listing.id)?.status).toBe('sold');
});

test('trade proposal, account switch and acceptance transfer both inventories',async({page})=>{
  await login(page);
  const fredouBefore=await state(page);
  const offered=fredouBefore.inventory.find(i=>fredouBefore.cards.find(c=>c.id===i.cardId)?.rarity===0)!;
  await switchAccount(page,'Iris');
  const irisBefore=await state(page);
  const requested=irisBefore.inventory.find(i=>i.cardId!==offered.cardId && irisBefore.cards.find(c=>c.id===i.cardId)?.rarity===0)!;
  expect(requested).toBeTruthy();
  await switchAccount(page,'Fredou');
  await page.goto('/echanges');
  await page.getByRole('button',{name:'Proposer un échange',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Destinataire',{exact:true}).selectOption('iris');
  await dialog.getByRole('button',{name:'Ajouter une carte',exact:true}).nth(0).click();
  await dialog.getByLabel('Carte proposée 1',{exact:true}).selectOption(offered.cardId);
  await dialog.getByRole('button',{name:'Ajouter une carte',exact:true}).nth(1).click();
  await dialog.getByLabel('Carte demandée 1',{exact:true}).selectOption(requested.cardId);
  await dialog.getByRole('button',{name:/Envoyer la proposition/}).click();
  await expect(dialog).toHaveCount(0);
  await switchAccount(page,'Iris');
  await page.goto('/echanges');
  await page.locator('.trade-panel').filter({hasText:'Fredou'}).first().getByRole('button',{name:'Accepter',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Confirmer',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const after=await state(page);
  expect(after.inventory.find(i=>i.cardId===offered.cardId)?.quantity).toBe((irisBefore.inventory.find(i=>i.cardId===offered.cardId)?.quantity||0)+1);
  expect(after.inventory.find(i=>i.cardId===requested.cardId)?.quantity||0).toBe(requested.quantity-1);
  expect(after.trades.some(t=>t.senderId==='fredou'&&t.status==='accepted')).toBeTruthy();
});

test('disposable account recycling preserves identities and preferences survive reload',async({page})=>{
  await login(page,'Noam');
  await page.goto('/parametres');
  const toggle=page.getByRole('switch',{name:'Réduire les animations',exact:true});
  await expect(toggle).toHaveAttribute('aria-checked','false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked','true');
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-checked','true');
  const before=await state(page);
  const recycleValue=before.inventory.reduce((total,item)=>total+Math.max(0,item.quantity-1)*before.cards.find(c=>c.id===item.cardId)!.recycleValue,0);
  expect(recycleValue).toBeGreaterThan(0);
  await page.goto('/collection');
  await page.getByRole('button',{name:/Recycler les doublons/}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Confirmer le recyclage',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const after=await state(page);
  expect(after.inventory.map(i=>i.cardId).sort()).toEqual(before.inventory.map(i=>i.cardId).sort());
  expect(after.inventory.every(i=>i.quantity===1)).toBeTruthy();
  expect(after.currentUser!.balance).toBeGreaterThanOrEqual(before.currentUser!.balance+recycleValue);
  expect(after.achievements.find(a=>a.id==='first-recycle')?.unlockedAt).toBeTruthy();
});

test('local administration persists an informational event without promising a booster reward',async({page})=>{
  await login(page);
  await page.goto('/admin');
  await page.getByRole('button',{name:'Nouvel événement',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Nom',{exact:true}).fill('Rencontre de démonstration');
  await dialog.getByLabel('Description',{exact:true}).fill('Un événement informatif créé uniquement dans la base jetable de contrôle.');
  await dialog.getByLabel('Début',{exact:true}).fill(new Date(Date.now()-86_400_000).toISOString().slice(0,16));
  await dialog.getByLabel('Fin',{exact:true}).fill(new Date(Date.now()+86_400_000).toISOString().slice(0,16));
  await dialog.getByRole('button',{name:'Enregistrer',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await page.goto('/evenements');
  await expect(page.getByRole('heading',{name:'Rencontre de démonstration',exact:true})).toBeVisible();
  await expect(page.getByText('Événement informatif',{exact:true})).toBeVisible();
});

test('all main mobile routes render without horizontal overflow or JavaScript errors',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:390,height:844});
  await login(page);
  for(const route of ['/boosters','/boutique','/collection','/albums','/wiki/card-1','/marche','/echanges','/classement','/profil/fredou','/succes','/evenements','/actualites','/regles','/parametres','/admin','/parrainage']) {
    await page.goto(route);
    await expect(page.locator('main h1').first()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route).toBeTruthy();
  }
  expect(errors).toEqual([]);
});
