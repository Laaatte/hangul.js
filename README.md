# 한글JS (hangul.js)

> 자바스크립트의 예약어·전역·메서드를 **한글 음차**로 바꿔 쓰는, 재미로 만든 트랜스파일러.
> `for → 포`, `function → 펑션`, `console → 콘솔`, `map → 맵` … 처럼.

빌드도, 번들러도, 의존성도 없다. `hangul.js` 한 파일이 전부다.

```js
콘솔.로그(["철수", "영희"].맵((이름) => `안녕, ${이름}!`).조인("\n"));
//  ↓ 변환
console.log(["철수", "영희"].map((이름) => `안녕, ${이름}!`).join("\n"));
```

---

## 제작 계기
퇴근하고 샤워하고 있는데 갑자기 생각나서 클로드한테 부탁했습니다.
이부분을 제외하고는 모든걸 클로드가 해줬습니다.

## 설치

`hangul.js` **파일 하나**가 전부다. 패키지 매니저도 빌드도 필요 없다.

### 단독 사용 (브라우저)

1. [`hangul.js`](hangul.js) 를 받아 HTML 옆에 둔다.
   (GitHub이라면 파일 화면의 **Raw → 저장**, 아니면 내용을 복사해 `hangul.js` 로 저장)
2. `<head>` 에서 불러오면 끝.

```html
<head>
  <script src="hangul.js"></script>
</head>
```

경로만 맞으면 바로 동작한다 — npm·번들러 모두 불필요하다.

### Node

npm 레지스트리에 올라가 있지 않으므로, 파일을 프로젝트에 두고 `require` 하는 게 가장 간단하다.

```js
// hangul.js 를 프로젝트에 복사한 뒤
const 한글 = require('./hangul.js');
한글.run('콘솔.로그("설치 끝!")');
```

npm으로 관리하고 싶다면 아래 중 하나를 쓴다.

```bash
npm install github:Laaatte/hangul.js   # 깃허브에서 바로 설치
npm install ./hangul-js              # 로컬 폴더(package.json 포함) 설치
# npm 레지스트리에 게시했다면:  npm install hangul-js
```

설치한 경우엔 `require('hangul-js')` 로 불러온다. CLI `han` 명령도 함께 설치된다.

## 빠른 시작

### 1) 브라우저 — `<script type="text/hangul">`

```html
<script src="hangul.js"></script>
<script type="text/hangul">
  콘솔.로그("안녕, 한글JS!");
</script>
```

페이지가 로드되면 `text/hangul` 블록(인라인 / `src=` 외부 파일 모두)을 위에서부터
순서대로 한글→JS로 변환한 뒤, 일반 `<script>`처럼 전역 스코프에서 실행한다.
→ [`examples/hello.html`](examples/hello.html)

### 2) Node — 라이브러리로

```js
const 한글 = require('./hangul.js');

const 코드 = '콘솔.로그([1,2,3].맵((엔) => 엔 * 2));';
console.log(한글.transpile(코드)); // 변환된 JS 문자열
한글.run(코드);                    // 변환 후 실행
```

→ [`examples/node-demo.js`](examples/node-demo.js) · `npm run demo`

### 3) CLI — `.한글` / `.han` 파일 실행

```bash
node bin/han.js examples/hello.han        # 변환 후 실행
node bin/han.js build examples/hello.han  # 변환된 JS를 표준출력으로
npm link && han examples/hello.han        # 전역 설치 후 han 명령으로
```

→ [`examples/hello.han`](examples/hello.han)

---

## 동작 원리

한 줄 요약: **단어(식별자)만 한글로 치환하고, 기호와 문자열은 손대지 않는다.**

1. 소스를 한 글자씩 훑으며 토큰화한다. 문자열(`'…'`, `"…"`), 템플릿 리터럴 본문,
   주석(`//`, `/* */`)은 **변환 대상에서 제외**한다.
