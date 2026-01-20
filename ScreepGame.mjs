//@ts-nocheck
import { getObjectsByPrototype } from 'game/utils';
import { Creep, Flag } from 'game/prototypes';
import { } from 'game/constants';
import { ATTACK, CARRY, ERR_NOT_IN_RANGE, HEAL, WORK, MOVE, RANGED_ATTACK, RESOURCE_ENERGY, Source, StructureContainer, StructureSpawn, StructureTower, WALL_HITS_MAX, prototypes, GameObject, createConstructionSite, TOUGH, findPath, getTerrainAt, TERRAIN_WALL, ERR_NOT_ENOUGH_ENERGY, findInRange, getRange, findClosestByPath, searchPath, findClosestByRange, Resource } from 'game';
import ScreepGameBase from './Bases.mjs';

class WorkQueue {

}


class ScreepsGame {
	constructor() {
		this.harvester_group_list = []
		this.battle_group_list = []
		this.status = GameStatus.PEACE
		/* 2 flag group to acquire the flags */
		this.battle_group_plan = [GroupFlager, GroupFlager]
		this.battle_group_default = GroupCommon
		this.scanOnce()
	}

	scanOnce() {
		this.spawn = getObjectsByPrototype(StructureSpawn).find(s => s.my)
		this.enemy_spawn = getObjectsByPrototype(StructureSpawn).find(s => !s.my)
		this.flags = getObjectsByPrototype(Flag)
		this.sources = getObjectsByPrototype(Source)


		if (this.sources.length == 0) {
			this.mode = GameMode.STRIKE
			/* sort the flag, we will try to catch the further flag first */
			for (let flag of this.flags) {
				flag.path_len = this.spawn.findPathTo(flag).length
			}
			/* further one get first */
			this.flags.sort((a,b) => b.path_len - a.path_len)
		} else {
			this.mode = GameMode.CONSTRUCT
			for (var s of this.sources) {
				s.avail_slot = 0;
				s.path_len = findPath(this.spawn, s, {maxCost: 500}).length
				if (s.path_len == 0) {
					s.path_len = 0xffffffff
					continue
				}
				for (let x = s.x - 1; x <= s.x + 1; x ++) {
					for (let y = s.y - 1; y <= s.y + 1; y ++) {
						if (x == s.x && y == s.y) continue;
						let t = getTerrainAt({x: x, y: y})
						if (t != TERRAIN_WALL)
							s.avail_slot ++
					}
				}
				this.max_harvester += s.avail_slot;
				this.harvester_group_list.push(new GroupHarvester(this, s.avail_slot, s))
			}

			this.sources.sort((a,b) => a.path_len - b.path_len)
		}
	}

	scan() {
		this.enemy_creeps = getObjectsByPrototype(Creep).filter(c => !c.my)
		this.enemy_towers = getObjectsByPrototype(StructureTower).filter(t => !t.my)
		this.my_creeps = getObjectsByPrototype(Creep).filter(c => c.my)

		let enemies = this.enemy_creeps.concat(this.enemy_towers)
		if (findInRange(this.spawn, enemies, 25).length > 0) this.status = GameStatus.WAR
		else this.status = GameStatus.PEACE
	}

	nextGroup() {
		if (this.battle_group_plan.length > 0) {
			let ret = this.battle_group_plan[0]
			this.battle_group_plan.splice(0, 1)
			return ret
		}
		return this.battle_group_default
	}

	doSpawn() {
		if (this.spawn.spawning)
			return

		console.log("Mode:", this.mode, "Status: ", this.status)

		// if peace, supply harvester group first
		if (this.status == GameStatus.PEACE) {
			// supply group then
			for (let group of this.harvester_group_list) {
				if (!group.intact()) {
					group.supply()
					return
				}
			}
		}

		// supply existing group then
		for (let group of this.battle_group_list) {
			if (!group.intact()) {
				group.supply()
				return
			}
		}

		// if workers and groups are full, or it is in the war, create new group
		if (this.spawn.store.getFreeCapacity(RESOURCE_ENERGY) < 0.2 * this.spawn.store.getCapacity(RESOURCE_ENERGY) || this.status == GameStatus.WAR || this.mode == GameMode.STRIKE) {
			let group = new (this.nextGroup())(this)
			this.battle_group_list.push(group)
			group.supply()
			return
		}
	}

	run() {
		this.scan()
		this.doSpawn()
		//console.log(this.harvester_group_list)
		for (let g of this.harvester_group_list) {
			g.run()
		}
		//console.log(this.battle_group_list)
		for (let g of this.battle_group_list) {
			g.run()
		}
	}


}

export {ScreepsGame}
