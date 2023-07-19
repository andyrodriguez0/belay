
var redirect;

// -------------------------------- PAGE ----------------------------------

function Page() {

  const [loggedIn, setLoggedIn] = React.useState(localStorage.getItem('andyrod_api_key'));
  const [profile, setProfile] = React.useState(false);
  const [channel, setChannel] = React.useState(null);
  const [message, setMessage] = React.useState(null);

  function router() {
    const path = window.location.pathname.split('/');
    if (loggedIn == null) {
      if (path[1] != '') {redirect = window.location.pathname; history.replaceState({}, '', '/')}
      setProfile(false);
      setChannel(null);
      setMessage(null);
    } else if (path[0] == '' && path[1] == '') {
      const channels = document.querySelector('.channels');
      if (channels != null) {channels.classList.remove('one')};
      setProfile(false);
      setChannel(null);
      setMessage(null);
    } else if (path[1][0] == 'p') {
      setProfile(true);
      setChannel(null);
      setMessage(null);
    } else if (path[1][0] == 'c' && path.length == 2) {
      setProfile(false);
      setChannel(path[1].split('-')[1]);
      setMessage(null);
    } else {
      setProfile(false);
      setChannel(path[1].split('-')[1]);
      setMessage(path[2].split('-')[1]);
    }
  }

  function handleChannelClick(i, forward) {
    for (const element of document.querySelectorAll('.channel-name')) {
      element.classList.remove('focus')
      element.classList.add('secondary')
    }
    if (i == channel) {
      if (forward) {history.pushState({}, '', '/')}; setChannel(null)}
      else {history.pushState({}, '', `/channel-${i}`); setChannel(i); setMessage(null);}
    setMessage(null);
    document.querySelector('.channels').classList.add('one');
  }

  function handleLoginClick() {
    if (redirect) {
      if (redirect == '/profile') {setProfile(!profile)}
      history.replaceState({}, '', redirect);
      redirect = null;
    }
    setLoggedIn(localStorage.getItem('andyrod_api_key'));
  }

  function handleProfileClick() {
    if (profile == true) {history.pushState({}, '', '/'); setChannel(null); setMessage(null)}
    else {history.pushState({}, '', '/profile')}
    setProfile(!profile);
  }

  React.useEffect(() => {
    window.addEventListener('popstate', router);
    router();
    return () => {window.removeEventListener('popstate', router)};
  }, [loggedIn]);

  return profile ? <Profile onProfileClick={handleProfileClick} /> : 
  <Splash channel={channel} setChannel={setChannel} message={message} setMessage={setMessage} loggedIn={loggedIn} onLoginClick={handleLoginClick} onProfileClick={handleProfileClick} handleChannelClick={handleChannelClick} />
}

// -------------------------------- SPLASH ----------------------------------