2. 식별자 토큰을 만나면 위치에 따라 사전을 골라 적용한다.
   - **일반 위치** → `NORMAL` 사전 (예약어 + 전역 객체/함수)
   - **`.` 바로 뒤(멤버 접근)** → `MEMBERS` 사전 (메서드/프로퍼티명)
3. 사전에 없으면 그대로 둔다 → 변수·함수 이름은 한글이든 영문이든 자유.

그래서 같은 한글이 위치에 따라 다르게 풀린다:

| 입력          | 출력          | 이유                          |
| ------------- | ------------- | ----------------------------- |
| `뉴 맵()`     | `new Map()`   | `맵` 이 일반 위치 → `Map`     |
| `[].맵(…)`    | `[].map(…)`   | `맵` 이 `.` 뒤 → `map`        |

템플릿 리터럴의 `${ … }` 안은 다시 코드로 취급해 변환한다.

---

## 사전 (요약)

| 분류                         | 예시                                                              |
| ---------------------------- | ----------------------------------------------------------------- |
| `RESERVED` 예약어·리터럴     | 펑션→function, 포→for, 이프→if, 리턴→return, 트루→true, 뉴→new …   |
| `GLOBALS` 전역 객체·함수     | 콘솔→console, 매스→Math, 제이슨→JSON, 맵→Map, 프로미스→Promise …   |
| `MEMBERS` 메서드·프로퍼티    | 맵→map, 필터→filter, 리듀스→reduce, 로그→log, 길이→length …        |

전체 목록은 [`hangul.js`](hangul.js) §1 사전을 참고. 새 단어는 해당 객체에 한 줄 추가하면 된다.

---

## API

| 호출                       | 설명                                                        |
| -------------------------- | ----------------------------------------------------------- |
| `한글.transpile(코드)`     | 한글 소스를 JS 문자열로 변환해 반환                          |
| `한글.run(코드)`           | 변환 후 실행하고 결과 반환 (최상위 `리턴`도 동작)            |
| `한글.runScripts()`        | `<script type="text/hangul">` 블록을 찾아 변환·실행 (브라우저) |
| `한글.버전`                | 버전 문자열                                                 |
| `한글.RESERVED / GLOBALS / MEMBERS / NORMAL` | 내부 사전 (확장·확인용)                   |

브라우저에서는 `window.한글` 과 `window.Hangul` 둘 다로 접근할 수 있다.

---

## 한계 / 주의

- 실행기는 `eval` / `new Function` 을 쓰지 않는다 — **Node는 내장 `vm` 모듈**, **브라우저는
  `<script>` 엘리먼트 주입**으로 돌린다. 다만 변환 결과를 코드로 실행하는 것 자체는 임의
  코드 실행이므로, 위험 API를 피했더라도 **신뢰된 소스만** 실행하는 게 좋다.
- **정규식 리터럴**(`/패턴/g`)은 본문을 변환하지 않는다. 표현식이 올 자리에서 시작하는
  `/`만 정규식으로 보는 휴리스틱이라, `리턴 에이 / 비` 같은 나눗셈과 구분된다. 다만
  단일-토큰 추적이라 드문 경우(예: 한 줄에 안 닫힌 `/`)는 나눗셈으로 폴백한다.
- 사전은 **ECMAScript 표준 빌트인 + 흔한 브라우저 전역**을 폭넓게 담았지만, 모든 호스트
  객체의 모든 메서드를 다 담지는 못한다. 없는 단어는 변환되지 않으니 필요하면 직접 추가하면 된다.
- 클래스 생성자 `콘스트럭터`(constructor)는 일반 위치에서도 변환된다. 그 밖의 클래스
  메서드명은 (사전에 있는 단어가 아닌 한) 그대로 식별자로 남는다 — 의도된 동작이다.

---

## 프로젝트 구조

```
hangul.js          핵심 — 단일 파일 트랜스파일러 (사전 + 토크나이저 + 로더)
bin/han.js         CLI — .한글/.han 파일 변환·실행
examples/          브라우저·Node·CLI 예제
test/              node:test 기반 변환 테스트  (npm test)
```

## 라이선스

MIT
