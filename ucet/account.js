const $ = selector => document.querySelector(selector);
const form = $('#account-form');
const title = $('#account-title');
const status = $('#account-status');
const links = $('#account-links');
const sessionPanel = $('#account-session');
const email = form.elements.namedItem('email');
const password = form.elements.namedItem('password');
const submit = $('#account-submit');
const logout = $('#account-logout');

const redirect = new URL('/ucet/', location.origin).href;
const callback = new URLSearchParams(location.hash.slice(1));
let auth;
let mode = 'login';
let busy = false;

function show(next, message = '') {
  mode = next;
  const labels = {
    login: 'Přihlásit se',
    register: 'Vytvořit účet',
    reset: 'Poslat odkaz pro obnovu',
    recovery: 'Uložit nové heslo',
  };
  title.textContent = labels[next] || 'Zákaznický účet';
  status.textContent = message;
  form.hidden = next === 'session';
  sessionPanel.hidden = next !== 'session';
  links.hidden = next === 'session' || next === 'recovery';
  for (const button of links.querySelectorAll('button')) button.hidden = button.dataset.mode === next;
  $('#email-field').hidden = next === 'recovery';
  email.required = next !== 'recovery';
  $('#password-field').hidden = next === 'reset';
  password.required = next !== 'reset';
  password.minLength = next === 'register' || next === 'recovery' ? 8 : 0;
  password.autocomplete = next === 'register' || next === 'recovery' ? 'new-password' : 'current-password';
  password.value = '';
  submit.textContent = labels[next] || '';
}

function showSession(session, message = '') {
  $('#account-email').textContent = session.user.email || '';
  show('session', message);
}

function setBusy(next) {
  busy = next;
  for (const control of [email, password, submit, logout, ...links.querySelectorAll('button')]) control.disabled = next;
}

function errorMessage(error) {
  const messages = {
    email_not_confirmed: 'Nejdřív potvrďte e-mail odkazem z doručené zprávy.',
    invalid_credentials: 'E-mail nebo heslo nesouhlasí.',
    weak_password: 'Zvolte silnější heslo s alespoň 8 znaky.',
    same_password: 'Zvolte jiné heslo než dosud.',
    over_email_send_rate_limit: 'Před dalším odesláním chvíli počkejte.',
    otp_expired: 'Platnost odkazu vypršela. Vyžádejte si nový odkaz.',
  };
  if (error?.status === 429) return 'Příliš mnoho pokusů. Zkuste to za chvíli.';
  return messages[error?.code] || 'Požadavek se nepodařilo dokončit. Zkuste to znovu.';
}

function loadClient() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.102.0/dist/umd/supabase.js';
    script.integrity = 'sha384-poKfwTwdwtKSNytBl3naRZbL6oWsW0sXebHBBcIdv25HCh9elYfWO0B7QjfL8yZq';
    script.crossOrigin = 'anonymous';
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
}

async function start() {
  const response = await fetch('/auth-config.json', {cache: 'no-cache'});
  if (!response.ok) throw new Error();
  const config = await response.json();
  if (!config.url && !config.publishableKey) return;
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.url) || !/^sb_publishable_[a-zA-Z0-9_-]+$/.test(config.publishableKey)) throw new Error();
  await loadClient();
  auth = globalThis.supabase.createClient(config.url, config.publishableKey, {
    auth: {flowType: 'implicit', detectSessionInUrl: true},
  }).auth;

  let recoverySession = false;
  auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY' && session) {
      recoverySession = true;
      show('recovery', 'Zadejte nové heslo.');
    }
    if (event === 'SIGNED_OUT' && mode === 'session') show('login');
  });
  const {data, error} = await auth.getSession();
  if (recoverySession || (callback.get('type') === 'recovery' && callback.has('access_token') && data.session)) {
    show('recovery', 'Zadejte nové heslo.');
  } else if (callback.has('error') || new URLSearchParams(location.search).has('error')) {
    history.replaceState(null, '', redirect);
    show('login', 'Odkaz se nepodařilo ověřit nebo už vypršel.');
  } else if (error) {
    show('login', errorMessage(error));
  } else if (data.session) {
    showSession(data.session);
  } else {
    show('login');
  }
}

links.addEventListener('click', event => {
  const button = event.target.closest('button[data-mode]');
  if (!button || busy) return;
  show(button.dataset.mode);
  email.focus();
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!auth || busy) return;
  const address = email.value.trim();
  const secret = password.value;
  setBusy(true);
  try {
    if (mode === 'register') {
      const {error} = await auth.signUp({email:address, password:secret, options:{emailRedirectTo:redirect}});
      if (error) throw error;
      show('login', 'Pokud lze pro tuto adresu založit účet, přijde vám odkaz k potvrzení e-mailu.');
    } else if (mode === 'reset') {
      const {error} = await auth.resetPasswordForEmail(address, {redirectTo:redirect});
      if (error) throw error;
      show('login', 'Pokud účet existuje, pošleme vám odkaz pro nastavení nového hesla.');
    } else if (mode === 'recovery') {
      const {data, error} = await auth.updateUser({password:secret});
      if (error) throw error;
      showSession({user:data.user}, 'Nové heslo je uložené.');
    } else {
      const {data, error} = await auth.signInWithPassword({email:address, password:secret});
      if (error) throw error;
      showSession(data.session);
    }
  } catch (error) {
    status.textContent = errorMessage(error);
  } finally {
    setBusy(false);
  }
});

logout.addEventListener('click', async () => {
  if (busy) return;
  setBusy(true);
  try {
    const {error} = await auth.signOut({scope:'local'});
    if (error) throw error;
    show('login', 'Jste odhlášení.');
  } catch (error) {
    status.textContent = errorMessage(error);
  } finally {
    setBusy(false);
  }
});
start().catch(() => { status.textContent = 'Zákaznický účet se nepodařilo načíst. Zkuste stránku obnovit.'; });
