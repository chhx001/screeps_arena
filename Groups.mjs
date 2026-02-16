import { getObjectsByPrototype, getTicks } from "game/utils";
import { ArenaBase } from "./Base.mjs";
import { Archer, Farmer, Healer, Tower, Warrior } from "./Units.mjs";
import { Flag } from "game/prototypes/flag";
import { debug, error, info, warn } from "./Utils.mjs";
import { RANGED_ATTACK, ATTACK, ERR_NO_BODYPART, ERR_NOT_IN_RANGE, findClosestByPath, getRange, RESOURCE_ENERGY, StructureContainer, HEAL, MOVE, StructureTower, Creep } from "game";
import { BodyPart } from "arena/season_2/capture_the_flag/basic/prototypes";

class ArenaGroup extends ArenaBase {
    constructor(game) {
        super(game)
        this.unit_list = []
        this.design_list = []
        this.warrior_list = []
        this.healer_list = []
        this.archer_list = []
        this.farmer_list = []
        this.tower_list = []
    }

    isFull() {
        return this.design_list.length == this.unit_list.length
    }

    run() {
        info(`${this.constructor.name} execute run()...`)
    }

    supply() {
        error("Group " + this.constructor.name + " supply() undefined")
    }

    addUnit(unit) {
        if (!this.needUnit(unit))
            return false
        this.unit_list.push(unit)
        unit.group = this
        info(`${unit.unit_type} ${unit.id} added to ${this.constructor.name}`)

        if (unit.unit_type == "Farmer")
            this.farmer_list.push(unit)
        else if (unit.unit_type == "Warrior")
            this.warrior_list.push(unit)
        else if (unit.unit_type == "Healer")
            this.healer_list.push(unit)
        else if (unit.unit_type == "Tower")
            this.tower_list.push(unit)
        else if (unit.unit_type == "Archer")
            this.archer_list.push(unit)
        return true
    }

    removeUnit(unit) {
        let index = this.unit_list.indexOf(unit)
        if (index == -1) return false
        this.unit_list.splice(index, 1)

        if (unit.unit_type == "Farmer")
            this.farmer_list.splice(this.farmer_list.indexOf(unit), 1)
        else if (unit.unit_type == "Warrior")
            this.warrior_list.splice(this.warrior_list.indexOf(unit), 1)
        else if (unit.unit_type == "Healer")
            this.healer_list.splice(this.healer_list.indexOf(unit), 1)
        else if (unit.unit_type == "Tower")
            this.tower_list.splice(this.tower_list.indexOf(unit), 1)
        else if (unit.unit_type == "Archer")
            this.archer_list.splice(this.archer_list.indexOf(unit), 1)
        return true
    }

    needUnit(unit) {
        debug(`${this.constructor.name} try unit ${unit.unit_type} ${unit.id}`)
        if (unit.group != undefined || unit.ready == undefined)    // it has group already
            return false
        let design_cnt = this.design_list.filter(x => x.name == unit.unit_type).length
        let cur_unit_cnt = this.unit_list.filter(x => x.unit_type == unit.unit_type).length
        //debug(`design_cnt = ${design_cnt}, cur_unit_cnt = ${cur_unit_cnt}`)
        return (design_cnt - cur_unit_cnt) > 0
    }

    transferUnit(unit, to_group) {
        if (!to_group.needUnit(unit)) {
            warn(`transfer unit ${unit.unit_type} failed as group ${to_group.constructor.name} does not need`)
            return false
        }
        if (this.removeUnit(unit)) {
            to_group.addUnit(unit)
            unit.group = to_group
            return true
        }
        return false
    }

    mergeToGroup(to_group) {
        let unit_index = 0
        while (this.unit_list.length > unit_index) {
            if (!this.transferUnit(this.unit_list[unit_index], to_group)) {
                //warn(`Failed to merge Group ${this.constructor.name} to ${to_group.constructor.name} on unit ${this.unit_list[0].unit_type}`)
                unit_index ++
            }
        }
        return true
    }
}

