// ==UserScript==
// @name         PTA 工具合集（AI 解析 + 一键完成 + 隐藏题目集 + 返回跳转）
// @namespace    pta-tool
// @version      2.2.0
// @author       xuchao3328 (https://github.com/xuchao3328)
// @description  四个脚本合一：AI 解析（客观题 + 编程题）、一键完成（客观题 + 编程题，题干图片发给视觉模型、SQL 题按数据库方言生成）、题目集卡片隐藏按钮、返回箭头跳转题目集；「作者的话」（GitHub + 微信赞赏码）挂在一键完成悬浮面板底部，可折叠
// @match        https://pintia.cn/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      api.deepseek.com
// @run-at       document-idle
// ==/UserScript==

// 本文件由 tools/bundle.mjs 自动生成，请勿直接编辑；改源码后执行 npm run bundle 重新生成。
//
// 组成（按执行顺序）：
//   [0/5] API Key 迁移：把「一键完成」旧的 pta-deepseek-auto-key 迁到统一键
//   [1/5] 返回箭头跳转题目集 · v1.0.0 · src/back-to-active.user.js
//   [2/5] 题目集隐藏按钮 · v1.2.0 · src/hide-problem-sets.user.js
//   [3/5] AI 解析 · v1.5.0 · src/pta-ai-solve.user.js
//   [4/5] 一键完成 · v1.6.2 · src/pta-auto-complete.user.js
//   [5/5] 作者的话（嵌入一键完成面板） · v2.0.0 · src/pta-author-card.user.js
//
// 合并时的两处统一（其余正文逐字来自各源文件）：
//   1. 两个 AI 脚本共用同一个 API Key 存储键 pta-deepseek-key（菜单项两处，点哪个都一样）；
//   2. 元数据取并集：@match 取最宽、@grant/@connect 全保留、@run-at 取最晚的 document-idle。
//
// 注意：装了这一份就请禁用原来的各个单脚本，否则「解析」按钮和面板会出现两套。

// ---------------------------------------------------------------
// [0/5] API Key 迁移（pta-deepseek-auto-key → pta-deepseek-key）
// ---------------------------------------------------------------
(() => {
  try {
    if (typeof GM_getValue !== "function" || typeof GM_setValue !== "function") return;
    const canon = "pta-deepseek-key";
    const legacy = "pta-deepseek-auto-key";
    if (!GM_getValue(canon, "") && GM_getValue(legacy, "")) GM_setValue(canon, GM_getValue(legacy, ""));
  } catch (e) { /* ignore */ }
})();

// ---------------------------------------------------------------
// [1/5] 返回箭头跳转题目集 · v1.0.0 · src/back-to-active.user.js
// ---------------------------------------------------------------
(() => {
  const TARGET = '/problem-sets/active';

  const isBack = (a) => {
    if (a.tagName !== 'A' || a.getAttribute('href') !== '/') return false;
    const use = a.querySelector('use');
    if (!use) return false;
    return use.getAttribute('href') === '#pat-left-arrow' || use.getAttributeNS('http://www.w3.org/1999/xlink', 'href') === '#pat-left-arrow';
  };

  document.addEventListener(
    'click',
    (e) => {
      const a = e.target && e.target.closest ? e.target.closest('a') : null;
      if (!a || !isBack(a) || location.pathname === TARGET) return;
      e.preventDefault();
      e.stopPropagation();
      location.assign(TARGET);
    },
    true
  );
})();

