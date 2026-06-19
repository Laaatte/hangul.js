/*! ============================================================================
 * 한글JS (hangul.js) v0.4.0 — 한글 키워드로 쓰는 자바스크립트
 * ----------------------------------------------------------------------------
 * 빌드도 npm도 필요 없는 단일 파일. 그냥 다운로드해서 불러오면 끝.
 *
 *   <head>
 *     <script src="hangul.js"></script>
 *     <script type="text/hangul">
 *       콘솔.로그(["철수","영희"].맵(이름 => `안녕, ${이름}!`).조인("\n"));
 *     </script>
 *   </head>
 *
 * 페이지 로드 시 <script type="text/hangul"> 블록(인라인 / src= 외부파일 둘 다)을
 * 순서대로 한글->JS 변환 후 일반 <script>처럼 전역 스코프에서 실행한다.
 *
 * 수동 API:  한글.transpile(코드)  // 변환된 JS 문자열
 *            한글.run(코드)        // 변환 후 실행하고 결과 반환
 *
 * 음차 원칙: 발음 그대로. (function->펑션, for->포, push->푸시)
 * 기호(. / = () [] * & 등)는 손대지 않는다. "단어"만 한글로 바꾼다.
 * ----------------------------------------------------------------------------
 * 구성
 *   §0  공용 유틸     — 식별자 정규식, has()
 *   §1  사전          — RESERVED / GLOBALS / MEMBERS / NORMAL
 *   §2  트랜스파일러   — transpile() / scanCode() / scanTemplate()
 *   §3  실행 · 로더    — run() / runScripts()
 *   §4  노출          — Node(CommonJS) + 브라우저 전역
 * ========================================================================== */
