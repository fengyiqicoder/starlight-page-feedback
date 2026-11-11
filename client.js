// Browser side of starlight-page-feedback.

const STRINGS = {
	en: { question: 'Was this page helpful?', yes: 'Yes', no: 'No', thanks: 'Thanks for the feedback.', what: 'What were you looking for?', placeholder: 'Tell us what was missing or unclear', send: 'Send', sent: 'Sent. Thank you.', issue: 'Open a GitHub issue', ask: 'Ask AI', asking: 'Looking through the docs…', aiFoot: 'Answered by AI from these docs.' },
	zh: { question: '这一页有帮助吗？', yes: '有', no: '没有', thanks: '谢谢反馈。', what: '你在找什么？', placeholder: '说说缺了什么或哪里没讲清楚', send: '发送', sent: '已发送，谢谢。', issue: '在 GitHub 提个 issue', ask: '问 AI', asking: '正在翻文档…', aiFoot: '由 AI 根据本站文档回答。' },
	ja: { question: 'このページは役に立ちましたか？', yes: 'はい', no: 'いいえ', thanks: 'フィードバックありがとうございます。', what: '何を探していましたか？', placeholder: '足りない点やわかりにくい点を教えてください', send: '送信', sent: '送信しました。ありがとうございます。', issue: 'GitHub で issue を開く', ask: 'AI に聞く', asking: 'ドキュメントを確認中…', aiFoot: 'このドキュメントをもとに AI が回答しました。' },
	es: { question: '¿Te resultó útil esta página?', yes: 'Sí', no: 'No', thanks: 'Gracias por tu opinión.', what: '¿Qué estabas buscando?', placeholder: 'Cuéntanos qué faltaba o no estaba claro', send: 'Enviar', sent: 'Enviado. Gracias.', issue: 'Abrir un issue en GitHub', ask: 'Preguntar a la IA', asking: 'Buscando en la documentación…', aiFoot: 'Respuesta de IA basada en esta documentación.' },
	fr: { question: 'Cette page vous a-t-elle aidé ?', yes: 'Oui', no: 'Non', thanks: 'Merci pour votre retour.', what: 'Que cherchiez-vous ?', placeholder: 'Dites-nous ce qui manquait ou n’était pas clair', send: 'Envoyer', sent: 'Envoyé. Merci.', issue: 'Ouvrir une issue GitHub', ask: 'Demander à l’IA', asking: 'Recherche dans la documentation…', aiFoot: 'Réponse de l’IA à partir de cette documentation.' },
	de: { question: 'War diese Seite hilfreich?', yes: 'Ja', no: 'Nein', thanks: 'Danke für das Feedback.', what: 'Wonach hast du gesucht?', placeholder: 'Was hat gefehlt oder war unklar?', send: 'Senden', sent: 'Gesendet. Danke.', issue: 'GitHub-Issue öffnen', ask: 'KI fragen', asking: 'Durchsuche die Doku…', aiFoot: 'KI-Antwort auf Basis dieser Doku.' },
	pt: { question: 'Esta página foi útil?', yes: 'Sim', no: 'Não', thanks: 'Obrigado pelo feedback.', what: 'O que você procurava?', placeholder: 'Conte o que faltou ou não ficou claro', send: 'Enviar', sent: 'Enviado. Obrigado.', issue: 'Abrir uma issue no GitHub', ask: 'Perguntar à IA', asking: 'Procurando na documentação…', aiFoot: 'Resposta da IA com base nesta documentação.' },
	ko: { question: '이 페이지가 도움이 되었나요?', yes: '예', no: '아니요', thanks: '의견 감사합니다.', what: '무엇을 찾고 계셨나요?', placeholder: '부족하거나 불분명한 점을 알려 주세요', send: '보내기', sent: '보냈습니다. 감사합니다.', issue: 'GitHub 이슈 열기', ask: 'AI에게 묻기', asking: '문서를 찾는 중…', aiFoot: '이 문서를 바탕으로 AI가 답했습니다.' },
};

const STORE = 'starlight-page-feedback:';

function el(tag, attrs = {}, ...children) {
	const n = document.createElement(tag);
	for (const [k, v] of Object.entries(attrs)) {
		if (v === false || v == null) continue;
		if (k === 'class') n.className = v;
		else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
		else n.setAttribute(k, v === true ? '' : v);
	}
	n.append(...children.filter((c) => c != null));
	return n;
}

