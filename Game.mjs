import {getObjectsByPrototype} from 'game/utils';
import {Creep, Flag, StructureContainer, StructureTower} from 'game/prototypes';
import { ArenaUtils } from './Utils.mjs';
import { GroupAllCreeps, GroupGuard, GroupSeeker } from './Groups.mjs';

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

        this.group_list = [new GroupSeeker(this), new GroupGuard(this)]
    }

    scan() {
        this.enemy_list = getObjectsByPrototype(Creep).filter(c => !c.my)
        this.creep_list = getObjectsByPrototype(Creep).filter(c => c.my)
        
        let my_creeps = getObjectsByPrototype(Creep).filter(object => object.my);
        for (let creep of my_creeps) {
            ArenaUtils.match(creep, this)
            for (let group of this.group_list) {
                if (!group.isFull())
                    group.addUnit(creep)
            }
        }

        for (let tower of this.tower_list) {
            ArenaUtils.match(tower, this)
        }
    }

    test() {
        for (let group of this.group_list) {
            group.run()
        }
    }
}

export {MyGame}