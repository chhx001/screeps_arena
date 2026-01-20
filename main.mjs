import { getObjectsByPrototype } from 'game/utils';
import { Creep, Flag } from 'game/prototypes';
import { } from 'game/constants';
import { ATTACK, CARRY, ERR_NOT_IN_RANGE, HEAL, WORK, MOVE, RANGED_ATTACK, RESOURCE_ENERGY, Source, StructureContainer, StructureSpawn, StructureTower, WALL_HITS_MAX, prototypes, GameObject, createConstructionSite } from 'game';
import { ScreepsGame } from './ScreepGame.mjs'

var mygame;

export function loop() {
    if (!mygame) mygame = new ScreepsGame();

    mygame.run()
    
}