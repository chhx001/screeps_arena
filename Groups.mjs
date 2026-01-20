//@ts-nocheck


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



class GroupBuild extends BattleGroup {
	static team_standard = [
		Carrier, Builder
	]
	constructor(game) {
		super(game)
	}

    bindDesigner(designer) {
        this.designer = designer
        designer.design()
    }

    run() {
        
    }


}

class GroupEscort extends BattleGroup {
	static team_standard = [
		Mage, Mage, Mage
	]
	constructor(game) {
		super(game)
	}

    run() {
        for (let m of this.group_member) {
        }
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
