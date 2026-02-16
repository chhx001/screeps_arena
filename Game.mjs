import {getObjectsByPrototype} from 'game/utils';
import {Creep, Flag, StructureContainer, StructureTower} from 'game/prototypes';
import { ArenaUtils } from './Utils.mjs';
import { GroupAllCreeps, GroupGuard, GroupRush, GroupSeeker } from './Groups.mjs';
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

        this.enemy_list = getObjectsByPrototype(Creep).filter(c => !c.my)
        this.creep_list = getObjectsByPrototype(Creep).filter(c => c.my)

        let my_creeps = getObjectsByPrototype(Creep).filter(object => object.my);
        for (let creep of my_creeps) {
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