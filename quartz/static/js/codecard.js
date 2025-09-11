<script>
document.addEventListener("DOMContentLoaded", () => {
  // 모든 프리태그 감지
  document.querySelectorAll("pre > code").forEach(code => {
    const pre = code.parentElement;

    // 이미 카드로 래핑된 경우 패스
    if (pre.closest(".codecard")) return;

    // 언어 추출 (class="language-ts" 또는 "lang-ts" 등)
    const cls = code.className || "";
    const m = cls.match(/language-([a-z0-9+#-]+)/i) || cls.match(/lang(?:uage)?-([a-z0-9+#-]+)/i);
    const lang = (m && m[1]) ? m[1].toUpperCase() : "";

    // 메타에서 title 시도 (Shiki/Prism가 넣어줄 수도 있는 data 속성)
    // 1) 코드 펜스 메타가 innerText 첫 줄에 있는 경우: ```js title="file.js"
    //    빌드 단계에서 사라지면 못 읽으므로 data 속성 우선
    const explicitTitle = code.getAttribute("data-title") || pre.getAttribute("data-title");

    // 파일명 추정: 첫 줄이 주석으로 // file: xxx.js 형태면 가져오기
    let guessed = "";
    const text = code.textContent || "";
    const firstLine = text.split("\n")[0].trim();
    const guessRe = /(?:\/\/|#|\/\*+)\s*(?:file|filename)\s*:\s*([^\s*]+)\s*/i;
    const g = firstLine.match(guessRe);
    if (g) guessed = g[1];

    const title = explicitTitle || guessed || "";

    // 래핑용 DOM 만들기
    const card = document.createElement("div");
    card.className = "codecard";

    // 타이틀 바
    const titleBar = document.createElement("div");
    titleBar.className = "codecard-title";
    titleBar.textContent = title || "Code";
    if (lang) {
      const badge = document.createElement("span");
      badge.className = "lang-badge";
      badge.textContent = lang;
      titleBar.appendChild(badge);
    }

    // pre를 card로 감싸기
    const wrapper = pre.parentElement;
    wrapper.insertBefore(card, pre);
    card.appendChild(titleBar);
    card.appendChild(pre);
  });
});
</script>