// Send the vote to whichever analytics the site already loads.
function track(cfg, data) {
	if (!cfg.analytics) return;
	const props = { page: data.page, helpful: data.helpful ? 'yes' : 'no' };
	if (data.comment) props.comment = data.comment.slice(0, 300);
	const w = window;
	try {
		w.plausible?.(cfg.event, { props });
		w.umami?.track?.(cfg.event, props);
		w.gtag?.('event', 'docs_feedback', props);
		w.posthog?.capture?.(cfg.event, props);
		w.fathom?.trackEvent?.(cfg.event + (data.helpful ? ': yes' : ': no'));
		w.sa_event?.('docs_feedback', props);
	} catch {}
}

function hasAnalytics() {
	const w = window;
	return !!(w.plausible || w.umami || w.gtag || w.posthog || w.fathom || w.sa_event);
}

function post(cfg, data) {
	if (!cfg.endpoint) return Promise.resolve(false);
	return fetch(cfg.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), keepalive: true })
		.then((r) => r.ok)
		.catch(() => false);
}

export default function init(cfg) {
	const content = document.querySelector('.sl-markdown-content');
	if (!content || document.querySelector('.splash-page, [data-has-hero]')) return;
	const path = location.pathname;
	if (cfg.exclude.some((p) => (p.endsWith('*') ? path.startsWith(p.slice(0, -1)) : path === p))) return;

	const lang = (document.documentElement.lang || 'en').toLowerCase();
	const t = { ...STRINGS.en, ...(STRINGS[lang.split('-')[0]] || {}), ...cfg.labels };
	addStyle();

	const title = document.querySelector('h1#_top')?.textContent?.trim() || document.title;
	const data = { page: path, title, lang, helpful: null, comment: '' };
	const prior = (() => {
		try {
			return localStorage.getItem(STORE + path);
		} catch {
			return null;
		}
	})();

	const status = el('p', { class: 'spf-status', 'aria-live': 'polite' });
	const yes = el('button', { type: 'button', class: 'spf-vote', 'aria-pressed': 'false', onclick: () => vote(true) }, thumb(true), t.yes);
	const no = el('button', { type: 'button', class: 'spf-vote', 'aria-pressed': 'false', onclick: () => vote(false) }, thumb(false), t.no);
	const text = el('textarea', { rows: '3', maxlength: '1000', placeholder: t.placeholder, 'aria-label': t.what });
	const send = el('button', { type: 'submit', class: 'spf-btn spf-primary' }, t.send);
	const ask = cfg.ai ? el('button', { type: 'button', class: 'spf-btn', onclick: () => askAi() }, t.ask) : null;
	const issue = cfg.github ? el('a', { class: 'spf-issue', target: '_blank', rel: 'noopener' }, t.issue) : null;
	const answer = el('div', { class: 'spf-answer', hidden: true });
	const form = el('form', { class: 'spf-form', hidden: true, onsubmit: (e) => (e.preventDefault(), submit()) }, el('label', {}, t.what), text, el('div', { class: 'spf-actions' }, send, ask, issue), answer);
	const box = el('section', { class: 'spf', 'aria-label': t.question, 'data-onetag-ui': '' }, el('div', { class: 'spf-row' }, el('p', { class: 'spf-q' }, t.question), yes, no), status, form);
	content.after(box);

	const issueUrl = () => {
		const body = `Page: ${location.href}\n\n${text.value.trim() || '(what was missing or unclear)'}`;
		return `https://github.com/${cfg.github}/issues/new?title=${encodeURIComponent('Docs feedback: ' + title)}&body=${encodeURIComponent(body)}`;
	};
	if (issue) {
		issue.href = issueUrl();
		text.addEventListener('input', () => (issue.href = issueUrl()));
	}

	function mark(helpful) {
		yes.setAttribute('aria-pressed', String(helpful === true));
		no.setAttribute('aria-pressed', String(helpful === false));
	}
	if (prior === 'yes' || prior === 'no') {
		mark(prior === 'yes');
		status.textContent = t.thanks;
	}

	function vote(helpful) {
		data.helpful = helpful;
		mark(helpful);
		try {
			localStorage.setItem(STORE + path, helpful ? 'yes' : 'no');
		} catch {}
		track(cfg, data);
		post(cfg, data);
		status.textContent = t.thanks;
		// Nowhere to send a comment: keep the form only for the AI answer, or hide it.
		const canSend = !!(cfg.endpoint || cfg.github || (cfg.analytics && hasAnalytics()));
		send.hidden = !canSend;
		form.hidden = helpful || (!canSend && !cfg.ai);
		if (!helpful) text.focus();
	}

	async function submit() {
		data.comment = text.value.trim();
		if (!data.comment) return text.focus();
		track(cfg, data);
		await post(cfg, data);
		status.textContent = t.sent;
		if (!cfg.endpoint && cfg.github) window.open(issueUrl(), '_blank', 'noopener');
		send.disabled = true;
	}

	// Optional: answer "what were you looking for" from the docs with OneTag AI.
	async function askAi() {
		const q = text.value.trim();
		if (!q) return text.focus();
		answer.hidden = false;
		answer.textContent = t.asking;
		ask.disabled = true;
		try {
			const api = await import('starlight-onetag/api');
			const out = el('div');
			answer.replaceChildren(out);
			const { pages } = await api.askDocs(cfg.ai, q, out);
			const foot = el('p', { class: 'spf-foot' }, t.aiFoot + ' ');
			pages.slice(0, 3).forEach((p, i) => {
				if (i) foot.append(' · ');
				foot.append(el('a', { href: p.url }, p.title));
			});
			answer.append(foot);
		} catch (e) {
			const api = await import('starlight-onetag/api').catch(() => null);
			answer.textContent = api ? api.errorText(e) : 'Could not load the AI helper.';
		} finally {
			ask.disabled = false;
		}
	}
}

