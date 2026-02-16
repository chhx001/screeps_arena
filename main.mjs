import { } from 'game/utils';
import { } from 'game/prototypes';
import { } from 'game/constants';
import { MyGame } from './Game.mjs';


// what's this?
//import { } from 'arena/season_beta/capture_the_flag/basic';

var mygame;

export function loop() {
    // Your code goes here
    if (mygame == undefined) {
        mygame = new MyGame()
    }
    mygame.run()
}