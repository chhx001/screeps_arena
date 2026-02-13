import { getObjectsByPrototype } from 'game/utils';
import { Creep, Flag } from 'game/prototypes';
import { } from 'game/constants';
import { ATTACK, CARRY, ERR_NOT_IN_RANGE, HEAL, WORK, MOVE, RANGED_ATTACK, RESOURCE_ENERGY, Source, StructureContainer, StructureSpawn, StructureTower, WALL_HITS_MAX, prototypes, GameObject, createConstructionSite, TOUGH, findPath, getTerrainAt, TERRAIN_WALL, ERR_NOT_ENOUGH_ENERGY, findInRange, getRange, findClosestByPath, searchPath, findClosestByRange, Resource, getCpuTime, getTicks } from 'game';
import ScreepGameBase from './Bases.mjs';
import { Scout, Mage, Builder, Flager, Harvester, Piece, Carrier, Tower } from './Pieces.mjs';
import { GameStatus } from './Consts.mjs';

// design for tower shoot, shoot remotely to enemies spawn policy
class Cluster extends ScreepGameBase {
	constructor(game) {
		super(game)
		this.construction_site = []
		this.structure_list = []
	}

	design() {
		console.log("Error: Designer is not implemented")
	}
}

class TowerShootCluster extends Cluster {
	constructor(game) {
		super(game)
		this.tower_limit = 2
		this.designed = false
		this.last_updated_tick = 0
	}

	design() {
		if (this.designed) return;

		for (let i = 0; i < this.tower_limit; i++) {
			let path = searchPath(this.game.spawn.pos, {pos: this.game.enemy_spawn.pos, range: 50 - i}).path
			if (path.length > 0) {
				this.construction_site.push(((s)=>({x: s.x, y: s.y}))(createConstructionSite(path[path.length - 1], StructureTower).object))
			}
		}
		this.last_updated_tick = getTicks()
		this.designed = true
	}

	updateProgress() {
		// skip the designed tick, the site may not be built correctly
		if (this.last_updated_tick == 0 || getTicks() == this.last_updated_tick) return

		for (let i = this.construction_site.length - 1; i >= 0; i --) {
			if (!this.construction_site[i].exists || this.construction_site[i].progress == this.construction_site[i].progressTotal) {
				this.structure_list.push(new Tower(this.game, this.construction_site[i].structure))
				this.construction_site.splice(i, 1)
			}
		}
	}

	run() {
		let enemy_list = this.game.enemy_creeps
		for (let t of this.structure_list) {
			// attack enemies within 20 tiles(not included) first
			let enemies_in_range = t.obj.findInRange(enemy_list, 19)
			if (enemies_in_range.length > 0) {
				console.log("Debug: Body=",enemies_in_range[0].Body)
				t.attack(enemies_in_range[0])
				return
			}

			// if there isn't, try attack enemy spawn
			if (t.attack(this.game.enemy_spawn) != ERR_NOT_IN_RANGE)
				return

			// try attack enemies within full range, this time exclude enemies with HEAL module
			enemies_in_range = t.obj.findInRange(enemy_list.filter(e => !e.Body.includes('H')), 50)
			if (enemies_in_range.length > 0) {
				t.attack(enemies_in_range[0])
				return
			}
		}
	}
}

export { TowerShootCluster }