/* Guard, Guard the base flag until TICK_LIMIT */
class GroupGuard extends ArenaGroup {
    constructor(game) {
        super(game)
        this.design_list = [Warrior, Warrior, Warrior, Healer, Healer, Farmer, Tower]
        this.warrior_list = []
        this.healer_list = []
        this.archer_list = []
        this.farmer = undefined
        this.tower = undefined
    }

    addUnit(unit) {
        if (super.addUnit(unit)) {
            if (unit.unit_type == "Farmer") {
                this.farmer = unit
            }
            else if (unit.unit_type == "Tower") {
                this.tower = unit
            }
            return true
        } else {
            return false
        }
    }

    removeUnit(unit) {
        if (super.removeUnit(unit)) {
            if (unit.unit_type == "Farmer")
                this.farmer = undefined
            else if (unit.unit_type == "Tower")
                this.tower = undefined
            return true
        } else {
            return false
        }
    }

    run() {
        super.run()
        if (this.unit_list.length == 0) {
            return
        }
        // Tower search for enemies, attack or heal
        if (this.tower == undefined) {
            this.addUnit(this.game.base_tower)
        }
        if (this.tower.exists) {
            this.tower.attackEx()
        }
        
        // farmer maintain the base tower
        if (this.farmer.exists && this.tower.exists) {
            this.farmer.supplyTower(this.tower)
        }

        let base_flag = this.game.base_flag
        // warrior patrol and attack enemies around the flag
        for (let c of this.warrior_list) {
            if (c.exists) {
                // search enemies in base flag range
                c.patrol(base_flag, 6)
            }
        }

        // healer protect the flag, others heal injured alies
        let protector = undefined
        for (let c of this.healer_list) {
            if (c.exists && protector == undefined) {
                // pickup protector
                protector = c
                // protector must move to the base flag
                c.moveTo(base_flag)
                if (c.hits < c.hitsMax && c.heal(c) != ERR_NO_BODYPART) {
                    // try heal self
                } else {
                    // try heal alies enemies in range
                    let injured = c.findInRange(this.game.creep_list, 3).filter(c => c.hits < c.hitsMax)
                    if (injured.length > 0) {
                        c.heal(injured[0])
                    }
                }
                continue
            } else if (c.exists) {
                // other healer heal around the base flag
                c.patrol(base_flag, 10)
            }
        }
        
        

    }


}
/*
    Seeker, if time < 1500 ticks, try arm itself
    if full, change one
    farmer will not arm itself
*/
class GroupSeeker extends ArenaGroup {
    static TICK_LIMIT = 1500

    constructor(game) {
        super(game)
        // Seeker, 1 WARRIOR, 1 ARCHER, 1 HEALER, 1 Farmer
        this.design_list = [Warrior, Archer, Archer, Archer, Archer, Healer, Healer, Farmer, Tower]
        this.flag = undefined
        this.tower = undefined
    }

    addUnit(unit) {
        if (super.addUnit(unit)) {
            if (unit.unit_type == "Farmer") {
                this.farmer = unit
            }
            else if (unit.unit_type == "Tower") {
                this.tower = unit
            }
            return true
        } else {
            return false
        }
    }

    removeUnit(unit) {
        if (super.removeUnit(unit)) {
            if (unit.unit_type == "Farmer")
                this.farmer = undefined
            else if (unit.unit_type == "Tower")
                this.tower = undefined
            return true
        } else {
            return false
        }
    }

    picker_alive(p0_list, p1_list = []) {
        for (let c of p0_list) {
            if (c.exists && (c.target == undefined || !c.target.exists))
                return c
        }
        for (let c of p1_list) {
            if (c.exists && (c.target == undefined || !c.target.exists))
                return c
        }
        return undefined
    }