function thumb(up) {
	const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	s.setAttribute('width', '16');
	s.setAttribute('height', '16');
	s.setAttribute('viewBox', '0 0 24 24');
	s.setAttribute('aria-hidden', 'true');
	s.innerHTML = '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M7 10v11H3V10zM7 10l4-8a3 3 0 0 1 3 3v4h5.5a2 2 0 0 1 2 2.3l-1.4 8A2 2 0 0 1 18.1 21H7"/>';
	if (!up) s.style.transform = 'scaleY(-1)';
	return s;
}

function addStyle() {
	if (document.getElementById('starlight-page-feedback')) return;
	const s = document.createElement('style');
	s.id = 'starlight-page-feedback';
	s.textContent = `
.spf { margin-top: 3rem; padding-top: 1.25rem; border-top: 1px solid var(--sl-color-hairline); font-size: var(--sl-text-sm); }
.spf [hidden] { display: none !important; }
.spf-row { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem .75rem; }
.spf-q { margin: 0; font-weight: 600; color: var(--sl-color-white); }
.spf-vote, .spf-btn { display: inline-flex; align-items: center; gap: .35rem; font: inherit; padding: .3rem .75rem; border: 1px solid var(--sl-color-gray-5); border-radius: .4rem; background: transparent; color: var(--sl-color-text); cursor: pointer; }
.spf-vote:hover, .spf-btn:hover { border-color: var(--sl-color-accent); color: var(--sl-color-white); }
.spf-vote[aria-pressed="true"] { border-color: var(--sl-color-accent); background: var(--sl-color-accent-low); color: var(--sl-color-white); }
.spf-vote:focus-visible, .spf-btn:focus-visible, .spf textarea:focus-visible, .spf-issue:focus-visible { outline: 2px solid var(--sl-color-accent); outline-offset: 2px; }
.spf-primary { background: var(--sl-color-accent); border-color: var(--sl-color-accent); color: var(--sl-color-black); font-weight: 600; }
.spf-primary:hover { color: var(--sl-color-black); }
.spf-btn[disabled] { opacity: .6; cursor: default; }
.spf-status { margin: .5rem 0 0; color: var(--sl-color-gray-3); min-height: 1em; }
.spf-form { display: flex; flex-direction: column; gap: .5rem; margin-top: .75rem; max-width: 36rem; }
.spf-form label { color: var(--sl-color-white); }
.spf textarea { font: inherit; padding: .5rem .65rem; border: 1px solid var(--sl-color-gray-5); border-radius: .4rem; background: var(--sl-color-black); color: var(--sl-color-white); resize: vertical; }
.spf-actions { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem .9rem; }
.spf-issue { color: var(--sl-color-text-accent); }
.spf-answer { padding: .75rem 1rem; border: 1px solid var(--sl-color-gray-5); border-inline-start: 3px solid var(--sl-color-accent); border-radius: .4rem; background: var(--sl-color-gray-6); }
.spf-answer p { margin: 0 0 .5em; }
.spf-foot { color: var(--sl-color-gray-3); font-size: var(--sl-text-xs); }
`;
	document.head.append(s);
}