// ---------------------------------------------------------------
// [2/5] 题目集隐藏按钮 · v1.2.0 · src/hide-problem-sets.user.js
// ---------------------------------------------------------------
(() => {
  const KEY = 'pta-hidden-problem-sets';
  const ALL_PATH = '/problem-sets/all';

  const readHidden = () => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(v) ? new Set(v) : new Set();
    } catch {
      return new Set();
    }
  };
  const writeHidden = () => localStorage.setItem(KEY, JSON.stringify([...hidden]));
  const hidden = readHidden();

  const setIdOf = (a) => {
    const m = (a.getAttribute('href') || '').match(/^\/problem-sets\/([^/?#]+)\/overview/);
    return m ? m[1] : null;
  };
  const isAllPage = () => location.pathname === ALL_PATH;

  const byBtn = new WeakMap();
  const btnOfAnchor = new WeakMap();

  const SKINS = {
    delete: { bg: 'rgba(239, 68, 68, 0.08)', hover: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', label: '✕', title: '隐藏该题目集' },
    restore: { bg: 'rgba(34, 197, 94, 0.12)', hover: 'rgba(34, 197, 94, 0.3)', color: '#22c55e', label: '↺', title: '恢复显示该题目集' },
  };

  const sideOf = (a) => {
    const total = a.offsetHeight || a.clientHeight || 0;
    if (!total) return 24;
    let pad = 0;
    if (typeof getComputedStyle === 'function') {
      const cs = getComputedStyle(a);
      pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    }
    return Math.max(total - pad, 24);
  };

  const makeButton = (a, mode) => {
    const skin = SKINS[mode];
    const btn = document.createElement('button');
    btn.textContent = skin.label;
    btn.title = skin.title;
    const side = sideOf(a);
    const s = btn.style;
    s.width = side + 'px';
    s.height = side + 'px';
    s.display = 'flex';
    s.alignItems = 'center';
    s.justifyContent = 'center';
    s.flex = 'none';
    s.padding = '0';
    s.border = '0';
    s.borderRadius = '12px';
    s.cursor = 'pointer';
    s.color = skin.color;
    s.fontSize = Math.max(Math.round(side * 0.4), 14) + 'px';
    s.lineHeight = '1';
    s.backgroundColor = skin.bg;
    btn.addEventListener('mouseenter', () => {
      btn.style.backgroundColor = skin.hover;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.backgroundColor = skin.bg;
    });
    byBtn.set(btn, { a, mode });
    btnOfAnchor.set(a, btn);
    return btn;
  };

  document.addEventListener(
    'click',
    (e) => {
      const btn = e.target && e.target.closest ? e.target.closest('button') : null;
      if (!btn || !byBtn.has(btn)) return;
      e.preventDefault();
      e.stopPropagation();
      const { a, mode } = byBtn.get(btn);
      const id = setIdOf(a);
      const host = a.closest('li') || a;
      if (mode === 'restore') {
        if (id) {
          hidden.delete(id);
          writeHidden();
        }
        host.style.display = '';
        a.dataset.ptaHideMode = 'none';
        btn.remove();
        btnOfAnchor.delete(a);
      } else {
        if (id) {
          hidden.add(id);
          writeHidden();
        }
        host.style.display = 'none';
      }
    },
    true
  );

  const modeOf = (a) => {
    const id = setIdOf(a);
    if (!id) return 'skip';
    const isHidden = hidden.has(id);
    if (isAllPage()) return isHidden ? 'restore' : 'none';
    return isHidden ? 'hidden' : 'delete';
  };

  const process = (a) => {
    const mode = modeOf(a);
    if (mode === 'skip' || a.dataset.ptaHideMode === mode) return;
    const old = btnOfAnchor.get(a);
    if (old) {
      old.remove();
      btnOfAnchor.delete(a);
    }
    a.dataset.ptaHideMode = mode;
    const host = a.closest('li') || a;
    host.style.display = mode === 'hidden' ? 'none' : '';
    if (mode === 'delete' || mode === 'restore') {
      const icon = a.querySelector('use[*|href="#pat-person"]');
      const wrap = icon && icon.closest('div.flex');
      const btn = makeButton(a, mode);
      if (wrap) a.appendChild(btn);
      else a.insertBefore(btn, a.firstChild);
    }
  };

  const scan = () => document.querySelectorAll('a[href^="/problem-sets/"]').forEach(process);
  scan();

  const mo = new MutationObserver(scan);
  mo.observe(document.body, { childList: true, subtree: true });

  window.__ptaRestoreHiddenSets = () => {
    localStorage.removeItem(KEY);
    location.reload();
  };
})();

// ---------------------------------------------------------------
// [3/5] AI 解析 · v1.5.0 · src/pta-ai-solve.user.js
// ---------------------------------------------------------------
// 仅在原脚本的 @match 范围内启用（location.pathname 以 /problem-sets/ 开头）
// 正文不做缩进：避免动到多行模板字符串的内容
if (location.pathname.indexOf('/problem-sets/') === 0) {
(() => {
  const API_URL = 'https://api.deepseek.com/chat/completions';
  const KEY_STORE = 'pta-deepseek-key';
  const TYPE_NAME = { multi: '多选题（可能不止一个正确选项）', single: '单选题', judge: '判断题', fill: '填空题' };

  const detectType = (q) => {
    if (q.checkCount > 0) return 'multi';
    if (q.radioCount > 0) {
      const t = q.options.map((o) => o.text).join(' ');
      const right = /对|正确|√/.test(t);
      const wrong = /错|错误|×/.test(t);
      if (q.options.length === 2 && right && wrong) return 'judge';
      return 'single';
    }
    return 'fill';
  };

  const buildPrompt = (q, lang) => {
    const lines = ['你是程序设计课程助教，请仔细作答。'];
    if (lang) lines.push(`编程语言：${lang}（如需写代码，必须使用该语言，保证代码可直接编译运行）`);
    lines.push(`题型：${TYPE_NAME[q.type]}`, `题干：${q.stem}`);
    if (q.type !== 'fill') {
      q.options.forEach((o) => lines.push(`${o.letter}. ${o.text}`));
    } else if (q.fills && q.fills.length > 1) {
      lines.push(`（共 ${q.fills.length} 个空，按顺序作答）`);
    }
    let fmt;
    if (q.type === 'multi') fmt = '答案: ABD（多个字母连写，按字母序，如 BCD）';
    else if (q.type === 'single') fmt = '答案: A（单个大写字母）';
    else if (q.type === 'judge') fmt = '答案: T（T=正确，F=错误，只写一个字母）';
    else if (q.fills && q.fills.length > 0) fmt = `答案: 1)第一个空的答案 2)第二个空的答案（共 ${q.fills.length} 个空，就写 ${q.fills.length} 项，按顺序）`;
    else fmt = '答案: 1)第一个空的答案 2)第二个空的答案（先数清题干中有几个空，有几个空就写几项，按顺序）';
    if (q.type === 'fill') lines.push('注意：先数清题干中的空（横线/下划线处）数量，答案项数必须与空数一致。');
    lines.push('', `最终答案只占一行，格式严格为「${fmt}」（"答案"后跟冒号），下一行起给出不超过 150 字的简要解析。`);
    return lines.join('\n');
  };

  const SPLIT_IDX = /(?:^|[\s　]+)(?:[（(]\s*\d+\s*[)）、]|\d+\s*[)）、]|\d+\s*空\s*[:：])\s*/;
  const stripIndex = (s) =>
    String(s)
      .replace(/^(?:[（(]\s*\d+\s*[)）、]|\d+\s*[)）、]|\d+\s*空\s*[:：]|第\s*\d+\s*(?:空|个空)\s*[:：]?)\s*/, '')
      .trim();

  const parseAnswer = (text, type) => {
    const m = String(text).match(/答案\s*[:：]\s*([^\n]+)/);
    if (!m) return null;
    const raw = m[1].trim();
    if (type === 'multi' || type === 'single') {
      const letters = [...new Set((raw.toUpperCase().match(/[A-Z]/g) || []))].sort();
      return { kind: 'letters', letters };
    }
    if (type === 'judge') {
      if (/^\s*T/i.test(raw)) return { kind: 'judge', value: 'right' };
      if (/^\s*F/i.test(raw)) return { kind: 'judge', value: 'wrong' };
      return { kind: 'judge', value: /错/.test(raw) ? 'wrong' : 'right' };
    }
    let values = raw
      .split(SPLIT_IDX)
      .map((s) => s.trim())
      .filter(Boolean);
    if (values.length <= 1) {
      values = raw.split(/[;；\n]/).map((s) => s.trim()).filter(Boolean);
    }
    if (values.length <= 1) {
      values = raw.split(/[,，、]/).map((s) => s.trim()).filter(Boolean);
    }
    values = values.map(stripIndex).filter(Boolean);
    return { kind: 'fill', values };
  };

  const buildActions = (q, ans) => {
    const acts = [];
    if (ans.kind === 'letters') {
      q.options.forEach((o) => acts.push({ inputId: o.inputId, gi: o.gi, checked: ans.letters.includes(o.letter.toUpperCase()) }));
    } else if (ans.kind === 'judge') {
      const re = ans.value === 'right' ? /对|正确|√/ : /错|错误|×/;
      let hit = q.options.filter((o) => re.test(o.text));
      if (!hit.length && q.options[ans.value === 'right' ? 0 : 1]) hit = [q.options[ans.value === 'right' ? 0 : 1]];
      q.options.forEach((o) => acts.push({ inputId: o.inputId, gi: o.gi, checked: hit.includes(o) }));
    } else {
      (q.fills || []).forEach((f, i) => acts.push({ inputId: f.inputId, gi: f.gi, value: (ans.values || [])[i] || '' }));
    }
    return acts;
  };

  const findInput = (a, resolve, getById) => {
    if (a.gi !== undefined && a.gi !== null && typeof resolve === 'function') {
      const el = resolve(a.gi);
      if (el) return el;
    }
    if (a.inputId && typeof getById === 'function') return getById(a.inputId) || null;
    return null;
  };

  const askDeepSeek = (key, promptText, cb) => {
    const body = JSON.stringify({
      model: 'deepseek-chat',
      stream: false,
      temperature: 0.2,
      messages: [{ role: 'user', content: promptText }],
    });
    const finish = (err, text) => {
      try {
        cb(err, text);
      } catch (e) {
        console.error(e);
      }
    };
    if (typeof GM_xmlhttpRequest === 'function') {
      GM_xmlhttpRequest({
        method: 'POST',
        url: API_URL,
        timeout: 120000,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
        data: body,
        onload: (r) => {
          try {
            const d = JSON.parse(r.responseText);
            const c = d && d.choices && d.choices[0];
            if (!c) finish('响应异常: ' + String(r.responseText).slice(0, 200));
            else finish(null, c.message.content);
          } catch (e) {
            finish('响应异常: ' + String(r.responseText).slice(0, 200));
          }
        },
        onerror: () => finish('网络错误'),
        ontimeout: () => finish('请求超时'),
      });
    } else if (typeof fetch === 'function') {
      fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body })
        .then((r) => r.json())
        .then((d) => {
          const c = d && d.choices && d.choices[0];
          if (!c) finish('响应异常');
          else finish(null, c.message.content);
        })
        .catch((e) => finish(e && e.message ? e.message : '网络错误'));
    } else {
      finish('当前环境无法发起网络请求');
    }
  };

  const collectFillGroups = (texts, resolveBlock) => {
    const groups = new Map();
    texts.forEach((t) => {
      const b = resolveBlock(t);
      if (!b) return;
      if (!groups.has(b)) groups.set(b, []);
      groups.get(b).push(t);
    });
    return [...groups.values()];
  };

  const titleAnchor = (block) => {
    let span;
    try {
      span = block.querySelector('.font-bold.text-lg');
    } catch (e) {
      return null;
    }
    if (!span) return null;
    const box = span.closest('.flex.flex-wrap.space-x-2.items-center') || span.parentElement;
    const outer = box && box.parentElement;
    return outer && block.contains(outer) ? outer : null;
  };

  const flowHost = (block, styleOf) => {
    let target = block;
    for (let i = 0; i < 3 && target.firstElementChild; i += 1) {
      const cs = styleOf(target);
      if (cs && typeof cs.display === 'string' && cs.display.includes('flex') && !cs.flexDirection.startsWith('column') && !/^(wrap|wrap-reverse)$/.test(String(cs.flexWrap))) {
        target = target.firstElementChild;
      } else break;
    }
    return target;
  };

  const pickLang = (texts) => {
    const hit = texts
      .map((t) => String(t).trim())
      .find((t) => t.length > 0 && t.length <= 30 && /^[A-Za-z][A-Za-z0-9#+. ]*(\s*\(.+\))?$/.test(t));
    return hit || '';
  };

  const nextFold = (display) => (String(display) === 'none' ? { show: true, label: '收起' } : { show: false, label: '展开' });

  const isSelectInput = (el) => {
    const role = el.getAttribute && el.getAttribute('role');
    const cls = typeof el.className === 'string' ? el.className : '';
    return role === 'combobox' || /dummyInput|select__/.test(cls);
  };

  const buildCodePrompt = (stem, lang) => {
    const lines = [
      '你是程序设计课程助教，请给出可直接提交的完整程序。',
      `编程语言：${lang || '按题目要求选择'}`,
      '',
      `题目：${stem}`,
      '',
      '输出格式要求：',
      '1. 先写一行「语言: 语言名」；',
      '2. 然后用 ``` 代码块给出完整代码（含输入读取、必要的 import/头文件），代码必须能直接编译运行；',
      '3. 代码块之后写「解析：」，再用不超过 150 字说明思路。',
    ];
    return lines.join('\n');
  };

  const parseCode = (text) => {
    const s = String(text);
    const fence = s.match(/```[ \t]*([A-Za-z0-9+#._-]*)[ \t]*\r?\n([\s\S]*?)```/);
    let lang = '';
    let code = '';
    if (fence) {
      lang = fence[1] || '';
      code = fence[2];
    } else {
      const m = s.match(/(?:^|\n)\s*(?:代码|程序|code)\s*[:：]\s*\n?([\s\S]*?)(?:\n\s*(?:解析|说明|思路)\s*[:：]|$)/i);
      if (m) code = m[1];
    }
    const em = s.match(/(?:解析|说明|思路)\s*[:：]\s*([\s\S]*)$/);
    return {
      lang,
      code: code.replace(/^\s*\n/, '').replace(/\s+$/, ''),
      explain: em ? em[1].trim() : '',
    };
  };

  const editorBlockOf = (editor, isStemNode) => {
    let el = editor;
    for (let i = 0; i < 8 && el && el.parentElement; i += 1) {
      el = el.parentElement;
      if (isStemNode(el)) return el;
    }
    return null;
  };

  // 编程题：一个题面下有两个编辑器（题面里的只读样例编辑器 + 答题编辑器），
  // 从它们各自向上找到的「题目块」是两个不同的祖先（题面容器 / 整个题目块），
  // 只按 block 对象去重会插出两条工具条 —— 这里改为按「题面节点」去重，
  // 保留文档顺序里先出现的那个（即题面容器），工具条落在标题下方、题面内容上方。
  const pickCodeTargets = (items) => {
    const seen = [];
    return (Array.isArray(items) ? items : []).filter((it) => {
      if (!it || !it.stem) return false;
      if (seen.indexOf(it.stem) >= 0) return false;
      seen.push(it.stem);
      return true;
    });
  };

  // 工具条宿主：题面 markdown 块的父级；拿不到才退回按布局下钻
  const codeBarHost = (stem, block, styleOf) =>
    stem && stem.parentElement ? stem.parentElement : flowHost(block, styleOf);

  const api = { detectType, buildPrompt, parseAnswer, buildActions, askDeepSeek, collectFillGroups, titleAnchor, flowHost, pickLang, nextFold, findInput, stripIndex, isSelectInput, buildCodePrompt, parseCode, editorBlockOf, pickCodeTargets, codeBarHost };
  const g = typeof window !== 'undefined' ? window : globalThis;
  g.__ptaAiSolve = api;

  if (typeof document === 'undefined' || !document.body) return;

  const getKey = () => (typeof GM_getValue === 'function' ? GM_getValue(KEY_STORE, '') : '');
  const saveKey = (k) => {
    if (typeof GM_setValue === 'function') GM_setValue(KEY_STORE, k);
  };
  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('设置 DeepSeek API Key（解析 / 一键完成通用）', () => {
      const k = prompt('DeepSeek API Key（在 platform.deepseek.com 获取）:', getKey());
      if (k) saveKey(k.trim());
    });
  }

  const textOf = (el) => ((el && (el.innerText || el.textContent)) || '').trim();

  const hasStemNode = (el) => [...el.querySelectorAll('[data-markdown-block]')].some((m) => !m.closest('label'));

  const stemOf = (block) =>
    [...block.querySelectorAll('[data-markdown-block]')].filter((m) => !m.closest('label')).map(textOf).join('\n');

  const findBlock = (input) => {
    let el = input;
    for (let i = 0; i < 8 && el && el.parentElement; i += 1) {
      el = el.parentElement;
      const hasStem = [...el.querySelectorAll('[data-markdown-block]')].some((m) => !m.closest('label'));
      if (hasStem && el.querySelectorAll('input').length > 0) return el;
    }
    return null;
  };

  const collectQuestion = (inputs) => {
    const name = inputs[0].getAttribute('name') || '';
    const checkboxes = inputs.filter((i) => i.type === 'checkbox');
    const radios = inputs.filter((i) => i.type === 'radio');
    const texts = inputs.filter((i) => i.type === 'text');
    const options = [];
    inputs.forEach((inp, gi) => {
      if (inp.type === 'text') return;
      const lb = inp.closest('label');
      if (!lb) return;
      const letterEl = lb.querySelector('span');
      const letter = textOf(letterEl).replace(/[^A-Za-z]/g, '');
      const md = lb.querySelectorAll('[data-markdown-block]');
      const text = md.length ? textOf(md[0]) : textOf(lb).replace(/^[A-Za-z][.、]?\s*/, '');
      options.push({ letter: letter || String.fromCharCode(65 + options.length), text, inputId: inp.id || '', gi });
    });
    let stem = '';
    const block = findBlock(inputs[0]);
    if (block) {
      stem = [...block.querySelectorAll('[data-markdown-block]')]
        .filter((m) => !m.closest('label'))
        .map(textOf)
        .join(' ');
    }
    return {
      id: name,
      stem,
      options,
      checkCount: checkboxes.length,
      radioCount: radios.length,
      fills: texts.map((t, i) => ({ inputId: t.id || '', index: i, gi: inputs.indexOf(t) })),
    };
  };

  const setChecked = (input, v) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked').set;
    setter.call(input, v);
    input.dispatchEvent(new Event('click', { bubbles: true }));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const setValue = (input, v) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const applyActions = (q, ans, resolve) => {
    const getById = typeof document !== 'undefined' ? (id) => document.getElementById(id) : null;
    buildActions(q, ans).forEach((a) => {
      const input = findInput(a, resolve, getById);
      if (!input) return;
      if (a.checked !== undefined) setChecked(input, a.checked);
      else if (a.value !== undefined) setValue(input, a.value);
    });
  };

  const inject = (block, list) => {
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 0;position:relative;z-index:10;';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '✨ 解析';
    btn.style.cssText = 'cursor:pointer;border:0;background:#534AB7;color:#fff;border-radius:6px;padding:4px 12px;font-size:13px;';
    const status = document.createElement('span');
    status.style.cssText = 'font-size:12px;color:#888;';
    const foldBtn = document.createElement('button');
    foldBtn.type = 'button';
    foldBtn.textContent = '收起';
    foldBtn.style.cssText = 'cursor:pointer;border:1px solid #ccc;background:#f5f5f5;color:#555;border-radius:6px;padding:2px 8px;font-size:12px;display:none;';
    foldBtn.addEventListener('click', () => {
      const r = nextFold(panel.style.display);
      panel.style.display = r.show ? 'block' : 'none';
      foldBtn.textContent = r.label;
    });
    const panel = document.createElement('div');
    panel.style.cssText = 'display:none;white-space:pre-wrap;font-size:13px;line-height:1.6;background:rgba(127,119,221,.08);border:1px solid rgba(127,119,221,.35);border-radius:8px;padding:10px;margin:6px 0;';
    bar.appendChild(btn);
    bar.appendChild(status);
    bar.appendChild(foldBtn);
    const styleOf = (el) => (typeof getComputedStyle === 'function' ? getComputedStyle(el) : null);
    const host = flowHost(block, styleOf);
    host.insertBefore(bar, host.firstChild);
    host.insertBefore(panel, bar.nextSibling);
    btn.addEventListener('click', () => {
      let q;
      try {
        q = collectQuestion(list);
      } catch (e) {
        status.textContent = '读取题目失败';
        return;
      }
      let key = getKey();
      if (!key) {
        key = prompt('请输入 DeepSeek API Key（在 platform.deepseek.com 获取）:');
        if (!key) return;
        saveKey(key.trim());
        key = key.trim();
      }
      btn.disabled = true;
      status.textContent = 'AI 思考中…';
      panel.style.display = 'none';
      foldBtn.style.display = 'none';
      const lang = pickLang([...document.querySelectorAll('.select__single-value')].map(textOf));
      askDeepSeek(key, buildPrompt(q, lang), (err, text) => {
        btn.disabled = false;
        if (err) {
          status.textContent = '失败：' + err;
          return;
        }
        status.textContent = '完成';
        panel.textContent = text;
        panel.style.display = 'block';
        foldBtn.style.display = '';
        foldBtn.textContent = '收起';
        const ans = parseAnswer(text, q.type);
        if (ans) applyActions(q, ans, (gi) => list[gi]);
      });
    });
  };

  const collectCodeBlocks = () => {
    const editors = [...document.querySelectorAll('.CodeMirror, .cm-editor, .monaco-editor')];
    const found = [];
    editors.forEach((ed) => {
      const block = editorBlockOf(ed, (el) => hasStemNode(el) && !el.querySelector('input[type=radio], input[type=checkbox]'));
      if (!block) return;
      // stem 取题目块里的第一个题面节点，用于「一个题面只插一条工具条」
      found.push({ block, stem: block.querySelector('[data-markdown-block]') });
    });
    return pickCodeTargets(found);
  };

  const injectCode = (target, getStem) => {
    const { block, stem } = target;
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 0;position:relative;z-index:10;flex-wrap:wrap;';
    bar.dataset.ptaSolveBar = 'code';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '✨ 编程解析';
    btn.style.cssText = 'cursor:pointer;border:0;background:#534AB7;color:#fff;border-radius:6px;padding:4px 12px;font-size:13px;';
    const foldBtn = document.createElement('button');
    foldBtn.type = 'button';
    foldBtn.textContent = '收起';
    foldBtn.style.cssText = 'cursor:pointer;border:1px solid #ccc;background:#f5f5f5;color:#555;border-radius:6px;padding:2px 8px;font-size:12px;display:none;';
    const status = document.createElement('span');
    status.style.cssText = 'font-size:12px;color:#888;';
    const panel = document.createElement('div');
    panel.style.cssText = 'display:none;white-space:pre-wrap;font-size:13px;line-height:1.6;background:rgba(127,119,221,.08);border:1px solid rgba(127,119,221,.35);border-radius:8px;padding:10px;margin:6px 0;max-height:420px;overflow:auto;';
    foldBtn.addEventListener('click', () => {
      const r = nextFold(panel.style.display);
      panel.style.display = r.show ? 'block' : 'none';
      foldBtn.textContent = r.label;
    });
    bar.appendChild(btn);
    bar.appendChild(foldBtn);
    bar.appendChild(status);
    const styleOf = (el) => (typeof getComputedStyle === 'function' ? getComputedStyle(el) : null);
    const host = codeBarHost(stem, block, styleOf);
    if (host.querySelector && host.querySelector('[data-pta-solve-bar]')) return; // 同一题面已有工具条
    host.insertBefore(bar, host.firstChild);
    host.insertBefore(panel, bar.nextSibling);
    btn.addEventListener('click', () => {
      let key = getKey();
      if (!key) {
        key = prompt('请输入 DeepSeek API Key（在 platform.deepseek.com 获取）:');
        if (!key) return;
        saveKey(key.trim());
        key = key.trim();
      }
      btn.disabled = true;
      status.textContent = 'AI 思考中…';
      panel.style.display = 'none';
      foldBtn.style.display = 'none';
      const lang = pickLang([...document.querySelectorAll('.select__single-value')].map(textOf));
      askDeepSeek(key, buildCodePrompt(getStem(), lang), (err, text) => {
        btn.disabled = false;
        if (err) {
          status.textContent = '失败：' + err;
          return;
        }
        const parsed = parseCode(text);
        status.textContent = parsed.code ? `完成（${lang || parsed.lang || '未识别语言'}）` : '完成（未识别到代码块，请查看原文）';
        panel.textContent = text;
        panel.style.display = 'block';
        foldBtn.style.display = '';
        foldBtn.textContent = '收起';
      });
    });
  };

  const done = new WeakSet();
  const doneCode = new WeakSet();
  const process = () => {
    const inputs = [...document.querySelectorAll('input')];
    const groups = new Map();
    const loneTexts = [];
    inputs.forEach((i) => {
      const t = i.type;
      if (t !== 'checkbox' && t !== 'radio' && t !== 'text') return;
      if (isSelectInput(i)) return;
      const k = i.getAttribute('name');
      if (k) {
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(i);
      } else if (t === 'text') {
        loneTexts.push(i);
      }
    });
    groups.forEach((list) => {
      if (done.has(list[0])) return;
      const block = findBlock(list[0]);
      if (!block) return;
      done.add(list[0]);
      inject(block, list);
    });
    collectFillGroups(loneTexts, findBlock).forEach((list) => {
      if (done.has(list[0])) return;
      const block = findBlock(list[0]);
      if (!block) return;
      done.add(list[0]);
      inject(block, list);
    });
    collectCodeBlocks().forEach((target) => {
      if (doneCode.has(target.stem)) return;
      doneCode.add(target.stem);
      injectCode(target, () => stemOf(target.block));
    });
  };

  try {
    new MutationObserver(process).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) { /* ignore */ }
  process();
})();
}

