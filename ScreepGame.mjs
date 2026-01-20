//@ts-nocheck
import { getObjectsByPrototype } from 'game/utils';
import { Creep, Flag } from 'game/prototypes';
import { } from 'game/constants';
import { ATTACK, CARRY, ERR_NOT_IN_RANGE, HEAL, WORK, MOVE, RANGED_ATTACK, RESOURCE_ENERGY, Source, StructureContainer, StructureSpawn, StructureTower, WALL_HITS_MAX, prototypes, GameObject, createConstructionSite, TOUGH, findPath, getTerrainAt, TERRAIN_WALL, ERR_NOT_ENOUGH_ENERGY, findInRange, getRange, findClosestByPath, searchPath, findClosestByRange } from 'game';

/*
1. scan map, find source
2. find how many empty slot around the source, decide how many workers to sapwn
*/

var GameMode = {
	STRIKE : "Strike",
	CONSTRUCT : "Construct"
}

var GameStatus = {
	PEACE: "Peace",
	SEARCH : "Search",
	WAR: "War"
}


class ScreepGameBase {
	constructor(game) {
		this.game = game
	}
}

class Piece extends ScreepGameBase {
	constructor(game, obj = null) {
		super(game)
		if (obj != null) {
			this.bind(obj)
		}
	}

	bindGroup(group) {
		this.group = group
	}

	isAlive() {
		if (!this.obj) return false
		// 1. if piece is spawning, return true
		if (this.isSpawning()) return true
		// 2. if not spawning, check exists
		return this.obj.exists
	}

	isSpawning() {
		// 1. if piece is just spawned, the id is undefined, so if id is undefined, we regard it is just queued to spawn
		if (this.obj.id == undefined) return true
		// 2. if the piece is spawning
		if (this.obj.spawning) return true
		// otherwise false
		return false
	}

	moveTo(target) {
		if (target instanceof Piece)
			this.obj.moveTo(target.obj)
		else
			this.obj.moveTo(target)
	}

	bind(obj) {
		this.obj = obj
	}

	follow(target, distance = 1) {
		let range
		if (target instanceof Piece)
			range = getRange(this.obj, target.obj)
		else
			range = getRange(this.obj, target)
		if (range > distance) {
			this.moveTo(target)
		}
	}

	static spawnMeWithLv(game, lv) {
		var new_creep = game.spawn.spawnCreep(this.getBodyPartLv(lv)).object
		if (new_creep instanceof Creep) {
			return new this(game, new_creep)
		} else {
			// it is an error code
			return new_creep
		}
	}

	static getBodyPartLv(level) {
		console.log("Error: Try to get Body Part Level for a Empty Piece")
		return [TOUGH, MOVE]
	}
}

class Group extends ScreepGameBase {
	constructor(game) {
		super(game)
		this.group_member = []
		this.spawn_list = []
		this.group_lv = 0
	}

	intact() {
		let died_list = this.group_member.filter(m => !m.isAlive())
		if (died_list.length > 0) {
			// some one is died, start war mode
			this.game.status = GameStatus.WAR
			for (let died of died_list) {
				this.spawn_list.push(died.constructor)
			}
		}
		this.group_member = this.group_member.filter(m => m.isAlive())

		return this.spawn_list.length == 0
	}

	supply() {
		if (this.spawn_list.length == 0)
			return

		var job = this.spawn_list[0]
		var new_creep = job.spawnMeWithLv(this.game, this.group_lv)
		if (new_creep instanceof Piece) {
			this.group_member.push(new_creep)
			new_creep.bindGroup(this)
			this.spawn_list.splice(0, 1)
		}
	}
}

class Worker extends Piece {
	constructor(game, obj = null) {
		super(game, obj)
	}

	static getBodyPartLv(level) {
		switch (level) {
			case 0:
				return [TOUGH, , MOVE, MOVE]
		}
	}

}

class Harvester extends Worker {
	constructor(game, obj = null) {
		super(game, obj)
		this.harvesting = true
		this.target = undefined
	}

	static getBodyPartLv(level) {
		switch (level) {
			case 0:
				return [WORK, CARRY, MOVE]
		}
	}

	setTarget(target) {
		this.target = target
	}

	run() {
		//console.log(this.obj)
		if (!this.isAlive() || !this.target || this.isSpawning()) return
		if (this.obj.store.getUsedCapacity(RESOURCE_ENERGY) == 0) this.harvesting = true;
		if (this.obj.store.getFreeCapacity(RESOURCE_ENERGY) == 0) this.harvesting = false;

		if (this.harvesting) {
			if (this.obj.harvest(this.target) == ERR_NOT_IN_RANGE) {
				this.moveTo(this.target)
				this.obj.harvest(this.target)
			}
		} else {
			if (this.obj.transfer(this.game.spawn, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
				this.moveTo(this.game.spawn)
				this.obj.transfer(this.game.spawn, RESOURCE_ENERGY)
			}
		}

	}
}

class Soldier extends Piece {
	 constructor(game, obj = null) {
		super(game, obj)
		this.attack_range = 0
		this.is_healer = false
	}

