/** Production deployment preflight. Reports variable names, never secret contents. */
import {validateDeploymentConfig} from '../src/server/deployment-config';

const errors=validateDeploymentConfig(process.env);
if(errors.length){
 console.error('Déploiement bloqué :\n- '+errors.join('\n- '));
 process.exitCode=1;
}else{
 console.log('Précontrôle configuration OK : PostgreSQL, Discord, HTTPS, modes de jeu et environnement.');
 console.log('Ce contrôle ne vérifie ni les connexions réelles, ni les images publiées, ni les transactions.');
}
