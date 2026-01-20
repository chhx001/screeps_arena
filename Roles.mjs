//@ts-nocheck

import { getObjectsByPrototype } from 'game/utils';
import { Creep, Flag } from 'game/prototypes';
import { } from 'game/constants';
import { ATTACK, CARRY, ERR_NOT_IN_RANGE, HEAL, WORK, MOVE, RANGED_ATTACK, RESOURCE_ENERGY, Source, StructureContainer, StructureSpawn, StructureTower, WALL_HITS_MAX, prototypes, GameObject, createConstructionSite, TOUGH, findPath, getTerrainAt, TERRAIN_WALL, ERR_NOT_ENOUGH_ENERGY, findInRange, getRange, findClosestByPath, searchPath, findClosestByRange, Resource } from 'game';
import ScreepGameBase from './Bases.mjs';


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

class Builder extends Soldier {
	constructor(game, obj = null) {
		super(game, obj)
		this.attack_range = 0
		this.target = undefined
	}

	static getBodyPartLv(level) {
		switch (level) {
			case 0:
				return [WORK, MOVE, CARRY]
		}
	}

	setTarget(target) {
		this.target = target
	}

	build() {
		if (this.target.exists) {
			// if constructionsite still exists, try build it
			// if not in range, move
			// if not enough source, pickup source nearby in 5 steps
			let err = this.obj.build(this.target)
			if (err == ERR_NOT_IN_RANGE) {
				this.moveTo(this.target)
			} else if (err == ERR_NOT_ENOUGH_ENERGY) {
				let dropped_res = getObjectsByPrototype(Resource).filter(r => r.resourceType == RESOURCE_ENERGY)
				if (dropped_res.length) {
					let res_in_range = this.obj.findClosestByRange(dropped_res, 5)
					if (res_in_range.length) {
						if (this.obj.pickup(res_in_range[0]) == ERR_NOT_IN_RANGE) {
							this.moveTo(res_in_range[0])
						}
					}
				}
			}
		}
	}
}
// carrier will carry source to builder, drop aside
class Carrier extends Soldier {
	constructor(game, obj = null) {
		super(game, obj)
		this.attack_range = 0
		// carry-to target
		this.target = undefined
		// if more than this dropped resource in the world, return to the base
		this.dropped_uppercap = 350
		// can be spawn or the carry-to target
		this.cur_target = undefined
	}

	static getBodyPartLv(level) {
		let ret = []
		switch (level) {
			case 0:
				return ret.concat(Array(6).fill(CARRY)).concat(Array(6).fill(MOVE))
		}
	}

	setTarget(target) {
		this.target = target
	}

	carryTo() {
		// stop if energy on the map exceeds the uppercap
		let energy_on_map = getObjectsByPrototype(Resource).filter(r => r.resourceType == RESOURCE_ENERGY).reduce((acc, r) => acc + r.amount, 0)
		if (energy_on_map > this.dropped_uppercap) {
			return
		}

		if (this.obj.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
			this.cur_target = this.target
			if (getRange(this.obj, this.target) > 1) {
				this.moveTo(this.target)
			} else {
				this.obj.drop(RESOURCE_ENERGY)
			}
		} else if (this.obj.store.getFreeCapacity(RESOURCE_ENERGY) == 0 ||
		(this.obj.store.getUsedCapacity(RESOURCE_ENERGY) > 0 && this.game.spawn.store.getFreeCapacity(RESOURCE_ENERGY) == 0)) {
			// if capacity is full or spawn has no energy, drop to the target position
			this.cur_target = this.game.spawn
			if (this.obj.withdraw(this.game.spawn, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
				this.moveTo(this.game.spawn)
			}
		}
	}


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

class Tower extends Piece {
	constructor(game, obj = null) {
		super(game, obj)
		this.attack_range = 0
		this.is_healer = true
	}

	moveTo(target) {
		console.log("Bug: Tower can not move")
	}

	attack(target) {
		if (this.obj.attack(target) == ERR_NOT_IN_RANGE) {
			this.obj.attack(target)
		}
	}
}

export { Piece, Worker, Harvester, Soldier, Builder, Carrier, Melee, Ranged, Scout, Healer, Rider, Flager, Mage }