// ---------------------------------------------------------------
// [4/5] 一键完成 · v1.6.2 · src/pta-auto-complete.user.js
// ---------------------------------------------------------------
// 仅在原脚本的 @match 范围内启用（location.pathname 以 /problem-sets/ 开头）
// 正文不做缩进：避免动到多行模板字符串的内容
if (location.pathname.indexOf('/problem-sets/') === 0) {
(() => {
  const API_URL = 'https://api.deepseek.com/chat/completions';
  const KEY_STORE = 'pta-deepseek-key'; // 合并后与解析脚本共用同一个 Key（原为 pta-deepseek-auto-key，见文件头迁移代码）
  const MODEL_TEXT = 'deepseek-chat'; // 纯文本，读不了图
  const MODEL_VISION = 'deepseek-flash'; // 多模态：可接收图片 URL（旧名 deepseek-v4-flash-vision-exp 已退役但仍兼容）
  const MAX_IMAGES = 6; // 单题最多随题干带几张图，超出的丢弃
  const TYPE_NAME = { multi: '多选题（可能不止一个正确选项）', single: '单选题', judge: '判断题', fill: '填空题' };

  const detectType = (q) => {
    if (q.checkCount > 0) return 'multi';
    if (q.radioCount > 0) {
      const t = q.options.map((o) => o.text).join(' ');
      const right = /对|正确|√/.test(t);
      const wrong = /错|错误|×/.test(t);
      if (q.options.length === 2 && right && wrong) return 'judge';
      return 'single';
    }
    return 'fill';
  };

  const withType = (q) => ({ ...q, type: detectType(q) });

  const buildPrompt = (q) => {
    const lines = ['你是程序设计课程助教，请仔细作答。', `题型：${TYPE_NAME[q.type]}`, `题干：${q.stem}`];
    if (q.type !== 'fill') {
      q.options.forEach((o) => lines.push(`${o.letter}. ${o.text}`));
    } else if (q.fills && q.fills.length > 1) {
      lines.push(`（共 ${q.fills.length} 个空，按顺序作答）`);
    }
    let fmt;
    if (q.type === 'multi') fmt = '答案: ABD（多个字母连写，按字母序，如 BCD）';
    else if (q.type === 'single') fmt = '答案: A（单个大写字母）';
    else if (q.type === 'judge') fmt = '答案: T（T=正确，F=错误，只写一个字母）';
    else if (q.fills && q.fills.length > 0) fmt = `答案: 1)第一个空的答案 2)第二个空的答案（共 ${q.fills.length} 个空，就写 ${q.fills.length} 项，按顺序）`;
    else fmt = '答案: 1)第一个空的答案 2)第二个空的答案（先数清题干中有几个空，有几个空就写几项，按顺序）';
    if (q.type === 'fill') lines.push('注意：先数清题干中的空（横线/下划线处）数量，答案项数必须与空数一致。');
    lines.push('', `最终答案只占一行，格式严格为「${fmt}」（"答案"后跟冒号），下一行起给出不超过 150 字的简要解析。`);
    return lines.join('\n');
  };

  const SPLIT_IDX = /(?:^|[\s　]+)(?:[（(]\s*\d+\s*[)）、]|\d+\s*[)）、]|\d+\s*空\s*[:：])\s*/;
  const stripIndex = (s) =>
    String(s)
      .replace(/^(?:[（(]\s*\d+\s*[)）、]|\d+\s*[)）、]|\d+\s*空\s*[:：]|第\s*\d+\s*(?:空|个空)\s*[:：]?)\s*/, '')
      .trim();

  const parseAnswer = (text, type) => {
    const m = String(text).match(/答案\s*[:：]\s*([^\n]+)/);
    if (!m) return null;
    const raw = m[1].trim();
    if (type === 'multi' || type === 'single') {
      const letters = [...new Set((raw.toUpperCase().match(/[A-Z]/g) || []))].sort();
      return { kind: 'letters', letters };
    }
    if (type === 'judge') {
      if (/^\s*T/i.test(raw)) return { kind: 'judge', value: 'right' };
      if (/^\s*F/i.test(raw)) return { kind: 'judge', value: 'wrong' };
      return { kind: 'judge', value: /错/.test(raw) ? 'wrong' : 'right' };
    }
    let values = raw
      .split(SPLIT_IDX)
      .map((s) => s.trim())
      .filter(Boolean);
    if (values.length <= 1) {
      values = raw.split(/[;；\n]/).map((s) => s.trim()).filter(Boolean);
    }
    if (values.length <= 1) {
      values = raw.split(/[,，、]/).map((s) => s.trim()).filter(Boolean);
    }
    values = values.map(stripIndex).filter(Boolean);
    return { kind: 'fill', values };
  };

  const buildActions = (q, ans) => {
    const acts = [];
    if (ans.kind === 'letters') {
      q.options.forEach((o) => acts.push({ inputId: o.inputId, gi: o.gi, checked: ans.letters.includes(o.letter.toUpperCase()) }));
    } else if (ans.kind === 'judge') {
      const re = ans.value === 'right' ? /对|正确|√/ : /错|错误|×/;
      let hit = q.options.filter((o) => re.test(o.text));
      if (!hit.length && q.options[ans.value === 'right' ? 0 : 1]) hit = [q.options[ans.value === 'right' ? 0 : 1]];
      q.options.forEach((o) => acts.push({ inputId: o.inputId, gi: o.gi, checked: hit.includes(o) }));
    } else {
      (q.fills || []).forEach((f, i) => acts.push({ inputId: f.inputId, gi: f.gi, value: (ans.values || [])[i] || '' }));
    }
    return acts;
  };

  const isSelectInput = (el) => {
    const role = el.getAttribute && el.getAttribute('role');
    const cls = typeof el.className === 'string' ? el.className : '';
    return role === 'combobox' || /dummyInput|select__/.test(cls);
  };

  const pickLang = (texts) => {
    const hit = (texts || [])
      .map((t) => String(t).trim())
      .find((t) => t.length > 0 && t.length <= 30 && /^[A-Za-z][A-Za-z0-9#+. ]*(\s*\(.+\))?$/.test(t));
    return hit || '';
  };

  // ---------- 读图（多模态） ----------
  // 图片只能以 image_url 块的形态送进多模态模型；纯文本模型收到图片会直接报 400。
  const pickModel = (useVision) => (useVision ? MODEL_VISION : MODEL_TEXT);

  // 只保留合法的 http(s) 图片地址，去重并按上限截断（占位编号与实际发送顺序一一对应）
  const capImages = (urls, max) => {
    const lim = typeof max === 'number' ? max : MAX_IMAGES;
    const out = [];
    (Array.isArray(urls) ? urls : []).forEach((u) => {
      const s = typeof u === 'string' ? u.trim() : '';
      if (!/^https?:\/\//i.test(s) || out.indexOf(s) >= 0) return;
      if (out.length < lim) out.push(s);
    });
    return out;
  };

  // 组装消息 content：有图 → 数组（text + image_url），无图 → 纯字符串（保持原有行为）
  const buildContent = (promptText, urls) => {
    const imgs = capImages(urls);
    if (!imgs.length) return promptText;
    return [{ type: 'text', text: promptText }].concat(
      imgs.map((u) => ({ type: 'image_url', image_url: { url: u } }))
    );
  };

  // 从 API 错误文本判断「这个模型处理不了图片 / 模型名已失效」，用于自动降级重试
  const isVisionError = (msg) =>
    /does not support image|not support image|不支持图片|invalid_image|no such model|model_not_found|model[\s\S]{0,20}not\s*exist|does not exist|image_url/i.test(
      String(msg || '')
    );

  // 数据库 / SQL 题：题干里必有建表语句，或语言选择器写着 SQL/MySQL/数据库
  const isSqlTask = (stem, lang) =>
    /mysql|sql|oracle|postgres|数据库/i.test(String(lang || '')) ||
    /CREATE\s+(?:TABLE|VIEW|INDEX|DATABASE)\b/i.test(String(stem || ''));

  // 数据库方言：PTA 的 SQL 题可能是 MySQL / SQL Server / Oracle…，
  // 「数据库：xxx」写在 problemInfo（题干文本里）而不是语言选择器，所以从题干识别。
  // 每种方言给模型一组硬性语法要点，避免 MySQL 语句跑到 SQL Server 上（CURDATE 报错就是这种）。
  const DB_DIALECTS = [
    [
      'SQL Server',
      /sql\s*server|mssql|t-sql/i,
      [
        '不要使用 MySQL 语法：标识符不用反引号 ` ` 包裹（直接写 Student、sno，或用 [Student]）；',
        '取当前日期/时间只能用 GETDATE()（纯日期用 CAST(GETDATE() AS date)）；没有 CURDATE、CURDATE()、NOW()、CURTIME()；',
        '没有 LIMIT、IFNULL()、DATE_FORMAT()；取前 N 行用 SELECT TOP N；空值转换用 ISNULL()；字符串拼接用 +；',
        '按生日算年龄：YEAR(GETDATE()) - YEAR(生日列)；若用 DATEDIFF(YEAR, 生日列, GETDATE()) 注意它只按年份数字作差，生日未过会多算 1 岁，需用 CASE 校正。',
      ],
    ],
    [
      'MySQL',
      /mysql|mariadb/i,
      [
        '标识符用反引号 ` `（如 `Student`）；取当前日期用 CURDATE() 或 NOW()；',
        '取前 N 行用 LIMIT；空值转换用 IFNULL()；日期格式化用 DATE_FORMAT()；保留 n 位小数用 ROUND(x, n)。',
      ],
    ],
    [
      'Oracle',
      /oracle|pl\s*\/\s*sql/i,
      [
        '取当前日期用 SYSDATE（纯日期 TRUNC(SYSDATE)）；没有 LIMIT，取前 N 行用 FETCH FIRST N ROWS ONLY 或 ROWNUM；',
        '空值转换用 NVL()；字符串拼接用 ||；日期与字符串转换用 TO_DATE()/TO_CHAR()。',
      ],
    ],
    [
      'PostgreSQL',
      /postgres|postgresql/i,
      [
        '取当前日期用 CURRENT_DATE 或 NOW()；取前 N 行用 LIMIT；空值转换用 COALESCE()；字符串拼接用 ||。',
      ],
    ],
  ];

  // 依次看语言选择器和题干，返回方言名；识别不到返回 ''（由调用方决定兜底）
  const pickDialect = (stem, lang) => {
    const text = String(lang || '') + '\n' + String(stem || '');
    for (let i = 0; i < DB_DIALECTS.length; i++) {
      if (DB_DIALECTS[i][1].test(text)) return DB_DIALECTS[i][0];
    }
    return '';
  };

  // 方言对应的语法要点；完全识别不到时只允许通用标准写法，禁用一切方言函数
  const dialectSpec = (name) => {
    const hit = DB_DIALECTS.find((d) => d[0] === name);
    if (hit) return hit[2];
    return [
      '题面没有写明数据库类型，使用各数据库通用的标准 SQL 写法：不用反引号、不用 CURDATE/NOW/GETDATE/LIMIT/IFNULL 等某一家特有的函数与语法。',
    ];
  };

  // SQL 专属提示词：只给一条可执行语句，列名/顺序/大小写按题面与样例图，语法约束按识别出的数据库方言
  const buildSqlPrompt = (stem, lang, imageCount) => {
    const text = String(stem || '');
    const detected = pickDialect(text, lang);
    const db = detected || 'MySQL';
    const note = detected ? '' : '（题面未写明数据库类型，按 PTA 默认的 MySQL 处理；若实际是其他数据库请以题面为准）';
    const lines = [
      '你是数据库课程助教，请给出可直接执行的 SQL 语句。',
      `数据库：${db}${note}——必须只使用该数据库真实存在的语法与内置函数，用错方言函数会直接报错。`,
      '',
      `题目：${text}`,
    ];
    if (imageCount > 0) {
      lines.push(
        '',
        `题干附有 ${imageCount} 张图片（正文中以 [图1] [图2] … 标出位置），里面可能包含表样例数据与题目要求的输出样例。请以图片中的列名、列顺序和数据格式为准。`
      );
    }
    lines.push(
      '',
      '硬性要求：',
      '1. 只输出一条 SQL 语句（建视图就是 CREATE VIEW ... AS SELECT ...），不要写成程序、不要加注释、不要写多条语句；',
      '2. 表名、列名的大小写必须与题目给出的表结构定义完全一致；',
      '3. 视图的列名与列顺序必须与输出样例一致（含大小写）；数值格式也照样例，需要保留 n 位小数就用该数据库的四舍五入函数；'
    );
    if (/忽略顺序/i.test(text)) lines.push('4. 题目要求「忽略顺序只对比数据」，不要写 ORDER BY；');
    else if (/严格对比顺序/i.test(text)) lines.push('4. 题目要求「严格对比顺序与数据」，行顺序按样例推导并补上 ORDER BY；');
    else lines.push('4. 行顺序按样例推导，需要时补 ORDER BY；');
    lines.push(`5. ${db} 的语法要点（必须遵守）：`);
    dialectSpec(db).forEach((s) => lines.push('   - ' + s));
    lines.push(
      '6. 用 ```sql 代码块给出语句，代码块之后写「解析：」，不超过 150 字，并明确列出你对列名、列顺序与所用函数的假设。'
    );
    return lines.join('\n');
  };

  const buildCodePrompt = (stem, lang, imageCount) => {
    const lines = [
      '你是程序设计课程助教，请给出可直接提交的完整程序。',
      `编程语言：${lang || '按题目要求选择'}`,
      '',
      `题目：${stem}`,
    ];
    if (imageCount > 0) {
      lines.push('', `题干附有 ${imageCount} 张图片（正文中以 [图1] [图2] … 标出位置），请一并参考，不要忽略图片里的示例数据与要求。`);
    }
    lines.push(
      '',
      '输出格式要求：',
      '1. 先写一行「语言: 语言名」；',
      '2. 然后用 ``` 代码块给出完整代码（含输入读取、必要的 import/头文件），代码必须能直接编译运行；',
      '3. 代码块之后写「解析：」，再用不超过 150 字说明思路。'
    );
    return lines.join('\n');
  };

  const parseCode = (text) => {
    const s = String(text);
    const fence = s.match(/```[ \t]*([A-Za-z0-9+#._-]*)[ \t]*\r?\n([\s\S]*?)```/);
    let lang = '';
    let code = '';
    if (fence) {
      lang = fence[1] || '';
      code = fence[2];
    } else {
      const m = s.match(/(?:^|\n)\s*(?:代码|程序|code)\s*[:：]\s*\n?([\s\S]*?)(?:\n\s*(?:解析|说明|思路)\s*[:：]|$)/i);
      if (m) code = m[1];
    }
    const em = s.match(/(?:解析|说明|思路)\s*[:：]\s*([\s\S]*)$/);
    return {
      lang,
      code: code.replace(/^\s*\n/, '').replace(/\s+$/, ''),
      explain: em ? em[1].trim() : '',
    };
  };

  const hasCode = (text) => String(text || '').replace(/\s+/g, '') !== '';

  const isWritableEditor = (el) => {
    if (!el || typeof el.getAttribute !== 'function') return false;
    return el.getAttribute('contenteditable') === 'true' && el.getAttribute('aria-readonly') !== 'true';
  };

  const findInput = (a, resolve, getById) => {
    if (a.gi !== undefined && a.gi !== null && typeof resolve === 'function') {
      const el = resolve(a.gi);
      if (el) return el;
    }
    if (a.inputId && typeof getById === 'function') return getById(a.inputId) || null;
    return null;
  };

  const pushLine = (lines, s, max) => {
    const arr = Array.isArray(lines) ? lines : [];
    const out = arr.concat([String(s)]);
    return out.length > max ? out.slice(out.length - max) : out;
  };

  const textOf = (el) => ((el && (el.innerText || el.textContent)) || '').trim();

  // ---------- 题干抓取：文本 + 图片 ----------
  // 图片地址补全成绝对 URL：模型侧要自己去下载图片，//host/x.png 这种协议相对地址发不出去
  const absUrl = (src) => {
    const s = String(src == null ? '' : src).trim();
    if (/^https?:\/\//i.test(s)) return s;
    if (/^\/\//.test(s)) return 'https:' + s;
    if (!s) return '';
    if (typeof location !== 'undefined' && location && location.href) {
      try {
        return new URL(s, location.href).href;
      } catch (e) {
        return '';
      }
    }
    return '';
  };

  // 克隆一段题面做清洗：去掉行号栏/工具栏/播报区、给 CodeMirror 每行补换行、把图片换成 [图N] 占位。
  // 占位编号与 images 数组顺序一致，模型据此把 [图N] 对应到实际图片。
  const stemPart = (el, images) => {
    let node;
    try {
      node = el.cloneNode(true);
    } catch (e) {
      return textOf(el);
    }
    const doc = typeof document !== 'undefined' ? document : null;
    [...node.querySelectorAll('.cm-gutters, .cm-announced, .cm-panels')].forEach((g) => {
      if (g.remove) g.remove();
    });
    if (doc) {
      [...node.querySelectorAll('.cm-line')].forEach((l) => {
        if (l.appendChild) l.appendChild(doc.createTextNode('\n'));
      });
      [...node.querySelectorAll('br')].forEach((b) => {
        if (b.replaceWith) b.replaceWith(doc.createTextNode('\n'));
      });
    }
    [...node.querySelectorAll('img')].forEach((im) => {
      const src = absUrl(im.getAttribute ? im.getAttribute('src') : im.src);
      let slot = 0;
      if (src) {
        slot = images.indexOf(src) + 1;
        if (!slot) {
          images.push(src);
          slot = images.length;
        }
      }
      if (doc && im.replaceWith) im.replaceWith(doc.createTextNode(slot ? `[图${slot}]` : '[图片]'));
    });
    return textOf(node);
  };

  // 题干 = markdown 题面（含图片占位）+ problemInfo（数据库类型、结果输出要求等不在 markdown 块里的信息）
  const stemBundle = (block) => {
    const images = [];
    const parts = [];
    [...block.querySelectorAll('[data-markdown-block]')].forEach((m) => {
      if (m.closest && m.closest('label')) return;
      parts.push(stemPart(m, images));
    });
    [...block.querySelectorAll('[class*="problemInfo"]')].forEach((p) => parts.push(textOf(p)));
    return { text: parts.filter(Boolean).join('\n'), images };
  };

  const isDone = (blockText, inputs) => {
    if (/评测结果|参考答案/.test(String(blockText))) return true;
    if (!inputs.length) return false;
    const anyChecked = inputs.some((i) => i.type !== 'text' && i.checked);
    if (anyChecked) return true;
    const texts = inputs.filter((i) => i.type === 'text');
    if (texts.length) return texts.every((i) => String(i.value || '').trim() !== '');
    return false;
  };

  // content 既可以是字符串（纯文本），也可以是内容块数组（text + image_url）
  const askDeepSeek = (key, content, cb, opts) => {
    const o = opts || {};
    const withVision = Array.isArray(content);
    const plain = withVision ? String(((content.find((b) => b && b.type === 'text') || {}).text) || '') : String(content);
    const finish = (err, text, meta) => {
      try {
        cb(err, text, meta);
      } catch (e) {
        console.error(e);
      }
    };
    const send = (model, payload, done) => {
      const body = JSON.stringify({
        model,
        stream: false,
        temperature: 0.2,
        messages: [{ role: 'user', content: payload }],
      });
      // 把 API 的 error.message 也带出来，便于判断「模型不支持图片」后降级
      const bad = (raw, d) => {
        const m = d && d.error && (d.error.message || d.error.type);
        return (m ? String(m) : '响应异常') + '：' + String(raw == null ? '' : raw).slice(0, 200);
      };
      if (typeof GM_xmlhttpRequest === 'function') {
        GM_xmlhttpRequest({
          method: 'POST',
          url: API_URL,
          timeout: 120000,
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
          data: body,
          onload: (r) => {
            try {
              const d = JSON.parse(r.responseText);
              const c = d && d.choices && d.choices[0];
              if (!c) done(bad(r.responseText, d));
              else done(null, c.message.content);
            } catch (e) {
              done('响应异常：' + String(r.responseText).slice(0, 200));
            }
          },
          onerror: () => done('网络错误'),
          ontimeout: () => done('请求超时'),
        });
      } else if (typeof fetch === 'function') {
        fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body })
          .then((r) => r.json().then((d) => ({ d })))
          .then(({ d }) => {
            const c = d && d.choices && d.choices[0];
            if (!c) done(bad(JSON.stringify(d), d));
            else done(null, c.message.content);
          })
          .catch((e) => done(e && e.message ? e.message : '网络错误'));
      } else {
        done('当前环境无法发起网络请求');
      }
    };
    send(o.model || MODEL_TEXT, content, (err, text) => {
      if (!err) {
        finish(null, text, { model: o.model || MODEL_TEXT, fell: false });
        return;
      }
      // 带图请求失败且错误指向「图片/模型不可用」时，退回纯文本模型重试一次
      if (withVision && o.fallbackModel && isVisionError(err)) {
        send(o.fallbackModel, plain, (e2, t2) => finish(e2, t2, { model: o.fallbackModel, fell: true }));
        return;
      }
      finish(err, text, { model: o.model || MODEL_TEXT, fell: false });
    });
  };

  const dragPos = (sx, sy, dx, dy, vw, vh, w, h) => {
    const clamp = (v, max) => Math.min(Math.max(v, 0), Math.max(max, 0));
    return { left: Math.round(clamp(sx + dx, vw - w)), top: Math.round(clamp(sy + dy, vh - h)) };
  };

  // ---------- 编辑器定位与写入（绕过站点「禁止粘贴」） ----------
  // CodeMirror 6 会把视图挂在内容节点上：新版属性名 cmTile（旧版 cmView），
  // 顺着 tile.parent / tile.root 能拿到 DocTile 上的 view —— 等价于官方 EditorView.findFromDOM。
  const looksLikeView = (o) =>
    !!o && typeof o === 'object' && typeof o.dispatch === 'function' && !!o.state && !!o.state.doc && typeof o.state.doc.toString === 'function';

  const SKIP_KEYS = {
    state: 1, doc: 1, dom: 1, contentDOM: 1, win: 1, window: 1, document: 1, constructor: 1,
    return: 1, child: 1, sibling: 1, alternate: 1, stateNode: 1, childNodes: 1, _owner: 1,
  };

  const findViewDeep = (root, maxDepth, maxNodes) => {
    if (!root || typeof root !== 'object') return null;
    const seen = new Set();
    const queue = [[root, 0]];
    let n = 0;
    while (queue.length && n < maxNodes) {
      const item = queue.shift();
      const obj = item[0];
      const d = item[1];
      if (!obj || typeof obj !== 'object' || seen.has(obj)) continue;
      seen.add(obj);
      n += 1;
      if (looksLikeView(obj)) return obj;
      if (d >= maxDepth) continue;
      if (typeof obj.nodeType === 'number') continue; // DOM 节点只看自身属性，不往里钻
      let keys;
      try {
        keys = Object.keys(obj);
      } catch (e) {
        continue;
      }
      for (let i = 0; i < keys.length; i += 1) {
        const k = keys[i];
        if (SKIP_KEYS[k]) continue;
        let v;
        try {
          v = obj[k];
        } catch (e) {
          continue;
        }
        if (v && typeof v === 'object') queue.push([v, d + 1]);
      }
    }
    return null;
  };

  const fiberOf = (el) => {
    if (!el || typeof el !== 'object') return null;
    let keys;
    try {
      keys = Object.keys(el);
    } catch (e) {
      return null;
    }
    const k = keys.find((x) => x.indexOf('__reactFiber$') === 0 || x.indexOf('__reactInternalInstance$') === 0);
    if (!k) return null;
    try {
      return el[k] || null;
    } catch (e) {
      return null;
    }
  };

  const viewOfNode = (node) => {
    if (!node) return null;
    let tile = null;
    try {
      tile = node.cmTile || node.cmView || null;
    } catch (e) {
      tile = null;
    }
    let cur = tile;
    for (let i = 0; cur && i < 10; i += 1) {
      if (looksLikeView(cur.view)) return cur.view;
      let root = null;
      try {
        root = cur.root || null;
      } catch (e) {
        root = null;
      }
      if (root && looksLikeView(root.view)) return root.view;
      if (looksLikeView(cur)) return cur;
      cur = cur.parent || null;
    }
    let fiber = fiberOf(node);
    for (let i = 0; fiber && i < 20; i += 1) {
      const hit = findViewDeep(fiber.memoizedState, 5, 600) || findViewDeep(fiber.memoizedProps, 4, 400);
      if (hit) return hit;
      fiber = fiber.return || null;
    }
    return findViewDeep(node, 3, 400);
  };

  const isContentEl = (el) => {
    try {
      return !!(el && el.classList && el.classList.contains('cm-content'));
    } catch (e) {
      return false;
    }
  };

  // 目标内容节点：既要能写，又要是可编辑的那个（题面样例编辑器 aria-readonly=true 被排除）
  const writableContent = (root) => {
    if (!root) return null;
    if (isWritableEditor(root)) return root;
    if (isContentEl(root) && root.getAttribute && root.getAttribute('aria-readonly') === 'true') return null;
    try {
      return root.querySelector ? root.querySelector('.cm-content[contenteditable="true"]') : null;
    } catch (e) {
      return null;
    }
  };

  const readEditorText = (el) => {
    if (!el) return '';
    if (typeof el.value === 'string') return el.value;
    const view = viewOfNode(el);
    if (view) {
      try {
        return view.state.doc.toString();
      } catch (e) {
        /* 忽略，退回读 DOM 文本 */
      }
    }
    return String(el.textContent || '').replace(/\u00a0/g, ' ');
  };

  const normText = (s) => String(s === null || s === undefined ? '' : s).replace(/\r\n?/g, '\n').replace(/\s+/g, ' ').trim();

  // 写入是否真的落到了编辑器里（白空格差异不算失败）
  const codeLanded = (text, code) => {
    const t = normText(text);
    const c = normText(code);
    if (!c || !t) return false;
    if (t === c || t.indexOf(c) >= 0) return true;
    const first = normText(String(code).split('\n').find((l) => l.trim()) || '');
    return first.length >= 8 && t.indexOf(first) >= 0;
  };

  // 是否要在捕获阶段屏蔽站点自己的粘贴拦截（只挡拦截器，不阻止浏览器默认行为）
  // 注意：keydown 只拦 Ctrl/Cmd+V，否则会连带拦掉 Ctrl+Z / Ctrl+A 等编辑器自身快捷键
  const shouldShield = (type, inEditor, ctrl, key) => {
    if (!inEditor) return false;
    if (type === 'keydown') return !!ctrl && String(key === null || key === undefined ? '' : key).toLowerCase() === 'v';
    return type === 'paste' || type === 'contextmenu' || type === 'drop' || type === 'dragover';
  };

  const api = { detectType, withType, buildPrompt, parseAnswer, buildActions, isDone, askDeepSeek, dragPos, findInput, stripIndex, isSelectInput, pushLine, textOf, absUrl, stemPart, stemBundle, pickLang, buildCodePrompt, buildSqlPrompt, pickDialect, dialectSpec, parseCode, hasCode, isWritableEditor, looksLikeView, findViewDeep, viewOfNode, writableContent, readEditorText, normText, codeLanded, shouldShield, pickModel, capImages, buildContent, isVisionError, isSqlTask, MODEL_TEXT, MODEL_VISION, MAX_IMAGES };
  const g = typeof window !== 'undefined' ? window : globalThis;
  g.__ptaAutoComplete = api;

  if (typeof document === 'undefined' || !document.body) return;

  let lastCode = ''; // 最近一次 AI 生成的代码（供「📋 复制代码」兜底）
  let pasteGuard = true; // 是否接管编辑器内的粘贴（绕过「禁止粘贴」）

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const getKey = () => (typeof GM_getValue === 'function' ? GM_getValue(KEY_STORE, '') : '');
  const saveKey = (k) => {
    if (typeof GM_setValue === 'function') GM_setValue(KEY_STORE, k);
  };
  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('设置 DeepSeek API Key（解析 / 一键完成通用）', () => {
      const k = prompt('DeepSeek API Key（在 platform.deepseek.com 获取）:', getKey());
      if (k) saveKey(k.trim());
    });
  }

  const findBlock = (input) => {
    let el = input;
    for (let i = 0; i < 8 && el && el.parentElement; i += 1) {
      el = el.parentElement;
      const hasStem = [...el.querySelectorAll('[data-markdown-block]')].some((m) => !m.closest('label'));
      if (hasStem && el.querySelectorAll('input').length > 0) return el;
    }
    return null;
  };

  const collectQuestion = (inputs) => {
    const name = inputs[0].getAttribute('name') || '';
    const checkboxes = inputs.filter((i) => i.type === 'checkbox');
    const radios = inputs.filter((i) => i.type === 'radio');
    const texts = inputs.filter((i) => i.type === 'text');
    const options = [];
    inputs.forEach((inp, gi) => {
      if (inp.type === 'text') return;
      const lb = inp.closest('label');
      if (!lb) return;
      const letterEl = lb.querySelector('span');
      const letter = textOf(letterEl).replace(/[^A-Za-z]/g, '');
      const md = lb.querySelectorAll('[data-markdown-block]');
      const text = md.length ? textOf(md[0]) : textOf(lb).replace(/^[A-Za-z][.、]?\s*/, '');
      options.push({ letter: letter || String.fromCharCode(65 + options.length), text, inputId: inp.id || '', gi });
    });
    let stem = '';
    const block = findBlock(inputs[0]);
    if (block) {
      stem = [...block.querySelectorAll('[data-markdown-block]')]
        .filter((m) => !m.closest('label'))
        .map(textOf)
        .join(' ');
    }
    return withType({
      id: name,
      stem,
      options,
      checkCount: checkboxes.length,
      radioCount: radios.length,
      fills: texts.map((t, i) => ({ inputId: t.id || '', index: i, gi: inputs.indexOf(t) })),
    });
  };

  const collectFillGroups = (texts, resolveBlock) => {
    const groups = new Map();
    texts.forEach((t) => {
      const b = resolveBlock(t);
      if (!b) return;
      if (!groups.has(b)) groups.set(b, []);
      groups.get(b).push(t);
    });
    return [...groups.values()];
  };

  const collectGroups = () => {
    const inputs = [...document.querySelectorAll('input')];
    const byName = new Map();
    const loneTexts = [];
    inputs.forEach((i) => {
      const t = i.type;
      if (t !== 'checkbox' && t !== 'radio' && t !== 'text') return;
      if (isSelectInput(i)) return;
      const k = i.getAttribute('name');
      if (k) {
        if (!byName.has(k)) byName.set(k, []);
        byName.get(k).push(i);
      } else if (t === 'text') {
        loneTexts.push(i);
      }
    });
    const groups = [];
    byName.forEach((list) => {
      const block = findBlock(list[0]);
      if (block) groups.push({ kind: 'objective', block, inputs: list });
    });
    collectFillGroups(loneTexts, findBlock).forEach((list) => {
      const block = findBlock(list[0]);
      if (block) groups.push({ kind: 'objective', block, inputs: list });
    });
    return groups.concat(collectCodeGroups());
  };

  // 从编辑器向上找到「含题干」的题目块（编程题的题面在左侧栏，编辑器在右侧栏，需向上若干层）
  const findCodeBlock = (el) => {
    let n = el;
    for (let i = 0; i < 10 && n && n.parentElement; i += 1) {
      n = n.parentElement;
      if ([...n.querySelectorAll('[data-markdown-block]')].some((m) => !m.closest('label'))) return n;
    }
    return null;
  };

  // 只认可写的 .cm-content（题面里的输入/输出样例是只读编辑器，aria-readonly="true"）
  const collectCodeGroups = () => {
    const out = [];
    const seen = new Set();
    [...document.querySelectorAll('.cm-content')].forEach((content) => {
      if (!isWritableEditor(content)) return;
      const editor = content.closest('.cm-editor') || content;
      const block = findCodeBlock(editor);
      if (!block || seen.has(block)) return;
      seen.add(block);
      out.push({ kind: 'code', block, content });
    });
    return out;
  };

  const pageLang = () => pickLang([...document.querySelectorAll('.select__single-value')].map(textOf));

  const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));

  const selectAllIn = (el) => {
    try {
      const sel = window.getSelection();
      if (!sel) return;
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) {
      /* 忽略 */
    }
  };

  // 合成 paste 事件：CM6 自带的 paste 处理器会读 clipboardData 并写入（不依赖浏览器默认粘贴）
  const syntheticPaste = (content, code) => {
    if (typeof window.ClipboardEvent !== 'function' || typeof window.DataTransfer !== 'function') return false;
    try {
      const dt = new DataTransfer();
      dt.setData('text/plain', code);
      const ev = new window.ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
      content.dispatchEvent(ev);
      return true;
    } catch (e) {
      return false;
    }
  };

  // 写入代码：五种方式依次尝试，每种都用「读回编辑器文本」校验，避免假成功
  const insertCode = (root, code, mode) => {
    const text = String(code === null || code === undefined ? '' : code);
    const tried = [];
    const done = (how) => ({ how, ok: true, tried });
    if (!text.trim()) return { how: '', ok: false, tried: ['内容为空'] };
    let target = writableContent(root);
    if (target && target.isConnected === false) target = writableContent(document); // 扫描后 React 重渲染过则重新定位

    // 1) CodeMirror6 事务：直接改编辑器状态，站点的 paste/beforeinput 拦截完全无效
    if (target) {
      const view = viewOfNode(target);
      if (view) {
        try {
          if (mode === 'sel' && view.state.selection && typeof view.state.replaceSelection === 'function') {
            view.dispatch(view.state.replaceSelection(text));
          } else {
            view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
          }
          if (typeof view.focus === 'function') view.focus();
          if (codeLanded(view.state.doc.toString(), text)) return done('CodeMirror6·事务');
          tried.push('CM6 事务未生效');
        } catch (e) {
          tried.push('CM6 事务异常：' + ((e && e.message) || e));
        }
      } else {
        tried.push('未找到 CM6 视图');
      }

      // 2) 合成 paste 事件（走 CM6 自己的粘贴通道）
      try {
        if (typeof target.focus === 'function') target.focus();
        if (mode !== 'sel') selectAllIn(target);
        if (syntheticPaste(target, text) && codeLanded(readEditorText(target), text)) return done('CM6·合成粘贴');
        tried.push('合成粘贴未生效');
      } catch (e) {
        tried.push('合成粘贴异常：' + ((e && e.message) || e));
      }
    } else {
      tried.push('未找到可编辑内容区');
    }

    // 3) CodeMirror5
    const cm5 = root && root.querySelector ? root.querySelector('.CodeMirror') : null;
    if (cm5 && cm5.CodeMirror && typeof cm5.CodeMirror.setValue === 'function') {
      try {
        cm5.CodeMirror.setValue(text);
        if (codeLanded(String(cm5.CodeMirror.getValue()), text)) return done('CodeMirror5');
        tried.push('CM5 setValue 未生效');
      } catch (e) {
        tried.push('CM5 异常：' + ((e && e.message) || e));
      }
    }

    // 4) contenteditable + execCommand（走浏览器编辑管线，不产生 paste 事件）
    if (target) {
      try {
        if (typeof target.focus === 'function') target.focus();
        if (mode !== 'sel') selectAllIn(target);
        if (typeof document.execCommand === 'function' && document.execCommand('insertText', false, text) && codeLanded(readEditorText(target), text)) {
          return done('contenteditable');
        }
        tried.push('execCommand 未生效');
      } catch (e) {
        tried.push('execCommand 异常：' + ((e && e.message) || e));
      }
    }

    // 5) 普通 textarea
    const ta = root && root.querySelector ? root.querySelector('textarea') : null;
    if (ta) {
      try {
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
        setter.call(ta, text);
        fire(ta, 'input');
        fire(ta, 'change');
        if (codeLanded(ta.value, text)) return done('textarea');
        tried.push('textarea 写值未生效');
      } catch (e) {
        tried.push('textarea 异常：' + ((e && e.message) || e));
      }
    }
    return { how: '', ok: false, tried };
  };

  const setChecked = (input, v) => {
    if (input.checked === v) return true;
    const before = input.checked;
    input.click(); // 原生点击：浏览器翻转 checked 并派发完整事件序列，React 受控组件最认可
    if (input.checked === before) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked').set;
      setter.call(input, v);
      fire(input, 'click');
      fire(input, 'input');
      fire(input, 'change');
    }
    return input.checked === v;
  };

  const setValue = (input, v) => {
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, v);
    fire(input, 'input');
    fire(input, 'change');
    if (input.value !== v && typeof document.execCommand === 'function') {
      try {
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, v);
      } catch (e) { /* ignore */ }
    }
    return input.value === v;
  };

  const applyActions = (q, ans, resolve) => {
    let n = 0;
    const getById = typeof document !== 'undefined' ? (id) => document.getElementById(id) : null;
    buildActions(q, ans).forEach((a) => {
      const input = findInput(a, resolve, getById);
      if (!input) return;
      if (a.checked !== undefined) {
        if (input.type === 'radio' && !a.checked) return; // radio 无需取消同组其他项
        if (setChecked(input, a.checked)) n += 1;
      } else if (a.value !== undefined) {
        if (setValue(input, a.value)) n += 1;
      }
    });
    return n;
  };

  const visionFlag = { on: true }; // 「🖼 读图」开关：关掉就退回纯文本模型

  // 发请求：带图时用视觉模型（失败自动降级为纯文本重试），不带图时用纯文本模型
  const askP = (key, promptText, images) => {
    const imgs = capImages(images);
    const useVision = visionFlag.on && imgs.length > 0;
    const content = buildContent(promptText, useVision ? imgs : []);
    const opts = useVision ? { model: MODEL_VISION, fallbackModel: MODEL_TEXT } : { model: MODEL_TEXT };
    return new Promise((resolve) => {
      let settled = false;
      const done = (v) => {
        if (settled) return;
        settled = true;
        resolve(v);
      };
      const timer = setTimeout(() => done({ err: '请求超时（180 秒无响应）', text: '', meta: {} }), 180000);
      askDeepSeek(
        key,
        content,
        (err, text, meta) => {
          clearTimeout(timer);
          done({ err, text, meta: meta || {} });
        },
        opts
      );
    });
  };

  let stopFlag = false;
  const stopped = () => stopFlag;

  const waitGroups = async (log) => {
    let gs = collectGroups();
    for (let i = 0; i < 10 && !gs.length; i += 1) {
      log(`未在当前页面识别到题目，${10 - i} 秒后重试…`);
      await sleep(1000);
      gs = collectGroups();
    }
    return gs;
  };

  const runCode = async (grp, i, total, key, log, counters) => {
    log(`(${i + 1}/${total}) 编程题：读取题干…`);
    try {
      if (hasCode(textOf(grp.content))) {
        counters.skipped += 1;
        log(`(${i + 1}/${total}) 编程题：编辑器里已有代码，跳过`);
        return;
      }
      const bundle = stemBundle(grp.block);
      const stem = bundle.text;
      if (!stem) {
        counters.failed += 1;
        log(`(${i + 1}/${total}) 编程题：未能读取题干，跳过`);
        return;
      }
      const lang = pageLang();
      const imgs = visionFlag.on ? capImages(bundle.images) : [];
      const sql = isSqlTask(stem, lang);
      if (bundle.images.length) {
        log(`(${i + 1}/${total}) 编程题：题干含 ${bundle.images.length} 张图片${imgs.length ? `，随请求一并发送（${sql ? 'SQL 题' : '编程题'}）` : '，读图已关闭，跳过图片'}`);
      } else if (sql) {
        log(`(${i + 1}/${total}) 编程题：识别为 SQL / 数据库题，改用 SQL 专用提示词`);
      }
      const promptText = sql ? buildSqlPrompt(stem, lang, imgs.length) : buildCodePrompt(stem, lang, imgs.length);
      const { err, text, meta } = await askP(key, promptText, imgs);
      if (meta && meta.fell) log(`(${i + 1}/${total}) 视觉模型不可用，已自动降级为纯文本重试`);
      if (err) {
        counters.failed += 1;
        log(`(${i + 1}/${total}) 编程题：AI 调用失败：${err}`);
        return;
      }
      const parsed = parseCode(text);
      if (!parsed.code) {
        counters.failed += 1;
        log(`(${i + 1}/${total}) 编程题：AI 回复里没识别到代码块，请查看日志`);
        return;
      }
      lastCode = parsed.code;
      const r = insertCode(grp.content || document, parsed.code, 'all');
      if (!r.ok) {
        counters.failed += 1;
        log(`(${i + 1}/${total}) 编程题：写入编辑器失败——${r.tried.join('；')}\n代码已存下，可点「📋 复制代码」后在编辑器里直接 Ctrl+V（粘贴接管已开启）。`);
        return;
      }
      counters.done += 1;
      log(`(${i + 1}/${total}) 编程题：代码已写入（${r.how}，${lang || parsed.lang || '语言未识别'}），请自行运行并提交`);
      await sleep(1200);
    } catch (e) {
      counters.failed += 1;
      log(`(${i + 1}/${total}) 编程题出错：${(e && e.message) || e}`);
    }
  };

  const runPage = async (key, log) => {
    const groups = await waitGroups(log);
    const total = groups.length;
    if (!total) {
      log('本页未识别到可处理的题目（若题目还没加载完，请刷新后重试）。');
      return { done: 0, skipped: 0, failed: 0, total: 0, halted: false };
    }
    const codeCount = groups.filter((x) => x.kind === 'code').length;
    log(`共识别到 ${total} 道题${codeCount ? `（含 ${codeCount} 道编程题）` : ''}，开始处理…`);
    const counters = { done: 0, skipped: 0, failed: 0 };
    for (let i = 0; i < total; i += 1) {
      if (stopped()) {
        log(`已停止（处理到第 ${i + 1} 题）`);
        return { ...counters, total, halted: true };
      }
      const grp = groups[i];
      if (grp.kind === 'code') {
        await runCode(grp, i, total, key, log, counters);
        continue;
      }
      log(`(${i + 1}/${total}) 处理中…`);
      if (isDone(textOf(grp.block), grp.inputs)) {
        counters.skipped += 1;
        continue;
      }
      try {
        const q = collectQuestion(grp.inputs);
        if (!q.stem) {
          counters.failed += 1;
          log(`(${i + 1}/${total}) 未能读取题干，跳过`);
          continue;
        }
        const { err, text } = await askP(key, buildPrompt(q));
        if (err) {
          counters.failed += 1;
          log(`(${i + 1}/${total}) AI 调用失败：${err}`);
          continue;
        }
        const ans = parseAnswer(text, q.type);
        if (!ans) {
          counters.failed += 1;
          log(`(${i + 1}/${total}) 无法解析答案，AI 回复开头：${String(text).slice(0, 60)}`);
          continue;
        }
        const n = applyActions(q, ans, (gi) => grp.inputs[gi]);
        if (!n) {
          counters.failed += 1;
          log(`(${i + 1}/${total}) 回填未生效：页面未响应勾选/输入`);
          continue;
        }
        counters.done += 1;
        log(`(${i + 1}/${total}) 已完成（${q.type === 'multi' ? '多选' : q.type === 'single' ? '单选' : q.type === 'judge' ? '判断' : '填空'}）`);
        await sleep(1200);
      } catch (e) {
        counters.failed += 1;
        log(`(${i + 1}/${total}) 出错：${(e && e.message) || e}`);
      }
    }
    return { ...counters, total, halted: false };
  };

  const panel = document.createElement('div');
  // 固定 id：合并进合集后，「作者的话」模块靠它把赞助区块挂进本面板底部
  panel.id = 'pta-auto-complete-panel';
  panel.style.cssText = 'position:fixed;right:16px;top:130px;z-index:99999;background:#fff;border:1px solid #ccc;border-radius:10px;padding:10px 12px;box-shadow:0 4px 16px rgba(0,0,0,.18);font-size:13px;max-width:300px;color:#333;font-family:sans-serif;';
  const headRow = document.createElement('div');
  headRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;cursor:move;user-select:none;';
  const title = document.createElement('div');
  title.textContent = '🚀 PTA 一键完成 v1.6.2';
  title.style.cssText = 'font-weight:bold;cursor:move;';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '✕';
  closeBtn.title = '关闭面板';
  closeBtn.style.cssText = 'cursor:pointer;border:0;background:transparent;color:#999;font-size:14px;line-height:1;padding:2px 6px;border-radius:4px;';
  closeBtn.addEventListener('click', () => panel.remove());
  headRow.appendChild(title);
  headRow.appendChild(closeBtn);
  const logEl = document.createElement('div');
  logEl.style.cssText = 'white-space:pre-wrap;min-height:16px;margin-bottom:6px;color:#555;max-height:120px;overflow:auto;';
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;';
  const startBtn = document.createElement('button');
  startBtn.type = 'button';
  startBtn.textContent = '▶ 开始';
  startBtn.style.cssText = 'cursor:pointer;border:0;background:#534AB7;color:#fff;border-radius:6px;padding:4px 12px;font-size:13px;';
  const stopBtn = document.createElement('button');
  stopBtn.type = 'button';
  stopBtn.textContent = '⏹ 停止';
  stopBtn.style.cssText = 'cursor:pointer;border:1px solid #ccc;background:#f5f5f5;color:#333;border-radius:6px;padding:4px 12px;font-size:13px;';
  btnRow.appendChild(startBtn);
  btnRow.appendChild(stopBtn);
  const toolRow = document.createElement('div');
  toolRow.style.cssText = 'display:flex;gap:8px;margin-top:6px;';
  const guardBtn = document.createElement('button');
  guardBtn.type = 'button';
  guardBtn.textContent = '🔓 粘贴接管：开';
  guardBtn.title = '开启后：在代码编辑器内 Ctrl+V / 右键粘贴由脚本直接写入编辑器，绕过题目集的「禁止粘贴」限制';
  guardBtn.style.cssText = 'cursor:pointer;border:1px solid #ccc;background:#f5f5f5;color:#333;border-radius:6px;padding:4px 8px;font-size:12px;';
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.textContent = '📋 复制代码';
  copyBtn.title = '复制最近一次 AI 生成的代码到剪贴板';
  copyBtn.style.cssText = 'cursor:pointer;border:1px solid #ccc;background:#f5f5f5;color:#333;border-radius:6px;padding:4px 8px;font-size:12px;';
  const visionBtn = document.createElement('button');
  visionBtn.type = 'button';
  visionBtn.textContent = '🖼 读图：开';
  visionBtn.title = '开启后：题干里的图片（表样例、输出样例等）会一起发给视觉模型 deepseek-flash；模型不支持图片时自动降级为纯文本重试';
  visionBtn.style.cssText = 'cursor:pointer;border:1px solid #ccc;background:#f5f5f5;color:#333;border-radius:6px;padding:4px 8px;font-size:12px;';
  toolRow.appendChild(guardBtn);
  toolRow.appendChild(copyBtn);
  toolRow.appendChild(visionBtn);
  panel.appendChild(headRow);
  panel.appendChild(logEl);
  panel.appendChild(btnRow);
  panel.appendChild(toolRow);
  document.body.appendChild(panel);

  let dragOn = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let panelLeft = 0;
  let panelTop = 0;
  headRow.addEventListener('mousedown', (e) => {
    if (e.target === closeBtn || e.button !== 0) return;
    dragOn = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    const r = panel.getBoundingClientRect();
    panelLeft = r.left;
    panelTop = r.top;
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragOn) return;
    const r = panel.getBoundingClientRect();
    const p = dragPos(panelLeft, panelTop, e.clientX - dragStartX, e.clientY - dragStartY, window.innerWidth, window.innerHeight, r.width, r.height);
    panel.style.left = p.left + 'px';
    panel.style.top = p.top + 'px';
    panel.style.right = 'auto';
  });
  document.addEventListener('mouseup', () => {
    dragOn = false;
  });

  let logLines = [];
  const log = (s) => {
    logLines = pushLine(logLines, s, 30);
    logEl.textContent = logLines.join('\n');
    logEl.scrollTop = logEl.scrollHeight;
  };

  const copyText = (text) => {
    const fallback = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
      } catch (e) {
        return false;
      }
    };
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      return navigator.clipboard.writeText(text).then(() => true).catch(fallback);
    }
    return Promise.resolve(fallback());
  };

  // 代码编辑器容器定位（用于粘贴接管）
  const editorAt = (el) => {
    if (!el || typeof el.closest !== 'function') return null;
    let host = null;
    try {
      host = el.closest('.cm-editor') || el.closest('.CodeMirror');
    } catch (e) {
      host = null;
    }
    if (!host) return null;
    return writableContent(host) || host;
  };

  // 捕获阶段抢在站点拦截器之前处理粘贴：能自己写进去就接管，写不进去就放行浏览器默认粘贴
  const shield = (e) => {
    if (!pasteGuard) return;
    const hit = editorAt(e.target);
    if (!shouldShield(e.type, !!hit, !!(e.ctrlKey || e.metaKey), e.key)) return;
    if (e.type !== 'paste') {
      e.stopPropagation(); // 只拦住站点自己的 keydown/右键拦截器，不阻止浏览器默认行为
      return;
    }
    const dt = e.clipboardData;
    const text = dt && typeof dt.getData === 'function' ? dt.getData('text/plain') : '';
    if (!text) return;
    const r = insertCode(hit, text, 'sel');
    if (r.ok) {
      e.preventDefault();
      e.stopPropagation();
      log(`🔓 已接管粘贴并写入编辑器（${r.how}）。`);
    } else {
      log(`🔓 粘贴接管未成功（${r.tried.join('；')}），已放行浏览器默认粘贴。`);
    }
  };
  ['paste', 'contextmenu', 'keydown', 'drop', 'dragover'].forEach((t) => window.addEventListener(t, shield, true));

  guardBtn.addEventListener('click', () => {
    pasteGuard = !pasteGuard;
    guardBtn.textContent = pasteGuard ? '🔓 粘贴接管：开' : '🔓 粘贴接管：关';
    log(pasteGuard ? '已开启粘贴接管：编辑器内 Ctrl+V 由脚本写入，绕过「禁止粘贴」。' : '已关闭粘贴接管。');
  });

  copyBtn.addEventListener('click', () => {
    if (!lastCode) {
      log('还没有生成过代码。');
      return;
    }
    copyText(lastCode).then((ok) => log(ok ? '代码已复制到剪贴板，可在编辑器内 Ctrl+V。' : '复制失败，请改用控制台 __ptaFillCode(代码) 写入。'));
  });

  visionBtn.addEventListener('click', () => {
    visionFlag.on = !visionFlag.on;
    visionBtn.textContent = visionFlag.on ? '🖼 读图：开' : '🖼 读图：关';
    log(
      visionFlag.on
        ? `已开启读图：题干里的图片会随请求发给 ${MODEL_VISION}（失败自动降级为 ${MODEL_TEXT}）。`
        : '已关闭读图：只用纯文本模型，题干里的图表信息会被忽略。'
    );
  });

  log(`就绪：点「▶ 开始」自动完成本页题目；代码编辑器内 Ctrl+V 由脚本接管，可绕过题目集的「禁止粘贴」；读图由 ${MODEL_VISION} 负责。`);

  // 手动兜底：控制台执行 __ptaFillCode(`代码`) 即可写入当前编辑器
  window.__ptaFillCode = (text) => {
    const s = String(text === null || text === undefined ? '' : text);
    lastCode = s;
    const r = insertCode(document, s, 'all');
    log(r.ok ? `✅ 已写入编辑器（${r.how}）` : `❌ 写入失败：${r.tried.join('；')}`);
    return r;
  };

  let running = false;
  const start = async () => {
    if (running) {
      log('⏳ 正在处理中，请等待当前题目完成（可点「⏹ 停止」中断）。');
      return;
    }
    running = true;
    stopFlag = false;
    startBtn.disabled = true;
    startBtn.textContent = '⏳ 处理中…';
    log('▶ 已启动，正在准备…');
    await sleep(30); // 先让界面刷新，保证点击立刻可见反馈
    try {
      let key = getKey();
      if (!key) {
        log('未保存过 API Key，请在弹窗中填写（取消则中止）。');
        key = prompt('请输入 DeepSeek API Key（在 platform.deepseek.com 获取）:');
        if (!key) {
          log('未提供 API Key，已取消。');
          return;
        }
        saveKey(String(key).trim());
        key = String(key).trim();
      }
      log('已就绪，开始扫描题目…');
      const res = await runPage(key, log);
      if (res.halted) return;
      log(`本页：完成 ${res.done}，跳过 ${res.skipped}，失败 ${res.failed}（共 ${res.total} 题）。客观题请核对后手动切换下一题型；编程题代码已写入编辑器，需自行运行并提交。`);
    } catch (e) {
      log('运行出错：' + ((e && e.message) || e));
      console.error('[PTA 一键完成]', e);
    } finally {
      startBtn.disabled = false;
      startBtn.textContent = '▶ 开始';
      running = false;
      stopFlag = false;
    }
  };

  startBtn.addEventListener('click', start);
  stopBtn.addEventListener('click', () => {
    if (!running) {
      log('尚未开始运行。');
      return;
    }
    stopFlag = true;
    log('已请求停止，将在当前题目结束后停止…');
  });
})();
}

