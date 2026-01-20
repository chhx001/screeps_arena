import { getObjectsByPrototype } from 'game/utils';
import { Creep, Flag } from 'game/prototypes';
import { } from 'game/constants';
import { ATTACK, CARRY, ERR_NOT_IN_RANGE, HEAL, WORK, MOVE, RANGED_ATTACK, RESOURCE_ENERGY, Source, StructureContainer, StructureSpawn, StructureTower, WALL_HITS_MAX, prototypes, GameObject, createConstructionSite, TOUGH, findPath, getTerrainAt, TERRAIN_WALL, ERR_NOT_ENOUGH_ENERGY, findInRange, getRange, findClosestByPath, searchPath, findClosestByRange, Resource } from 'game';
import ScreepGameBase from './Bases.mjs';
import { Scout, Mage, Builder, Flager, Harvester, Piece, Carrier } from './Roles.mjs';
import { GameStatus } from './Consts.mjs';

// design for tower shoot, shoot remotely to enemies spawn policy
class Designer extends ScreepGameBase {
	constructor(game) {
		super(game)
		this.construction_site = []
	}

	design() {
		console.log("Error: Designer is not implemented")
	}
}

class TowerShootDesigner extends Designer {
	constructor(game) {
		super(game)
		this.tower_limit = 2
	}

	design() {
		for (let i = 0; i < this.tower_limit; i++) {
			let path = searchPath(this.game.spawn.pos, {pos: this.game.enemy_spawn.pos, range: 50 - i}).path
			if (path.length > 0) {
				this.construction_site.push(((s)=>({x: s.x, y: s.y}))(createConstructionSite(path[path.length - 1], StructureTower).object))
			}
		}
	}
}

export { TowerShootDesigner }