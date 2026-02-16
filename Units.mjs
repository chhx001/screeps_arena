import { Creep } from "game/prototypes/creep"
import { MOVE, ATTACK, CARRY, ERR_NO_BODYPART, ERR_NOT_IN_RANGE, findInRange, getRange, HEAL, OK, RANGED_ATTACK, RANGED_ATTACK_DISTANCE_RATE, RESOURCE_ENERGY, searchPath, StructureContainer } from "game";
import { StructureTower } from "game/prototypes/tower";
import { debug, error, info } from "./Utils.mjs";

class ArenaUnitExt extends Creep {
    constructor(game) {
        super()
        this.game = game
        this.range = 0
        this.moveable = false
        this.unit_type = undefined
        error("ArenaUnitExt() is called, which should not happen")
    }

    countBodyPart(part) {
        let ret = 0
        for (let bp of this.body) {
            if (bp.type == part)
                ret ++
        }
        return ret
    }

    attackEx(obj) {
        //if hit point < 50%, heal it self instead of shoot.
        let ret = ERR_NO_BODYPART
        if (this.hits < this.hitsMax * 0.5) {
            ret = this.heal(this)
        }
        // if we can't self heal
        if (ret != OK) {
            let distance = this.getRangeTo(obj)
            // 1. try ranged attack
            let ret = this.rangedAttack(obj)
            if (ret == ERR_NOT_IN_RANGE && distance == 4) {
                // it means we can ranged attack, but enemy is too far. See if we can reach the range by 1 step, if not, heal
                return ret
            } else if (ret == ERR_NO_BODYPART) {
                // it can't ranged attack, then try melee attack
                ret = this.attack(obj)
                if (ret == ERR_NOT_IN_RANGE && distance == 2) {
                    return ret
                }
            }
            // attack can't reach, heal
            ret = this.heal(this)
        }
        return ret
    }

    fleeFrom(obj, distance = 4) {
        if (Array.isArray(obj)) {
            obj = obj.map(o => {return {pos: o, range: distance}})
        } else {
            obj = {pos: obj, range: distance}
        }

        let result = searchPath(this, obj, {flee: true, maxOps: 20})
        if (result.path.length > 0) {
            this.moveTo(result.path[0])
        }
    }

    supplyTower(tower) {
        error(`${this.unit_type} ${this.id} does not support supplyTower() please check`)
    }

    // patrol around an object with range
    patrol(obj, range) {
        error(`${this.unit_type} ${this.id} does not support patrol() please check`)
    }

    static addFunctions(obj) {
        let cls = this
        // mix-in stop at Creep
        while (cls && cls != Object.prototype && cls != Creep) {
            //debug("addFunctions iterated: " + Object.getOwnPropertyNames(cls.prototype))
            Object.getOwnPropertyNames(cls.prototype)
                .filter(key => key !== 'constructor' && typeof cls.prototype[key] === 'function')
                .forEach(key => {
                    if (key in obj) {
                        info(`${key} already exist in ${cls.name}`)
                    } else {
                        obj[key] = cls.prototype[key];
                        //debug(`key ${key} mixed to ${typeof obj}`)
                    }
            });
            cls = Object.getPrototypeOf(cls)
        }
    }

    static addVariables(obj) {
        obj.moveable = true
        obj.range = 1
        obj.attackable = true
    }

    static mixIn(obj, game, unit_type = undefined) {
        obj.ready = true
        if (unit_type == undefined) {
            error(`Unit type not provided for obj id ${obj.id}, set unknown`)
        }
        // mix in
        unit_type.addFunctions(obj)
        unit_type.addVariables(obj)
        obj.move_speed = 0
        if (obj instanceof Creep) {
            for (let bp of obj.body) {
                if (bp.type != MOVE)
                    obj.move_speed -= 1
                else
                    obj.move_speed += 1
            }
        }
        obj.unit_type = unit_type.name
        obj.game = game
        return obj
    }
}

class Farmer extends ArenaUnitExt {
    constructor(game) {
        super(game)
    }

    supplyTower(tower) {
        debug(`Farmer ${this.id} start to supply tower ${tower.id}`)
        if (tower.exists) {
            if (this.store.getUsedCapacity(RESOURCE_ENERGY) < 10) {
                if (this.target == undefined || !(this.target instanceof StructureContainer)) {
                    this.target = tower.findClosestByRange(this.game.container_list)
                }
                if (this.withdraw(this.target, RESOURCE_ENERGY) != ERR_NOT_IN_RANGE) {
                    return
                }
            } else if (this.store.getUsedCapacity(RESOURCE_ENERGY) >= 10){
                this.target = tower
                if (this.transfer(this.target, RESOURCE_ENERGY) != ERR_NOT_IN_RANGE) {
                    return
                }
            }
            this.moveTo(this.target)
        }
    }

    static addVariables(obj) {
        super.addVariables(obj)
    }

