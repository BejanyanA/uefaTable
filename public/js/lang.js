const langMap = {
  en: {
    login: "Login",
    register: "Registration",
    registerBtn: "Sign Up",
    registerSubmit: "Submit",
    email: "Email",
    password: "Password",
    confirmPassword: "Confirm Password",
    username: "Username",
    required: "This field is required",
    invalidEmail: "Invalid email format",
    invalidPassword: "Password must be at least 8 characters, include uppercase, lowercase, number, and special character",
    mismatch: "Passwords do not match",
    shortUsername: "Username must be at least 3 characters"
  },
  am: {
    login: "Մուտք",
    register: "Գրանցվել",
    registerBtn: "Գրանցվել",
    registerSubmit: "Հաստատել",
    email: "Էլ․ հասցե",
    password: "Գաղտնաբառ",
    confirmPassword: "Հաստատել գաղտնաբառը",
    username: "Օգտանուն",
    required: "Այս դաշտը պարտադիր է",
    invalidEmail: "Սխալ էլ․ հասցե",
    invalidPassword: "Գաղտնաբառը պետք է լինի առնվազն 8 նիշ, պարունակի մեծատառ, փոքրատառ, թիվ և հատուկ նիշ",
    mismatch: "Գաղտնաբառերը չեն համընկնում",
    shortUsername: "Օգտանունը պետք է պարունակի առնվազն 3 նիշ"
  }
};

function getLangFromURL() {
  const params = new URLSearchParams(window.location.search);
  const lang = params.get("lang");
  return langMap[lang] ? lang : "en";
}

let currentLang = getLangFromURL();

function updateURLWithLang(lang) {
  const url = new URL(window.location);
  url.searchParams.set("lang", lang);
  window.history.replaceState(null, "", url);
}

function changeLang(lang) {
  currentLang = lang;
  updateURLWithLang(lang);

  const t = langMap[lang];

  document.getElementById("loginBtn").innerText = t.login;
  document.getElementById("registerBtn").innerText = t.registerBtn;
  document.getElementById("loginTitle").innerText = t.login;
  document.getElementById("registerTitle").innerText = t.register;
  document.getElementById("loginEmail").placeholder = t.email;
  document.getElementById("loginPassword").placeholder = t.password;
  document.getElementById("loginSubmit").innerText = t.login;
  document.getElementById("regUsername").placeholder = t.username;
  document.getElementById("regEmail").placeholder = t.email;
  document.getElementById("regPassword").placeholder = t.password;
  document.getElementById("regConfirmPassword").placeholder = t.confirmPassword;
  document.getElementById("registerSubmit").innerText = t.registerSubmit;

  const flag = document.getElementById("langTrigger");
  if (flag) flag.src = `assets/${lang}.svg`;
}

window.changeLang = changeLang;
window.langMap = langMap;
window.currentLang = currentLang;