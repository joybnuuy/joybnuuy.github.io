// 반장전(8국) 진행: 친 교대, 본장, 리치봉, 종료 판정. 8국 뒤 3만 이상이 없으면 서입 연장
import { Hand } from './game.js';
                                            
import { makeRng } from './tiles.js';

                            
               
                      
                                
                                        
                                                                          
                                                        
 

// 상태를 JSON으로 저장했다 되살릴 수 있게 난수는 시드 + 몇 번째 판인지로만 만든다
export class Match {
  seed        ;
  serial = 0;
  scores          ;
  dealer = 0;
  handNo = 0;           // 0부터. 4 미만이면 동장, 이상이면 남장
  honba = 0;
  sticks = 0;
  total        ;
  tobi         ;
  endScore        ;
  maxHands        ;
  finished = false;
  history               = [];

  constructor(o           ) {
    this.seed = o.seed >>> 0;
    this.scores = new Array(4).fill(o.startScore ?? 25000);
    this.total = o.hands ?? 8;
    this.tobi = o.tobi ?? true;
    this.endScore = o.endScore ?? 30000;
    this.maxHands = o.maxHands ?? 12;
  }

  newHand()       {
    return new Hand({
      rng: makeRng((this.seed ^ Math.imul(++this.serial, 0x9e3779b1)) >>> 0), dealer: this.dealer, roundWind: Math.min(2, Math.floor(this.handNo / 4)),
      scores: this.scores, honba: this.honba, sticks: this.sticks,
    });
  }

  // 끝난 판을 반영하고 다음 국 준비
  finishHand(h      )       {
    const r = h.result ;
    this.history.push(r);
    for (let s = 0; s < 4; s++) this.scores[s] = h.scores[s] + r.deltas[s];
    this.sticks = r.sticksLeft;
    if (r.kind === 'draw') this.honba++;
    else this.honba = r.dealerContinues ? this.honba + 1 : 0;
    const top = Math.max(...this.scores);
    const inFinal = this.handNo >= this.total - 1; // 마지막 국이거나 서입 연장 중
    if (r.dealerContinues) {
      // 마지막 국 이후 친이 연장할 때: 친이 1등이고 3만 이상이면 끝낸다
      if (inFinal && this.scores[this.dealer] === top && top >= this.endScore) this.finished = true;
    } else {
      this.dealer = (this.dealer + 1) % 4;
      this.handNo++;
      if (inFinal && top >= this.endScore) this.finished = true;
      else if (this.handNo >= this.maxHands) this.finished = true; // 서입 연장에도 3만이 안 나오면 종료
    }
    if (this.tobi && this.scores.some((x) => x < 0)) this.finished = true;
  }

  // JSON으로 저장 (판 기록은 빼고)
  toJSON()      {
    const { history: _h, ...rest } = this       ;
    return rest;
  }
  static revive(data     )        {
    return Object.assign(Object.create(Match.prototype), data, { history: [] });
  }

  ranking()           {
    return [0, 1, 2, 3].sort((a, b) => this.scores[b] - this.scores[a] || a - b);
  }
}
