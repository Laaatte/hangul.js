#!/usr/bin/env node
'use strict';

/* ============================================================================
 * 한글JS CLI — .한글 / .han 파일을 변환하거나 실행한다.
 *
 *   han <파일>              파일을 변환 후 실행 (run 과 동일)
 *   han run <파일>          파일을 변환 후 실행
 *   han build <파일> [출력]  변환된 JS를 출력 파일에 쓰거나(없으면) 표준출력으로
 *   han -h | --help        도움말
 *
 * 빌드도 의존성도 없다. Node 하나만 있으면 동작한다.
 * ========================================================================== */

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var 한글 = require('../hangul.js');

function 도움말() {
  process.stdout.write([
    '한글JS v' + 한글.버전 + ' — 한글 키워드로 쓰는 자바스크립트',
    '',
    '사용법:',
    '  han <파일>               변환 후 실행',
    '  han run <파일>           변환 후 실행',
    '  han build <파일> [출력]   변환된 JS 출력(파일 또는 표준출력)',
    '  han -h | --help          이 도움말',
    ''
  ].join('\n'));
}

function 읽기(파일) {
  if (!파일) { console.error('파일 경로가 필요합니다.'); process.exit(1); }
  if (!fs.existsSync(파일)) { console.error('파일을 찾을 수 없습니다: ' + 파일); process.exit(1); }
  return fs.readFileSync(파일, 'utf8');
}

// 변환된 JS를 현재 컨텍스트에서 실행. 스택 추적에 원본 파일명이 찍히도록 filename 지정.
function 실행(파일) {
  var js = 한글.transpile(읽기(파일));
  try {
    vm.runInThisContext(js, { filename: path.resolve(파일) });
  } catch (err) {
    console.error('[한글JS] 실행 오류:', err && err.message ? err.message : err);
    console.error('\n— 변환된 JS —\n' + js);
    process.exit(1);
  }
}

function 빌드(파일, 출력) {
  var js = 한글.transpile(읽기(파일));
  if (출력) {
    fs.writeFileSync(출력, js);
    process.stdout.write('변환 완료 → ' + 출력 + '\n');
  } else {
    process.stdout.write(js + '\n');
  }
}

function 메인(argv) {
  var args = argv.slice(2);
  var cmd = args[0];

  if (!cmd || cmd === '-h' || cmd === '--help') return 도움말();
  if (cmd === 'run') return 실행(args[1]);
  if (cmd === 'build') return 빌드(args[1], args[2]);

  // 서브커맨드 없이 파일만 준 경우 → 실행
  return 실행(cmd);
}

메인(process.argv);