	execTargetList(target_list) {
		// if there is already enemies in the attack range, attack directly
		let reachable = findInRange(this.obj, target_list, this.attack_range)
		if (reachable.length > 0) {
			this.attack(reachable[0])
			return
		}

		// pieces without attack ability dont move
		if (this.attack_range == 0)
			return

		// move to available target
		let target;
		while (target_list.length > 0) {
			console.log(target)
			target = target_list[0]
			if (target.exists) {
				/* todo: if target is in an enemy rampart, skip */

				break
			} else{
				target_list.splice(0, 1)
				target = undefined
			}
		}

		if (target) {
			this.moveTo(target)
		}
	}

	moveTo(target) {
		if (target instanceof Piece)
			this.obj.moveTo(target.obj)
		else
			this.obj.moveTo(target)

		/* heal and attack when moving */
		if (this.is_healer == true) {
			let my_creeps = this.game.my_creeps
			let target_list = my_creeps.filter(c => c.hits < c.hitsMax)
			let heal_target = findClosestByRange(this.obj, target_list, 1)
			if (heal_target) {
				this.obj.heal(heal_target)
				return
			}
			heal_target = findClosestByRange(this.obj, target_list, 3)
			if (heal_target) {
				this.obj.rangedHeal(target)
			}
		}
	}

	attack(target) {
		console.log("Error: Soldier type direct attack, should not happen")
	}
}

class Builder extends Worker {

}

class Melee extends Soldier {
	constructor(game, obj = null) {
		super(game, obj)
		this.attack_range = 1
	}

	attack(target) {
		if (this.obj.attack(target) == ERR_NOT_IN_RANGE) {
			this.moveTo(target)
			this.obj.attack(target)
		}
	}
}

class Ranged extends Soldier {
	 constructor(game, obj = null) {
		super(game, obj)
		this.attack_range = 3
	}

	attack(target) {
		if (this.obj.rangedAttack(target) == ERR_NOT_IN_RANGE) {
			this.moveTo(target)
			this.obj.rangedAttack(target)
		}
	}
}

class Scout extends Melee {
	constructor(game, obj = null) {
		super(game, obj)
		this.is_healer = true
	}

	bindGroup(group) {
		this.group = group
		//scout report back to group
		this.group.scout_list.push(this)
	}

	static getBodyPartLv(level) {
		switch (level) {
			case 0:
				return [TOUGH, TOUGH, ATTACK, TOUGH, TOUGH, HEAL, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE]
		}
	}

	leading() {
		// if group is not intact or the last member is under spawning, leave the spawn away for some spaces and wait until intact
		if ((this.group.spawn_list.length > 0 ||
			this.group.group_member[this.group.group_member.length - 1].isSpawning()) &&
			this.game.status == GameStatus.PEACE) {
			if (getRange(this.obj, this.game.spawn) < 3) {
				let path = searchPath(this.obj, {pos: {x: this.game.spawn.x, y: this.game.spawn.y}, range: 3}, {flee: true}).path
				this.obj.moveTo(path[0])
				return
			}
		}

		//potential target
		var pt = []
		pt = pt.concat(getObjectsByPrototype(StructureSpawn).filter(c => !c.my))
		pt = pt.concat(getObjectsByPrototype(Creep).filter(c => !c.my))
		pt = pt.concat(getObjectsByPrototype(StructureTower).filter(c => !c.my))

		if (pt.length == 0) return

		let target = findClosestByPath(this.obj, pt, {maxCost: 5000})
		this.moveTo(target)
	}

}

class Healer extends Soldier {
	constructor(game, obj = null) {
		super(game, obj)
		this.attack_range = 0
		this.is_healer = true
	}

	execTargetList(target_list) {
		/* healer doesn't attack enemy, instead it try to heal nearby allies */
		let needs_to_heal = getObjectsByPrototype(Creep).filter(c => (c.my && c.hits < c.hitsMax))

		if(needs_to_heal.length == 0) {
			// if no one needs to be healed, follow the scout of the group
			this.follow(this.group.scout_list[0])
		} else {
			let targets = this.obj.findInRange(needs_to_heal, 1)
			if (targets.length > 0) {
				this.obj.heal(targets[0])
				return
			}
			// ranged heal?
			targets = this.obj.findInRange(needs_to_heal, 3)
			if (targets.length > 0) {
				this.obj.heal(targets[0])
				return
			}
			targets = this.obj.findClosestByPath(needs_to_heal)
			if (targets)
				this.moveTo(targets[0]);
			return
		}

	}
}

class Rider extends Scout {
	constructor(game, obj = null) {
		super(game, obj)
		this.is_healer = true
	}