    run_arm() {
        if (this.flag == undefined) {
            this.flag = this.game.base_flag.findClosestByRange(this.game.flag_list.filter(f => !f.my))
        }
        if (this.tower == undefined) {
            this.tower = this.flag.findClosestByRange(this.game.tower_list)
            this.addUnit(this.tower)
        }

        // tower, if it is my and exists, search and attack
        if (this.tower.exists && this.tower.my) {
            this.tower.attackEx()
        }
        // farmer, if side flag is not my, rush to it, otherwise supply the side tower
        info(`Seeker, flag ${this.flag.id}, my: ${this.flag.my}, farmer: ${this.farmer.id}`)
        if (this.flag.my == undefined || !this.flag.my) {
            this.farmer.moveTo(this.flag)
        } else {
            this.farmer.supplyTower(this.tower)
        }

        // Seeker search for body parts
        // rebalance move speed
        for (let c of this.unit_list) {
            if (c instanceof StructureTower || !c.exists)    //no tower
                continue
            c.move_speed = 0
            for (let bp of c.body) {
                if (bp.type != MOVE)
                    c.move_speed -= 1
                else
                    c.move_speed += 1
            }
        }
        // pick
        let body_parts = getObjectsByPrototype(BodyPart)
        let picker = undefined
        body_parts = this.flag.findInRange(body_parts, 15)
        for (let bp of body_parts) {
            picker = undefined
            if (bp["picker"] != undefined && bp["picker"].exists) {
                bp["picker"].moveTo(bp)
                continue
            }
            if (bp.type == ATTACK) {
                // no one like this except warrior
                picker = this.picker_alive(this.warrior_list)
            } else if (bp.type == MOVE){
                // let's see if warrior_giant or archer_giant who need this more
                // check archer first, archer has higher priority
                let archer_giant = this.picker_alive(this.archer_list)
                let warrior_giant = this.picker_alive(this.warrior_list)
                if (archer_giant && archer_giant.move_speed < 0) {
                    picker = archer_giant
                } else if (warrior_giant && warrior_giant.move_speed < 0) {
                    picker = warrior_giant
                } else {
                    picker = (archer_giant) ? archer_giant : warrior_giant;
                }
            } else {
                // others are all give to the first archer
                picker = this.picker_alive(this.archer_list)
            }
            if (picker) {
                picker.target = bp
                bp["picker"] = picker
                picker.moveTo(bp)
            }
        }

        // warrior, which is not picking parts, patrol the flag
        for (let c of this.warrior_list) {
            if (c.exists && (c.target == undefined || !c.target.exists)) {
                c.patrol(this.flag, 8)
            }
        }

        // archer, which is not picking parts, patrol the flag
        for (let c of this.archer_list) {
            if (c.exists && (c.target == undefined || !c.target.exists)) {
                c.patrol(this.flag, 8)
            }
        }

        // healer, which is not picking parts, patrol the flag
        for (let c of this.healer_list) {
            if (c.exists && (c.target == undefined || !c.target.exists)) {
                c.patrol(this.flag, 8)
            }
        }
        
    }

    run_rush() {
        info("Seeker rush is not implemented")
        this.run_arm()
    }

    run() {
        super.run()
        if (this.unit_list.length == 0) {
            return
        }
        let tick = getTicks()
        if (tick < GroupSeeker.TICK_LIMIT)
            this.run_arm()
        else
            this.run_rush()
    }


}

class GroupRush extends ArenaGroup {
    static TICK_LIMIT = 1200
    constructor(game) {
        super(game)
        this.tick_limit = GroupRush.TICK_LIMIT
        this.archer_giant = undefined
        this.warrior_giant = undefined
    }

    needUnit(unit) {
        // Rush Group reject everything before the limit tick
        if (getTicks() < GroupRush.TICK_LIMIT)
            return false
        if (unit.ready == undefined)
            return false
        if (unit.unit_type == Farmer.name || unit.unit_type == Tower.name) {
            return false    // do not need farmer
        }
        return true
    }

