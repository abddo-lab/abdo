import React from "react";

const TOKEN_RE =
  /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(import|export|from|const|let|var|function|return|if|else|type|interface|extends|new|async|await|for|of|in|default|null|undefined|true|false|void|as|useReducer|useEffect|useRef|useCallback|useMemo|useState|useLayoutEffect|typeof|keyof)\b|\b(\d+(?:\.\d+)?)\b|([A-Z][A-Za-z0-9_]*)|([a-zA-Z_$][\w$]*)(?=\s*\()|([{}()[\].,;:=<>+\-*/!?&|@#]+)/g;

export function highlight(code: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(code)) !== null) {
    if (m.index > last) {
      out.push(
        <span key={key++} className="tk-df">
          {code.slice(last, m.index)}
        </span>,
      );
    }
    const [full, cm, st, kw, nu, ty, fn, pn] = m;
    let cls = "tk-df";
    if (cm) cls = "tk-cm";
    else if (st) cls = "tk-st";
    else if (kw) cls = "tk-kw";
    else if (nu) cls = "tk-nu";
    else if (ty) cls = "tk-ty";
    else if (fn) cls = "tk-fn";
    else if (pn) cls = "tk-pn";
    out.push(
      <span key={key++} className={cls}>
        {full}
      </span>,
    );
    last = m.index + full.length;
  }
  if (last < code.length) {
    out.push(
      <span key={key++} className="tk-df">
        {code.slice(last)}
      </span>,
    );
  }
  return out;
}