	static getBodyPartLv(level) {
		switch (level) {
			case 0:
				return [ATTACK, ATTACK, ATTACK, HEAL, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE]
		}
	}
}

class Flager extends Scout {
	constructor(game, obj = null) {
		super(game, obj)
		this.attack_range = 1
		this.target_flag = undefined
		this.is_healer = false
	}

	static getBodyPartLv(level) {
		switch (level) {
			case 0:
				return [ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE]
		}
	}

	leading() {
		/* lock down a flag */
		if (!this.target_flag) {
			for (let flag of this.game.flags) {
				if (flag.flager == undefined) {
					flag.flager = this
					this.target_flag = flag
					break
				}
			}
		}
		/* rush to the flag */
		this.moveTo(this.target_flag)

	}

	execTargetList(target_list) {
		// flager will rush to the flag
		this.leading()
		// if there is already enemies in the attack range, attack directly
		let reachable = findInRange(this.obj, target_list, this.attack_range)
		if (reachable.length > 0) {
			this.attack(reachable[0])
			return
		}

	}
}

class Mage extends Ranged {
	constructor(game, obj = null) {
		super(game, obj)
		this.attack_range = 3
		this.is_healer = true
	}

	static getBodyPartLv(level) {
		switch (level) {
			case 0:
				return [RANGED_ATTACK, RANGED_ATTACK, HEAL, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE]
		}
	}
}

class BattleGroup extends Group {
	static team_standard = []
	constructor(game) {
		super(game)
		this.group_member = []
		this.spawn_list = []
		this.scout_list = []
		this.enemies_cache = []
		this.follow_distance = 2
		this.spawn_list = this.constructor.team_standard.concat()
	}

	scoutReport() {
		// 8 tiles around scout doesn't have enemies
		if (this.scout_list.length == 0) return
		let scout = this.scout_list[0]
		// potential target
		let pt = []
		pt = pt.concat(getObjectsByPrototype(StructureSpawn).filter(c => !c.my))
		pt = pt.concat(getObjectsByPrototype(Creep).filter(c => !c.my))
		pt = pt.concat(getObjectsByPrototype(StructureTower).filter(c => !c.my))
		let foundin8 = findInRange(scout.obj, pt, 8)
		//console.log("Scout: foundin8:", foundin8)
		let foundin20;
		// if found enemies in 8 tiles, search for bigger tiles to cache all enemies
		if (foundin8.length > 0) {
			console.log(foundin8)
			let enemies_cache = findInRange(scout.obj, pt, 16)
			for (let enemy of enemies_cache) {
				enemy.path_len = findPath(scout.obj, enemy, {maxCost: 300})
				if (enemy.path_len == 0) enemy.path_len = 0xffffffff
			}
			enemies_cache.sort((a,b) => a.path_len - b.path_len)
			this.enemies_cache = enemies_cache
		}
	}

	run() {
		// clear died enemies from last round
		for (let i = this.enemies_cache.length - 1; i >= 0; i --) {
			if (!this.enemies_cache[i].exists) {
				this.enemies_cache.splice(i, 1)
			}
		}
		// still has enemies left attack
		if (this.enemies_cache.length > 0) {
			for (let member of this.group_member) {
				member.execTargetList(this.enemies_cache)
			}
			return
		}
		// get scout
		let scout
		while (this.scout_list.length > 0) {
			scout = this.scout_list[0]
			if (scout.isAlive()) break;
			else {
				this.scout_list.splice(0, 1)
				scout = undefined
			}
		}
		// not a single scout, every one back home
		if (!scout) scout = this.game.spawn

		// no enemies left, everyone follow scout, scout move, scout report enemies
		for (let member of this.group_member) {
			if (member == scout) continue
			member.follow(scout)
		}
		// if scout alive, scout lead the way
		if (scout instanceof Scout) {
			scout.leading()
		}

		this.scoutReport()
	}


}

class GroupCommon extends BattleGroup {
	static team_standard = [
		Scout, Scout, Scout, Mage, Mage, Mage, Mage
	]
	constructor(game) {
		super(game)

	}
}

class GroupFlager extends BattleGroup {
	static team_standard = [
		Flager, Mage
	]
	constructor(game) {
		super(game)
	}
}

class GroupHarvester extends Group {
	constructor(game, max_count, source) {
		super(game)
		this.max_count = max_count
		for (let i = 0; i < max_count; i ++) {
			this.spawn_list.push(Harvester)
		}
		this.source = source
	}

	run() {
		for (let m of this.group_member) {
			m.setTarget(this.source)
			m.run()
		}
	}

}

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
