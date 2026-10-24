import { all, getDb, now, one } from './database';
import { adjustBalance, logActivity } from './economy';
import { GAME_CONFIG } from './config';
import type { Achievement, PublicUser } from '../lib/contracts';

export function userStatistics(userId: string): Pick<PublicUser,'uniqueCards'|'collectionPoints'|'mythicCards'|'completedAlbums'|'achievementCount'|'completion'> {
  const stats=one<{unique_cards:number;points:number;mythic:number}>(`SELECT COUNT(*) unique_cards,COALESCE(SUM(c.collection_points),0) points,COALESCE(SUM(CASE WHEN c.rarity=5 THEN i.quantity ELSE 0 END),0) mythic FROM inventory i JOIN cards c ON c.id=i.card_id WHERE i.user_id=? AND i.quantity>0`,userId)!;
  const albums=one<{count:number}>(`SELECT COUNT(*) count FROM series s WHERE NOT EXISTS (SELECT 1 FROM cards c WHERE c.series_id=s.id AND NOT EXISTS(SELECT 1 FROM inventory i WHERE i.card_id=c.id AND i.user_id=? AND i.quantity>0))`,userId)!.count;
  const achievements=one<{count:number}>('SELECT COUNT(*) count FROM user_achievements WHERE user_id=?',userId)!.count;
  const total=one<{count:number}>('SELECT COUNT(*) count FROM cards')!.count;
  return {uniqueCards:stats.unique_cards,collectionPoints:stats.points,mythicCards:stats.mythic,completedAlbums:albums,achievementCount:achievements,completion:total?Math.round(stats.unique_cards/total*10000)/100:0};
}
export function achievementProgress(userId: string | null): Achievement[] {
  const rows=all<{id:string;name:string;description:string;icon:string;target:number;reward:number}>('SELECT * FROM achievements ORDER BY rowid');
  if (!userId) return rows.map(row=>({...row,progress:0,unlockedAt:null}));
  const stats=userStatistics(userId);
  const count=(sql:string)=>one<{count:number}>(sql,userId)!.count;
  const openings=count('SELECT COUNT(*) count FROM openings WHERE user_id=?');
  const legendary=count('SELECT COUNT(*) count FROM acquisitions a JOIN cards c ON c.id=a.card_id WHERE a.user_id=? AND c.rarity=4');
  const mythic=count('SELECT COUNT(*) count FROM acquisitions a JOIN cards c ON c.id=a.card_id WHERE a.user_id=? AND c.rarity=5');
  const recycled=count("SELECT COUNT(*) count FROM activities WHERE user_id=? AND kind='recycle'");
  const traded=count("SELECT COUNT(*) count FROM activities WHERE user_id=? AND kind='market'");
  const progress:Record<string,number>={'first-opening':openings,'ten-unique':stats.uniqueCards,'first-legendary':legendary,'first-mythic':mythic,'first-album':stats.completedAlbums,'first-recycle':recycled,'first-transaction':traded,'fifty-unique':stats.uniqueCards,'ten-openings':openings};
  const unlocked=all<{achievement_id:string;unlocked_at:string}>('SELECT * FROM user_achievements WHERE user_id=?',userId);
  return rows.map(row=>({...row,progress:Math.min(row.target,progress[row.id]||0),unlockedAt:unlocked.find(a=>a.achievement_id===row.id)?.unlocked_at||null}));
}
export function evaluateAchievements(userId: string): void {
  for (const achievement of achievementProgress(userId)) {
    if (!achievement.unlockedAt && achievement.progress>=achievement.target) {
      getDb().prepare('INSERT INTO user_achievements VALUES(?,?,?)').run(userId,achievement.id,now());
      adjustBalance(userId,achievement.reward,`Succès : ${achievement.name}`,achievement.id);
      logActivity(userId,'achievement',`Succès débloqué : ${achievement.name}.`);
    }
  }
}
export function evaluateReferral(userId: string): void {
  const user=one<{referred_by:string|null}>('SELECT referred_by FROM users WHERE id=?',userId);
  if (!user?.referred_by || one('SELECT 1 FROM referral_rewards WHERE referred_id=?',userId)) return;
  if (one<{count:number}>('SELECT COUNT(*) count FROM openings WHERE user_id=?',userId)!.count<GAME_CONFIG.referralRequiredOpenings) return;
  getDb().prepare('INSERT INTO referral_rewards VALUES(?,?,?)').run(userId,user.referred_by,now());
  for (const recipient of [userId,user.referred_by]) {
    adjustBalance(recipient,GAME_CONFIG.referralReward,'Parrainage confirmé',userId);
    logActivity(recipient,'referral','Parrainage confirmé après trois ouvertures.');
  }
}
