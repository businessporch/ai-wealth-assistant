(() => {
  const status = document.getElementById('news-status');
  const sources = document.getElementById('source-status');
  const list = document.getElementById('news-list');
  const refresh = document.getElementById('refresh-news');
  const format = value => {
    const date = new Date(value);
    return value && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai', dateStyle:'medium', timeStyle:'short'}).format(date) : '未提供时间';
  };
  function node(tag, text, cls) {
    const el = document.createElement(tag); el.textContent = text;
    if (cls) el.className = cls;
    return el;
  }
  async function load() {
    refresh.disabled = true;
    try {
      const response = await fetch('data/news.json', {cache:'no-store', signal:AbortSignal.timeout(15000)});
      if (!response.ok) throw Error('读取失败');
      const data = await response.json();
      if (!Array.isArray(data.items) || !Array.isArray(data.sources)) throw Error('格式错误');
      const stale = !data.generatedAt || Date.now() - Date.parse(data.generatedAt) > 6*3600000 || !Number.isFinite(Date.parse(data.generatedAt));
      status.textContent = `最近抓取：${format(data.generatedAt)}（北京时间）${stale?' · 更新已过期，请谨慎使用':''} · 非实时`;
      status.classList.toggle('news-warning', stale);
      sources.replaceChildren(); list.replaceChildren();
      data.sources.forEach(s => sources.append(node('div',`${s.name}：${s.ok?'抓取成功':'抓取失败，可能显示旧数据'} · 最近成功 ${format(s.lastSuccessAt)}`)));
      data.items.slice(0,40).forEach(item => {
        let url; try { url = new URL(item.url); } catch { return; }
        if (url.protocol !== 'https:') return;
        const card = node('article','','card');
        card.append(node('span','事实 · 官方发布','badge'),node('h3',item.title,'news-title'),node('p',`来源：${item.source} · 发布：${format(item.publishedAt)}（北京时间）`,'news-meta'));
        if (Date.now()-Date.parse(item.fetchedAt)>6*3600000) card.append(node('p','此条为上次成功抓取的旧资讯','news-warning'));
        card.append(node('p','分析：尚未生成；请阅读原文核实上下文。'));
        const link = node('a','查看来源原文 ↗','news-link'); link.href=url.href; link.target='_blank'; link.rel='noopener noreferrer'; card.append(link); list.append(card);
      });
      if (!list.children.length) list.append(node('div','暂无可用资讯，请稍后刷新或查看官方来源。','empty'));
    } catch (error) {
      status.textContent = '资讯更新失败。已显示的内容可能过期；本次未取得最新数据。';
      status.classList.add('news-warning');
      if (!list.children.length) list.append(node('div','暂时无法读取资讯，请稍后重试。','empty'));
    } finally {refresh.disabled=false;}
  }
  refresh.addEventListener('click',load); load();
})();
