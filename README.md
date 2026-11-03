# Nitro Surge Fighters

Pixel-art fighting game playable in the browser (PC and mobile in landscape).

## Play locally
Double-click `index.html`.

## Mobile controls (landscape)
- Stick: move · up = jump (forward/back = roll) · down = crouch · down + back = low block · back = block
- Y: punch · B: kick · A: fireball (hold 2 s for a MAX fireball, 1 s when energy is 80% or less) · X: counter
- Forward + Y: long punch · Forward + B: long kick
- Down + Y: rising uppercut · Down + B x3: low kicks, the 3rd knocks down
- Up + A: uppercut · Back + A: tornado kick x4 (4 hits in a row knock down, each spin can be countered)
- Air + A: spin kick
- X just before a hit: counter (flash, foe in slow motion 1 s). Then close to him: Y = overhead slam, B = rolling throw
- Combos while the foe is stunned: Y Y B B · B B Y Y · Y Y B A · B B Y A — the 4th hit is on fire and knocks him down
- START: pause (continue, move list, character select)

## PC controls
- Arrows: move · J: punch · K: kick · L: special · Space: counter · Enter: start/confirm · Esc: back

## Phone controllers (2 players on PC)
On the character select screen (PC), scan the left QR code for Player 1 and the right one for Player 2.
Each phone opens `controller.html` (stick + Y/X/B/A + START) and talks to the PC directly through WebRTC (PeerJS).
When Player 2's phone is connected, Player 2 picks the second fighter and plays instead of the CPU.
