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


        if (activity.type === 'message' && activity.suggestedActions?.actions?.length) {
          const actions = activity.suggestedActions.actions.map(a => (a.title || a.text || a.value || ''));
          renderSuggestions(actions);
          return;
        }


        if (activity.channelData?.suggestedActions && Array.isArray(activity.channelData.suggestedActions)) {
          const actions = activity.channelData.suggestedActions.map(a => a.title || a.text || a);
          renderSuggestions(actions);
          return;
        }


        if (activity.type === 'message' && activity.attachments?.length) {
          for (const att of activity.attachments) {
            const payload = att.content;
            if (payload?.suggestedActions?.actions) {
              const actions = payload.suggestedActions.actions.map(a => a.title || a.text || a);
              renderSuggestions(actions);
              return;
            }
            if (payload?.actions && Array.isArray(payload.actions)) {
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


    if (initialText?.trim()) {
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

  function addCopyButtons() {
    document.querySelectorAll('.webchat__bubble__content').forEach(bubble => {

    if (bubble.querySelector('.copy-btn')) return;

    const answer = bubble.querySelector('.webchat__render-markdown--message-activity');
    const refs = bubble.querySelector('.webchat__link-definitions');
    if (!answer || !refs) return;  

    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
        <path d="M10 1.5A1.5 1.5 0 0 1 11.5 3v10A1.5 1.5 0 0 1 10 14.5H4A1.5 1.5 0 0 1 2.5 13V3A1.5 1.5 0 0 1 4 1.5h6zm0 1H4a.5.5 0 0 0-.5.5v10a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5V3a.5.5 0 0 0-.5-.5z"/>
        <path d="M13.5 4a.5.5 0 0 1 .5.5V13a2 2 0 0 1-2 2H5.5a.5.5 0 0 1 0-1H12a1 1 0 0 0 1-1V4.5a.5.5 0 0 1 .5-.5z"/>
        </svg>
    `;

    bubble.style.position = 'relative';
    bubble.classList.add('has-copy-btn'); 
    bubble.appendChild(btn);

        btn.addEventListener('click', () => {
    const text = answer.innerText.trim();

    const refLinks = [];
    bubble.querySelectorAll('.webchat__link-definitions a').forEach(a => {
        refLinks.push(`${a.innerText}: ${a.href}`);
    });

    const finalText = refLinks.length
        ? `${text}\n\nReferences:\n${refLinks.join('\n')}`
        : text;

    navigator.clipboard.writeText(finalText).then(() => {
        btn.innerText = '✅';
    });
    });

        bubble.style.position = 'relative';
        bubble.appendChild(btn);
    });
    }

const observer = new MutationObserver(() => addCopyButtons());
observer.observe(document.querySelector('#webchat'), {
  childList: true,
  subtree: true
});

addCopyButtons();

})();
