import test from 'node:test';
import assert from 'node:assert/strict';
import { initialOpeningAnimation, openingAnimationReducer as reduce } from '../src/lib/booster-animation';

test('opening presentation has ordered phases and ignores rapid repeated commands', () => {
  const initial=initialOpeningAnimation();
  assert.equal(initial.phase,'pack');
  assert.equal(reduce(initial,{type:'REVEAL',index:0}),initial);
  const tear=reduce(initial,{type:'OPEN'});
  assert.equal(tear.phase,'tear');
  assert.equal(reduce(tear,{type:'OPEN'}),tear);
  const fan=reduce(tear,{type:'TEAR_DONE'});
  assert.equal(fan.phase,'fan');
  assert.equal(reduce(fan,{type:'TEAR_DONE'}),fan);
  const reveal=reduce(fan,{type:'FAN_DONE'});
  assert.equal(reveal.phase,'reveal');
  const first=reduce(reveal,{type:'REVEAL',index:0});
  assert.deepEqual(first.revealed,[0]);
  assert.equal(reduce(first,{type:'REVEAL',index:0}),first);
  assert.equal(reduce(first,{type:'REVEAL',index:1}),first);
  const settled=reduce(first,{type:'FLIP_DONE'});
  assert.equal(settled.flipping,null);
  assert.equal(reduce(settled,{type:'REVEAL',index:3}),settled);
});

test('all five sequential flips reach summary with unique indices', () => {
  let state=reduce(reduce(reduce(initialOpeningAnimation(),{type:'OPEN'}),{type:'TEAR_DONE'}),{type:'FAN_DONE'});
  state=reduce(state,{type:'AUTOMATIC'});
  for(let index=0;index<5;index++) {
    state=reduce(state,{type:'REVEAL',index});
    assert.equal(state.flipping,index);
    state=reduce(state,{type:'FLIP_DONE'});
  }
  assert.equal(state.phase,'summary');
  assert.deepEqual(state.revealed,[0,1,2,3,4]);
  assert.equal(state.automatic,false);
  assert.equal(reduce(state,{type:'REVEAL',index:0}),state);
});

test('reduced motion and history replay show already assigned rewards immediately', () => {
  assert.equal(initialOpeningAnimation(true).phase,'summary');
  assert.equal(initialOpeningAnimation(false,true).phase,'summary');
  assert.deepEqual(reduce(initialOpeningAnimation(),{type:'REDUCE'}).revealed,[0,1,2,3,4]);
  assert.deepEqual(initialOpeningAnimation(),{phase:'pack',revealed:[],flipping:null,automatic:false});
});
