import { Archer, Enemy, Farmer, Healer, Tower, Warrior } from './Units.mjs'

function debug(...args) {
    console.log("[DEBUG] ", ...args)
}

function info(...args) {
    console.log("[INFO] ", ...args)
}

function warn(...args) {
    console.log("[WARN] ", ...args)
}

function error(...args) {
    console.log("[ERROR] ", ...args)
}

class ArenaUtils {
    static match(obj, game) {
        if (obj.ready == true)
            return
        let unit_type = [Farmer, Archer, Warrior, Healer, Tower, Enemy]
        for (let ut of unit_type) {
            if (ut.match(obj, game) != null) {
                info("Creep " + obj.id + " matched type " + ut.name)
                return
            } 
        }
        
        error("Creep " + JSON.stringify(obj) + " doesn't match any type")
    }
}


export {ArenaUtils, info, warn, error, debug}