function Splash({ channel, setChannel, message, setMessage, loggedIn, onLoginClick, onProfileClick, handleChannelClick }) {

  const [replyCounts, setReplyCounts] = React.useState(null);
  const [unreadCounts, setUnreadCounts] = React.useState(null);

  async function signUp() {
    const response = await fetch('/api/signup', {method: 'POST'});
    const data = await response.json();
    localStorage.setItem('andyrod_api_key', data['api_key']);
    onLoginClick();
  }

  async function login() {
    const username = document.querySelector('.username');
    const password = document.querySelector('.password');
    const response = await fetch('/api/login', {headers: {username: username.value, password: password.value}});
    if (response.status == 200) {
      const data = await response.json();
      localStorage.setItem('andyrod_api_key', data['api_key']);
      username.value = '';
      password.value = '';
      onLoginClick();
    }
  }

  function handleMessageClick(i) {
    setMessage(i);
  }

  function handleReplyClick(i) {
    if (i != null) {
      history.pushState({}, '', `/channel-${channel}/message-${i}`);
    }
  }

  function logOut() {
    localStorage.removeItem('andyrod_api_key');
    history.pushState({}, '', '/');
    onLoginClick();
  }

  async function getReplyCounts() {
    const header = {'api_key': localStorage.getItem('andyrod_api_key')}
    const response = await fetch('/api/getreplycounts', {headers: header});
    const data = await response.json();
    setReplyCounts(data);
  };

  async function getUnreadCounts() {
    const response = await fetch('/api/getunreadcounts', {headers: {'api_key': localStorage.getItem('andyrod_api_key')}});
    const data = await response.json();
    setUnreadCounts(data);
  };

  if (!loggedIn) {
    return (
      <div className="home">
      <h1>Welcome to BELAY</h1>
      <div className="container">
        <div className="sign-up">
          <button onClick={signUp}>Sign Up</button>
        </div>
        <div className="login">
          <label>Username: </label>
          <input className="username" />
          <label>Password: </label>
          <input className="password" type="password"/>
          <button onClick={login}>Login</button>
        </div>
      </div>
    </div>
    );
  }

  return (
    <div className="splash">
      <div className="splash-buttons">
        <button onClick={onProfileClick}>Profile</button>
        <button onClick={logOut}>Log Out</button>
      </div>
      <div className="splash-container">
        <div className="channels three">
          <h3 className="center">Channels</h3>
          <Channels onClick={handleChannelClick} unreadCounts={unreadCounts} getUnreadCounts={getUnreadCounts} replyClick={handleReplyClick} channel={channel}/>
        </div>
        <div className="channel two">
          <h3 className="center">Channel</h3>
          <Channel channel={channel} setChannel={setChannel} onClick={handleMessageClick} getReplyCounts={getReplyCounts} replyCounts={replyCounts} getUnreadCounts={getUnreadCounts} replyClick={handleReplyClick} setMessage={setMessage}/>
        </div>
        {message != null && (
        <div className="replies four">
          <h3 className="center">Replies</h3>
          <Replies channel={channel} message={message} getReplyCounts={getReplyCounts} setMessage={setMessage}/>
        </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------- CHANNELS ----------------------------------

function Channels({ onClick, unreadCounts, getUnreadCounts, replyClick, channel }) {
  const [channels, setChannels] = React.useState(null);
  const unreadIntervalRef = React.useRef(null);
  const channelIntervalRef = React.useRef(null);

  async function getChannels() {
    const response = await fetch('/api/getchannels', {headers: {'api_key': localStorage.getItem('andyrod_api_key')}});
    const data = await response.json();
    setChannels(data);
  };

  async function createChannel() {
    const name = document.querySelector('.name')
    const body = {name: name.value};
    const header = {'api_key': localStorage.getItem('andyrod_api_key'), 'Content-Type': 'application/json'}
    const response = await fetch('/api/createchannel', {method: 'POST', headers: header, body: JSON.stringify(body)});
    if (response.status == 200) {name.value = ''}
    getChannels();
  }

  React.useEffect(() => {
    getChannels();
    getUnreadCounts();
    unreadIntervalRef.current = setInterval(getUnreadCounts, 1000);
    channelIntervalRef.current = setInterval(getChannels, 1000);
    return () => {clearInterval(unreadIntervalRef.current); clearInterval(channelIntervalRef.current);};
  }
  , []);

  if (!channels || !unreadCounts || Object.keys(channels).length === 0) {
    return (
      <div className="create-channel">
        <input className="name" />
        <button onClick={createChannel}>Create</button>
      </div>
    )
  }

  const renderItems = channels[0].map((item, index) => {
    if (channel == index + 1) {var classes = "channel-name focus " + "channel" + String(index + 1);}
    else {var classes = "channel-name secondary " + "channel" + String(index + 1);}
    return <div className={classes} key={index + 1} onClick={() => {onClick(index + 1, true); getUnreadCounts(); replyClick(null)}}>{item[1]} {unreadCounts[index + 1] > 0 && unreadCounts[index + 1]}</div>
  });

  return (
    <div className="channels-container">
      {renderItems}
      <div className="create-channel">
        <input className="name" />
        <button onClick={createChannel}>Create</button>
      </div>
    </div>
  );
}

// -------------------------------- CHANNEL ----------------------------------

function Channel({ channel, setChannel, onClick, getReplyCounts, replyCounts, getUnreadCounts, replyClick, setMessage }) {
  const [messages, setMessages] = React.useState(null);
  const intervalRef = React.useRef(null);

  async function getMessages() {
    const header = {'api_key': localStorage.getItem('andyrod_api_key'), type: 'messages'}
    const response = await fetch('/api/getmessages/' + channel, {headers: header});
    const data = await response.json();
    setMessages(data);
    getUnreadCounts();
    getReplyCounts();
    const body = {channel_id: channel};
    const readHeader = {'api_key': localStorage.getItem('andyrod_api_key'), 'Content-Type': 'application/json'}
    const readResponse = await fetch('/api/updateread', {method: 'POST', headers: readHeader, body: JSON.stringify(body)});
  };

  async function createMessage() {
    const content = document.querySelector('.message');
    const body = {channel_id: channel, body: content.value, replies: null};
    const header = {'api_key': localStorage.getItem('andyrod_api_key'), 'Content-Type': 'application/json'};
    const response = await fetch('/api/createmessage', {method: 'POST', headers: header, body: JSON.stringify(body)});
    if (response.status == 200) {content.value = ''};
    getMessages();
  };

  async function createReaction(reaction, message) {
    const body = {reaction: reaction, message_id: message};
    const header = {'api_key': localStorage.getItem('andyrod_api_key'), 'Content-Type': 'application/json'}
    const response = await fetch('/api/createreaction', {method: 'POST', headers: header, body: JSON.stringify(body)});
    getMessages();
  };

  function goBack() {
    history.pushState({}, '', '/');
    setChannel(null);
    setMessage(null);
    document.querySelector('.channels').classList.remove('one');
  };

  React.useEffect(() => {
    if (channel != null) {
      getMessages();
      getReplyCounts();
      intervalRef.current = setInterval(getMessages, 500);
      document.querySelector('.channels').classList.add('one');
    }
    return () => {clearInterval(intervalRef.current)};
  }, [channel]);

  if (channel == null) {
    return
  } else if (!messages || !replyCounts || Object.keys(messages).length === 0) {
    return (
      <>
      <div>
        <input className="message" />
        <button onClick={createMessage}>Create</button>
      </div>
      <div><button onClick={goBack}>Return</button></div>
    </>
    );
  };

  const renderItems = messages[0].map((message) => {
    const [messageId, author, channelId, content, repliesTo, happyNames, sadNames, heartNames] = message;
    const hasHappyReactions = happyNames.length > 0;
    const hasSadReactions = sadNames.length > 0;
    const hasHeartReactions = heartNames.length > 0;
    const regex = new RegExp(`(http)?s?:?(\/\/[^"']*\.(?:png|jpg|jpeg|gif|png|svg))[^ ]*`)
    const imageUrl = content.match(regex);
    const display = content.replace(regex, '');

    return (
      <div className={'message-container message' + String(messageId)} key={messageId}>
        <div className="author">{author}</div>
        <div className="display">{display}</div>
        {imageUrl != null && <img src={imageUrl[0]} />}
        <div>
          <span className="italic">{messageId in replyCounts && (String(replyCounts[messageId]) + (`${replyCounts[messageId] === 1 ? ' Reply' : ' Replies'}`))}</span>
          {(messageId in replyCounts && (hasHappyReactions || hasSadReactions || hasHeartReactions)) && <span>&nbsp;&nbsp;&nbsp;</span>}
          {hasHappyReactions && <span className="happy reaction">&nbsp;{'(-:'}&nbsp;</span>}
          {(hasHappyReactions && (hasSadReactions || hasHeartReactions)) && <span>&nbsp;&nbsp;&nbsp;&nbsp;</span>}
          {hasSadReactions && <span className="sad reaction">&nbsp;{')-:'}&nbsp;</span>}
          {(hasSadReactions && hasHeartReactions) && <span>&nbsp;&nbsp;&nbsp;&nbsp;</span>}
          {hasHeartReactions && <span className="heart reaction">&nbsp;{'<3'}&nbsp;</span>}
          {hasHappyReactions && <span className="happy-hide italic">{happyNames.map((name) => <span key={messageId}> {name}</span>)}</span>}
          {hasSadReactions && <span className="sad-hide italic">{sadNames.map((name) => <span key={messageId}> {name}</span>)}</span>}
          {hasHeartReactions && <span className="heart-hide italic">{heartNames.map((name) => <span key={messageId}> {name}</span>)}</span>}
        </div>
        <div className="emoji-container">
          <button onClick={() => {replyClick(messageId); onClick(messageId)}}>{'Reply'}</button>
          <button onClick={() => createReaction('happy', messageId)}>{'(-:'}</button>
          <button onClick={() => createReaction('sad', messageId)}>{')-:'}</button>
          <button onClick={() => createReaction('heart', messageId)}>{'<3'}</button>
        </div>
      </div>
    );
  })

  return (
    <>
      {renderItems}
      <div className="create-message">
        <input className="message" />
        <button onClick={createMessage}>Create</button>
      </div>
      <div className="return"><button onClick={goBack}>Return</button></div>
    </>
  );
}

// -------------------------------- REPLIES ----------------------------------

function Replies({ channel, message, getReplyCounts, setMessage }) {
  const [replies, setReplies] = React.useState(null);
  const [replyInfo, setReplyInfo] = React.useState(null);
  const intervalRef = React.useRef(null);
  
  async function getReplies() {
    const header = {'api_key': localStorage.getItem('andyrod_api_key'), type: 'replies', message_id: message};
    const response = await fetch('/api/getmessages/' + channel, {headers: header});
    const data = await response.json();
    setReplies(data);
  };

  async function createReply() {
    const content = document.querySelector('.reply');
    const body = {channel_id: channel, body: content.value, replies: message};
    const header = {'api_key': localStorage.getItem('andyrod_api_key'), 'Content-Type': 'application/json'}
    const response = await fetch('/api/createmessage', {method: 'POST', headers: header, body: JSON.stringify(body)});
    if (response.status == 200) {content.value = ''}
    getReplies();
    getReplyCounts();
  }

  async function createReaction(reaction, message) {
    const body = {reaction: reaction, message_id: message};
    const header = {'api_key': localStorage.getItem('andyrod_api_key'), 'Content-Type': 'application/json'}
    const response = await fetch('/api/createreaction', {method: 'POST', headers: header, body: JSON.stringify(body)});
    getReplies();
  }

  function goBack() {
    history.pushState({}, '', `/channel-${channel}`);
    setMessage(null);
  }

  async function getReplyInfo() {
    const header = {'api_key': localStorage.getItem('andyrod_api_key'), message_id: message};
    const response = await fetch('/api/getparent', {headers: header});
    const data = await response.json();
    setReplyInfo(data);
  }

  React.useEffect(() => {
    if (message != null) {
      getReplies();
      getReplyInfo()
      intervalRef.current = setInterval(getReplies, 500);
    } return () => {clearInterval(intervalRef.current)};
  }, [message]);

  if (message == null || replyInfo == null) {
    return
  }

  const regex = new RegExp(`(http)?s?:?(\/\/[^"']*\.(?:png|jpg|jpeg|gif|png|svg))[^ ]*`)
  const mainUrl = replyInfo[0][0].match(regex);
  const main = replyInfo[0][0].replace(regex, '');

  if (!replies || Object.keys(replies).length === 0) {
    return (
      <>
        <div className="author">{replyInfo[0][1]}</div>
        <div>{main}</div>
        {mainUrl != null && <img src={mainUrl[0]} />}
        <input className="reply" />
        <button onClick={createReply}>Create</button>
        <div><button onClick={goBack}>Return</button></div>
      </>
    );
  }
  
  const renderItems = replies[0].map((reply) => {
    const [replyId, author, channelId, content, repliesTo, happyNames, sadNames, heartNames] = reply;
    const hasHappyReactions = happyNames.length > 0;
    const hasSadReactions = sadNames.length > 0;
    const hasHeartReactions = heartNames.length > 0;
    const imageUrl = content.match(regex);
    const display = content.replace(regex, '');

    return (
      <div key={replyId} className="message-container">
        <div className="author">{author}</div>
        <div>{display}</div>
        {imageUrl != null && <img src={imageUrl[0]} />}
        <div>
          {hasHappyReactions && <span className="happy reaction">&nbsp;&nbsp;{'(-:'}&nbsp;</span>}
          {(hasHappyReactions && (hasSadReactions || hasHeartReactions)) && <span>&nbsp;&nbsp;&nbsp;&nbsp;</span>}
          {hasSadReactions && <span className="sad reaction">&nbsp;{')-:'}&nbsp;</span>}
          {(hasSadReactions && hasHeartReactions) && <span>&nbsp;&nbsp;&nbsp;&nbsp;</span>}
          {hasHeartReactions && <span className="heart reaction">&nbsp;{'<3'}</span>}
          {hasHappyReactions && <span className="happy-hide italic">{happyNames.map((name) => <span key={replyId}> {name}</span>)}</span>}
          {hasSadReactions && <span className="sad-hide italic">{sadNames.map((name) => <span key={replyId}> {name}</span>)}</span>}
          {hasHeartReactions && <span className="heart-hide italic">{heartNames.map((name) => <span key={replyId}> {name}</span>)}</span>}
        </div>
        <div className="emoji-container">
          <button onClick={() => createReaction('happy', replyId)}>{'(-:'}</button>
          <button onClick={() => createReaction('sad', replyId)}>{')-:'}</button>
          <button onClick={() => createReaction('heart', replyId)}>{'<3'}</button>
        </div>
      </div>
    );
  })

  return (
    <>
      <div className="message-container">
        <div className="author">{replyInfo[0][1]}</div>
        <div>{main}</div>
        {mainUrl != null && <img src={mainUrl[0]} />}
      </div>
      {renderItems}
      <div className="create-reply">
        <input className="reply" />
        <button onClick={createReply}>Create</button>
      </div>
      <div className="Return"><button onClick={goBack}>Return</button></div>
    </>
  );
}

// -------------------------------- PROFILE ----------------------------------

function Profile({ onProfileClick }) {
  const [userInfo, setUserInfo] = React.useState(null);

  async function changeUsername() {
    const username = document.querySelector('.username');
    const header = {'api_key': localStorage.getItem('andyrod_api_key'), 'Content-Type': 'application/json'};
    const body = {username: username.value};
    const response = await fetch('/api/changeusername', {method: 'POST', headers: header, body: JSON.stringify(body)});
    if (response.status == 200) {username.value = ''}
  }

  async function changePassword() {
    const password = document.querySelector('.password');
    const header = {'api_key': localStorage.getItem('andyrod_api_key'), 'Content-Type': 'application/json'};
    const body = {password: password.value};
    const response = await fetch('/api/changepassword', {method: 'POST', headers: header, body: JSON.stringify(body)});
    if (response.status == 200) {password.value = ''}
  }

  async function getUserInfo() {
    const response = await fetch('/api/getuserinfo', {headers: {'api_key': localStorage.getItem('andyrod_api_key')}});
    const data = await response.json();
    setUserInfo(data);
  }

  React.useEffect(() => {
    getUserInfo();
  }, []);

  if (userInfo == null) {return}

  return (
    <div className="profile">
      <label>Username: </label>
      <input className="username" defaultValue={userInfo[1]} />
      <button onClick={changeUsername}>Change</button>
      <label>Password: </label>
      <input className="password" type="password" defaultValue={userInfo[2]}/>
      <button onClick={changePassword}>Change</button>
      <button onClick={onProfileClick}>Return</button>
    </div>
  );
}

// -------------------------------- SCRIPT ----------------------------------
  
const rootContainer = document.getElementById("root");
const root = ReactDOM.createRoot(rootContainer);
root.render(<Page />);