    static match(obj, game) {
        if (!(obj instanceof Creep) || obj.ready == true)
            return null;
        let body_part = obj.body.filter(bp => bp.type == CARRY)
        if (body_part.length > 0) 
            return ArenaUnitExt.mixIn(obj, game, this)
        else
            return null
    }
}

class Archer extends ArenaUnitExt {
    constructor(game) {
        super(game)
        this.moveable = true
    }

    hitAndRun(obj) {
        if (this.moveable == false || this.range <= 1)
            return false
        /* detect the enemies within this.range
            Policy 0: if there no enemies within 2, move close and shoot
            Policy 1: if there is enemies within 2, leave enemy and shoot
        */
        let enemies_in_range = findInRange(this, this.game.enemy_list, this.range)
        let policy = 0
        if (enemies_in_range.length > 0) {
            policy = 1
            for (let e of enemies_in_range) {
                let r = getRange(this, e)
                if (r <= this.range - 1) {
                    policy = 2
                    // in this case, we leave the enemy, we attack this one instead
                    obj = e
                    break
                }
            }
        }

        if (policy == 0) {
            this.attackEx(obj)
            this.moveTo(obj)
        } else if (policy == 1) {
            this.attackEx(obj)
            this.fleeFrom(obj)
        }
    }

    patrol(obj, range) {
        let enemy_list = obj.findInRange(this.game.enemy_list, range) 
        if (enemy_list.length > 0) {
            let enemy = this.findClosestByRange(enemy_list)
            this.hitAndRun(enemy)
        } else {
            // no enemy, move to target
            this.moveTo(obj)
        }
    }

    static addVariables(obj) {
        super.addVariables(obj)
        obj.range = 3
    }

    static match(obj, game) {
        if (!(obj instanceof Creep) || obj.ready == true)
            return null;
        let body_part = obj.body.filter(bp => bp.type == RANGED_ATTACK)
        if (body_part.length > 0) 
            return ArenaUnitExt.mixIn(obj, game, this)
        else
            return null
    }
}

class Healer extends Archer {
    constructor(game) {
        super(game)
        this.attackable = false
    }

    patrol(obj, range) {
        // ? can we attack?
        if (!this.attackable) {
            let ranged_attack_count = this.countBodyPart(RANGED_ATTACK)
            if (ranged_attack_count > 0) {
                info(`Healer ${this.id} get attack ability`)
                this.attackable = true
            }
        }
        if (this.attackable) {
            // if attackable, work as archer
            super.patrol(obj, range)
        } else {
            // it is just an healer
            let injured = obj.findInRange(this.game.creep_list, range).filter(c => c.hits < c.hitsMax)
            if (injured.length > 0) {
                injured = this.findClosestByRange(injured)
                this.heal(injured)
                if (getRange(this, injured) > 1) {
                    this.moveTo(injured)
                }
            } else {
                this.moveTo(obj)
            }
        }
        
    }

    static addVariables(obj) {
        super.addVariables(obj)
        obj.range = 3
        obj.attackable = false
    }

    static match(obj, game) {
        if (!(obj instanceof Creep) || obj.ready == true)
            return null;
        let body_part = obj.body.filter(bp => bp.type == HEAL)
        if (body_part.length > 0) 
            return ArenaUnitExt.mixIn(obj, game, this)
        else
            return null
    }
}

class Warrior extends ArenaUnitExt {
    constructor(game) {
        super(game)
    }

    patrol(obj, range) {
        let enemy_list = obj.findInRange(this.game.enemy_list, range) 
        if (enemy_list.length > 0) {
            let enemy = this.findClosestByRange(enemy_list)
            this.attack(enemy)
            this.moveTo(enemy)
        } else {
            // no enemy, move to target
            this.moveTo(obj)
        }
    }

    static addVariables(obj) {
        super.addVariables(obj)
    }

    static match(obj, game) {
        if (!(obj instanceof Creep) || obj.ready == true)
            return null;
        let body_part = obj.body.filter(bp => bp.type == ATTACK)
        if (body_part.length > 0) 
            return ArenaUnitExt.mixIn(obj, game, this)
        else
            return null
    }
}

class Tower extends ArenaUnitExt {
    constructor(game) {
        super(game)
        this.range = 20
    }

    attackEx(obj) {
        let enemy = obj
        if (!enemy)
            enemy = this.findClosestByRange(this.game.enemy_list)
        let ret = OK
        ret = this.attack(enemy)
        if (ret == ERR_NOT_IN_RANGE) {
            // try heal
            let injured = this.game.creep_list.filter(c => c.hits < c.hitsMax)
            injured = this.findInRange(injured, this.range)
            if (injured.length > 0) {
                ret = this.heal(injured[0])
            }
        }
        return ret
    }

    static addVariables(obj) {
        super.addVariables(obj)
        this.moveable = false;
        obj.range = 20
    }

    static match(obj, game) {
        if (!(obj instanceof StructureTower) || obj.ready == true)
            return null;
        else return ArenaUnitExt.mixIn(obj, game, this)
    }
}


export {Farmer, Warrior, Archer, Healer, Tower}