(function () {
  'use strict';

  // ==========================================================================
  // §0  공용 유틸
  // ==========================================================================

  // 식별자 문자: JS 식별자 문자 + 한글(첫가끝 자모 / 호환 자모 / 완성형 음절).
  var ID_START = /[A-Za-z_$ᄀ-ᇿㄱ-ㆎ가-힣]/;
  var ID_PART  = /[0-9A-Za-z_$ᄀ-ᇿㄱ-ㆎ가-힣]/;
  var WS = /\s/;

  function has(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  // ==========================================================================
  // §1  사전 — 위치별로 둘로 나뉜다.
  //   NORMAL  : 일반 위치 토큰 (예약어 + 전역 객체/함수)
  //   MEMBERS : '.' 바로 뒤(멤버 접근) 토큰 (메서드/프로퍼티명)
  // 같은 한글이 위치에 따라 다르게 풀린다:  뉴 맵() -> new Map(),  [].맵() -> [].map()
  // ==========================================================================

  /** 예약어 + 리터럴 값 (일반 위치) */
  var RESERVED = {
    // 선언 / 제어
    바: 'var', 렛: 'let', 콘스트: 'const',
    펑션: 'function', 클래스: 'class',
    이프: 'if', 엘스: 'else',
    포: 'for', 와일: 'while', 두: 'do',
    스위치: 'switch', 케이스: 'case', 디폴트: 'default',
    브레이크: 'break', 컨티뉴: 'continue', 리턴: 'return',

    // 예외
    트라이: 'try', 캐치: 'catch', 파이널리: 'finally', 쓰로우: 'throw',

    // 클래스 / 객체
    뉴: 'new', 디스: 'this', 익스텐즈: 'extends', 슈퍼: 'super',
    스태틱: 'static', 겟: 'get', 셋: 'set',

    // 연산자성
    타입오브: 'typeof', 인스턴스오브: 'instanceof', 딜리트: 'delete',
    보이드: 'void', 인: 'in', 오브: 'of',

    // 비동기 / 모듈
    어싱크: 'async', 어웨이트: 'await', 일드: 'yield',
    임포트: 'import', 익스포트: 'export', 프롬: 'from', 애즈: 'as',

    // 기타 예약어
    디버거: 'debugger', 위드: 'with', 이넘: 'enum',
    임플리먼츠: 'implements', 인터페이스: 'interface', 패키지: 'package',
    프라이빗: 'private', 프로텍티드: 'protected', 퍼블릭: 'public',

    // 리터럴 값
    트루: 'true', 폴스: 'false', 널: 'null',
    언디파인드: 'undefined', 낸: 'NaN', 인피니티: 'Infinity'
  };

  /** 전역 객체 / 함수 (일반 위치) */
  var GLOBALS = {
    // 기본 객체
    오브젝트: 'Object', 어레이: 'Array', 스트링: 'String',
    넘버: 'Number', 불리언: 'Boolean', 심볼: 'Symbol', 빅인트: 'BigInt',
    매스: 'Math', 제이슨: 'JSON', 데이트: 'Date', 레그엑스프: 'RegExp',

    // 컬렉션
    맵: 'Map', 세트: 'Set', 위크맵: 'WeakMap', 위크셋: 'WeakSet',

    // 비동기 / 메타 프로그래밍
    프로미스: 'Promise', 프록시: 'Proxy', 리플렉트: 'Reflect',

    // 구조화 데이터 / 버퍼
    어레이버퍼: 'ArrayBuffer', 셰어드어레이버퍼: 'SharedArrayBuffer',
    데이터뷰: 'DataView', 아토믹스: 'Atomics',

    // 형식화 배열 (TypedArray)
    인트8어레이: 'Int8Array', 유인트8어레이: 'Uint8Array',
    유인트8클램프드어레이: 'Uint8ClampedArray',
    인트16어레이: 'Int16Array', 유인트16어레이: 'Uint16Array',
    인트32어레이: 'Int32Array', 유인트32어레이: 'Uint32Array',
    플로트32어레이: 'Float32Array', 플로트64어레이: 'Float64Array',
    빅인트64어레이: 'BigInt64Array', 빅유인트64어레이: 'BigUint64Array',

    // 에러 타입
    에러: 'Error', 타입에러: 'TypeError', 레인지에러: 'RangeError',
    레퍼런스에러: 'ReferenceError', 신택스에러: 'SyntaxError',
    이밸에러: 'EvalError', 유알아이에러: 'URIError', 어그리게이트에러: 'AggregateError',

    // 국제화
    인틀: 'Intl',

    // 전역 함수
    파스인트: 'parseInt', 파스플로트: 'parseFloat',
    이즈낸: 'isNaN', 이즈파이나이트: 'isFinite',
    // 이밸: 'eval',  // 보안상 위험해 제외 — 라이브러리 자체도 eval / new Function 을 쓰지 않는다.
    인코드유알아이: 'encodeURI', 디코드유알아이: 'decodeURI',
    인코드유알아이컴포넌트: 'encodeURIComponent', 디코드유알아이컴포넌트: 'decodeURIComponent',
    스트럭처드클론: 'structuredClone', 큐마이크로태스크: 'queueMicrotask',
    비토아: 'btoa', 에이토비: 'atob',

    // 타이머 / 프레임
    셋타임아웃: 'setTimeout', 셋인터벌: 'setInterval',
    클리어타임아웃: 'clearTimeout', 클리어인터벌: 'clearInterval',
    리퀘스트애니메이션프레임: 'requestAnimationFrame',
    캔슬애니메이션프레임: 'cancelAnimationFrame',

    // 브라우저 호스트 객체
    콘솔: 'console', 윈도우: 'window', 도큐먼트: 'document',
    내비게이터: 'navigator', 로케이션: 'location', 히스토리: 'history',
    로컬스토리지: 'localStorage', 세션스토리지: 'sessionStorage',
    페치: 'fetch', 얼럿: 'alert', 컨펌: 'confirm', 프롬프트: 'prompt',
    유알엘: 'URL', 유알엘서치파람즈: 'URLSearchParams',
    폼데이터: 'FormData', 헤더즈: 'Headers',
    리퀘스트: 'Request', 리스폰스: 'Response',
    블롭: 'Blob', 파일: 'File', 파일리더: 'FileReader',
    웹소켓: 'WebSocket', 워커: 'Worker',
    이벤트: 'Event', 커스텀이벤트: 'CustomEvent',
    어보트컨트롤러: 'AbortController', 어보트시그널: 'AbortSignal',
    글로벌디스: 'globalThis'
  };

  /** 메서드 / 프로퍼티명 ('.' 바로 뒤 위치) */
  var MEMBERS = {
    // 공통 프로퍼티
    길이: 'length', 사이즈: 'size', 네임: 'name',
    콘스트럭터: 'constructor', 프로토타입: 'prototype', 앳: 'at',

    // 배열 (Array)
    푸시: 'push', 팝: 'pop', 시프트: 'shift', 언시프트: 'unshift',
    슬라이스: 'slice', 스플라이스: 'splice', 콘캣: 'concat', 조인: 'join',
    맵: 'map', 필터: 'filter', 리듀스: 'reduce', 리듀스라이트: 'reduceRight',
    포이치: 'forEach',
    파인드: 'find', 파인드인덱스: 'findIndex',
    파인드라스트: 'findLast', 파인드라스트인덱스: 'findLastIndex',
    인덱스오브: 'indexOf', 라스트인덱스오브: 'lastIndexOf',
    인클루즈: 'includes', 썸: 'some', 에브리: 'every',
    소트: 'sort', 리버스: 'reverse', 플랫: 'flat', 플랫맵: 'flatMap',
    필: 'fill', 카피위딘: 'copyWithin',
    키즈: 'keys', 밸류즈: 'values', 엔트리즈: 'entries',
    투리버스드: 'toReversed', 투소티드: 'toSorted', 투스플라이스드: 'toSpliced', 위드: 'with',
    프롬: 'from', 이즈어레이: 'isArray', 오브: 'of', // Array 정적

    // 문자열 (String)
    차랫: 'charAt', 차코드앳: 'charCodeAt', 코드포인트앳: 'codePointAt',
    투어퍼케이스: 'toUpperCase', 투로어케이스: 'toLowerCase',
    투로케일어퍼케이스: 'toLocaleUpperCase', 투로케일로어케이스: 'toLocaleLowerCase',
    트림: 'trim', 트림스타트: 'trimStart', 트림엔드: 'trimEnd',
    스플릿: 'split', 리플레이스: 'replace', 리플레이스올: 'replaceAll',
    리핏: 'repeat', 패드스타트: 'padStart', 패드엔드: 'padEnd',
    스타츠위드: 'startsWith', 엔즈위드: 'endsWith',
    서브스트링: 'substring', 서브스트르: 'substr',
    매치: 'match', 매치올: 'matchAll', 서치: 'search',
    노멀라이즈: 'normalize', 로케일컴페어: 'localeCompare',
    프롬차코드: 'fromCharCode', 프롬코드포인트: 'fromCodePoint', 로: 'raw', // String 정적

    // 객체 (Object)
    어사인: 'assign', 크리에이트: 'create',
    디파인프로퍼티: 'defineProperty', 디파인프로퍼티즈: 'defineProperties',
    겟프로토타입오브: 'getPrototypeOf', 셋프로토타입오브: 'setPrototypeOf',
    겟오운프로퍼티네임즈: 'getOwnPropertyNames',
    겟오운프로퍼티디스크립터: 'getOwnPropertyDescriptor',
    프롬엔트리즈: 'fromEntries',
    프리즈: 'freeze', 이즈프로즌: 'isFrozen', 실: 'seal', 이즈실드: 'isSealed',
    프리벤트익스텐션즈: 'preventExtensions',
    이즈: 'is', 해즈오운: 'hasOwn',
    해즈오운프로퍼티: 'hasOwnProperty', 이즈프로토타입오브: 'isPrototypeOf',
    프로퍼티이즈이뉴머러블: 'propertyIsEnumerable',
    투스트링: 'toString', 투로케일스트링: 'toLocaleString', 밸류오브: 'valueOf',

    // 숫자 (Number)
    투픽스드: 'toFixed', 투프리시전: 'toPrecision', 투익스포넨셜: 'toExponential',
    이즈인티저: 'isInteger', 이즈세이프인티저: 'isSafeInteger',
    이즈낸: 'isNaN', 이즈파이나이트: 'isFinite', 파스인트: 'parseInt', 파스플로트: 'parseFloat',

    // Math
    앱스: 'abs', 사인: 'sign', 라운드: 'round', 플로어: 'floor', 실링: 'ceil', 트렁크: 'trunc',
    맥스: 'max', 민: 'min', 파워: 'pow', 스퀘어루트: 'sqrt', 큐브루트: 'cbrt',
    랜덤: 'random', 로그2: 'log2', 로그10: 'log10', 익스프: 'exp',
    신: 'sin', 코스: 'cos', 탄: 'tan',
    아크사인: 'asin', 아크코스: 'acos', 아크탄: 'atan', 아크탄2: 'atan2',
    하이포트: 'hypot', 파이: 'PI', // 로그(log)는 console 그룹 참조

    // 날짜 (Date)
    겟풀이어: 'getFullYear', 겟먼스: 'getMonth', 겟데이트: 'getDate', 겟데이: 'getDay',
    겟아워즈: 'getHours', 겟미닛츠: 'getMinutes', 겟세컨즈: 'getSeconds', 겟밀리세컨즈: 'getMilliseconds',
    겟타임: 'getTime', 겟타임존오프셋: 'getTimezoneOffset',
    셋풀이어: 'setFullYear', 셋먼스: 'setMonth', 셋데이트: 'setDate',
    셋아워즈: 'setHours', 셋미닛츠: 'setMinutes', 셋세컨즈: 'setSeconds',
    투아이에스오스트링: 'toISOString', 투데이트스트링: 'toDateString', 투타임스트링: 'toTimeString',
    투로케일데이트스트링: 'toLocaleDateString', 투로케일타임스트링: 'toLocaleTimeString',
    나우: 'now',

    // Map / Set
    겟: 'get', 셋: 'set', 해즈: 'has', 딜리트: 'delete', 클리어: 'clear', 애드: 'add',

    // Promise
    덴: 'then', 캐치: 'catch', 파이널리: 'finally',
    올: 'all', 올세틀드: 'allSettled', 레이스: 'race', 애니: 'any',
    리졸브: 'resolve', 리젝트: 'reject',

    // 정규식 (RegExp)
    테스트: 'test', 이그젝: 'exec',
    소스: 'source', 플래그즈: 'flags', 글로벌: 'global', 라스트인덱스: 'lastIndex',

    // 함수 (Function)
    콜: 'call', 어플라이: 'apply', 바인드: 'bind',

    // Reflect
    오운키즈: 'ownKeys', 콘스트럭트: 'construct',

    // console
    로그: 'log', 에러: 'error', 워언: 'warn', 인포: 'info', 디버그: 'debug',
    테이블: 'table', 디르: 'dir', 트레이스: 'trace', 그룹: 'group', 그룹엔드: 'groupEnd',
    카운트: 'count', 타임: 'time', 타임엔드: 'timeEnd', 어서트: 'assert',

    // JSON
    스트링기파이: 'stringify', 파스: 'parse',

    // 스토리지 (localStorage / sessionStorage)
    겟아이템: 'getItem', 셋아이템: 'setItem', 리무브아이템: 'removeItem',

    // DOM — 조회
    쿼리셀렉터: 'querySelector', 쿼리셀렉터올: 'querySelectorAll',
    겟엘리먼트바이아이디: 'getElementById',
    겟엘리먼츠바이클래스네임: 'getElementsByClassName',
    겟엘리먼츠바이태그네임: 'getElementsByTagName',
    겟컨텍스트: 'getContext',

    // DOM — 이벤트
    애드이벤트리스너: 'addEventListener', 리무브이벤트리스너: 'removeEventListener',
    디스패치이벤트: 'dispatchEvent',
    프리벤트디폴트: 'preventDefault', 스톱프로퍼게이션: 'stopPropagation',
    타겟: 'target', 커런트타겟: 'currentTarget', 타입: 'type', 키: 'key', 코드: 'code',

    // DOM — 트리 조작
    크리에이트엘리먼트: 'createElement', 크리에이트텍스트노드: 'createTextNode',
    어펜드차일드: 'appendChild', 리무브차일드: 'removeChild',
    리플레이스차일드: 'replaceChild', 인서트비포: 'insertBefore',
    어펜드: 'append', 프리펜드: 'prepend', 리무브: 'remove', 클론노드: 'cloneNode',

    // DOM — 속성 / 내용
    셋애트리뷰트: 'setAttribute', 겟애트리뷰트: 'getAttribute',
    리무브애트리뷰트: 'removeAttribute', 해즈애트리뷰트: 'hasAttribute',
    텍스트콘텐트: 'textContent', 이너에이치티엠엘: 'innerHTML',
    이너텍스트: 'innerText', 아우터에이치티엠엘: 'outerHTML',
    클래스리스트: 'classList', 클래스네임: 'className', 아이디: 'id',
    스타일: 'style', 밸류: 'value', 데이터셋: 'dataset',
    체크드: 'checked', 디스에이블드: 'disabled',
    토글: 'toggle', 컨테인즈: 'contains',

    // DOM — 트리 탐색 / 포커스
    패런트노드: 'parentNode', 패런트엘리먼트: 'parentElement',
    칠드런: 'children', 차일드노드즈: 'childNodes',
    퍼스트차일드: 'firstChild', 라스트차일드: 'lastChild',
    넥스트시블링: 'nextSibling', 프리비어스시블링: 'previousSibling',
    포커스: 'focus', 블러: 'blur', 클릭: 'click'
  };

  /** 일반 위치 통합 사전 (예약어 + 전역) */
  var NORMAL = {};
  (function (dst) {
    for (var k in RESERVED) if (has(RESERVED, k)) dst[k] = RESERVED[k];
    for (var g in GLOBALS) if (has(GLOBALS, g)) dst[g] = GLOBALS[g];
  })(NORMAL);

  // 클래스 본문의 메서드명은 일반 위치(. 앞이 아님)에 온다. constructor 만은
  // 특수 식별자라 일반 위치에서도 변환해 줘야 `콘스트럭터() {}` 가 동작한다.
  NORMAL.콘스트럭터 = 'constructor';

  // ==========================================================================
  // §2  트랜스파일러
  // ==========================================================================

  // 이 키워드들 바로 뒤에서는 표현식이 시작될 수 있다 → '/'를 정규식으로 본다.
  // (그 외 식별자/숫자/`)`/`]` 뒤의 '/'는 나눗셈으로 본다.)
  var EXPR_KEYWORDS = {
    'return': 1, 'typeof': 1, 'instanceof': 1, 'in': 1, 'of': 1, 'new': 1,
    'delete': 1, 'void': 1, 'do': 1, 'else': 1, 'yield': 1, 'await': 1,
    'case': 1, 'throw': 1
  };

  /**
   * 한글 키워드 소스를 일반 자바스크립트 소스로 변환한다.
   * 문자열/주석/템플릿 본문은 건드리지 않는다. 식별자는 통째로 토큰화한 뒤,
   * '.' 바로 뒤면 members 사전을, 아니면 normal 사전을 적용한다.
   * @param {string} src
   * @param {{normal?:Object, members?:Object}} [opts]
   * @returns {string}
   */
  function transpile(src, opts) {
    opts = opts || {};
    var normal = opts.normal || NORMAL;
    var members = opts.members || MEMBERS;
    return scanCode(String(src), 0, normal, members, false).out;
  }

  // 코드 영역 스캔. stopAtBrace=true면 짝이 맞는 닫는 '}'를 소비하지 않고 멈춘다.
  function scanCode(src, start, normal, members, stopAtBrace) {
    var n = src.length;
    var out = '';
    var i = start;
    var depth = 0;            // ${ } 안의 중첩 { } 추적
    var prev = '';            // 직전 유효 코드 문자(공백/주석 제외). '.' 이면 멤버 접근.
    var regexAllowed = true;  // 지금 '/'가 정규식 시작일 수 있는가(아니면 나눗셈)

    while (i < n) {
      var c = src[i];

      if (stopAtBrace && c === '}' && depth === 0) return { out: out, i: i };

      // 한 줄 주석 — prev / regexAllowed 유지(멤버 접근·연산 위치를 끊지 않음)
      if (c === '/' && src[i + 1] === '/') {
        var j = i + 2;
        while (j < n && src[j] !== '\n') j++;
        out += src.slice(i, j); i = j; continue;
      }

      // 블록 주석 — prev / regexAllowed 유지
      if (c === '/' && src[i + 1] === '*') {
        var k = i + 2;
        while (k < n && !(src[k] === '*' && src[k + 1] === '/')) k++;
        k = Math.min(k + 2, n);
        out += src.slice(i, k); i = k; continue;
      }

      // 정규식 리터럴 — 표현식이 올 자리에서 시작하는 '/'만 정규식으로 본다.
      // 본문은 변환하지 않는다. 미완성(닫는 '/' 없음/줄바꿈)이면 일반 처리로 폴백.
      if (c === '/' && regexAllowed) {
        var rx = scanRegex(src, i);
        if (rx) { out += rx.out; i = rx.i; prev = '/'; regexAllowed = false; continue; }
      }

      // 따옴표 문자열
      if (c === '"' || c === "'") {
        var s = i + 1;
        while (s < n) {
          if (src[s] === '\\') { s += 2; continue; }
          if (src[s] === c) { s++; break; }
          s++;
        }
        out += src.slice(i, s); i = s; prev = c; regexAllowed = false; continue;
      }

      // 템플릿 리터럴
      if (c === '`') {
        var t = scanTemplate(src, i + 1, normal, members);
        out += '`' + t.out; i = t.i; prev = '`'; regexAllowed = false; continue;
      }

      // 전개/나머지 ...  (뒤따르는 식별자는 멤버가 아님, 표현식 위치)
      if (c === '.' && src[i + 1] === '.' && src[i + 2] === '.') {
        out += '...'; i += 3; prev = '!'; regexAllowed = true; continue;
      }

      if (c === '{') { depth++; out += c; i++; prev = '{'; regexAllowed = true; continue; }
      if (c === '}') { depth--; out += c; i++; prev = '}'; regexAllowed = true; continue; }

      // 식별자 토큰
      if (ID_START.test(c)) {
        var e = i + 1;
        while (e < n && ID_PART.test(src[e])) e++;
        var word = src.slice(i, e);
        var table = prev === '.' ? members : normal;
        var resolved = has(table, word) ? table[word] : word;
        out += resolved;
        i = e;
        prev = word.charAt(word.length - 1); // 비공백
        // 식별자/숫자 뒤 '/'는 나눗셈. 단 표현식 키워드(return 등) 뒤면 정규식 허용.
        regexAllowed = table === normal && has(EXPR_KEYWORDS, resolved);
        continue;
      }

      // 그 외 한 글자
      out += c; i++;
      if (!WS.test(c)) {
        prev = c;
        if (c >= '0' && c <= '9') regexAllowed = false;        // 숫자 = 값
        else if (c === ')' || c === ']') regexAllowed = false; // 표현식 끝
        else if (c === '.') regexAllowed = false;              // 프로퍼티/숫자 자리
        else regexAllowed = true;                             // 연산자 · ( [ , ; : 등
      }
    }

    return { out: out, i: i };
  }

  // 여는 백틱 다음부터 스캔. 결과(닫는 백틱 포함)와 다음 인덱스를 반환.
  function scanTemplate(src, start, normal, members) {
    var n = src.length;
    var out = '';
    var i = start;

    while (i < n) {
      var c = src[i];

      if (c === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
      if (c === '`') return { out: out + '`', i: i + 1 };

      // ${ ... } 보간식은 다시 코드로 취급 (멤버 판정 새로 시작)
      if (c === '$' && src[i + 1] === '{') {
        out += '${';
        var r = scanCode(src, i + 2, normal, members, true);
        out += r.out;
        if (src[r.i] === '}') { out += '}'; i = r.i + 1; }
        else { i = r.i; }
        continue;
      }

      out += c; i++;
    }

    return { out: out, i: i };
  }

  // 여는 '/'(start)에서 시작하는 정규식 리터럴을 통째로 스캔. 본문은 변환하지 않는다.
  // 닫는 '/'와 플래그까지 포함해 반환. 미완성(EOF/줄바꿈 전 닫힘 없음)이면 null.
  function scanRegex(src, start) {
    var n = src.length;
    var i = start + 1;
    var inClass = false;   // [ ... ] 문자 클래스 안에서는 '/'가 종료가 아님
    var closed = false;

    while (i < n) {
      var c = src[i];
      if (c === '\\') { i += 2; continue; }          // 이스케이프
      if (c === '\n') return null;                    // 정규식은 한 줄 — 미완성 간주
      if (c === '[') { inClass = true; i++; continue; }
      if (c === ']') { inClass = false; i++; continue; }
      if (c === '/' && !inClass) { i++; closed = true; break; }
      i++;
    }
    if (!closed) return null;

    while (i < n && /[a-z]/i.test(src[i])) i++;       // 플래그 (g i m s u y d)
    return { out: src.slice(start, i), i: i };
  }

  // ==========================================================================
  // §3  실행 · 로더 — eval / new Function 을 쓰지 않는다.
  //   Node     : 내장 vm 모듈로 실행
  //   브라우저  : <script> 엘리먼트를 주입해 일반 스크립트처럼 전역 실행
  //
  // 주의: '실행'은 본질적으로 변환 결과를 코드로 돌리는 일이다. 위험 API(eval/Function)는
  //       쓰지 않지만, 임의 코드 실행이라는 성격은 같으니 신뢰된 소스만 실행할 것.
  // ==========================================================================

  var runSeq = 0; // 브라우저 run() 결과/오류 핸드오프용 카운터

  // 변환된 JS 한 덩이를 브라우저 전역 스코프에서 실행한다(일반 <script> 의미).
  // 인라인 스크립트는 DOM에 붙는 순간 동기 실행된다.
  function injectScript(js) {
    var el = document.createElement('script');
    el.textContent = js;
    (document.head || document.documentElement).appendChild(el);
    if (el.parentNode) el.parentNode.removeChild(el);
  }

  /**
   * 변환 후 실행하고 결과(최상위 `리턴` 값)를 돌려준다.
   * eval/new Function 대신 Node는 vm, 브라우저는 <script> 주입을 쓴다.
   * @param {string} src
   * @param {{normal?:Object, members?:Object}} [opts]
   */
  function run(src, opts) {
    var js = transpile(src, opts);
    var iife = '(() => {\n' + js + '\n})()';

    // 브라우저: 결과/오류를 임시 전역에 담아 동기로 받아온다.
    if (typeof document !== 'undefined') {
      var resKey = '__한글_결과_' + runSeq;
      var errKey = '__한글_오류_' + runSeq;
      runSeq++;
      injectScript(
        'try { window[' + JSON.stringify(resKey) + '] = ' + iife + '; }' +
        ' catch (e) { window[' + JSON.stringify(errKey) + '] = e; }'
      );
      var result = window[resKey];
      var threw = errKey in window;
      var error = window[errKey];
      delete window[resKey];
      delete window[errKey];
      if (threw) throw error;
      return result;
    }

    // Node: 내장 vm 모듈로 실행하고 완료값을 반환.
    if (typeof require === 'function') {
      return require('vm').runInThisContext(iife, { filename: 'hangul:run' });
    }
    throw new Error('[한글JS] run(): 이 환경에서 실행기를 찾지 못했습니다 (document/vm 없음).');
  }

  // <script type="text/hangul"> 블록을 변환해 전역 스코프에서 실행한다.
  function runScripts() {
    if (typeof document === 'undefined') return;
    var nodes = document.querySelectorAll('script[type="text/hangul"]');
    var chain = Promise.resolve();
    Array.prototype.forEach.call(nodes, function (node) {
      chain = chain.then(function () {
        var codeP = node.src
          ? fetch(node.src).then(function (r) { return r.text(); })
          : Promise.resolve(node.textContent);
        return codeP.then(function (code) {
          var js = transpile(code);
          try {
            // 일반 <script> 처럼 주입 → 전역 스코프 공유. 런타임 오류는 콘솔에 그대로 표시.
            injectScript(js);
          } catch (err) {
            console.error('[한글JS] 주입 오류:', err, '\n변환된 코드:\n' + js);
          }
        });
      });
    });
    return chain;
  }

  // ==========================================================================
  // §4  노출 — 브라우저 전역(Hangul / 한글) + Node(CommonJS) 양쪽
  // ==========================================================================

  var 한글JS = {
    버전: '0.4.0',
    transpile: transpile,
    run: run,
    runScripts: runScripts,
    RESERVED: RESERVED,
    GLOBALS: GLOBALS,
    MEMBERS: MEMBERS,
    NORMAL: NORMAL
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = 한글JS; // Node: require('./hangul.js')
  }

  if (typeof window !== 'undefined') {
    window.Hangul = 한글JS;
    window['한글'] = 한글JS;
    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runScripts);
      } else {
        runScripts();
      }
    }
  }
})();
