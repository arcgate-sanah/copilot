(async function init() {

  const DIRECT_LINE_TOKEN_URL = "https://defaultb7e91da213bb4f4085c1fe13df9009.13.environment.api.powerplatform.com/powervirtualagents/botsbyschema/cr432_agent1/directline/token?api-version=2022-03-01-preview";

  const userId = 'user_' + Date.now();
  let token = null;
  let directLine = null;
  let webchatRendered = false;

  let directLineReadyPromise = null;
  let directLineReadyResolve;
  directLineReadyPromise = new Promise((res) => { directLineReadyResolve = res; });

  const preView = document.getElementById('initial-view');
  const chatView = document.getElementById('chat-view');
  const suggestionsContainer = document.getElementById('suggestions');
  const inputEl = document.getElementById('userInput');
  const sendBtn = document.getElementById('sendBtn');

  function showSuggestionsLoading() {
    suggestionsContainer.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('div');
      s.className = 'skeleton';
      suggestionsContainer.appendChild(s);
    }
  }

  function renderSuggestions(actions) {
    if (!actions || !actions.length) return;
    suggestionsContainer.innerHTML = '';
    actions.forEach(text => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'suggest-btn';
      btn.textContent = text;
      btn.onclick = () => startChatAndSend(text);
      suggestionsContainer.appendChild(btn);
    });
  }

  async function fetchToken() {
    const res = await fetch(DIRECT_LINE_TOKEN_URL, { method: 'GET' });
    if (!res.ok) throw new Error('Token fetch failed: ' + res.status);
    const json = await res.json();
    if (!json.token) throw new Error('Token missing in response');
    return json.token;
  }


  async function createDirectLineAndRequestSuggestions() {
    try {
      token = await fetchToken();
    } catch (e) {
      console.error('Failed to fetch token', e);
      directLineReadyResolve();
      return;
    }

    directLine = window.WebChat.createDirectLine({ token });

    directLine.activity$.subscribe(activity => {
      try {
        if (!activity) return;

        if (activity.type === 'message' && activity.suggestedActions && activity.suggestedActions.actions && activity.suggestedActions.actions.length) {
          const actions = activity.suggestedActions.actions.map(a => (a.title || a.text || a.value || ''));
          renderSuggestions(actions);
          return;
        }

        if (activity.channelData && activity.channelData.suggestedActions && Array.isArray(activity.channelData.suggestedActions)) {
          const actions = activity.channelData.suggestedActions.map(a => a.title || a.text || a);
          renderSuggestions(actions);
          return;
        }

        if (activity.type === 'message' && activity.attachments && activity.attachments.length) {
          for (const att of activity.attachments) {
            const payload = att.content;
            if (payload && payload.suggestedActions && payload.suggestedActions.actions) {
              const actions = payload.suggestedActions.actions.map(a => a.title || a.text || a);
              renderSuggestions(actions);
              return;
            }
            if (payload && payload.actions && Array.isArray(payload.actions)) {
              const actions = payload.actions.map(a => a.title || a.text || a);
              renderSuggestions(actions);
              return;
            }
          }
        }
      } catch (e) {
        console.warn('Activity handler error', e);
      }
    });

    directLine.postActivity({
      type: 'event',
      name: 'startConversation',
      from: { id: userId, name: 'Visitor' }
    }).subscribe(
      id => console.log('startConversation posted, activity id:', id),
      err => console.warn('Failed to post startConversation', err)
    );

    directLineReadyResolve(directLine);
    return directLine;
  }

  async function startChatAndSend(initialText) {
    if (!directLine) {
      try {
        await directLineReadyPromise;
      } catch(_) { }
    }

    preView.style.display = 'none';
    chatView.style.display = 'flex';

    if (!webchatRendered) {
      const styleOptions = {
        botAvatarInitials: 'G365',
        userAvatarInitials: 'You',
        backgroundColor: '#ffffff',
        bubbleBackground: '#eaf1fb',
        bubbleFromUserBackground: '#ececec',
        bubbleTextColor: '#000000',
        bubbleFromUserTextColor: '#000000',
        hideUploadButton: true,
        sendBoxPlaceholder: 'Type your message...',
        suggestedActionLayout: 'stacked',
        suggestedActionBorderRadius: 20,
        paddingRegular: 12
      };

      const styleSet = window.WebChat.createStyleSet(styleOptions);
      styleSet.suggestedAction = { display: 'none' };
      styleSet.messageActivity = {
        ...styleSet.messageActivity,
        '& .webchat__bubble:not(.webchat__bubble--from-user)': { alignSelf: 'flex-end' },
        '& .webchat__bubble--from-user': { alignSelf: 'flex-start' }
      };

      window.WebChat.renderWebChat({
        directLine,
        userID: userId,
        locale: 'en-US',
        styleSet,
        styleOptions,
        adaptiveCardsHostConfig: {
          fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
        }
      }, document.getElementById('webchat'));

      webchatRendered = true;
    }

    if (initialText && initialText.trim()) {

      setTimeout(() => {

        if (directLine) {
          directLine.postActivity({
            from: { id: userId, name: 'User' },
            type: 'message',
            text: initialText
          }).subscribe(
            id => console.log('User initial message sent, id:', id),
            err => console.warn('Failed to post user message', err)
          );
        }
      }, 100);
    }

    setTimeout(() => {
      const sendBox = document.querySelector('.webchat__send-box-text-box');
      if (sendBox) sendBox.focus();
    }, 100);
  }

  
  sendBtn.addEventListener('click', () => {
    const text = inputEl.value.trim();
    if (!text) return;
    startChatAndSend(text);
  });
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const text = inputEl.value.trim();
      if (!text) return;
      startChatAndSend(text);
    }
  });


  showSuggestionsLoading();
  createDirectLineAndRequestSuggestions().catch(err => {
    console.error('DirectLine init error:', err);

    suggestionsContainer.innerHTML = '';
    directLineReadyResolve();
  });

})();
