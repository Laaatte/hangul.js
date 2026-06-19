'use strict';

// node:test 기반. 의존성 없음.  실행:  node --test   (또는  npm test)

var test = require('node:test');
var assert = require('node:assert');
var fs = require('node:fs');
var path = require('node:path');
var 한글 = require('../hangul.js');
var transpile = 한글.transpile;

test('예약어를 변환한다', function () {
  assert.strictEqual(
    transpile('펑션 더하기(가, 나) { 리턴 가 + 나; }'),
    'function 더하기(가, 나) { return 가 + 나; }'
  );
});

test('같은 한글이 일반 위치와 멤버 위치에서 다르게 풀린다', function () {
  assert.strictEqual(transpile('뉴 맵()'), 'new Map()');           // normal: 맵 -> Map
  assert.strictEqual(transpile('[].맵((엑스) => 엑스)'), '[].map((엑스) => 엑스)'); // member: 맵 -> map
});

test('문자열 리터럴 안은 건드리지 않는다', function () {
  assert.strictEqual(transpile('콘솔.로그("포 맵 콘솔")'), 'console.log("포 맵 콘솔")');
  assert.strictEqual(transpile("'포'"), "'포'");
});

test('주석은 보존한다', function () {
  assert.strictEqual(transpile('// 포 맵\n포'), '// 포 맵\nfor');
  assert.strictEqual(transpile('/* 맵 */ 포'), '/* 맵 */ for');
});

test('템플릿 리터럴: 본문은 그대로, ${} 안만 변환', function () {
  assert.strictEqual(transpile('`포 맵 ${트루}`'), '`포 맵 ${true}`');
});

test('전개 연산자(...) 뒤 식별자는 멤버가 아니다', function () {
  assert.strictEqual(transpile('[...맵]'), '[...Map]');
});

test('정규식 리터럴 본문은 변환하지 않는다', function () {
  assert.strictEqual(transpile('"맵".매치(/맵/g)'), '"맵".match(/맵/g)');
  assert.strictEqual(transpile('콘스트 정규 = /포|맵/;'), 'const 정규 = /포|맵/;');
  assert.strictEqual(transpile('리턴 /맵/.테스트(에스)'), 'return /맵/.test(에스)');
});

test('나눗셈 연산자는 정규식으로 오해하지 않는다', function () {
  assert.strictEqual(transpile('매스.파워(2,3) / 2'), 'Math.pow(2,3) / 2');
  assert.strictEqual(transpile('에이 / 비 / 시'), '에이 / 비 / 시');
  assert.strictEqual(transpile('배열.길이 / 2'), '배열.length / 2');
});

test('숫자 리터럴은 그대로 둔다', function () {
  assert.strictEqual(transpile('3.14 + 1e3 + 0x1f + 10n'), '3.14 + 1e3 + 0x1f + 10n');
});

test('옵셔널 체이닝과 스프레드', function () {
  assert.strictEqual(transpile('객체?.맵(엑스)'), '객체?.map(엑스)');
  assert.strictEqual(transpile('[...리스트]'), '[...리스트]');
});

test('클래스 생성자(콘스트럭터)는 일반 위치에서도 변환된다', function () {
  assert.strictEqual(
    transpile('클래스 에이 { 콘스트럭터() {} }'),
    'class 에이 { constructor() {} }'
  );
});

test('run(): 변환 후 실행하고 결과를 돌려준다', function () {
  assert.strictEqual(한글.run('리턴 [1,2,3].리듀스((아, 비) => 아 + 비, 0);'), 6);
});

test('버전과 사전이 노출된다', function () {
  assert.strictEqual(typeof 한글.버전, 'string');
  assert.strictEqual(한글.NORMAL.포, 'for');
  assert.strictEqual(한글.MEMBERS.맵, 'map');
});

// 사전이 커질수록 같은 한글 키가 한 객체 안에서 중복되면 조용히 덮어써진다.
// 소스를 직접 스캔해 사전별 중복 키가 없음을 상시 보장한다.
test('사전 안에 중복된 한글 키가 없다 (덮어쓰기 가드)', function () {
  var src = fs.readFileSync(path.join(__dirname, '..', 'hangul.js'), 'utf8');
  var keyRe = /([가-힣ㄱ-ㆎ][가-힣ㄱ-ㆎ0-9]*)\s*:/g;

  ['RESERVED', 'GLOBALS', 'MEMBERS'].forEach(function (name, idx, all) {
    var after = ['GLOBALS', 'MEMBERS', 'NORMAL'][idx];
    var start = src.indexOf('var ' + name + ' = {');
    var end = src.indexOf('var ' + after + ' = {', start);
    // 주석 안의 `한글:` 까지 키로 오인하지 않도록 한 줄 주석은 제거하고 스캔한다.
    var block = src.slice(start, end).replace(/\/\/[^\n]*/g, '');

    var seen = Object.create(null);
    var dups = [];
    var m;
    while ((m = keyRe.exec(block))) {
      if (seen[m[1]]) dups.push(m[1]);
      seen[m[1]] = true;
    }
    assert.deepStrictEqual(dups, [], name + ' 사전에 중복 키: ' + dups.join(', '));
  });
});
