import {getObjectsByPrototype} from 'game/utils';
import {Creep, Flag, StructureContainer, StructureTower} from 'game/prototypes';
import { ArenaUtils } from './Utils.mjs';
import { GroupAllCreeps, GroupEnemy, GroupGuard, GroupRush, GroupSeeker } from './Groups.mjs';
import { getTicks } from 'game';

class MyGame {
    constructor() {
        // settings
        this.scan_once()
        this.scan()
    }

    run() {
        this.scan()
        this.test()
    }

    scan_once() {
        this.container_list = getObjectsByPrototype(StructureContainer)
        this.tower_list = getObjectsByPrototype(StructureTower)
        this.flag_list = getObjectsByPrototype(Flag)
        this.base_flag = this.flag_list.find(f=>f.my)
        this.base_tower = this.base_flag.findClosestByRange(this.tower_list)
        this.base_container = this.base_flag.findClosestByRange(this.container_list)

        this.group_list = []
        this.group_list.push(new GroupSeeker(this))
        this.group_list.push(new GroupGuard(this))

        this.enemy_group = new GroupEnemy(this)
        this.group_list.push(this.enemy_group)

        this.enemy_list = getObjectsByPrototype(Creep).filter(c => !c.my)
        this.creep_list = getObjectsByPrototype(Creep).filter(c => c.my)

        let creeps = getObjectsByPrototype(Creep);
        for (let creep of creeps) {
            ArenaUtils.match(creep, this)
            for (let group of this.group_list) {
                group.addUnit(creep)
            }
        }

        for (let tower of this.tower_list) {
            ArenaUtils.match(tower, this)
        }
    }

    scan() {
        this.enemy_list = getObjectsByPrototype(Creep).filter(c => !c.my)
        this.creep_list = getObjectsByPrototype(Creep).filter(c => c.my)
    }

    getEnemyList() {
        return this.enemy_group.getUnitList()
    }

    test() {
        // == TICK_LIMIT only exec once
        if (getTicks() == GroupRush.TICK_LIMIT) {
            let group_rush = new GroupRush(this)
            for (let group of this.group_list) {
                group.mergeToGroup(group_rush)
            }
            this.group_list.push(group_rush)
        }
        for (let group of this.group_list) {
            group.run()
        }
    }
}

export {MyGame}