    addUnit(unit) {
        if (super.addUnit(unit)) {
            if ((unit instanceof Creep) && unit.body.length > 12) {
                if (unit.unit_type == Archer.name) {
                    this.archer_giant = unit
                } else if (unit.unit_type == Warrior.name) {
                    this.warrior_giant = unit
                }
            }
            return true
        }
        return false
    }

    removeUnit(unit) {
        if (super.removeUnit(unit)) {
            if (unit == this.archer_giant) {
                this.archer_giant = undefined
            } else if (unit == this.warrior_giant) {
                this.warrior_giant = undefined
            }
            return true
        }
        return false
    }

    run() {
        super.run()
        if (this.unit_list.length == 0) {
            return
        }

        // tower attackEx as much as possible
        for (let tower of this.tower_list) {
            tower.attackEx()
        }
        let enemy_flag = this.game.flag_list.filter(f => !f.my)
        enemy_flag = this.warrior_giant.findClosestByPath(enemy_flag)
        // warrior giant, target the enemy flag, rush
        {
            if (!this.warrior_giant.exists) {
                for (let w of this.warrior_list) {
                    if (w.exists) {
                        this.warrior_giant = w
                        break
                    }
                }
            }
            if (this.warrior_giant.exists) {
                this.warrior_giant.moveTo(enemy_flag)
                let enemy_in_range = this.warrior_giant.findInRange(this.game.enemy_list, 1)
                if (enemy_in_range.length > 0) {
                    this.warrior_giant.attack(enemy_in_range[0])
                }
            }
        }

        // archer giant
        {
            if (!this.archer_giant.exists) {
                for (let a of this.archer_list) {
                    if (a.exists) {
                        this.archer_giant = a
                        break
                    }
                }
            }
            if (this.archer_giant.exists) {
                let enemy_in_range = this.archer_giant.findInRange(this.game.enemy_list, 3)
                if (enemy_in_range.length > 0) {
                    this.archer_giant.hitAndRun(enemy_in_range[0])
                } else {
                    this.archer_giant.patrol(enemy_flag, 8)
                }
            }
        }

        // other warriors/archers patrol warrior giant or archer giant
        {
            for (let w of this.warrior_list) {
                if (w == this.warrior_giant)
                    continue
                if (w.exists) {
                    if (this.warrior_giant.exists)
                        w.patrol(this.warrior_giant, 8)
                    else if (this.archer_giant.exists)
                        w.patrol(this.archer_giant, 8)
                }
            }

            for (let a of this.archer_list) {
                if (a == this.archer_giant)
                    continue
                if (a.exists) {
                    if (this.archer_giant.exists)
                        a.patrol(this.archer_giant, 8)
                    else if (this.warrior_giant.exists)
                        a.patrol(this.warrior_giant, 8)
                }
            }
        }

        // healers, follow giant
        {
            for (let h of this.healer_list) {
                if (h.exists) {
                    if (this.warrior_giant.exists)
                        h.patrol(this.warrior_giant, 8)
                    else if (this.archer_giant.exists)
                        h.patrol(this.archer_giant, 8)
                }
            }
        }

    }



}

// Test Group, just rush to the base
class GroupAllCreeps extends ArenaGroup {
    constructor(game) {
        super(game)
    }

    // need any group
    needUnit(unit) {
        if (unit.group != undefined || unit.ready == undefined)    // it has group already
            return false
        return true
    }

    run() {
        super.run()
        var enemy_flag = this.game.flag_list.find(object => !object.my);
        var my_creeps = this.game.creep_list
        var my_flag = this.game.flag_list.find(f => f.my)
        for (let unit of this.unit_list) {
            unit.fleeFrom(my_creeps, 4)
        }
    }
}

export {GroupAllCreeps, GroupSeeker, GroupGuard, GroupRush}