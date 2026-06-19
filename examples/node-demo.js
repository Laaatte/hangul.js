'use strict';

// examples/node-demo.js — Node 에서 한글JS 라이브러리를 직접 쓰는 예시
// 실행:  node examples/node-demo.js

var 한글 = require('../hangul.js');

var 코드 = [
  '콘스트 과일 = ["사과", "바나나", "포도"];',
  '콘솔.로그(과일.맵((이름, 번호) => `${번호 + 1}. ${이름}`).조인("\\n"));'
].join('\n');

console.log('— 입력 (한글) —');
console.log(코드);

console.log('\n— transpile() 결과 (JS) —');
console.log(한글.transpile(코드));

console.log('\n— run() 실행 결과 —');
한글.run(코드);