// ---------------------------------------------------------------
// [5/5] 作者的话（嵌入一键完成面板） · v2.0.0 · src/pta-author-card.user.js
// ---------------------------------------------------------------
// 仅在原脚本的 @match 范围内启用（location.pathname 以 /problem-sets/ 开头）
// 正文不做缩进：避免动到多行模板字符串的内容
if (location.pathname.indexOf('/problem-sets/') === 0) {
//
// 说明：本模块依赖 pta-auto-complete 模块创建的 #pta-auto-complete-panel。
// 打包时两个模块都只在题目集页面启用，且本模块排在其后，所以首轮即可挂载成功。

(() => {
  const PANEL_ID = 'pta-auto-complete-panel';
  const SECTION_ID = 'pta-author-section';
  const COLLAPSE_KEY = 'pta-author-section-collapsed-v1';
  const QR_SRC = 'data:image/jpeg;base64,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';

  // 在面板底部挂一个「作者的话」折叠区块
  let expandSection = null; // build() 赋值，供菜单命令调用

  const build = () => {
    const panel = document.getElementById && document.getElementById(PANEL_ID);
    if (!panel) return false;
    if (document.getElementById(SECTION_ID)) return true;

    const sec = document.createElement('div');
    sec.id = SECTION_ID;
    sec.style.cssText = 'margin-top:8px;padding-top:8px;border-top:1px dashed #ddd;';

    const head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:pointer;user-select:none;color:#534AB7;font-weight:600;';
    const headText = document.createElement('span');
    headText.textContent = '❤️ 作者的话（2026年10月）';
    const caret = document.createElement('span');
    caret.style.cssText = 'color:#999;font-weight:400;';
    head.appendChild(headText);
    head.appendChild(caret);

    const body = document.createElement('div');
    body.style.cssText = 'margin-top:6px;';

    const msg = document.createElement('div');
    msg.style.cssText = 'color:#555;';
    msg.textContent = '如果觉得满意，可以小小赞助我一波～ 也欢迎来 GitHub 点个 Star：';

    const link = document.createElement('a');
    link.href = 'https://github.com/xuchao3328';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.cssText = 'color:#4a5fc1;text-decoration:none;';
    link.textContent = 'github.com/xuchao3328';

    const img = document.createElement('img');
    img.src = QR_SRC;
    img.alt = '微信赞赏码';
    img.title = '微信扫一扫，请作者喝杯咖啡';
    img.style.cssText = 'display:block;width:168px;height:168px;margin:8px auto 2px;border-radius:8px;border:1px solid #eee;';

    const tip = document.createElement('div');
    tip.style.cssText = 'color:#999;font-size:12px;text-align:center;';
    tip.textContent = '微信扫码赞赏';

    body.appendChild(msg);
    body.appendChild(link);
    body.appendChild(img);
    body.appendChild(tip);

    let open = true;
    try { open = localStorage.getItem(COLLAPSE_KEY) !== '1'; } catch (e) { /* ignore */ }

    const render = () => {
      body.style.display = open ? '' : 'none';
      caret.textContent = open ? '▾' : '▸';
    };
    const expand = () => {
      open = true;
      try { localStorage.setItem(COLLAPSE_KEY, '0'); } catch (e) { /* ignore */ }
      render();
    };
    expandSection = expand;

    head.addEventListener('click', () => {
      open = !open;
      try { localStorage.setItem(COLLAPSE_KEY, open ? '0' : '1'); } catch (e) { /* ignore */ }
      render();
    });

    sec.appendChild(head);
    sec.appendChild(body);
    panel.appendChild(sec);
    render();
    return true;
  };

  // 面板由一键完成模块在本模块之前同步创建，正常首轮即成功；个别情况（面板晚到）再重试几次
  let tries = 0;
  const mount = () => {
    if (build()) return;
    tries += 1;
    if (tries < 8) setTimeout(mount, 250);
  };
  mount();

  // 菜单入口：折叠状态下一键展开；面板被关掉时给出提示
  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('ℹ️ 关于作者 / 赞助', () => {
      const sec = document.getElementById(SECTION_ID);
      if (!sec) {
        build();
        alert('「作者的话」显示在「🚀 一键完成」悬浮面板的底部；若该面板已被关闭，请刷新题目集页面。GitHub：https://github.com/xuchao3328');
        return;
      }
      if (typeof expandSection === 'function') expandSection();
      if (sec.scrollIntoView) sec.scrollIntoView({ block: 'nearest' });
    });
  }
})();
}
