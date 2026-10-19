// CORA prototype: shared app chrome + icon set.
//
// Every app page has <body data-shell="student|admin" data-page="path|ask|...">
// and a <main id="main">. This script renders the sidebar (desktop), the top
// bar + bottom tab bar (mobile), and fills every <svg data-icon="name">.
// In the real app this is AppShell.tsx (see DESIGN.md section 7).

(function () {
  // Heroicons v2 outline paths (the app already uses react-icons/hi2).
  const ICONS = {
    path: 'M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z',
    chat: 'M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.923 1.785A5.969 5.969 0 0 0 6 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337Z',
    stack: 'M6 6.878V6a2.25 2.25 0 0 1 2.25-2.25h7.5A2.25 2.25 0 0 1 18 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 0 0 4.5 9v.878m13.5-3A2.25 2.25 0 0 1 19.5 9v.878m0 0a2.246 2.246 0 0 0-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0 1 21 12v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6c0-.98.626-1.813 1.5-2.122',
    chart: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z',
    graph: 'M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z',
    fire: 'M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z',
    check: 'm4.5 12.75 6 6 9-13.5',
    up: 'M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18',
    plus: 'M12 4.5v15m7.5-7.5h-15',
    book: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25',
    doc: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
    x: 'M6 18 18 6M6 6l12 12',
    menu: 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5',
    user: 'M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    users: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z',
    bolt: 'm3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z',
    right: 'M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3',
    left: 'M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18',
    chev: 'm8.25 4.5 7.5 7.5-7.5 7.5',
    upload: 'M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z',
    eye: 'M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    warn: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z',
    search: 'm21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z',
    retry: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99',
    flag: 'M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5',
    lock: 'M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z',
    building: 'M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z',
    mail: 'M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75',
    key: 'M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z',
    copy: 'M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75',
    cog: 'M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    thumb: 'M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z',
    target: 'M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z',
    logout: 'M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9',
  };

  function svg(name, cls) {
    const d = ICONS[name] || '';
    return `<svg class="${cls || 'h-5 w-5'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
  }
  window.coraIcon = svg;

  function fillIcons(root) {
    root.querySelectorAll('svg[data-icon]').forEach((el) => {
      el.setAttribute('viewBox', '0 0 24 24');
      el.setAttribute('fill', 'none');
      el.setAttribute('stroke', 'currentColor');
      el.setAttribute('stroke-width', el.getAttribute('data-stroke') || '1.7');
      el.setAttribute('stroke-linecap', 'round');
      el.setAttribute('stroke-linejoin', 'round');
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML = `<path d="${ICONS[el.dataset.icon] || ''}"/>`;
    });
  }
  window.coraFillIcons = fillIcons;

  const LOGO = `<a href="path.html" class="flex items-center gap-2.5" aria-label="CORA home">
      <span class="grid h-8 w-8 place-items-center rounded-[10px] bg-red-600 font-display text-[17px] font-extrabold text-white" style="box-shadow:0 3px 0 #7f1d1d">C</span>
      <span class="font-display text-[19px] font-bold tracking-tight">cora</span>
    </a>`;

  const STUDENT_NAV = [
    { id: 'path', label: 'Path', icon: 'path', href: 'path.html' },
    { id: 'ask', label: 'Ask', icon: 'chat', href: 'ask.html' },
    { id: 'review', label: 'Review', icon: 'stack', href: 'quiz.html', badge: '7' },
    { id: 'progress', label: 'Progress', icon: 'chart', href: 'progress.html' },
  ];
  const ADMIN_NAV = [
    { id: 'materials', label: 'Materials', icon: 'doc', href: 'admin.html', badge: '2' },
    { id: 'analytics', label: 'Analytics', icon: 'chart', href: 'admin-analytics.html' },
    { id: 'users', label: 'Users', icon: 'users', href: 'admin-users.html' },
  ];

  // ChatGPT-style history: sessions of any mode, grouped by recency.
  const SESSIONS = [
    { group: 'Today', items: [
      { mode: 'Ask', title: 'Why decay heat matters after a scram', href: 'ask.html', active: true },
      { mode: 'Quiz', title: 'Reactor period · 4 questions', href: 'quiz-results.html' },
    ] },
    { group: 'Yesterday', items: [
      { mode: 'Guide', title: 'Delayed neutron fraction (β)', href: 'lesson.html' },
      { mode: 'Ask', title: 'SUR vs period, which one on the panel?', href: 'ask.html' },
    ] },
    { group: 'This week', items: [
      { mode: 'Ask', title: 'Xenon peak after a trip from 100%', href: 'ask.html' },
      { mode: 'Guide', title: 'Moderator temperature coefficient', href: 'lesson.html' },
      { mode: 'Quiz', title: 'Shutdown margin · 5 questions', href: 'quiz.html' },
    ] },
  ];
  const MODE_COLOR = { Ask: 'text-red-700', Guide: 'text-amber-700', Quiz: 'text-teal-700' };

  function navLink(item, page) {
    const active = item.id === page;
    return `<a href="${item.href}" ${active ? 'aria-current="page"' : ''}
      class="group flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-[15px] font-medium ${active ? 'bg-red-50 text-red-700' : 'text-slate-700 hover:bg-slate-50'}">
      ${svg(item.icon, 'h-5 w-5 ' + (active ? 'text-red-600' : 'text-slate-500 group-hover:text-slate-700'))}
      <span class="flex-1">${item.label}</span>
      ${item.badge ? `<span class="tabular rounded-md bg-red-600 px-1.5 py-0.5 text-[11px] font-bold text-white">${item.badge}<span class="sr-only"> due</span></span>` : ''}
    </a>`;
  }

  // Narrative state: pages after the quiz pass data-streak="7" data-goal="3".
  const STREAK = () => document.body.dataset.streak || '6';
  const GOAL = () => document.body.dataset.goal || '2';

  function studentSidebar(page) {
    const sessions = SESSIONS.map((g) => `
      <p class="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">${g.group}</p>
      ${g.items.map((s) => `<a href="${s.href}" class="flex min-h-[36px] items-center gap-2 rounded-lg px-3 text-[13.5px] ${s.active && page === 'ask' ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'}">
          <span class="w-11 flex-none font-mono text-[10.5px] font-medium uppercase ${MODE_COLOR[s.mode]}">${s.mode}</span>
          <span class="truncate">${s.title}</span></a>`).join('')}`).join('');

    return `
      <div class="flex h-full flex-col">
        <div class="flex h-16 flex-none items-center justify-between px-5">${LOGO}</div>
        <div class="px-3"><a href="ask.html" class="btn btn-secondary btn-block justify-start">${svg('plus')}New session</a></div>
        <nav aria-label="Primary" class="mt-3 space-y-0.5 px-3">${STUDENT_NAV.map((n) => navLink(n, page)).join('')}
          <a href="explore.html" ${page === 'explore' ? 'aria-current="page"' : ''} class="flex min-h-[40px] items-center gap-3 rounded-xl px-3 text-[13.5px] ${page === 'explore' ? 'bg-teal-50 text-teal-700' : 'text-slate-500 hover:bg-slate-50'}">${svg('graph', 'h-[18px] w-[18px]')}Course graph</a>
        </nav>
        <div class="scroll-thin mt-2 min-h-0 flex-1 overflow-y-auto border-t border-red-100 px-2 pb-3" aria-label="Recent sessions">${sessions}</div>
        <div class="flex-none border-t border-red-100 p-3">
          <a href="progress.html" class="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50">
            <span class="grid h-9 w-9 place-items-center rounded-full bg-amber-50 text-amber-700">${svg('fire', 'h-5 w-5')}</span>
            <span class="min-w-0 flex-1">
              <span class="block text-[13px] font-semibold"><span class="tabular">${STREAK()}</span>-day streak</span>
              <span class="block text-[12px] text-slate-500">Today: <span class="tabular">${GOAL()} of 3</span> checks${GOAL() === '3' ? ' · done' : ''}</span>
            </span>
            <span class="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-[12px] font-bold text-slate-700">JR</span>
          </a>
        </div>
      </div>`;
  }

  function adminSidebar(page) {
    return `
      <div class="flex h-full flex-col">
        <div class="flex h-16 flex-none items-center gap-2 px-5">${LOGO}<span class="rounded-md bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase text-white">Admin</span></div>
        <nav aria-label="Admin" class="mt-2 space-y-0.5 px-3">${ADMIN_NAV.map((n) => navLink(n, page)).join('')}</nav>
        <div class="mt-auto border-t border-red-100 p-3">
          <a href="path.html" class="flex min-h-[40px] items-center gap-3 rounded-xl px-3 text-[13.5px] text-slate-500 hover:bg-slate-50">${svg('eye', 'h-[18px] w-[18px]')}View as student</a>
          <div class="mt-2 flex items-center gap-3 px-3 py-2"><span class="grid h-8 w-8 place-items-center rounded-full bg-slate-900 text-[12px] font-bold text-white">MM</span><span class="text-[13px]"><span class="block font-semibold">Mason Mines</span><span class="block text-slate-500">Admin</span></span></div>
        </div>
      </div>`;
  }

  function mobileTop(shell) {
    return `<header class="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-red-100 bg-white/95 px-4 backdrop-blur lg:hidden">
      <button type="button" class="grid h-11 w-11 place-items-center rounded-xl text-slate-700 -ml-2" aria-label="Open menu" aria-controls="drawer" aria-expanded="false" data-open-drawer>${svg('menu', 'h-6 w-6')}</button>
      ${LOGO}
      ${shell === 'student'
        ? `<a href="progress.html" class="flex h-11 items-center gap-1 rounded-xl px-2 text-[14px] font-semibold text-amber-700" aria-label="${STREAK()}-day streak">${svg('fire', 'h-5 w-5')}<span class="tabular">${STREAK()}</span></a>`
        : '<span class="w-11"></span>'}
    </header>`;
  }

  function tabbar(page) {
    const items = [...STUDENT_NAV];
    return `<nav aria-label="Primary" class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-red-100 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      ${items.map((n) => {
        const active = n.id === page;
        return `<a href="${n.href}" ${active ? 'aria-current="page"' : ''} class="relative flex h-16 flex-col items-center justify-center gap-1 text-[11.5px] font-semibold ${active ? 'text-red-700' : 'text-slate-500'}">
          ${svg(n.icon, 'h-6 w-6')}<span>${n.label}</span>
          ${n.badge ? `<span class="tabular absolute right-[calc(50%-22px)] top-2 rounded-md bg-red-600 px-1 text-[10px] font-bold text-white">${n.badge}</span>` : ''}
        </a>`;
      }).join('')}
    </nav>`;
  }

  function mount() {
    const body = document.body;
    const shell = body.dataset.shell;
    const page = body.dataset.page;
    if (shell) {
      const main = document.getElementById('main');
      const side = shell === 'admin' ? adminSidebar(page) : studentSidebar(page);
      const frame = document.createElement('div');
      frame.className = 'flex min-h-screen';
      frame.innerHTML = `<aside class="sticky top-0 hidden h-screen w-[272px] flex-none border-r border-red-100 bg-white lg:block">${side}</aside>
        <div class="min-w-0 flex-1" data-slot></div>`;
      main.parentNode.insertBefore(frame, main);
      const slot = frame.querySelector('[data-slot]');
      if (!body.hasAttribute('data-no-mobile-top')) slot.insertAdjacentHTML('beforeend', mobileTop(shell));
      slot.appendChild(main);

      // Mobile drawer: same sidebar, as a modal dialog with focus handling.
      const drawer = document.createElement('div');
      drawer.id = 'drawer';
      drawer.className = 'fixed inset-0 z-50 hidden lg:hidden';
      drawer.setAttribute('role', 'dialog');
      drawer.setAttribute('aria-modal', 'true');
      drawer.setAttribute('aria-label', 'Menu');
      drawer.innerHTML = `<div class="absolute inset-0 bg-slate-900/40" data-close-drawer></div>
        <div class="enter absolute inset-y-0 left-0 w-[300px] max-w-[85vw] bg-white shadow-xl">
          <button type="button" class="absolute right-2 top-2.5 z-10 grid h-11 w-11 place-items-center rounded-xl text-slate-500" aria-label="Close menu" data-close-drawer>${svg('x', 'h-6 w-6')}</button>
          ${side}
        </div>`;
      body.appendChild(drawer);
      let lastFocus = null;
      const open = (e) => {
        lastFocus = e.currentTarget;
        drawer.classList.remove('hidden');
        lastFocus.setAttribute('aria-expanded', 'true');
        drawer.querySelector('[data-close-drawer].grid').focus();
      };
      const close = () => {
        drawer.classList.add('hidden');
        if (lastFocus) { lastFocus.setAttribute('aria-expanded', 'false'); lastFocus.focus(); }
      };
      document.querySelectorAll('[data-open-drawer]').forEach((b) => b.addEventListener('click', open));
      drawer.querySelectorAll('[data-close-drawer]').forEach((b) => b.addEventListener('click', close));
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.classList.contains('hidden')) close(); });

      if (shell === 'student' && !body.hasAttribute('data-no-tabbar')) {
        body.insertAdjacentHTML('beforeend', tabbar(page));
      }
    }
    fillIcons(document);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
