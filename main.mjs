import { } from 'game/utils';
import { } from 'game/prototypes';
import { } from 'game/constants';
import { } from 'game';
import { ScreepsGame } from './ScreepsGame.mjs'

var mygame;

export function loop() {
    if (!mygame) mygame = new ScreepsGame();

    mygame.run()
    
}